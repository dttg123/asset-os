'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),storage=new Map(),localStorage={get length(){return storage.size},key:i=>[...storage.keys()][i]??null,getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(String(k),String(v)),removeItem:k=>storage.delete(String(k))};
const document={querySelector:()=>null,querySelectorAll:()=>[],documentElement:{dataset:{},classList:{add(){},remove(){}},scrollHeight:0},body:{dataset:{},appendChild(){}}};
const window={addEventListener(){},removeEventListener(){},scrollTo(){},isSecureContext:false};
const context=vm.createContext({console,Date,Set,Map,URL:{createObjectURL:()=>'',revokeObjectURL(){}},Blob,File:global.File,TextEncoder,TextDecoder,Uint8Array,DataView,ArrayBuffer,Intl,Math,JSON,Number,String,Boolean,Object,RegExp,Promise,encodeURIComponent,decodeURIComponent,localStorage,document,window,navigator:{},location:{search:'?qa=1',hash:'',pathname:'/asset-os/'},history:{replaceState(){}},requestAnimationFrame:fn=>fn(),setTimeout:()=>0,clearTimeout(){},toast(){},closeSheets(){},render(){},haptic(){}});
vm.runInContext('let integratedAssetsExpanded=false',context);
const files=['core-config.js','broker-kis.js','broker-kis-client.js','data-defaults.js','integrated-ledger-engine.js','integrated-schedule-engine.js','integrated-finance-engine.js','store-state.js','core-accessors.js','core-visual-utils.js','pension-contributions.js','pension-ledger.js','chart-asset-analysis.js','pension-assets.js','isa-validation.js','isa-ledger.js','integrated-forms.js','integrated-pages.js','home.js','qa-mode.js','backup.js'];
for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const run=(code,args=[])=>vm.runInContext(code,Object.assign(context,{__args:args})),plain=value=>JSON.parse(JSON.stringify(value));

run('state=qaBuildThirtyFiveYearState();lastPersistedState=clone(state)');
const stress=plain(run(`(()=>{
 const candidate=clone(state),start=new Date('2026-01-01T00:00:00Z'),end=new Date('2060-12-31T00:00:00Z'),holdings=Array.from({length:12},(_,i)=>({productCode:'QA'+String(i+1).padStart(5,'0'),productName:'장기보존 검증 종목 '+(i+1),quantity:100+i,avgPrice:80000+i*1000,currentPrice:120000+i*1100,marketValue:(100+i)*(120000+i*1100),profitLoss:(100+i)*(40000+i*100)}));candidate.brokerKis.balanceSnapshots=[];
 for(let cursor=new Date(start),n=0;cursor<=end;cursor.setUTCDate(cursor.getUTCDate()+1),n++){
  const date=cursor.toISOString().slice(0,10),account=candidate.accounts.find(a=>a.openedAt<=date&&date<=a.maturityAt),value=10000000+n*1234;
  if(account)account.assetSnapshots.push({date,cost:8000000+n*700,value,cash:250000,totalValue:value+250000,meta:{autoSnapshot:true,accountId:account.id,valueBasis:'securities',totalValueBasis:'securities_plus_cash',grain:'day',verified:true}});
  for(const [kind,accountId,offset] of [['pension','qa-pension',0],['irp','qa-irp',5000000]])candidate.brokerKis.balanceSnapshots.push({id:['kis-balance',kind,accountId,date].join('|'),source:'kis',authoritative:true,accountKind:kind,accountId,date,fetchedAt:date+'T09:00:00.000Z',cash:500000+offset,cashDetail:{depositCash:500000,settledCash:500000,nextDayCash:500000,d2Cash:500000,todayBuyAmount:0,todaySellAmount:0,availableCash:500000},securitiesValue:value+offset,totalValue:value+offset+500000,holdings:clone(holdings)});
 }
 const manual={date:'2030-05-17',cost:1234567,value:2345678,cash:345678,totalValue:2691356,meta:{source:'manual-import',note:'절대 보존'}};candidate.accounts.find(a=>a.openedAt<='2030-05-17'&&a.maturityAt>='2030-05-17').assetSnapshots.push(manual);
 candidate.accounts[0].assetSnapshots.push({date:'날짜오류',cost:1,value:2,meta:{autoSnapshot:true}});
 const current=candidate.accounts.at(-1),sixBefore=isaAnalysisDisplayRows(current,'6m'),yearBefore=isaAnalysisDisplayRows(current,'1y'),countsBefore={isaTx:candidate.accounts.reduce((n,a)=>n+a.transactions.length,0),pensionTx:candidate.pension.transactions.length,integrated:candidate.integrated.ledger.length,orders:candidate.brokerKis.orders.length,rights:candidate.brokerKis.rights.length,matches:candidate.brokerKis.matches.length},latestBefore=clone(brokerKisLatestBalance(candidate.brokerKis,'pension','qa-pension')),preBytes=stateEnvelopeBytes(stateEnvelopeJson(candidate)),report=compactStateSnapshots(candidate,'2060-12-31'),postBytes=stateEnvelopeBytes(stateEnvelopeJson(candidate)),sixAfter=isaAnalysisDisplayRows(current,'6m'),yearAfter=isaAnalysisDisplayRows(current,'1y'),firstPass=JSON.stringify({accounts:candidate.accounts.map(a=>a.assetSnapshots),kis:candidate.brokerKis.balanceSnapshots}),second=compactStateSnapshots(candidate,'2060-12-31'),secondPass=JSON.stringify({accounts:candidate.accounts.map(a=>a.assetSnapshots),kis:candidate.brokerKis.balanceSnapshots});
 return{candidate,manual,countsBefore,latestBefore,preBytes,postBytes,report,second,sameAfterSecond:firstPass===secondPass,sixBefore,sixAfter,yearBefore,yearAfter,autoIsa:candidate.accounts.flatMap(a=>a.assetSnapshots).filter(x=>x.meta?.autoSnapshot===true&&/^\\d{4}/.test(x.date)).length,kis:candidate.brokerKis.balanceSnapshots.length,invalidKept:candidate.accounts[0].assetSnapshots.some(x=>x.date==='날짜오류'),manualKept:candidate.accounts.some(a=>a.assetSnapshots.some(x=>JSON.stringify(x)===JSON.stringify(manual)))}
})()`));

