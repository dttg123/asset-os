-- Make a clean QA project reproducible without changing an existing project.
-- Existing columns and rows are preserved because every operation is additive
-- or idempotent.
create table if not exists public.asset_os_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{"data":{}}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.asset_os_state enable row level security;

drop policy if exists asset_os_state_select_own on public.asset_os_state;
create policy asset_os_state_select_own
on public.asset_os_state
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.asset_os_state from anon, authenticated;
grant select on table public.asset_os_state to authenticated;
