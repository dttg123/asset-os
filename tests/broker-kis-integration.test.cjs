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

const partial={orderDate:'2026-08-31',orderTime:'101500',branchNo:'001',orderNo:'12345',productCode:'ETF001',productName:'테스트 ETF',exchangeCode:'KRX',side:'buy',orderQty:100,filledQty:30,filledAmount:300000,remainingQty:70,cancelledQty:0,appKey:'NEVER_SAVE',appSecret:'NEVER_SAVE',token:'NEVER_SAVE',cano:'NEVER_SAVE'};
const complete={...partial,filledQty:100,filledAmount:1020000,remainingQty:0};
assert.deepEqual(plain(run('brokerKisImportOrderSnapshots(state.brokerKis,__args[0],"pension","ps-main","2026-09-01T00:00:00Z")',[[partial]])),{inserted:1,updated:0,skipped:0,rejected:0,total:1});
assert.deepEqual(plain(run('brokerKisImportOrderSnapshots(state.brokerKis,__args[0],"pension","ps-main","2026-09-01T07:00:00Z")',[[complete]])),{inserted:0,updated:1,skipped:0,rejected:0,total:1});
assert.equal(run('state.brokerKis.orders[0].revisions.length'),1);
assert.equal(run('state.pension.transactions.length'),before.pension.transactions.length,'KIS 가져오기가 연금 거래원장을 직접 변경하면 안 된다');
assert.equal(run('centralPensionContributionRows().length'),before.pension.contributions.length,'KIS 가져오기가 납입을 만들면 안 된다');

run('brokerKisImportBalanceSnapshot(state.brokerKis,{cash:500000,securitiesValue:1500000,totalValue:2000000,holdings:[{productCode:"ETF001",productName:"테스트 ETF",quantity:100,avgPrice:10200,currentPrice:15000,marketValue:1500000}]},"pension","ps-main","2026-09-01T08:00:00Z")');
run('brokerKisImportRights(state.brokerKis,[{rightTypeCode:"32",baseDate:"2026-08-01",cashPaymentDate:"2026-08-20",productCode:"ETF001",productName:"테스트 ETF",amount:10000,tax:0}],"pension","ps-main","2026-09-01T08:00:00Z")');
const afterMetrics=plain(run('integratedFinancialModel()'));
assert.equal(afterMetrics.pension,2000000,'KIS 현재 잔고가 연결 원장 현재값을 교체해야 한다');
assert.equal(afterMetrics.totalAssets,before.metrics.totalAssets-before.metrics.pension+2000000,'KIS 잔고를 기존 Asset OS 자산에 단순 합산하면 안 된다');
assert.equal(afterMetrics.currentSources.pension,'kis');
assert.equal(plain(run('historicalFinancialModel("2026-08-31")')).pension,500000,'과거 자산 분석은 KIS 현재 잔고로 덮어쓰면 안 된다');

run('brokerKisLinkInstrument(state.brokerKis,{accountId:"ps-main",productCode:"ETF001",holdingId:"missing-local-holding",linkedAt:"2026-09-01T08:01:00Z"})');
const draft=plain(run('brokerKisLedgerDraft(state.brokerKis,state.brokerKis.orders[0].orderKey)'));
assert.equal(draft.type,'buy');assert.equal(draft.qty,100);assert.equal(draft.price,10200);assert.equal('contribution' in draft,false);
assert.equal(run('state.pension.transactions.length'),before.pension.transactions.length,'미리보기 draft가 원장을 수정하면 안 된다');

assert.equal(run('persist(false)'),true);
const saved=JSON.parse(storage.get('asset-os-v1.9.45-live'));
assert.equal(saved.schemaVersion,20);assert.equal(saved.data.brokerKis.orders.length,1);
assert.equal(saved.data.brokerKis.rights[0].classification,'unclassified_cash_right');
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