assert.ok(stress.preBytes>19000000,`35년 일별 원본이 충분히 무거워야 함: ${stress.preBytes}`);
assert.ok(stress.postBytes<4000000,`정리 후 4MB 안전한도를 지켜야 함: ${stress.postBytes}`);
assert.equal(stress.autoIsa,598,'ISA는 과거 계좌별 월 대표와 최근 6개월 일별만 남겨야 한다');
assert.equal(stress.kis,1196,'KIS 두 계좌는 과거 월 대표와 최근 6개월 일별만 남겨야 한다');
assert.equal(stress.manualKept,true,'수동·가져오기 ISA 스냅샷은 절대 삭제하면 안 된다');
assert.equal(stress.invalidKept,true,'날짜를 판정할 수 없는 스냅샷은 임의 삭제하면 안 된다');
const oldKis=stress.candidate.brokerKis.balanceSnapshots.find(x=>x.date==='2026-01-31'&&x.accountKind==='pension'),recentKis=stress.candidate.brokerKis.balanceSnapshots.find(x=>x.date==='2060-07-01'&&x.accountKind==='pension'),latestKis=stress.candidate.brokerKis.balanceSnapshots.find(x=>x.date==='2060-12-31'&&x.accountKind==='pension');
assert.equal(oldKis.summaryOnly,true,'오래된 KIS 월 대표는 그래프용 합계로 압축해야 한다');assert.equal(oldKis.holdings.length,0);
assert.equal(recentKis.summaryOnly,undefined,'최근 6개월 KIS 종목 상세는 유지해야 한다');assert.equal(recentKis.holdings.length,12);
assert.equal(latestKis.holdings.length,12,'가장 최신 KIS 잔고 상세는 유지해야 한다');
assert.deepEqual(stress.sixAfter,stress.sixBefore,'6개월 일별 그래프가 바뀌면 안 된다');
assert.deepEqual(stress.yearAfter,stress.yearBefore,'1년 월별 그래프가 바뀌면 안 된다');
assert.equal(stress.sameAfterSecond,true,'반복 정리는 저장 결과를 바꾸면 안 된다');
assert.deepEqual(stress.second,{referenceDate:'2060-12-31',dailyMonths:6,isaRemoved:0,kisRemoved:0,protected:153});

