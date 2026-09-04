'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const calls=[];
let renders=0;
const state={brokerKis:{connections:{pension:{accountId:'ps-main',lastSyncAt:''},irp:{accountId:'irp-main',lastSyncAt:'2026-09-04T00:05:00Z'}}}};
const accounts=[{id:'ps-main',kind:'pension',status:'active'},{id:'irp-main',kind:'irp',status:'active'}];
const context=vm.createContext({
 console,Date,Promise,String,Number,Array,Set,Math,state,
 pensionStore:()=>({accounts}),
 brokerKisClient:{authState:()=>({signedIn:true}),sync:async(action,kind,id,range)=>{calls.push({action,kind,id,range});return{ok:true}}},
 localYmd:()=> '2026-09-04',
 renderKeepingScroll:()=>{renders++},
 $:()=>null,$$:()=>[],toast:()=>{},openSheet:()=>{},setTimeout:()=>0,FormData
});
vm.runInContext(fs.readFileSync('ui-settings.js','utf8'),context,{filename:'ui-settings.js'});

assert.equal(vm.runInContext('KIS_AUTO_REFRESH_MS',context),600000);
assert.equal(vm.runInContext('kisAutoRefreshDue("pension",Date.parse("2026-09-04T00:10:00Z"))',context),true);
assert.equal(vm.runInContext('kisAutoRefreshDue("irp",Date.parse("2026-09-04T00:14:59Z"))',context),false);
assert.equal(vm.runInContext('kisAutoRefreshDue("irp",Date.parse("2026-09-04T00:15:00Z"))',context),true);

(async()=>{
 const result=await vm.runInContext('maybeAutoRefreshBrokerKis(false,["pension"])',context);
 assert.equal(result.ok,true);assert.equal(result.updated,1);assert.equal(calls.length,3);
 assert.deepEqual(calls.map(x=>x.action),['balance','orders','rights']);assert.equal(renders,1);
 console.log('kis auto refresh tests: PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
