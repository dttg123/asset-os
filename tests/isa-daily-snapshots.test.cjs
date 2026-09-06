'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

let today='2026-09-04';
const context=vm.createContext({
 console,Date,Math,Number,String,Array,Map,Set,JSON,
 localYmd:()=>today,
 isCurrentAccount:a=>a.status==='active',
 accountMetrics:a=>({cost:a.testCost,holdings:[{marketValue:a.testValue}]}),
 pensionAssetMetrics:kind=>kind==='irp'?{cost:300,value:330,cash:30,source:'manual'}:{cost:500,value:550,cash:50,source:'manual'}
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

vm.runInContext(`state={moduleVerification:{isa:false},accounts:[{id:'isa-unverified',status:'active',testCost:200,testValue:230,assetSnapshots:[]}]}`,context);
vm.runInContext('syncCurrentIsaSnapshots()',context);
assert.equal(vm.runInContext('state.accounts[0].assetSnapshots.length',context),1,'실제 현재자산이 있으면 과거 검산 플래그와 무관하게 스냅샷을 저장해야 한다');

today='2026-09-06';
vm.runInContext(`state={moduleVerification:{isa:true},accounts:[{id:'isa-manual',status:'active',testCost:300,testValue:350,assetSnapshots:[{date:'2026-09-06',cost:900,value:999,meta:{source:'manual-import'}}]}]}`,context);
vm.runInContext('syncCurrentIsaSnapshots()',context);
assert.equal(vm.runInContext('state.accounts[0].assetSnapshots.length',context),1,'같은 날짜의 수동 ISA 스냅샷 옆에 자동 중복을 만들면 안 된다');
assert.equal(vm.runInContext('state.accounts[0].assetSnapshots[0].value',context),999,'수동 ISA 스냅샷은 자동 저장이 덮어쓰면 안 된다');

vm.runInContext(`state={moduleVerification:{pension:true,irp:true},pension:{assetSnapshots:[{date:'2026-09-01',pension:{cost:900,value:999},irp:{cost:800,value:888},meta:{source:'manual-import'}}]}}`,context);
vm.runInContext('syncCurrentPensionSnapshot()',context);
assert.equal(vm.runInContext('state.pension.assetSnapshots.length',context),1,'같은 달의 수동 연금 스냅샷 옆에 자동 중복을 만들면 안 된다');
assert.equal(vm.runInContext('state.pension.assetSnapshots[0].pension.value',context),999,'수동 연금 스냅샷은 자동 저장이 덮어쓰면 안 된다');

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
