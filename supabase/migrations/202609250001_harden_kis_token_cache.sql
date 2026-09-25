create table if not exists public.kis_token_cache (
  account_type text primary key check (account_type in ('pension', 'irp')),
  access_token text not null default '',
  expires_at timestamptz not null default '1970-01-01 00:00:00+00',
  refreshing_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.kis_token_cache enable row level security;
revoke all on table public.kis_token_cache from anon, authenticated;

insert into public.kis_token_cache (account_type, access_token, expires_at, refreshing_until, updated_at)
values ('pension', '', '1970-01-01 00:00:00+00', null, now())
on conflict (account_type) do nothing;

create or replace function public.claim_kis_token_refresh(p_account_type text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed boolean := false;
begin
  if p_account_type not in ('pension', 'irp') then
    return false;
  end if;

  insert into public.kis_token_cache (
    account_type, access_token, expires_at, refreshing_until, updated_at
  ) values (
    p_account_type, '', '1970-01-01 00:00:00+00', now() + interval '30 seconds', now()
  )
  on conflict (account_type) do update
    set refreshing_until = excluded.refreshing_until,
        updated_at = excluded.updated_at
    where public.kis_token_cache.refreshing_until is null
       or public.kis_token_cache.refreshing_until < now()
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

revoke all on function public.claim_kis_token_refresh(text) from public, anon, authenticated;
grant execute on function public.claim_kis_token_refresh(text) to service_role;
