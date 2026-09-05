'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const clone=value=>JSON.parse(JSON.stringify(value));
const context=vm.createContext({
 console,Date,Promise,setTimeout:fn=>fn(),clearTimeout:()=>{},clone,
 SCHEMA_VERSION:20,APP_VERSION:'v0.5',APP_ENV:'live',KEY:'asset-test',seed:{accounts:[]},state:{accounts:[]},
 localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
 normalizeState:clone,pruneRecoveryKeys:()=>{},render:()=>{},toast:()=>{},formatDateTime:value=>value,
 $:()=>null,document:{documentElement:{classList:{add:()=>{},remove:()=>{}}}},location:{hash:'#/home'}
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','supabase-sync.js'),'utf8'),context,{filename:'supabase-sync.js'});

assert.equal(vm.runInContext("cloudDataHasMeaningfulRecords({accounts:[],pension:{},integrated:{ledger:[]}})",context),false);
assert.equal(vm.runInContext("cloudDataHasMeaningfulRecords({accounts:[{id:'isa'}],pension:{},integrated:{ledger:[]}})",context),true);

(async()=>{
 vm.runInContext(`assetSupabaseClient={};assetSupabaseSession={user:{id:'owner'}};cloudSyncBusy=false;cloudLocalEnvelope=()=>({stored:true,envelope:{savedAt:'2026-09-02T02:00:00Z',data:{accounts:[],pension:{},integrated:{ledger:[]}}}});cloudFetchStateRow=async()=>({row:{updated_at:'2026-09-02T01:00:00Z',payload:{savedAt:'2026-09-02T01:00:00Z',data:{accounts:[{id:'remote'}],pension:{},integrated:{ledger:[]}}}},error:null});cloudApplyRemoteEnvelope=payload=>{__applied=payload.data.accounts[0].id};`,context);
 const ok=await vm.runInContext("cloudReconcileState()",context);
 assert.equal(ok,true);
 assert.equal(context.__applied,'remote');
 vm.runInContext(`cloudSyncBusy=false;cloudLocalEnvelope=()=>({stored:true,envelope:{savedAt:'2026-09-02T03:00:00.000Z',data:{accounts:[{id:'local'}],pension:{},integrated:{ledger:[]}}}});cloudFetchStateRow=async()=>({row:{updated_at:'2026-09-02T03:00:00.000Z',payload:{savedAt:'2026-09-02T03:00:00.000Z',data:{accounts:[{id:'remote'}],pension:{},integrated:{ledger:[]}}}},error:null});__applied='';`,context);
 const conflict=await vm.runInContext("cloudReconcileState()",context);
 assert.equal(conflict,false,'같은 시각에 내용이 다른 저장본을 정상 동기화로 처리하면 안 된다');
 assert.equal(context.__applied,'','충돌 상태에서 어느 쪽도 자동으로 덮어쓰면 안 된다');
 vm.runInContext(`cloudSyncBusy=false;cloudLocalEnvelope=()=>({stored:true,envelope:{savedAt:'2026-09-02T01:00:00.000Z',data:{accounts:[{id:'local'}],pension:{},integrated:{ledger:[]}}}});cloudFetchStateRow=async()=>({row:{updated_at:'2026-09-02T04:00:00.000Z',payload:{savedAt:'2026-09-02T04:00:00.000Z',data:{accounts:[],pension:{},integrated:{ledger:[]}}}},error:null});__applied='';`,context);
 const emptyRemote=await vm.runInContext("cloudReconcileState()",context);
 assert.equal(emptyRemote,false,'최신 시각의 빈 클라우드 자료가 의미 있는 로컬 원장을 덮으면 안 된다');assert.equal(context.__applied,'');
 console.log('cloud reconcile safety tests: PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
