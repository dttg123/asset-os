'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),storage=new Map([['asset-os-v1.9.45-live','LIVE-SENTINEL']]);
const localStorage={get length(){return storage.size},key:i=>[...storage.keys()][i]??null,getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(String(k),String(v)),removeItem:k=>storage.delete(String(k))};
let networkClients=0,fetches=0;
const document={querySelector:()=>null,querySelectorAll:()=>[],documentElement:{dataset:{},classList:{add(){},remove(){}},scrollHeight:0},body:{dataset:{}}};
const window={addEventListener(){},removeEventListener(){},scrollTo(){},isSecureContext:false,supabase:{createClient(){networkClients++;throw new Error('QA must not initialize Supabase')}}};
const context=vm.createContext({console,Date,Set,Map,URL,Blob,File:global.File,TextEncoder,TextDecoder,Uint8Array,DataView,ArrayBuffer,Intl,Math,JSON,Number,String,Boolean,Object,RegExp,Promise,encodeURIComponent,decodeURIComponent,localStorage,document,window,navigator:{},location:{search:'?qa=1',hash:'',pathname:'/asset-os/'},history:{replaceState(){}},fetch:async()=>{fetches++;throw new Error('QA network blocked')},requestAnimationFrame:fn=>fn(),setTimeout:()=>0,clearTimeout(){},toast(){} });
const files=['core-config.js','broker-kis.js','broker-kis-client.js','data-defaults.js','integrated-ledger-engine.js','integrated-schedule-engine.js','integrated-finance-engine.js','store-migrations.js','store-state.js','core-accessors.js','core-visual-utils.js','pension-contributions.js','pension-ledger.js','pension-assets.js','isa-validation.js','isa-ledger.js','integrated-forms.js','qa-mode.js','supabase-sync.js'];
for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const run=(code,args=[])=>vm.runInContext(code,Object.assign(context,{__args:args})),plain=x=>JSON.parse(JSON.stringify(x)),close=(actual,expected,tolerance=.01)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);

assert.equal(run('QA_MODE'),true);assert.equal(run('KEY'),'asset-os-qa-v1');assert.equal(run('localYmd()'),'2060-12-31');
run('state=qaBuildThirtyFiveYearState();lastPersistedState=clone(state)');
const stats=plain(run('qaDatasetStats()'));
assert.deepEqual(stats,{isa:872,pension:907,integrated:5977,total:7756,totalAssets:1375710850.87,totalDebt:87400124,netAssets:1288310726.87,cash:529654229,isaAccounts:12,months:420});
assert.deepEqual(plain(run('integratedIssues()')),[]);assert.deepEqual(plain(run('pensionTransactionIssues()')),[]);assert.deepEqual(plain(run('allIsaIssues()')),[]);assert.deepEqual(plain(run('brokerKisIssues(state.brokerKis)')),[]);assert.deepEqual(plain(run('systemIntegrityIssues()')),[]);

// ISA: 3년 주기 12계좌, 지정 7개년 5월 스킵과 6월 보충, 계좌별 목표 납입액 보존.
assert.equal(run('state.accounts.length'),12);
assert.deepEqual(plain(run('state.accounts.map(a=>[a.openedAt,a.maturityAt,a.status])')),[
 ['2026-01-01','2028-12-31','closed'],['2029-01-01','2031-12-31','closed'],['2032-01-01','2034-12-31','closed'],['2035-01-01','2037-12-31','closed'],
 ['2038-01-01','2040-12-31','closed'],['2041-01-01','2043-12-31','closed'],['2044-01-01','2046-12-31','closed'],['2047-01-01','2049-12-31','closed'],
 ['2050-01-01','2052-12-31','closed'],['2053-01-01','2055-12-31','closed'],['2056-01-01','2058-12-31','closed'],['2059-01-01','2061-12-31','active']
]);
assert.deepEqual(plain(run('state.accounts.map(a=>a.transactions.filter(t=>t.type==="deposit").reduce((n,t)=>n+t.amount,0))')),[20000000,50000000,60000000,20000000,50000000,60000000,20000000,50000000,60000000,20000000,50000000,40000000]);
assert.equal(run('annualContributionTotal(state.accounts.at(-1))'),20000000);
assert.equal(run('state.accounts.flatMap(a=>a.transactions).filter(t=>t.type==="deposit"&&/-05-25$/.test(t.date)&&QA_ISA_SKIP_YEARS.has(Number(t.date.slice(0,4)))).length'),0);
assert.equal(run('state.accounts.flatMap(a=>a.transactions).filter(t=>t.type==="deposit"&&/-06-25$/.test(t.date)&&QA_ISA_SKIP_YEARS.has(Number(t.date.slice(0,4)))).length'),7);

