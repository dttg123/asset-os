'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const requests=[];let failThirdOrder=true;let toastMessage='';
const elements={
 '[data-kis-account="pension"]':{value:'ps-main'},
 '[data-kis-history-start="pension"]':{value:'2026-06-01'},
};
const context=vm.createContext({
 console,Date,FormData,Promise,String,Number,Set,Map,URL,encodeURIComponent,
 state:{},window:{},
 $:selector=>elements[selector]||null,$$:()=>[],
 localYmd:value=>value instanceof Date?value.toISOString().slice(0,10):'2026-09-03',
 recordToast:value=>{toastMessage=String(value)},setTimeout:fn=>{fn();return 0},clearTimeout:()=>{},
 escapeHtml:value=>String(value??''),formatDateTime:value=>value,
 pensionStore:()=>({accounts:[]}),syncBrokerKisSessionFromCloud:()=>false,openSheet:()=>{},
 brokerKisClient:{
  authState:()=>({configured:true,signedIn:true}),signOut:()=>({ok:true}),
  sync:async(action,kind,accountId,range)=>{
   requests.push({action,kind,accountId,range:{...range}});
   if(action==='orders'&&requests.filter(x=>x.action==='orders').length===3&&failThirdOrder){failThirdOrder=false;return{ok:false,error:'NETWORK'}}
   return{ok:true,inserted:action==='balance'?0:1,updated:0}
  }
 }
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','broker-kis.js'),'utf8'),context,{filename:'broker-kis.js'});
vm.runInContext('state.brokerKis=brokerKisEmptyStore();window.__assetOS={brokerKis:{beginHistory:input=>brokerKisBeginHistory(state.brokerKis,input),updateHistory:input=>brokerKisUpdateHistory(state.brokerKis,input)}}',context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','ui-settings.js'),'utf8'),context,{filename:'ui-settings.js'});
vm.runInContext('openKisSettings=()=>{};toast=value=>recordToast(value)',context);

(async()=>{
 const longRanges=vm.runInContext(`(()=>{const out=[];let cursor='2010-01-01';while(cursor<='2026-09-03'){const range=kisHistoryChunk(cursor,'2026-09-03',31);out.push(range);cursor=kisDateAddDays(range.to,1)}return out})()`,context);
 assert.equal(longRanges[0].from,'2010-01-01');assert.equal(longRanges.at(-1).to,'2026-09-03');
 for(let i=1;i<longRanges.length;i++)assert.equal(longRanges[i].from,vm.runInContext(`kisDateAddDays('${longRanges[i-1].to}',1)`,context),'장기 구간 사이에 누락·중복 날짜가 생기면 안 된다');

 await vm.runInContext('syncKisHistory("pension")',context);
 let history=JSON.parse(JSON.stringify(context.state.brokerKis.history.pension));
 assert.equal(history.status,'paused');
 assert.equal(history.orderThrough,'2026-08-01','실패 직전까지 완료된 31일 구간을 저장해야 한다');
 assert.match(toastMessage,/다음 구간부터 다시 이어집니다/);

 await vm.runInContext('syncKisHistory("pension")',context);
 history=JSON.parse(JSON.stringify(context.state.brokerKis.history.pension));
 assert.equal(history.status,'complete');
 assert.equal(history.orderThrough,'2026-09-03');
 assert.equal(history.rightsThrough,'2026-09-03');
 const orderRanges=requests.filter(x=>x.action==='orders').map(x=>x.range);
 assert.deepEqual(orderRanges,[
  {from:'2026-06-01',to:'2026-07-01'},
  {from:'2026-07-02',to:'2026-08-01'},
  {from:'2026-08-02',to:'2026-09-01'},
  {from:'2026-08-02',to:'2026-09-01'},
  {from:'2026-09-02',to:'2026-09-03'},
 ]);
 assert.deepEqual(requests.filter(x=>x.action==='rights').map(x=>x.range),[{from:'2026-06-01',to:'2026-09-03'}]);
 assert.match(toastMessage,/과거자료 저장 완료/);
 console.log('kis history backfill tests: PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
