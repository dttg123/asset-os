create or replace function public.save_asset_os_state(
  p_expected_revision bigint,
  p_payload jsonb,
  p_request_id uuid
)
returns table(outcome text, new_revision bigint, saved_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_revision bigint;
  v_last_request_id uuid;
  v_saved_at timestamptz;
  v_current_schema integer;
  v_count integer;
  v_max integer;
  v_min integer;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'REQUEST_ID_REQUIRED' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or not (p_payload ? 'data') then
    raise exception 'INVALID_ASSET_OS_PAYLOAD' using errcode = '22023';
  end if;


  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text,0));
  if coalesce((p_payload->>'schemaVersion')::integer,0)>=22 then
    if p_payload->>'encoding' is distinct from 'gzip-chunks-v1' or p_payload->>'requestId' is distinct from p_request_id::text or coalesce(p_payload->>'checksum','') !~ '^[a-f0-9]{64}$' or coalesce((p_payload->>'rawBytes')::bigint,0) not between 1 and 67108864 or coalesce((p_payload->>'chunkCount')::integer,0) not between 1 and 384 then raise exception 'INVALID_STORAGE_MANIFEST' using errcode='22023'; end if;
    select count(*),min(chunk_index),max(chunk_index) into v_count,v_min,v_max from public.asset_os_state_chunks where user_id=v_user_id and request_id=p_request_id;
    if v_count<>(p_payload->>'chunkCount')::integer or v_min<>0 or v_max<>v_count-1 then raise exception 'INCOMPLETE_STORAGE_CHUNKS' using errcode='22023';end if;
  end if;

  select s.revision, s.last_request_id, s.updated_at, coalesce((s.payload->>'schemaVersion')::integer,4)
    into v_current_revision, v_last_request_id, v_saved_at, v_current_schema
    from public.asset_os_state as s
   where s.user_id = v_user_id
   for update;

  if found then
    if v_current_schema>=22 and coalesce((p_payload->>'schemaVersion')::integer,0)<22 then raise exception 'APP_UPDATE_REQUIRED' using errcode='22023'; end if;
    -- A network retry with the same request id returns the original success
    -- without incrementing twice.
    if v_last_request_id = p_request_id then
      return query select 'saved'::text, v_current_revision, v_saved_at;
      return;
    end if;
    if coalesce(p_expected_revision, 0) <> v_current_revision then
      return query select 'conflict'::text, v_current_revision, v_saved_at;
      return;
    end if;

    update public.asset_os_state as s
       set previous_request_id = s.last_request_id,
           payload = p_payload,
           revision = s.revision + 1,
           last_request_id = p_request_id,
           updated_at = now()
     where s.user_id = v_user_id
     returning s.revision, s.updated_at into v_current_revision, v_saved_at;
    update public.asset_os_state_chunks set published_at=now() where user_id=v_user_id and request_id=p_request_id;
    delete from public.asset_os_state_chunks c where c.user_id=v_user_id and (c.published_at is not null or c.created_at<now()-interval '7 days') and c.request_id<>p_request_id and c.request_id is distinct from v_last_request_id;
    return query select 'saved'::text, v_current_revision, v_saved_at;
    return;
  end if;

  if coalesce(p_expected_revision, 0) <> 0 then
    return query select 'conflict'::text, 0::bigint, null::timestamptz;
    return;
  end if;

  insert into public.asset_os_state(user_id, payload, revision, last_request_id, updated_at)
  values(v_user_id, p_payload, 1, p_request_id, now())
  on conflict (user_id) do nothing
  returning revision, updated_at into v_current_revision, v_saved_at;

  if found then
    update public.asset_os_state_chunks set published_at=now() where user_id=v_user_id and request_id=p_request_id;
    return query select 'saved'::text, v_current_revision, v_saved_at;
  else
    select s.revision, s.updated_at
      into v_current_revision, v_saved_at
      from public.asset_os_state as s
     where s.user_id = v_user_id;
    return query select 'conflict'::text, v_current_revision, v_saved_at;
  end if;
end;
$$;

revoke all on function public.save_asset_os_state(bigint, jsonb, uuid) from public, anon;
grant execute on function public.save_asset_os_state(bigint, jsonb, uuid) to authenticated;