// 연금: 420개월, 지정 3개년 7월 미납 및 8월 보충. IRP는 매월 유지.
assert.equal(run('state.pension.assetSnapshots.length'),420);
assert.equal(run('state.pension.transactions.filter(t=>t.accountId==="qa-pension"&&t.type==="buy").length'),417);
assert.equal(run('state.pension.transactions.filter(t=>t.accountId==="qa-irp"&&t.type==="buy").length'),420);
assert.equal(run('state.pension.transactions.filter(t=>t.accountId==="qa-pension"&&t.type==="buy"&&/-07-25$/.test(t.date)&&QA_PENSION_SKIP_YEARS.has(Number(t.date.slice(0,4)))).length'),0);
assert.equal(run('state.pension.transactions.filter(t=>t.accountId==="qa-pension"&&t.type==="buy"&&t.note==="전월 미납 보충매수").length'),3);

// 생활 원장: 월급 2회 휴직, 카드/보험/소비, 대출 원리금. 전 기간 현금·부채 음수 없음.
assert.equal(run('state.integrated.ledger.filter(t=>t.category==="월급").length'),418);
assert.equal(run('state.integrated.ledger.filter(t=>t.category==="카드값").length'),420);
assert.equal(run('state.integrated.ledger.filter(t=>t.category==="보험").length'),420);
assert.ok(run('state.integrated.ledger.filter(t=>["병원·치과","여행","가전·가구"].includes(t.category)).length')>40);
const replay=plain(run('integratedReplay()'));assert.ok(Object.values(replay.minAssets).every(v=>v>=0));assert.ok(Object.values(replay.minLiabilities).every(v=>v>=0));
assert.equal(run('state.integrated.ledger.filter(t=>t.id.startsWith("qa-home-principal-")).length'),372);
assert.equal(run('state.integrated.ledger.filter(t=>t.id.startsWith("qa-car-principal-")).length'),60);
assert.equal(run('state.integrated.ledger.filter(t=>t.id.startsWith("qa-home-principal-")).reduce((n,t)=>n+t.amount,0)'),142599876);
assert.equal(run('state.integrated.ledger.filter(t=>t.id.startsWith("qa-car-principal-")).reduce((n,t)=>n+t.amount,0)'),30000000);
assert.equal(replay.liabilities['finance-debt-qa-home-loan'],87400124);assert.equal(replay.liabilities['finance-debt-qa-car-loan'],0);

// 대출이자는 매월 상환 전 잔액과 당시 금리로 독립 재계산한다.
let homeBalance=230000000,homeInterest=0;for(let year=2030;year<=2060;year++)for(let month=1;month<=12;month++){const rate=year>=2050?.034:year>=2040?.052:.04;homeInterest+=Math.round(homeBalance*rate/12);homeBalance-=Math.min(homeBalance,383333)}
let carBalance=30000000,carInterest=0;for(let i=0;i<60;i++){carInterest+=Math.round(carBalance*.052/12);carBalance-=Math.min(carBalance,500000)}
assert.equal(run('state.integrated.ledger.filter(t=>t.id.startsWith("qa-home-interest-")).reduce((n,t)=>n+t.amount,0)'),homeInterest);
assert.equal(run('state.integrated.ledger.filter(t=>t.id.startsWith("qa-car-interest-")).reduce((n,t)=>n+t.amount,0)'),carInterest);

