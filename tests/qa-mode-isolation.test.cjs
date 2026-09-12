'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),storage=new Map([['asset-os-v1.9.45-live','LIVE-SENTINEL']]);
const localStorage={get length(){return storage.size},key:i=>[...storage.keys()][i]??null,getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(String(k),String(v)),removeItem:k=>storage.delete(String(k))};
let networkClients=0,fetches=0;
const document={querySelector:()=>null,querySelectorAll:()=>[],documentElement:{dataset:{},classList:{add(){},remove(){}},scrollHeight:0},body:{dataset:{}}};
const window={addEventListener(){},removeEventListener(){},scrollTo(){},isSecureContext:false,supabase:{createClient(){networkClients++;throw new Error('QA must not initialize Supabase')}}};
const context=vm.createContext({console,Date,Set,Map,URL,Blob,File:global.File,TextEncoder,TextDecoder,Uint8Array,DataView,ArrayBuffer,Intl,Math,JSON,Number,String,Boolean,Object,RegExp,Promise,encodeURIComponent,decodeURIComponent,localStorage,document,window,navigator:{},location:{search:'?qa=1',hash:'',pathname:'/asset-os/'},history:{replaceState(){}},fetch:async()=>{fetches++;throw new Error('QA network blocked')},requestAnimationFrame:fn=>fn(),setTimeout:()=>0,clearTimeout(){},toast(){},closeSheets(){},render(){},haptic(){} });
vm.runInContext('let integratedAssetsExpanded=false',context);
const files=['core-config.js','broker-kis.js','broker-kis-client.js','data-defaults.js','integrated-ledger-engine.js','integrated-schedule-engine.js','integrated-finance-engine.js','store-state.js','core-accessors.js','core-visual-utils.js','pension-contributions.js','pension-ledger.js','chart-asset-analysis.js','pension-assets.js','isa-validation.js','isa-ledger.js','integrated-forms.js','integrated-pages.js','home.js','qa-mode.js','supabase-sync.js'];
for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const run=(code,args=[])=>vm.runInContext(code,Object.assign(context,{__args:args})),plain=x=>JSON.parse(JSON.stringify(x)),close=(actual,expected,tolerance=.01)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);

assert.equal(run('QA_MODE'),true);assert.equal(run('APP_VERSION'),'v0.6.10');assert.equal(run('KEY'),'asset-os-qa-v0.5');assert.equal(run('localYmd()'),'2060-12-31');
assert.equal(run('daysUntil("2061-12-31")'),365,'QA D-day must use the simulated app date');
run('state=qaBuildThirtyFiveYearState();lastPersistedState=clone(state)');
const stats=plain(run('qaDatasetStats()'));
assert.equal(run('state.system.qaDataset.version'),'v0.6.10');
assert.deepEqual(stats,{isa:872,pension:891,integrated:5977,total:7740,totalAssets:1342937642,totalDebt:87400124,netAssets:1255537518,cash:529654229,isaAccounts:12,months:420});
assert.equal(run('homeSample().contributed'),2416674,'홈 저축·투자는 ISA·연금저축·IRP를 포함해야 한다');
assert.ok(run('homeSample().activity.living')>0,'홈 월 합계에 생활비·고정지출이 있어야 한다');
assert.ok(run('homeSample().activity.loan')>0,'홈 월 합계에 대출 원금·이자가 있어야 한다');
assert.equal(run('homeSample().outgoing'),run('homeSample().activity.living+homeSample().activity.saving+homeSample().activity.loan+homeSample().activity.other'));
assert.equal(run('scheduleOccurrences("2060-12").filter(x=>x.status==="done").length'),2,'이미 존재하는 연금·IRP 납입 원장은 일정 완료로 인식해야 한다');
assert.deepEqual(plain(run('[...new Set(financeSchedules().map(x=>x.kind))].sort()')),['expense','income','insurance','investment','loan','saving'],'QA 일정은 월급·생활비·보험·저축·투자·대출을 모두 포함해야 한다');
assert.equal(run('state.accounts.at(-1).name'),'QA ISA 2059 · 납입 4,000만원');
assert.deepEqual(plain(run('integratedIssues()')),[]);assert.deepEqual(plain(run('pensionTransactionIssues()')),[]);assert.deepEqual(plain(run('allIsaIssues()')),[]);assert.deepEqual(plain(run('brokerKisIssues(state.brokerKis)')),[]);assert.deepEqual(plain(run('systemIntegrityIssues()')),[]);
assert.equal(run('state.insurance.policies[0].coverages.length'),8,'QA 보험은 실제 긴 상세창 스크롤을 재현해야 한다');
assert.ok(run('state.insurance.policies[0].coverages.some(x=>x.name.length>15)'),'QA 보험은 모바일 장문 줄바꿈도 검사해야 한다');

