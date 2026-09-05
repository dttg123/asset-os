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
  accountMetrics:()=>({value:3388142,cost:4556261,cash:26817,holdingsValue:3361325,profit:-1194936,rate:-26.23,holdings:[]}),
  policy:kind=>kind==='isa'?{name:'현행 ISA',verifiedAt:'2026-07-30',annualLimit:20000000,generalExemption:2000000,lowIncomeExemption:4000000,farmerExemption:4000000,taxRate:.099,mandatoryYears:3}:{name:kind==='irp'?'현행 IRP':'현행 연금저축',verifiedAt:'2026-07-30',annualContributionLimit:18000000,annualTaxCreditLimit:6000000,combinedTaxCreditLimit:9000000,taxCreditRate:.132,riskyAssetLimit:.7},
  annualContributionTotal:()=>0,
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
  pensionRiskMetrics:()=>({risky:4823025,unknown:0,ratio:67.57,maxRatio:67.57,limit:70,classificationComplete:true}),
  Blob:class{},
  File:class{},
  navigator:{},
  URL:{},
  document:{},
  localYmd:()=>'',
  businessYear:()=>2026,
  settingPersisted:{},
  persist:()=>true,
  toast:()=>{},
  $:()=>null,
  $$:()=>[]
};
vm.createContext(context);
const source=fs.readFileSync(path.resolve(__dirname,'..','ai-strategy.js'),'utf8');
vm.runInContext(`${source}\nthis.__buildAiStrategyPayload=buildAiStrategyPayload;`,context);
const payload=context.__buildAiStrategyPayload('buy',3000000,'new_money');

assert.equal(payload.request.additionalInvestmentWon,3000000);
assert.equal(payload.isa.combined.value,3388142);
assert.equal(payload.isa.combined.cost,4556261);
assert.equal(payload.isa.combined.profit,-1194936);
assert.equal(payload.format,'asset-os-ai-strategy-v2');
assert.equal(payload.pensionSavings.combined.value,41533833);
assert.equal(payload.combinedPlan.projection.expectedAssetsAtRetirement,1311070000);
assert.equal(payload.irp.risk.confirmedRatio,67.57);
assert.equal(payload.dataQuality.ready,true);
assert.match(payload.request.prompt,/국제 정세/);
assert.match(payload.request.prompt,/ISA를 별도로/);
assert.match(payload.request.prompt,/연금저축을 별도로/);
assert.match(payload.request.prompt,/IRP는 위험자산 한도/);
assert.match(payload.request.prompt,/앱이나 데이터 구조를 평가하는 보고서가 아니라/);
const json=JSON.stringify(payload);
for(const forbidden of ['accountNo','accessToken','refreshToken','appSecret','dttg123@gmail.com'])assert.doesNotMatch(json,new RegExp(forbidden,'i'));

console.log('AI strategy payload tests: PASS');
