'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const storage=new Map();
const localStorage={get length(){return storage.size},key:i=>[...storage.keys()][i]??null,getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(String(k),String(v)),removeItem:k=>storage.delete(String(k))};
const document={querySelector:()=>null,querySelectorAll:()=>[],documentElement:{dataset:{},scrollHeight:0},body:{dataset:{}}};
const window={addEventListener:()=>{},removeEventListener:()=>{},scrollTo:()=>{},isSecureContext:false};
const context=vm.createContext({console,Date,Set,Map,URL,Blob,File:global.File,TextEncoder,TextDecoder,Uint8Array,DataView,ArrayBuffer,Intl,Math,JSON,Number,String,Boolean,Object,RegExp,Promise,encodeURIComponent,decodeURIComponent,localStorage,document,window,navigator:{},location:{hash:''},requestAnimationFrame:fn=>fn(),setTimeout:()=>0,clearTimeout:()=>{}});
const files=['core-config.js','broker-kis.js','broker-kis-client.js','data-defaults.js','integrated-ledger-engine.js','integrated-schedule-engine.js','integrated-finance-engine.js','store-migrations.js','store-state.js','backup.js','core-accessors.js','pension-contributions.js','pension-ledger.js','pension-assets.js','isa-validation.js','isa-ledger.js'];
for(const file of files)vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context,{filename:file});
const run=(code,args=[])=>vm.runInContext(code,Object.assign(context,{__args:args}));
const plain=value=>JSON.parse(JSON.stringify(value));

run('state=normalizeState(seed);lastPersistedState=clone(state)');
run('state.pension.accounts.push({id:"ps-main",kind:"pension",name:"연금저축",provider:"한국투자증권",status:"active",openedAt:"2026-01-01",closedAt:"",policyId:state.policies.pension.activePolicyId,policyHistory:[]})');
run('state.integrated.ledger.push({id:"opening-pension-test",date:"2026-08-01",type:"openingAsset",amount:500000,toAccountId:"pension-link",sequence:1,createdAt:"2026-08-01T00:00:00.001",meta:{}});state.integrated=normalizeIntegrated(state.integrated)');
const before=plain(run('({pension:state.pension,integrated:state.integrated,metrics:integratedFinancialModel()})'));
assert.equal(run('SCHEMA_VERSION'),20);
assert.equal(run('typeof brokerKisClient.sync'),'function');
assert.equal(run('state.brokerKis.orders.length'),0);
const linkedDetail=plain(run('pensionAssetMetrics("pension")'));
assert.equal(linkedDetail.value,500000,'통합 원장 연금 잔액이 상세 자산 화면에서도 보여야 한다');
assert.equal(linkedDetail.source,'linked');
assert.equal(linkedDetail.unallocatedRows[0].name,'연결 원장 잔액');

const partial={orderDate:'2026-08-31',orderTime:'101500',branchNo:'001',orderNo:'12345',productCode:'ETF001',productName:'테스트 ETF',exchangeCode:'KRX',side:'buy',orderQty:100,filledQty:30,filledAmount:300000,remainingQty:70,cancelledQty:0,appKey:'NEVER_SAVE',appSecret:'NEVER_SAVE',token:'NEVER_SAVE',cano:'NEVER_SAVE'};
const complete={...partial,filledQty:100,filledAmount:1020000,remainingQty:0};
assert.deepEqual(plain(run('brokerKisImportOrderSnapshots(state.brokerKis,__args[0],"pension","ps-main","2026-09-01T00:00:00Z")',[[partial]])),{inserted:1,updated:0,skipped:0,rejected:0,total:1});
assert.deepEqual(plain(run('brokerKisImportOrderSnapshots(state.brokerKis,__args[0],"pension","ps-main","2026-09-01T07:00:00Z")',[[complete]])),{inserted:0,updated:1,skipped:0,rejected:0,total:1});
assert.equal(run('state.brokerKis.orders[0].revisions.length'),1);
assert.equal(run('state.pension.transactions.length'),before.pension.transactions.length,'KIS 가져오기가 연금 거래원장을 직접 변경하면 안 된다');
assert.equal(run('centralPensionContributionRows().length'),before.pension.contributions.length,'KIS 가져오기가 납입을 만들면 안 된다');

