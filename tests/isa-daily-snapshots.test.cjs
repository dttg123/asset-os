'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

let today='2026-09-04';
const context=vm.createContext({
 console,Date,Math,Number,String,Array,Map,Set,JSON,
 localYmd:()=>today,
 isCurrentAccount:a=>a.status==='active',
 accountMetrics:a=>({cost:a.testCost,holdings:[{marketValue:a.testValue}]})
});
vm.runInContext(fs.readFileSync('store-state.js','utf8'),context,{filename:'store-state.js'});
vm.runInContext(`state={moduleVerification:{isa:true},accounts:[{id:'isa-main',status:'active',testCost:100,testValue:110,assetSnapshots:[]}]}`,context);
vm.runInContext('syncCurrentIsaSnapshots()',context);
vm.runInContext('state.accounts[0].testValue=115;syncCurrentIsaSnapshots()',context);
let rows=vm.runInContext('JSON.parse(JSON.stringify(state.accounts[0].assetSnapshots))',context);
assert.equal(rows.length,1,'같은 날짜의 ISA 스냅샷은 최신값으로 교체해야 한다');
assert.equal(rows[0].value,115);assert.equal(rows[0].meta.grain,'day');

today='2026-09-05';
vm.runInContext('state.accounts[0].testValue=120;syncCurrentIsaSnapshots()',context);
rows=vm.runInContext('JSON.parse(JSON.stringify(state.accounts[0].assetSnapshots))',context);
assert.equal(rows.length,2,'날짜가 바뀌면 ISA 일별 스냅샷을 추가해야 한다');

vm.runInContext(fs.readFileSync('chart-asset-analysis.js','utf8'),context,{filename:'chart-asset-analysis.js'});
const account={assetSnapshots:[
 {date:'2026-08-01',cost:100,value:101},{date:'2026-08-20',cost:100,value:105},
 {date:'2026-09-04',cost:100,value:115},{date:'2026-09-05',cost:100,value:120}
]};
context.testAccount=account;
assert.equal(vm.runInContext('isaAnalysisDisplayRows(testAccount,"3m").length',context),4,'3개월 그래프는 일별 기록을 유지해야 한다');
const monthly=vm.runInContext('JSON.parse(JSON.stringify(isaAnalysisDisplayRows(testAccount,"1y")))',context);
assert.equal(monthly.length,2,'1년 그래프는 월별 최신값으로 정리해야 한다');
assert.equal(monthly[0].value,105);assert.equal(monthly[1].value,120);
console.log('isa daily snapshot tests: PASS');
