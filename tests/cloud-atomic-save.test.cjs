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
  console,Date,Math,JSON,Promise,setTimeout:fn=>fn(),clearTimeout(){},globalThis:null,
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

test('migration enforces authenticated atomic writes',()=>{
 const sql=fs.readFileSync(path.join(root,'supabase/migrations/202609280001_atomic_asset_os_state.sql'),'utf8');
 assert.match(sql,/select s\.revision[\s\S]*for update/);
 assert.match(sql,/v_user_id uuid := auth\.uid\(\)/);
 assert.match(sql,/v_last_request_id = p_request_id/);
 assert.match(sql,/coalesce\(p_expected_revision, 0\) <> v_current_revision/);
 assert.match(sql,/revoke insert, update, delete on table public\.asset_os_state from authenticated/);
 assert.match(sql,/grant execute on function public\.save_asset_os_state[\s\S]*to authenticated/);
});