run('brokerKisImportBalanceSnapshot(state.brokerKis,{cash:500000,securitiesValue:1500000,totalValue:2000000,holdings:[{productCode:"ETF001",productName:"테스트 ETF",quantity:100,avgPrice:10200,currentPrice:15000,marketValue:1500000}]},"pension","ps-main","2026-09-01T08:00:00Z")');
run('brokerKisImportRights(state.brokerKis,[{rightTypeCode:"32",baseDate:"2026-08-01",cashPaymentDate:"2026-08-20",productCode:"ETF001",productName:"테스트 ETF",amount:10000,tax:0}],"pension","ps-main","2026-09-01T08:00:00Z")');
const kisDetail=plain(run('pensionAssetMetrics("pension")'));
assert.equal(kisDetail.value,2000000,'KIS 잔고와 개인연금 상세 평가액이 같아야 한다');
assert.equal(kisDetail.cash,500000);
assert.equal(kisDetail.holdings.length,1);
assert.equal(kisDetail.holdings[0].name,'테스트 ETF');
assert.equal(kisDetail.holdings[0].readOnly,true,'KIS 종목은 조회 전용이어야 한다');
assert.equal(run('state.pension.holdings.length'),before.pension.holdings.length,'KIS 종목을 수기 보유종목 원장에 복사하면 안 된다');
const afterMetrics=plain(run('integratedFinancialModel()'));
assert.equal(afterMetrics.pension,2000000,'KIS 현재 잔고가 연결 원장 현재값을 교체해야 한다');
assert.equal(afterMetrics.totalAssets,before.metrics.totalAssets-before.metrics.pension+2000000,'KIS 잔고를 기존 Asset OS 자산에 단순 합산하면 안 된다');
assert.equal(afterMetrics.currentSources.pension,'kis');
assert.equal(plain(run('historicalFinancialModel("2026-08-31")')).pension,500000,'과거 자산 분석은 KIS 현재 잔고로 덮어쓰면 안 된다');

run('state.pension.accounts.push({id:"ps-fund",kind:"pension",name:"연금저축 펀드",provider:"한국투자증권",status:"active",openedAt:"2026-01-01",closedAt:"",policyId:state.policies.pension.activePolicyId,policyHistory:[]})');
run('brokerKisImportBalanceSnapshot(state.brokerKis,{cash:0,securitiesValue:4000000,totalValue:4000000,holdings:[]},"pension","ps-fund","2026-09-01T08:01:00Z")');
const limitedFund=plain(run('pensionAssetMetrics("pension")'));
assert.equal(limitedFund.value,6000000,'종목 상세가 없어도 한투 총평가액은 사라지면 안 된다');
assert.equal(limitedFund.unallocated,4000000);
assert.equal(limitedFund.unallocatedRows[0].name,'한투 기타자산');
assert.equal(limitedFund.holdings.length,1,'API가 실제 반환한 ETF만 종목으로 표시해야 한다');

run('state.pension.accounts.push({id:"irp-main",kind:"irp",name:"IRP",provider:"한국투자증권",status:"active",openedAt:"2026-01-01",closedAt:"",policyId:state.policies.irp.activePolicyId,policyHistory:[]});state.integrated.ledger.push({id:"opening-irp-test",date:"2026-08-01",type:"externalAssetIn",amount:3380000,toAccountId:"irp-link",sequence:2,createdAt:"2026-08-01T00:00:00.002",meta:{}});state.integrated=normalizeIntegrated(state.integrated)');
run('brokerKisImportBalanceSnapshot(state.brokerKis,{cash:0,securitiesValue:0,totalValue:0,holdings:[]},"irp","irp-main","2026-09-01T08:02:00Z")');
const zeroLimited=plain(run('({model:integratedFinancialModel(),detail:pensionAssetMetrics("irp")})'));
assert.equal(zeroLimited.model.irp,0,'성공한 권위 잔고 응답의 0원은 실제 빈 계좌로 반영해야 한다');
assert.equal(zeroLimited.model.currentSources.irp,'kis');
assert.equal(zeroLimited.detail.value,0);
assert.equal(zeroLimited.detail.cash,0,'권위 응답이 0원이면 과거 연결 잔액을 계속 표시하면 안 된다');
assert.equal(zeroLimited.detail.holdings.length,0,'API가 반환하지 않은 종목명을 임의 생성하면 안 된다');