// 최근 5년 60개월은 사용자가 누르는 네 탭의 기준 월과 월별 금액 항등식을 모두 확인한다.
const fiveYearMonths=[];for(let year=2055,month=11;year<2060||year===2060&&month<=10;){fiveYearMonths.push(`${year}-${String(month).padStart(2,'0')}`);month++;if(month===13){year++;month=1}}
assert.equal(fiveYearMonths.length,60);
const fiveYearRenderSamples=new Set(['2055-11','2056-07','2057-12','2058-03','2059-09','2060-10']);
for(const key of fiveYearMonths){
 run('setting().integratedMonth=__args[0]',[key]);
 const [year,month]=key.split('-').map(Number),summary=plain(run('integratedSummary(__args[0])',[key])),activity=plain(run('homeMonthActivity(__args[0])',[key]));
 for(const field of ['income','fixed','variable','invest','principal','operatingCashDelta'])assert.ok(Number.isFinite(summary[field]),`${key} ${field} 숫자 오류`);
 close(activity.total,activity.living+activity.saving+activity.loan+activity.other,.01);
 if(fiveYearRenderSamples.has(key))for(const tab of ['summary','ledger','spending','schedule']){const html=String(run('integratedPage(__args[0])',[tab]));assert.ok(html.includes(`${year}년 ${month}월`),`${key} ${tab} 기준 월 불일치`);assert.doesNotMatch(html,/NaN|undefined|Infinity/,`${key} ${tab} 잘못된 표시값`)}
}

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
assert.equal(run('state.accounts.flatMap(a=>a.transactions).filter(t=>t.qty!=null&&!Number.isInteger(t.qty)).length'),0,'국내 ISA 종목 수량은 정수 주식이어야 한다');
assert.equal(run('centralIsaReplayRows(state.accounts.at(-1)).length'),0,'같은 날짜·금액의 과거 ISA 입금과 통합 납입을 중복 가산하면 안 된다');
assert.ok(run('accountMetrics(state.accounts.at(-1)).cash')<1000000,'중복 납입 제거 후 남은 ISA 현금만 표시해야 한다');
close(run('historicalFinancialModel(localYmd()).isa'),run('integratedFinancialModel().isa'),.01);