// 분석: QA 그래프가 실제 스냅샷을 읽고 대표 불황기에 하락을 표시한다.
const growth=plain(run('financialGrowthSeries("all").map(x=>({label:x.label,totalAssets:x.totalAssets,totalDebt:x.totalDebt,netAssets:x.netAssets}))')),byYear=new Map(growth.map(x=>[x.label,x]));
assert.equal(growth.length,35);for(const year of ['2042','2050','2057'])assert.ok(byYear.get(year).totalAssets<byYear.get(String(Number(year)-1)).totalAssets,`${year} 불황 하락 미반영`);
close(stats.totalAssets,stats.cash+run('integratedFinancialModel().deposit+integratedFinancialModel().savings+integratedFinancialModel().isa+integratedFinancialModel().pension+integratedFinancialModel().irp+integratedFinancialModel().other'));
close(stats.netAssets,stats.totalAssets-stats.totalDebt);

// 잘못된 입력은 저장 전 차단되고 건수도 변하지 않는다.
const mistakeCounts=plain(run('({integrated:state.integrated.ledger.length,pension:state.pension.transactions.length})'));
assert.match(run('integratedValidateCandidate({id:"bad-zero",date:"2060-12-30",type:"expense",amount:0,fromAccountId:"cash-main"})'),/1원 이상/);
assert.match(run('integratedValidateCandidate({id:"bad-same",date:"2060-12-30",type:"internalTransfer",amount:1000,fromAccountId:"cash-main",toAccountId:"cash-main"})'),/같은 계좌/);
assert.match(run('integratedValidateCandidate({id:"bad-over",date:"2060-12-30",type:"expense",amount:1e12,fromAccountId:"cash-main"})'),/잔액이 부족/);
assert.ok(run('integratedValidateCandidate({id:"bad-loan",date:"2060-12-30",type:"debtPrincipal",amount:1e12,fromAccountId:"cash-main",liabilityId:"finance-debt-qa-home-loan"})'));
assert.match(run('pensionTransactionSave({accountId:"qa-irp",holdingId:"qa-irp-h",type:"sell",date:"2060-12-30",qty:999999,price:100000,fee:0,tax:0}).error'),/초과매도/);
assert.deepEqual(plain(run('({integrated:state.integrated.ledger.length,pension:state.pension.transactions.length})')),mistakeCounts,'차단된 실수는 원장을 바꾸면 안 됨');
assert.equal(run('qaRunMistakes()'),true);

assert.equal(run('state.brokerKis.balanceSnapshots.length'),2);assert.equal(run('state.brokerKis.orders.length'),1);assert.equal(run('state.brokerKis.rights.length'),1);
assert.equal(run('persist(false)'),true);assert.equal(storage.get('asset-os-v1.9.45-live'),'LIVE-SENTINEL','운영 키는 절대 변경 금지');assert.ok(storage.get('asset-os-qa-v1').length>100000);
const before=plain(run('qaDatasetStats()'));run('state=loadState()');assert.deepEqual(plain(run('qaDatasetStats()')),before,'QA 새로고침 보존');
assert.equal(run('brokerKisClient.configure(BROKER_KIS_PUBLIC_CONFIG).ok'),true);assert.equal(networkClients,0);assert.equal(run('brokerKisClient.consumeRedirect().error'),'QA_NETWORK_BLOCKED');
(async()=>{assert.equal(await run('initSupabaseCloud()'),false);assert.equal(await run('cloudPushState()'),false);assert.equal(await run('cloudReconcileState()'),false);assert.equal(networkClients,0);assert.equal(fetches,0);console.log('QA mode isolation and 35-year real-user dataset tests: PASS')})().catch(error=>{console.error(error);process.exitCode=1});
