'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const policySource=fs.readFileSync(path.join(root,'src/domain/cloud-state-policy.js'),'utf8');
const contractSource=fs.readFileSync(path.join(root,'src/storage/cloud-save-contract.js'),'utf8');
const source=fs.readFileSync(path.join(root,'supabase-sync.js'),'utf8');

function client(database,id){
 const elements=new Map();
 const element=key=>{if(!elements.has(key))elements.set(key,{hidden:false,disabled:false,textContent:'',className:'',classList:{add(){},remove(){}}});return elements.get(key)};
 const context=vm.createContext({
  console,Date,Math,JSON,Promise,URLSearchParams,setTimeout:fn=>fn(),clearTimeout(){},globalThis:null,
  QA_MODE:false,SCHEMA_VERSION:21,APP_VERSION:'v0.6.7',APP_ENV:'live',KEY:`asset-${id}`,BACKUP_FORMAT:'asset-os-backup-v1',
  seed:{accounts:[]},state:{accounts:[]},clone:value=>JSON.parse(JSON.stringify(value)),normalizeState:value=>value,
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}},storeRecoveryCopy(){},pruneRecoveryKeys(){},render(){},toast(){},formatDateTime:value=>value,localYmd:()=> '2026-09-28',
  createBackupZipBytes:()=>new Uint8Array([1]),downloadBytes(){},document:{documentElement:{classList:{add(){},remove(){}}}},location:{hash:'#/home',search:'',pathname:'/'},history:{replaceState(){}},window:{},
  $:selector=>['#assetAuthGate','#assetAuthButton','#assetAuthStatus','#assetAuthConflict'].includes(selector)?element(selector):null
 });
 context.globalThis=context;
 vm.runInContext(contractSource,context,{filename:'cloud-save-contract.js'});
 vm.runInContext(policySource,context,{filename:'cloud-state-policy.js'});
 vm.runInContext(source,context,{filename:'supabase-sync.js'});
 const rpc=async(_name,args)=>{
  if(database.lastRequestId===args.p_request_id)return{data:[{outcome:'saved',new_revision:database.revision,saved_at:'2026-09-28T00:00:00Z'}],error:null};
  if(Number(args.p_expected_revision)!==database.revision)return{data:[{outcome:'conflict',new_revision:database.revision,saved_at:'2026-09-28T00:00:00Z'}],error:null};
  database.revision+=1;database.payload=args.p_payload;database.lastRequestId=args.p_request_id;
  if(database.failAfterCommit){database.failAfterCommit=false;return{data:null,error:{message:'network response lost'}}}
  return{data:[{outcome:'saved',new_revision:database.revision,saved_at:'2026-09-28T00:00:00Z'}],error:null};
 };
 context.__rpc=rpc;
 vm.runInContext(`assetSupabaseClient={rpc:__rpc};assetSupabaseSession={user:{id:'${id}'}};cloudBaseRevision=1;cloudSyncBusy=false`,context);
 return context;
}

test('same-revision clients cannot silently overwrite each other',async()=>{
 const database={revision:1,lastRequestId:'',payload:null,failAfterCommit:false};
 const phone=client(database,'owner'),pc=client(database,'owner');
 phone.__envelope={savedAt:'2026-09-28T01:00:00Z',data:{accounts:[{id:'phone'}]}};
 pc.__envelope={savedAt:'2026-09-28T01:00:01Z',data:{accounts:[{id:'pc'}]}};
 assert.equal(await vm.runInContext('cloudPushState(__envelope)',phone),true);
 assert.equal(database.revision,2);
 assert.equal(await vm.runInContext('cloudPushState(__envelope)',pc),false);
 assert.equal(vm.runInContext('cloudSyncStatus',pc),'동기화 충돌 확인 필요');
 assert.equal(database.payload.data.accounts[0].id,'phone');
});

test('a lost response retries the same request without a second revision',async()=>{
 const database={revision:1,lastRequestId:'',payload:null,failAfterCommit:true};
 const phone=client(database,'owner');phone.__envelope={savedAt:'2026-09-28T01:00:00Z',data:{accounts:[{id:'phone'}]}};
 assert.equal(await vm.runInContext('cloudPushState(__envelope)',phone),false);
 assert.equal(database.revision,2,'first request committed before the response was lost');
 assert.equal(await vm.runInContext('cloudPushState(__envelope)',phone),true);
 assert.equal(database.revision,2,'idempotent retry must not increment twice');
});