// 연금: 420개월, 지정 3개년 7월 미납 및 8월 보충. IRP는 매월 유지.
assert.equal(run('state.pension.assetSnapshots.length'),420);
assert.equal(run('state.pension.transactions.filter(t=>t.accountId==="qa-pension"&&t.type==="buy").length'),417);
assert.equal(run('state.pension.transactions.filter(t=>t.accountId==="qa-irp"&&t.type==="buy").length'),404);
assert.equal(run('state.pension.transactions.filter(t=>t.accountId==="qa-pension"&&t.type==="buy"&&/-07-25$/.test(t.date)&&QA_PENSION_SKIP_YEARS.has(Number(t.date.slice(0,4)))).length'),0);
assert.equal(run('state.pension.transactions.filter(t=>t.accountId==="qa-pension"&&t.type==="buy"&&t.note==="전월 미납 보충매수").length'),3);
assert.deepEqual(plain(run('(({year,ordinaryPs,ordinaryIrp,total})=>({year,ordinaryPs,ordinaryIrp,total}))(pensionSummary())')),{year:'2060',ordinaryPs:6000000,ordinaryIrp:3000000,total:9000000});
assert.deepEqual(plain(run('(({currentAge,years,monthly})=>({currentAge,years,monthly}))(pensionProjection())')),{currentAge:65,years:0,monthly:750000});
assert.equal(run('pensionIncomeSummary().year'),'2060');

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
assert.equal(growth[0].label,'2026','자산 자료가 없는 부채 단독 시점을 그래프 기준점으로 쓰면 안 됨');
assert.ok(run('financialGrowthSeries("all").every(x=>x.coverage.complete)'));
close(stats.totalAssets,stats.cash+run('integratedFinancialModel().deposit+integratedFinancialModel().savings+integratedFinancialModel().isa+integratedFinancialModel().pension+integratedFinancialModel().irp+integratedFinancialModel().other'));
close(stats.netAssets,stats.totalAssets-stats.totalDebt);

// 같은 달 스냅샷은 마지막 날짜의 최신값 하나만 사용한다.
run('state.pension.assetSnapshots.push({date:"2060-12-31",pension:{cost:1,value:987654321},irp:{cost:1,value:123456789}})');
assert.equal(run('pensionAnalysisDisplayRows("all","1y").at(-1).value'),1111111110);
assert.equal(run('pensionAnalysisDisplayRows("all","1y").filter(x=>x.key==="2060-12").length'),1);
run('state.pension.assetSnapshots.pop()');

// 대출 일정 완료는 총액을 전부 이자로 기록하지 않고 실제 원금·이자로 나눈다.
const loanBefore=run('state.integrated.ledger.length');
assert.equal(run('completeScheduleOccurrence("qa-schedule-home-loan","2060-12-26",0,"","",100000,50000)'),true);
assert.deepEqual(plain(run('state.integrated.ledger.slice(-2).map(x=>[x.type,x.amount,x.meta.component])')),[['debtPrincipal',100000,'principal'],['debtInterest',50000,'interest']]);
run(`state.integrated.ledger.splice(${loanBefore})`);

// 잘못된 입력은 저장 전 차단되고 건수도 변하지 않는다.
const mistakeCounts=plain(run('({integrated:state.integrated.ledger.length,pension:state.pension.transactions.length})'));
assert.match(run('integratedValidateCandidate({id:"bad-zero",date:"2060-12-30",type:"expense",amount:0,fromAccountId:"cash-main"})'),/1원 이상/);
assert.match(run('integratedValidateCandidate({id:"bad-same",date:"2060-12-30",type:"internalTransfer",amount:1000,fromAccountId:"cash-main",toAccountId:"cash-main"})'),/같은 계좌/);
assert.match(run('integratedValidateCandidate({id:"bad-over",date:"2060-12-30",type:"expense",amount:1e12,fromAccountId:"cash-main"})'),/잔액이 부족/);
assert.ok(run('integratedValidateCandidate({id:"bad-loan",date:"2060-12-30",type:"debtPrincipal",amount:1e12,fromAccountId:"cash-main",liabilityId:"finance-debt-qa-home-loan"})'));
assert.match(run('pensionTransactionSave({accountId:"qa-irp",holdingId:"qa-irp-h",type:"sell",date:"2060-12-30",qty:999999,price:100000,fee:0,tax:0}).error'),/초과매도/);
assert.deepEqual(plain(run('({integrated:state.integrated.ledger.length,pension:state.pension.transactions.length})')),mistakeCounts,'차단된 실수는 원장을 바꾸면 안 됨');
assert.equal(run('qaRunMistakes()'),true);

