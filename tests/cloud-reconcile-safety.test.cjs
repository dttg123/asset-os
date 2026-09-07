'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const clone=value=>JSON.parse(JSON.stringify(value));
const context=vm.createContext({
 console,Date,Promise,setTimeout:fn=>fn(),clearTimeout:()=>{},clone,
 SCHEMA_VERSION:20,APP_VERSION:'v0.6.4',APP_ENV:'live',KEY:'asset-test',seed:{accounts:[]},state:{accounts:[]},
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

 vm.runInContext(`cloudSyncBusy=false;cloudSyncStatus='동기화 확인 중';cloudLocalEnvelope=()=>({stored:true,envelope:{savedAt:'2026-09-02T03:00:00.000Z',data:{accounts:[{id:'kis',name:'연금저축',holdings:[{symbol:'ETF',quantity:3,price:1000}]}],pension:{accounts:[{id:'pension'}]},integrated:{ledger:[]}}}});cloudFetchStateRow=async()=>({row:{updated_at:'2026-09-02T03:00:00.000Z',payload:{savedAt:'2026-09-02T03:00:00.000Z',data:{integrated:{ledger:[]},pension:{accounts:[{id:'pension'}]},accounts:[{holdings:[{price:1000,quantity:3,symbol:'ETF'}],name:'연금저축',id:'kis'}]}}},error:null});__applied='';`,context);
 const reorderedJsonb=await vm.runInContext("cloudReconcileState()",context);
 assert.equal(reorderedJsonb,true,'KIS 저장 후 JSONB 키 순서가 바뀌어도 같은 원장으로 판정해야 한다');
 assert.equal(vm.runInContext("cloudSyncStatus",context),'동기화됨');assert.equal(context.__applied,'');
 assert.equal(vm.runInContext("cloudEnvelopeFingerprint({data:{b:{z:1,a:2},a:[{y:3,x:4}]}})===cloudEnvelopeFingerprint({data:{a:[{x:4,y:3}],b:{a:2,z:1}}})",context),true);

 vm.runInContext("cloudSyncStatus='동기화 충돌 확인 필요'",context);
 assert.match(vm.runInContext("cloudAuthGateMessage()",context),/동시에 변경/);
 vm.runInContext("cloudSyncStatus='동기화 오류'",context);
 assert.doesNotMatch(vm.runInContext("cloudAuthGateMessage()",context),/네트워크/);
 vm.runInContext("cloudSyncStatus='동기화 확인 실패'",context);
 assert.match(vm.runInContext("cloudAuthGateMessage()",context),/네트워크/);

 vm.runInContext(`cloudSyncBusy=false;cloudLocalEnvelope=()=>({stored:true,envelope:{savedAt:'2026-09-02T01:00:00.000Z',data:{accounts:[{id:'local'}],pension:{},integrated:{ledger:[]}}}});cloudFetchStateRow=async()=>({row:{updated_at:'2026-09-02T04:00:00.000Z',payload:{savedAt:'2026-09-02T04:00:00.000Z',data:{accounts:[],pension:{},integrated:{ledger:[]}}}},error:null});__applied='';`,context);
 const emptyRemote=await vm.runInContext("cloudReconcileState()",context);
 assert.equal(emptyRemote,false,'최신 시각의 빈 클라우드 자료가 의미 있는 로컬 원장을 덮으면 안 된다');assert.equal(context.__applied,'');
 console.log('cloud reconcile safety and KIS reload tests: PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
