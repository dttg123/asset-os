'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const context={
  console,
  state:{accounts:[{id:'isa-1',name:'나무 ISA',broker:'나무',type:'brokerage',status:'active',holdings:[],transactions:[],assetSnapshots:[]}],brokerKis:{}},
  setting:()=>({aiStrategy:{}}),
  isCurrentAccount:a=>a.status==='active',
  accountMetrics:()=>({value:3388142,cost:4556261,cash:26817,profit:-1194936,rate:-26.23,holdings:[]}),
  holdingCostValue:()=>0,
  txDate:t=>t.date||'',
  pensionAssetMetrics:()=>({value:41533833,cost:38786929,cash:0,profit:2746904,rate:7.08}),
  pensionProjection:()=>({retirementAge:65,currentAge:31,monthly:750000,annual:6,inflation:3,future:1311070000,monthlyPension:3280000}),
  pensionStore:()=>({accounts:[],transactions:[],assetSnapshots:[]}),
  pensionAccountView:()=>({kis:false,total:0,cash:0,holdingValue:0,unallocated:0,holdings:[]}),
  pensionHoldingValue:()=>0,
  pensionHoldingCost:()=>0,
  centralPensionContributionRows:()=>[],
  pensionAccount:()=>null,
  pensionHoldingById:()=>null,
  brokerKisVisibleOrders:()=>[],
  pensionIncomeRecords:()=>[],
  Blob:class{},
  File:class{},
  navigator:{},
  URL:{},
  document:{},
  localYmd:()=>'',
  settingPersisted:{},
  persist:()=>true,
  toast:()=>{},
  $:()=>null,
  $$:()=>[]
};
vm.createContext(context);
const source=fs.readFileSync(path.resolve(__dirname,'..','ai-strategy.js'),'utf8');
vm.runInContext(`${source}\nthis.__buildAiStrategyPayload=buildAiStrategyPayload;`,context);
const payload=context.__buildAiStrategyPayload('buy',3000000);

assert.equal(payload.request.additionalInvestmentWon,3000000);
assert.equal(payload.isa.combined.value,3388142);
assert.equal(payload.isa.combined.cost,4556261);
assert.equal(payload.isa.combined.profit,-1194936);
assert.equal(payload.pension.combined.value,41533833);
assert.equal(payload.pension.projection.expectedAssetsAtRetirement,1311070000);
assert.match(payload.request.prompt,/추가매수, 분할매수, 대기/);
assert.match(payload.request.prompt,/ISA·연금저축·IRP별 투입금액/);
const json=JSON.stringify(payload);
for(const forbidden of ['accountNo','accessToken','refreshToken','appSecret','dttg123@gmail.com'])assert.doesNotMatch(json,new RegExp(forbidden,'i'));

console.log('AI strategy payload tests: PASS');