test('conflict pull cancels a stale busy save before applying the remote state',async()=>{
 const database={revision:2,lastRequestId:'other-session',payload:{savedAt:'2026-09-28T00:00:00Z',data:{accounts:[]}},failAfterCommit:false};
 const stale=client(database,'owner');
 vm.runInContext(`cloudSyncBusy=true;cloudPushPending=true;cloudSyncTimer=99;cloudPendingWrite={requestId:'stale'};__pullForce='';__unlocked=0;clearTimeout=id=>{__cleared=id};cloudReconcileState=async force=>{__pullForce=force;return true};assetAuthGateUnlock=()=>{__unlocked+=1}`,stale);
 assert.equal(await vm.runInContext('cloudResolveConflictPull()',stale),true);
 assert.equal(vm.runInContext('cloudSyncBusy',stale),false);
 assert.equal(vm.runInContext('cloudPushPending',stale),false);
 assert.equal(vm.runInContext('cloudSyncTimer',stale),0);
 assert.equal(vm.runInContext('cloudPendingWrite',stale),null);
 assert.equal(stale.__cleared,99);
 assert.equal(stale.__pullForce,'pull');
 assert.equal(stale.__unlocked,1);
});

test('conflict recovery hides the auth gate when the app was already open',()=>{
 const database={revision:2,lastRequestId:'',payload:null,failAfterCommit:false};
 const openApp=client(database,'owner');
 vm.runInContext(`assetAppUnlocked=true;$ ('#assetAuthGate').hidden=false;assetAuthGateUnlock()`,openApp);
 assert.equal(vm.runInContext(`$ ('#assetAuthGate').hidden`,openApp),true);
 assert.equal(vm.runInContext('assetAppUnlocked',openApp),true);
});

test('a signed-in device opens local data before a slow cloud check finishes',async()=>{
 const database={revision:2,lastRequestId:'',payload:null,failAfterCommit:false};
 const fast=client(database,'owner');
 vm.runInContext(`__unlocks=0;__resolved=false;initSupabaseCloud=async()=>true;cloudLocalEnvelope=()=>({stored:true,envelope:{savedAt:'2026-09-28T00:00:00Z',data:{accounts:[]}}});assetAuthGateUnlock=()=>{__unlocks+=1};cloudReconcileState=()=>new Promise(resolve=>{__finishCloud=()=>{__resolved=true;resolve(true)}})`,fast);
 const startup=vm.runInContext('startAssetAuthenticatedApp()',fast);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(fast.__unlocks,1,'local UI must unlock without waiting for the network');
 assert.equal(fast.__resolved,false,'cloud verification should still be running');
 fast.__finishCloud();
 assert.equal(await startup,true);
});

test('a background cloud failure keeps valid local data open',async()=>{
 const database={revision:2,lastRequestId:'',payload:null,failAfterCommit:false};
 const offline=client(database,'owner');
 vm.runInContext(`__unlocks=0;__gateModes=[];initSupabaseCloud=async()=>true;cloudLocalEnvelope=()=>({stored:true,envelope:{savedAt:'2026-09-28T00:00:00Z',data:{accounts:[]}}});assetAuthGateUnlock=()=>{__unlocks+=1};assetAuthGateState=mode=>{__gateModes.push(mode)};cloudReconcileState=async()=>{cloudSyncStatus='동기화 확인 실패';return false}`,offline);
 assert.equal(await vm.runInContext('startAssetAuthenticatedApp()',offline),false);
 assert.equal(offline.__unlocks,1);
 assert.equal(JSON.stringify(offline.__gateModes),JSON.stringify(['loading']),'a transient network failure must not relock a valid local ledger');
 assert.equal(vm.runInContext('cloudSyncStatus',offline),'오프라인 · 재확인 필요');
});

test('migration enforces authenticated atomic writes',()=>{
 const baseline=fs.readFileSync(path.join(root,'supabase/migrations/202609240001_prepare_asset_os_state.sql'),'utf8');
 const sql=fs.readFileSync(path.join(root,'supabase/migrations/202609280001_atomic_asset_os_state.sql'),'utf8');
 assert.match(baseline,/create table if not exists public\.asset_os_state/);
 assert.match(baseline,/enable row level security/);
 assert.match(baseline,/auth\.uid\(\)\) = user_id/);
 assert.match(sql,/select s\.revision[\s\S]*for update/);
 assert.match(sql,/v_user_id uuid := auth\.uid\(\)/);
 assert.match(sql,/v_last_request_id = p_request_id/);
 assert.match(sql,/coalesce\(p_expected_revision, 0\) <> v_current_revision/);
 assert.match(sql,/revoke insert, update, delete on table public\.asset_os_state from authenticated/);
 assert.match(sql,/grant execute on function public\.save_asset_os_state[\s\S]*to authenticated/);
 const pgTap=fs.readFileSync(path.join(root,'supabase/tests/asset_os_state_rls_test.sql'),'utf8');
 assert.match(pgTap,/has_table_privilege\('authenticated','public\.asset_os_state','SELECT'\)/);
 assert.match(pgTap,/not has_table_privilege\('authenticated','public\.asset_os_state','UPDATE'\)/);
 assert.match(pgTap,/not has_function_privilege\('anon','public\.save_asset_os_state/);
});