context.__candidate=stress.candidate;context.__expected=stress.countsBefore;context.__latest=stress.latestBefore;
const preserved=plain(run(`(()=>{const c=__candidate;return{isaTx:c.accounts.reduce((n,a)=>n+a.transactions.length,0),pensionTx:c.pension.transactions.length,integrated:c.integrated.ledger.length,orders:c.brokerKis.orders.length,rights:c.brokerKis.rights.length,matches:c.brokerKis.matches.length,latest:brokerKisLatestBalance(c.brokerKis,'pension','qa-pension')}})()`));
assert.deepEqual({...preserved,latest:undefined},{...stress.countsBefore,latest:undefined},'스냅샷 정리가 실제 원장·주문·권리를 건드리면 안 된다');
assert.deepEqual(preserved.latest,stress.latestBefore,'가장 최신 KIS 잔고가 바뀌면 안 된다');

const roundTrip=plain(run(`(()=>{state=clone(__candidate);const payload=backupPayload(),parsed=parseBackupZipBytes(createBackupZipBytes(payload)),restored=validateBackupPayload(parsed);return{environment:parsed.environment,isaTx:restored.accounts.reduce((n,a)=>n+a.transactions.length,0),pensionTx:restored.pension.transactions.length,integrated:restored.integrated.ledger.length,orders:restored.brokerKis.orders.length,rights:restored.brokerKis.rights.length,matches:restored.brokerKis.matches.length,kis:restored.brokerKis.balanceSnapshots.length}})()`));
assert.deepEqual(roundTrip,{environment:'qa',...stress.countsBefore,kis:1196},'정리된 35년 자료가 ZIP 왕복에서 달라지면 안 된다');

run('state=clone(__candidate);lastPersistedState=clone(state)');
assert.equal(run('persist(false)'),true,'35년 정리 자료가 실제 저장돼야 한다');
const saved=storage.get('asset-os-qa-v0.5');assert.ok(new TextEncoder().encode(saved).length<4000000);
assert.equal(run('state.system.storageUsage.level'),run('storageUsageLevel(state.system.storageUsage.bytes)'));
assert.deepEqual(plain(run('[storageUsageLevel(2799999),storageUsageLevel(2800000),storageUsageLevel(3400000),storageUsageLevel(3800000)]')),['ok','notice','warning','critical'],'70%·85%·95% 저장 경고 경계가 정확해야 한다');
const reloaded=plain(run(`(()=>{state=loadState();return{isaTx:state.accounts.reduce((n,a)=>n+a.transactions.length,0),pensionTx:state.pension.transactions.length,integrated:state.integrated.ledger.length,orders:state.brokerKis.orders.length,rights:state.brokerKis.rights.length,matches:state.brokerKis.matches.length,kis:state.brokerKis.balanceSnapshots.length}})()`));
assert.deepEqual(reloaded,{...stress.countsBefore,kis:1196},'저장 후 새로고침에서도 35년 원장과 잔고가 유지돼야 한다');
const goodSaved=storage.get('asset-os-qa-v0.5');run(`lastPersistedState=clone(state);state.sourceArchives.records.push({id:'oversize',kind:'note',date:'2060-12-31',label:'용량초과',amount:0,note:'X'.repeat(2000000),meta:{}})`);
assert.equal(run('persist(false)'),false,'4MB 초과 저장은 차단해야 한다');assert.equal(storage.get('asset-os-qa-v0.5'),goodSaved,'용량초과 실패가 직전 정상 저장값을 덮으면 안 된다');assert.equal(run('state.sourceArchives.records.some(x=>x.id==="oversize")'),false,'실패한 대용량 변경은 메모리 상태에서도 롤백해야 한다');

console.log(`snapshot retention hard tests: PASS · before ${stress.preBytes.toLocaleString()}B · after ${stress.postBytes.toLocaleString()}B`);