// 임의 시점 3건씩: ISA와 연금 거래가 최근 월만 우연히 통과하지 않는지 검사한다.
const isaRandom=plain(run(`(()=>{const a=state.accounts.at(-1),h=a.holdings[0],rows=[
 {id:'qa-random-isa-interest',type:'interest',tradeDate:'2059-03-07',date:'2059-03-07',amount:12345,fee:0,tax:0,note:'임의기간 이자'},
 {id:'qa-random-isa-dividend',type:'dividend',tradeDate:'2060-04-19',date:'2060-04-19',holdingId:h.id,amount:23456,fee:0,tax:3600,note:'임의기간 배당'},
 {id:'qa-random-isa-sell',type:'sell',tradeDate:'2060-09-11',date:'2060-09-11',holdingId:h.id,qty:1,price:h.currentPrice,fee:1000,tax:0,note:'임의기간 매도'}
 ];let candidate=a.transactions.map(t=>({...t}));for(const tx of rows){tx.sequence=Math.max(0,...candidate.filter(x=>txDate(x)===tx.date).map(x=>Number(x.sequence)||0))+1;tx.createdAt=tx.date+'T12:00:00.000Z';tx.idempotencyKey=stableTxKey(tx);candidate.push(tx)}const result=replay(a,candidate);return{valid:result.valid,error:result.error,count:rows.length,dates:rows.map(x=>x.date)}})()`));
assert.deepEqual(isaRandom,{valid:true,error:null,count:3,dates:['2059-03-07','2060-04-19','2060-09-11']});
const randomPensionIds=[];
for(const candidate of [
 {accountId:'qa-pension',holdingId:'qa-pension-h',type:'dividend',date:'2033-04-09',amount:12345,fee:0,tax:1900,note:'임의기간 배당'},
 {accountId:'qa-pension',holdingId:'qa-pension-h',type:'sell',date:'2047-08-17',qty:1,price:175000,fee:1000,tax:0,note:'임의기간 매도'},
 {accountId:'qa-irp',holdingId:'',type:'interest',date:'2058-02-03',amount:6789,fee:0,tax:0,note:'임의기간 이자'}
 ]){const result=plain(run('pensionTransactionSave(__args[0])',[candidate]));assert.equal(result.ok,true,result.error);randomPensionIds.push(result.tx.id)}
assert.equal(randomPensionIds.length,3);for(const id of randomPensionIds)assert.equal(run('pensionTransactionDelete(__args[0])',[id]),true);

assert.equal(run('state.brokerKis.balanceSnapshots.length'),2);assert.equal(run('state.brokerKis.orders.length'),1);assert.equal(run('state.brokerKis.rights.length'),1);
assert.equal(run('quantityNumber(92.4553)'),'92.4553');assert.equal(run('quantityNumber(92)'),'92');
assert.ok(run('stateEnvelopeBytes(stateEnvelopeJson())')<2000000,'구버전 QA와 함께 보관 가능한 크기로 압축되어야 함');
assert.equal(run('persist(false)'),true);assert.equal(storage.get('asset-os-v1.9.45-live'),'LIVE-SENTINEL','운영 키는 절대 변경 금지');assert.ok(storage.get('asset-os-qa-v0.5').length>100000);assert.equal([...storage.keys()].filter(key=>key.startsWith('asset-os-qa-')).length,1,'QA 버전업은 격리 저장 키를 누적하면 안 됨');
const before=plain(run('qaDatasetStats()'));run('state=loadState()');assert.deepEqual(plain(run('qaDatasetStats()')),before,'QA 새로고침 보존');
assert.equal(run('brokerKisClient.configure(BROKER_KIS_PUBLIC_CONFIG).ok'),true);assert.equal(networkClients,0);assert.equal(run('brokerKisClient.consumeRedirect().error'),'QA_NETWORK_BLOCKED');
(async()=>{assert.equal(await run('initSupabaseCloud()'),false);assert.equal(await run('cloudPushState()'),false);assert.equal(await run('cloudReconcileState()'),false);assert.equal(networkClients,0);assert.equal(fetches,0);console.log('QA mode isolation and 35-year real-user dataset tests: PASS')})().catch(error=>{console.error(error);process.exitCode=1});
