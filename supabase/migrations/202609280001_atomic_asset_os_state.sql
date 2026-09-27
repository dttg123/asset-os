-- Every browser save goes through one transaction. A stale client can no
-- longer overwrite a newer revision after both clients read the same row.
alter table public.asset_os_state
  add column if not exists revision bigint not null default 1,
  add column if not exists last_request_id uuid;

alter table public.asset_os_state
  drop constraint if exists asset_os_state_revision_positive;
alter table public.asset_os_state
  add constraint asset_os_state_revision_positive check (revision >= 1);

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

  select s.revision, s.last_request_id, s.updated_at
    into v_current_revision, v_last_request_id, v_saved_at
    from public.asset_os_state as s
   where s.user_id = v_user_id
   for update;

  if found then
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
       set payload = p_payload,
           revision = s.revision + 1,
           last_request_id = p_request_id,
           updated_at = now()
     where s.user_id = v_user_id
     returning s.revision, s.updated_at into v_current_revision, v_saved_at;
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

-- Browser roles may read their RLS-protected row, but all writes must use the
-- revision-checking RPC above. The table owner/service role remains available
-- for migrations and recovery.
revoke insert, update, delete on table public.asset_os_state from authenticated;
grant select on table public.asset_os_state to authenticated;