run('brokerKisImportBalanceSnapshot(state.brokerKis,{cash:260574,cashDetail:{depositCash:260574,settledCash:20574,nextDayCash:20574,todayBuyAmount:240000,availableCash:20574},securitiesValue:6877500,totalValue:7138074,holdings:[{productCode:"A483290",productName:"KODEX 미국AI테크TOP10",quantity:321,avgPrice:16633,currentPrice:15025,marketValue:4823025,profitLoss:-516545},{productCode:"A483280",productName:"IBK 미국AI TOP10국채혼합50",quantity:207,avgPrice:10305,currentPrice:9925,marketValue:2054475,profitLoss:-78546}]} ,"irp","irp-main","2026-09-04T09:20:00Z")');
const actualIrp=plain(run('({metrics:pensionAssetMetrics("irp"),risk:pensionRiskMetrics(),cash:pensionSpendableCashStatus("irp")})'));
assert.equal(actualIrp.metrics.value,7138074,'IRP 총액은 한투 잔고 합계와 같아야 한다');
assert.equal(actualIrp.cash.available,20574,'오늘 매수금액이 아직 예수금에 보이면 실제 사용 가능액을 별도로 써야 한다');
assert.equal(actualIrp.risk.classificationComplete,true);
assert.ok(Math.abs(actualIrp.risk.ratio-67.566)<0.01,'KODEX 주식형만 위험자산으로 계산하고 IBK 채권혼합형은 제외해야 한다');

run('state.pension.holdings.push({id:"unknown-risk",accountId:"irp-main",name:"새 IRP 상품",qty:1,avgPrice:100,currentPrice:100})');
run('state=normalizeState(state)');
assert.equal(run('state.pension.holdings.find(x=>x.id==="unknown-risk").risky'),null,'위험 여부가 없는 상품을 안전자산으로 바꾸면 안 된다');

run('brokerKisLinkInstrument(state.brokerKis,{accountId:"ps-main",productCode:"ETF001",holdingId:"missing-local-holding",linkedAt:"2026-09-01T08:01:00Z"})');
const draft=plain(run('brokerKisLedgerDraft(state.brokerKis,state.brokerKis.orders[0].orderKey)'));
assert.equal(draft.type,'buy');assert.equal(draft.qty,100);assert.equal(draft.price,10200);assert.equal('contribution' in draft,false);
assert.equal(run('state.pension.transactions.length'),before.pension.transactions.length,'미리보기 draft가 원장을 수정하면 안 된다');

run('brokerKisBeginHistory(state.brokerKis,{accountKind:"pension",accountId:"ps-main",startDate:"2020-01-01",targetDate:"2026-09-03",updatedAt:"2026-09-03T00:00:00Z"})');
run('brokerKisUpdateHistory(state.brokerKis,{accountKind:"pension",orderThrough:"2026-09-03",rightsThrough:"2026-09-03",status:"complete",updatedAt:"2026-09-03T00:01:00Z"})');

assert.equal(run('persist(false)'),true);
const saved=JSON.parse(storage.get('asset-os-v1.9.45-live'));
assert.equal(saved.schemaVersion,20);assert.equal(saved.data.brokerKis.orders.length,1);
assert.equal(saved.data.brokerKis.rights[0].classification,'unclassified_cash_right');
assert.equal(saved.data.brokerKis.history.pension.status,'complete');
assert.equal(saved.data.brokerKis.history.pension.orderThrough,'2026-09-03');
assert.ok(saved.data.pension.assetSnapshots.length>0,'KIS 실잔고가 있으면 초기 검산 플래그와 무관하게 월 스냅샷을 저장해야 한다');
assert.equal(JSON.stringify(saved).includes('NEVER_SAVE'),false,'KIS 비밀값이 localStorage에 들어가면 안 된다');

const savedBroker=plain(saved.data.brokerKis),savedPension=plain(saved.data.pension),savedIntegrated=plain(saved.data.integrated);
run('state=loadState()');
assert.deepEqual(plain(run('state.brokerKis')),savedBroker,'새로고침 후 KIS 데이터가 달라지면 안 된다');
assert.deepEqual(plain(run('state.pension')),savedPension,'새로고침 후 기존 연금 원장이 달라지면 안 된다');
assert.deepEqual(plain(run('state.integrated')),savedIntegrated,'새로고침 후 통합 원장이 달라지면 안 된다');

const bytes=run('createBackupZipBytes()');
const payload=run('parseBackupZipBytes(__args[0])',[bytes]);
const restored=plain(run('validateBackupPayload(__args[0])',[payload]));
assert.deepEqual(restored.brokerKis,savedBroker,'ZIP 백업·복원에서 KIS 데이터가 달라지면 안 된다');
assert.deepEqual(restored.pension,savedPension,'ZIP 백업·복원에서 연금 원장이 달라지면 안 된다');
assert.deepEqual(restored.integrated,savedIntegrated,'ZIP 백업·복원에서 통합 원장이 달라지면 안 된다');
assert.deepEqual(plain(run('brokerKisIssues(state.brokerKis)')),[]);

console.log('broker-kis integration tests: PASS');
