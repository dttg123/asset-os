create or replace function public.stage_asset_os_state_chunk(p_request_id uuid,p_index integer,p_contents text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_user_id uuid:=auth.uid(); v_existing text; v_current uuid; v_previous uuid;
begin
 if v_user_id is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user_id::text,0));
 if p_request_id is null or p_index is null or p_index not between 0 and 383 or p_contents is null or octet_length(p_contents) not between 1 and 262144 or p_contents !~ '^[A-Za-z0-9+/=]+$' then raise exception 'INVALID_CHUNK' using errcode='22023';end if;
 if p_index=0 then
   delete from public.asset_os_state_chunks c where c.user_id=v_user_id and c.published_at is null and c.request_id<>p_request_id
    and c.request_id not in (select s.last_request_id from public.asset_os_state s where s.user_id=v_user_id and s.last_request_id is not null)
    and c.request_id not in (select s.previous_request_id from public.asset_os_state s where s.user_id=v_user_id and s.previous_request_id is not null)
    and c.request_id not in (select q.request_id from public.asset_os_state_chunks q where q.user_id=v_user_id and q.published_at is null and q.request_id<>p_request_id group by q.request_id order by max(q.created_at) desc limit 1);
 end if;
 insert into public.asset_os_state_chunks(user_id,request_id,chunk_index,contents) values(v_user_id,p_request_id,p_index,p_contents) on conflict do nothing;
 select contents into v_existing from public.asset_os_state_chunks where user_id=v_user_id and request_id=p_request_id and chunk_index=p_index;
 if v_existing is distinct from p_contents then raise exception 'CHUNK_ID_REUSED_WITH_DIFFERENT_CONTENT' using errcode='22023';end if;
 return true;
end $$;
revoke all on function public.stage_asset_os_state_chunk(uuid,integer,text) from public,anon;
grant execute on function public.stage_asset_os_state_chunk(uuid,integer,text) to authenticated;
