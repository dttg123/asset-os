'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const calls=[];
let renders=0;
const state={brokerKis:{connections:{pension:{accountId:'ps-main',lastSyncAt:'2026-08-07T00:00:00Z'},irp:{accountId:'irp-main',lastSyncAt:'2026-09-04T00:05:00Z'}}}};
const accounts=[{id:'ps-main',kind:'pension',status:'active'},{id:'irp-main',kind:'irp',status:'active'}];
const context=vm.createContext({
 console,Date,Promise,String,Number,Array,Set,Math,state,
 pensionStore:()=>({accounts}),
 brokerKisClient:{authState:()=>({signedIn:true}),sync:async(action,kind,id,range)=>{calls.push({action,kind,id,range});return{ok:true}}},
 brokerKisDate:value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?String(value):'',
 localYmd:value=>{if(!value)return'2026-09-04';const d=new Date(value);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`},
 renderKeepingScroll:()=>{renders++},
 $:()=>null,$$:()=>[],toast:()=>{},openSheet:()=>{},setTimeout:()=>0,FormData
});
vm.runInContext(fs.readFileSync('ui-settings.js','utf8'),context,{filename:'ui-settings.js'});

const settingsSource=fs.readFileSync('ui-settings.js','utf8');
const bootSource=fs.readFileSync('boot.js','utf8');
const renderSource=fs.readFileSync('ui-render.js','utf8');
const isaQuoteSource=fs.readFileSync('isa-quotes.js','utf8');
assert.doesNotMatch(settingsSource,/KIS_AUTO_REFRESH_MS|kisAutoRefreshDue|maybeAutoRefreshBrokerKis/);
assert.doesNotMatch(bootSource,/visibilitychange[^\n]*Refresh/);
assert.doesNotMatch(renderSource,/maybeAutoRefresh/);
assert.doesNotMatch(isaQuoteSource,/maybeAutoRefreshIsaQuotes|ISA_QUOTE_REFRESH_MS/);

(async()=>{
 const result=await vm.runInContext('refreshBrokerKisManually(["pension"])',context);
 assert.equal(result.ok,true);assert.equal(result.updated,1);assert.equal(calls.length,3);
 assert.deepEqual(calls.map(x=>x.action),['balance','orders','rights']);assert.equal(renders,1);
 calls.length=0;state.brokerKis.connections.pension.orderSyncThrough='2026-06-01';
 const catchup=await vm.runInContext('runKisCurrentSync("pension","ps-main")',context);
 assert.equal(catchup.ok,true);assert.deepEqual(calls.map(x=>x.action),['balance','orders','orders','orders','orders','rights']);
 const ranges=JSON.parse(JSON.stringify(calls.filter(x=>x.action==='orders').map(x=>x.range)));
 assert.deepEqual(ranges,[{from:'2026-05-30',to:'2026-06-29'},{from:'2026-06-30',to:'2026-07-30'},{from:'2026-07-31',to:'2026-08-30'},{from:'2026-08-31',to:'2026-09-04'}]);
 console.log('kis manual refresh tests: PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
