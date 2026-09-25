-- RLS protects row access, but TRUNCATE is outside RLS and the application
-- never needs schema-changing table privileges from browser roles.
revoke truncate, references, trigger on table public.asset_os_state from anon, authenticated;

-- Keep the browser role on the minimum CRUD surface used by Supabase sync.
revoke all on table public.asset_os_state from authenticated;
grant select, insert, update, delete on table public.asset_os_state to authenticated;

-- The token cache is server-only. The Edge Function needs only these three
-- operations through service_role; token deletion and DDL-like privileges are
-- deliberately unavailable.
revoke all on table public.kis_token_cache from anon, authenticated;
revoke truncate, references, trigger, delete on table public.kis_token_cache from service_role;
grant select, insert, update on table public.kis_token_cache to service_role;
