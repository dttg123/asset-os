begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

select has_table('public','asset_os_state','asset_os_state exists');
select has_column('public','asset_os_state','revision','revision exists');
select has_column('public','asset_os_state','last_request_id','request id exists');
select col_not_null('public','asset_os_state','revision','revision is required');
select ok((select relrowsecurity from pg_class where oid='public.asset_os_state'::regclass),'RLS is enabled');
select ok(has_table_privilege('authenticated','public.asset_os_state','SELECT'),'authenticated can read through RLS');
select ok(not has_table_privilege('authenticated','public.asset_os_state','INSERT'),'authenticated cannot insert directly');
select ok(not has_table_privilege('authenticated','public.asset_os_state','UPDATE'),'authenticated cannot update directly');
select ok(not has_table_privilege('authenticated','public.asset_os_state','DELETE'),'authenticated cannot delete directly');
select ok(has_function_privilege('authenticated','public.save_asset_os_state(bigint,jsonb,uuid)','EXECUTE'),'authenticated can call atomic save');
select ok(not has_function_privilege('anon','public.save_asset_os_state(bigint,jsonb,uuid)','EXECUTE'),'anon cannot call atomic save');
select ok(not has_table_privilege('authenticated','public.kis_token_cache','SELECT'),'browser cannot read KIS tokens');
select ok(not has_function_privilege('authenticated','public.claim_kis_token_refresh(text)','EXECUTE'),'browser cannot claim KIS token refresh');

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
select throws_ok(
  $$select * from public.save_asset_os_state(0,'{}'::jsonb,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)$$,
  '22023','INVALID_ASSET_OS_PAYLOAD','invalid payload is rejected'
);
reset role;

set local role anon;
select throws_ok(
  $$select * from public.save_asset_os_state(0,'{"data":{}}'::jsonb,'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)$$,
  '42501',null,'anonymous save is rejected'
);
reset role;

select * from finish();
rollback;
