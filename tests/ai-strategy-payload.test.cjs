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

const preflightPayload=JSON.parse(JSON.stringify(payload));
preflightPayload.pensionSavings.accounts=[{source:'한국투자 조회',sync:{lastCompleteAt:new Date().toISOString(),lastError:''},summary:{componentDelta:500000,cashConfirmed:true,availableCash:0,cash:0}}];
const positiveOtherAsset=vm.runInContext('aiStrategyPreflight(__payload,3000000,"new_money")',Object.assign(context,{__payload:preflightPayload}));
assert.equal(positiveOtherAsset.ready,true,'정상적인 양수 기타자산은 AI 공유를 막으면 안 된다');
assert.match(positiveOtherAsset.warnings.join(' '),/기타자산/);
preflightPayload.pensionSavings.accounts[0].summary.componentDelta=-500000;
const negativeMismatch=vm.runInContext('aiStrategyPreflight(__payload,3000000,"new_money")',Object.assign(context,{__payload:preflightPayload}));
assert.equal(negativeMismatch.ready,true,'외부 자금·보유종목 분석은 연금 차액을 경고하고 계속할 수 있어야 한다');
assert.match(negativeMismatch.warnings.join(' '),/500,000원/);
const cashMismatch=vm.runInContext('aiStrategyPreflight(__payload,3000000,"account_cash")',Object.assign(context,{__payload:preflightPayload}));
assert.equal(cashMismatch.ready,false,'구성 차액이 있는 계좌 현금을 투자금으로 쓸 때만 공유를 막아야 한다');
const zeroRebalancePayload=JSON.parse(JSON.stringify(payload));
zeroRebalancePayload.request.purpose='리밸런싱';
const zeroRebalance=vm.runInContext('aiStrategyPreflight(__payload,0,"new_money")',Object.assign(context,{__payload:zeroRebalancePayload}));
assert.equal(zeroRebalance.ready,true,'리밸런싱은 추가 투자금 0원으로도 가능해야 한다');
assert.match(vm.runInContext('aiStrategyPrompt("rebalance",0,"new_money")',context),/추가 자금 없음/);
const zeroBuyPayload=JSON.parse(JSON.stringify(payload));
zeroBuyPayload.request.purpose='추가매수 판단';
const zeroBuy=vm.runInContext('aiStrategyPreflight(__payload,0,"new_money")',Object.assign(context,{__payload:zeroBuyPayload}));
assert.equal(zeroBuy.ready,false,'추가매수 판단은 투자금 0원을 허용하지 않는다');

console.log('AI strategy payload tests: PASS');
