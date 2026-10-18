'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
function env(){const storage=new Map(),c=vm.createContext({console,Date,Set,Map,URL,Blob,TextEncoder,TextDecoder,Uint8Array,DataView,ArrayBuffer,Intl,Math,JSON,Number,String,Boolean,Object,RegExp,Promise,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{querySelector:()=>null,querySelectorAll:()=>[],documentElement:{dataset:{}},body:{dataset:{}}},window:{addEventListener:()=>{}},navigator:{},location:{search:'?qa=1',hash:''},setTimeout:()=>0,clearTimeout:()=>{}});for(const f of ['core-config.js','src/integrations/kis-normalization.js','broker-kis.js','data-defaults.js','src/domain/integrated-replay.js','src/domain/integrated-ledger-core.js','src/domain/integrated-ledger.js','src/domain/integrated-ledger-validation.js','src/domain/financial-current.js','src/domain/financial-history.js','src/domain/integrated-spending.js','integrated-schedule-engine.js','integrated-finance-engine.js','src/storage/state-migrations.js','src/storage/snapshot-retention.js','store-state.js','core-accessors.js','src/domain/investment-position.js','pension-contributions.js','pension-ledger.js','pension-assets.js','isa-validation.js','isa-ledger.js','isa-registration.js','isa-maturity-policy.js','integrated-forms.js','integrated-finance-ui.js','insurance.js','backup.js','export-csv.js','integrated-pages.js','src/app/schedule-completion.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c,{filename:f});const bytes=fs.readFileSync(path.join(root,'tests/fixtures/legacy/schema-v21-30y-backup.zip')),offset=30+bytes.readUInt16LE(26)+bytes.readUInt16LE(28);c.fixture=JSON.parse(require('node:zlib').inflateRawSync(bytes.subarray(offset,offset+bytes.readUInt32LE(18))).toString()).data;vm.runInContext('state=normalizeState(fixture)',c);return c}
const run=(c,s)=>vm.runInContext(s,c);

async function setup(){const c=env();(await run(c,"globalThis.productionPersist=persist;state=normalizeState(seed);persist=()=>true;toast=()=>{};renderScheduleCompletion=()=>{};state.integrated.ledger=[{id:'cash',date:'2026-01-01',type:'openingAsset',toAccountId:'cash-main',amount:10000000}];state.financeSchedules={items:[]}"));return c}
test('one occurrence and future changes keep earlier estimates and actual rows intact after restore',async ()=>{const c=(await setup());(await run(c,"state.financeSchedules.items=[{id:'s',name:'관리비',kind:'expense',amount:100000,day:25,startDate:'2026-01-01',active:true}]"));assert.equal((await run(c,"(async()=>{return (await updateSchedulePlannedAmount('s','2026-02-25',150000,'once'))})()")),true);assert.equal((await run(c,"schedulePlannedAmount(financeSchedules()[0],'2026-03-25')")),100000);assert.equal((await run(c,"(async()=>{return (await updateSchedulePlannedAmount('s','2026-03-25',200000,'future'))})()")),true);(await run(c,'state=normalizeState(JSON.parse(JSON.stringify(state)))'));assert.equal((await run(c,"schedulePlannedAmount(financeSchedules()[0],'2026-01-25')")),100000);assert.equal((await run(c,"schedulePlannedAmount(financeSchedules()[0],'2026-02-25')")),150000);assert.equal((await run(c,"schedulePlannedAmount(financeSchedules()[0],'2026-04-25')")),200000);assert.equal((await run(c,"(async()=>{return (await completeScheduleOccurrence('s','2026-03-25',210000))})()")),true);assert.equal((await run(c,"scheduleOccurrences('2026-03')[0].tx.meta.scheduledAmount")),200000);assert.equal((await run(c,"scheduleOccurrenceUiLabel(scheduleOccurrences('2026-03')[0])")),'금액 다름');const recordId=(await run(c,"scheduleOccurrences('2026-03')[0].tx.id"));assert.equal((await run(c,"(async()=>{return (await updateScheduleActualPayment('s','2026-03-25',220000))})()")),true);assert.equal((await run(c,"scheduleOccurrences('2026-03')[0].tx.id")),recordId);assert.equal((await run(c,"scheduleOccurrences('2026-03')[0].tx.meta.actualAmount")),220000);assert.equal((await run(c,"schedulePlannedAmount(financeSchedules()[0],'2026-04-25')")),200000);assert.equal((await run(c,"state.integrated.ledger.filter(t=>t.meta?.scheduleId==='s').length")),1)});
test('24-month no-interest purchase totals exactly, tracks debt and never counts principal twice as spending',async ()=>{const c=(await setup());(await run(c,"(async()=>{return (await createCardInstallment({name:'TV',purchaseAmount:3100000,months:24,purchaseDate:'2026-01-10',firstPaymentDate:'2026-01-31',interestMode:'free'}))})()"));assert.equal((await run(c,"integratedReplay().totalDebt")),3100000);assert.equal((await run(c,"integratedSpendingAnalysis('2026-01').total")),3100000);let principal=0;for(let i=0;i<24;i++){c.index=i;const date=(await run(c,"(()=>{const d=new Date(2026,index,1);return scheduleDateForMonth(financeSchedules()[0],d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'))})()"));c.date=date;const amount=(await run(c,"cardInstallmentTerms(financeSchedules()[0],date).principal"));principal+=amount;c.amount=amount;assert.equal((await run(c,"(async()=>{return (await completeScheduleOccurrence(financeSchedules()[0].id,date,0,'','',amount,0))})()")),true,date)}assert.equal(principal,3100000);assert.equal((await run(c,'integratedReplay().totalDebt')),0);assert.equal((await run(c,"integratedReplay().assets['cash-main']")),6900000);assert.equal((await run(c,"cardPlanSummary(financeSchedules()[0],'2027-12').remainingPrincipal")),0);assert.equal((await run(c,"scheduleOccurrences('2028-01').length")),0);(await run(c,'state=normalizeState(JSON.parse(JSON.stringify(state)))'));assert.equal((await run(c,'integratedReplay().totalDebt')),0);assert.equal((await run(c,"integratedSpendingAnalysis('2026-02').total")),0);assert.equal((await run(c,"financeSchedules()[0].cardPlan.months")),24)});
test('paid installment estimates differ from actual charges and payment correction preserves principal bounds',async ()=>{const c=(await setup());(await run(c,"(async()=>{return (await createCardInstallment({name:'가전',purchaseAmount:1200000,months:12,annualRate:12,purchaseDate:'2026-01-01',firstPaymentDate:'2026-01-25',interestMode:'paid'}))})()"));assert.equal((await run(c,"cardInstallmentTerms(financeSchedules()[0],'2026-01-25').interest")),12000);assert.equal((await run(c,"cardInstallmentTerms(financeSchedules()[0],'2026-02-25').interest")),11000);assert.equal((await run(c,"(async()=>{return (await completeScheduleOccurrence(financeSchedules()[0].id,'2026-01-25',0,'','',100000,12345))})()")),true);assert.equal((await run(c,"cardPlanSummary(financeSchedules()[0],'2026-01').actualAmount")),112345);assert.equal((await run(c,"(async()=>{return (await updateScheduleActualPayment(financeSchedules()[0].id,'2026-01-25',0,100000,13000))})()")),true);assert.equal((await run(c,"cardPlanSummary(financeSchedules()[0],'2026-01').actualAmount")),113000);const before=(await run(c,'JSON.stringify(state.integrated)'));assert.equal((await run(c,"(async()=>{return (await updateScheduleActualPayment(financeSchedules()[0].id,'2026-01-25',0,1200001,0))})()")),false);assert.equal((await run(c,'JSON.stringify(state.integrated)')),before)});
test('save failures roll back purchase, estimates and actual payment corrections',async ()=>{const c=(await setup());const before=(await run(c,'JSON.stringify(state)'));(await run(c,'persist=()=>false'));assert.equal((await run(c,"(async()=>{return (await createCardInstallment({name:'TV',purchaseAmount:10000,months:2,purchaseDate:'2026-01-01',firstPaymentDate:'2026-02-01',interestMode:'free'}))})()")),'');assert.equal((await run(c,'JSON.stringify(state)')),before);(await run(c,"(async()=>{persist=()=>true;state.financeSchedules.items=[{id:'s',name:'보험',kind:'expense',amount:1000,day:25,startDate:'2026-01-01',active:true}];(await completeScheduleOccurrence('s','2026-01-25',1000));return persist=()=>false})()"));const previous=(await run(c,'JSON.stringify(state.integrated)'));assert.equal((await run(c,"(async()=>{return (await updateScheduleActualPayment('s','2026-01-25',2000))})()")),false);assert.equal((await run(c,'JSON.stringify(state.integrated)')),previous);assert.equal((await run(c,"(async()=>{return (await updateSchedulePlannedAmount('s','2026-01-25',3000,'future'))})()")),false);assert.equal((await run(c,"schedulePlannedAmount(financeSchedules()[0],'2026-02-25')")),1000)});

test('unpaid card cancellation removes linked debt and consumption together and refuses paid purchases',async ()=>{const c=(await setup());(await run(c,"(async()=>{return (await createCardInstallment({name:'TV',purchaseAmount:10000,months:2,purchaseDate:'2026-01-01',firstPaymentDate:'2026-02-01',interestMode:'free'}))})()"));assert.equal((await run(c,"(async()=>{return (await removeUnpaidCardInstallment(financeSchedules()[0].id))})()")),true);assert.equal((await run(c,'integratedReplay().totalDebt')),0);assert.equal((await run(c,"integratedSpendingAnalysis('2026-01').total")),0);assert.equal((await run(c,'financeSchedules().length')),0);(await run(c,"(async()=>{(await createCardInstallment({name:'TV',purchaseAmount:10000,months:2,purchaseDate:'2026-01-01',firstPaymentDate:'2026-02-01',interestMode:'free'}));return (await completeScheduleOccurrence(financeSchedules()[0].id,'2026-02-01',0,'','',5000,0))})()"));const before=(await run(c,'JSON.stringify(state)'));assert.equal((await run(c,"(async()=>{return (await removeUnpaidCardInstallment(financeSchedules()[0].id))})()")),false);assert.equal((await run(c,'JSON.stringify(state)')),before)});

test('installment completion survives restore and never treats a partially paid final installment as settled',async ()=>{
 for(const partial of [false,true]){
  const c=(await setup());(await run(c,"(async()=>{return (await createCardInstallment({name:'완료 검증',purchaseAmount:10001,months:2,purchaseDate:'2026-01-01',firstPaymentDate:'2026-01-31',interestMode:'free'}))})()"));
  assert.equal((await run(c,"(async()=>{return (await completeScheduleOccurrence(financeSchedules()[0].id,'2026-01-31',0,'','',5000,0))})()")),true);
  assert.equal((await run(c,`completeScheduleOccurrence(financeSchedules()[0].id,'2026-02-28',0,'','',${partial?5000:5001},0)`)),true);
  (await run(c,'state=normalizeState(JSON.parse(JSON.stringify(state)))'));
  const summary=(await run(c,"cardPlanSummary(financeSchedules()[0],'2026-03')"));
  assert.equal(summary.paidInstallments,2);assert.equal(summary.completed,!partial);assert.equal(summary.remainingPrincipal,partial?1:0);
  assert.equal((await run(c,"scheduleOccurrences('2026-03').length")),0);
  assert.equal((await run(c,'financeSchedules().length')),1);assert.equal((await run(c,'state.integrated.ledger.filter(t=>t.meta?.cardPurchase).length')),1);
  const before=(await run(c,'JSON.stringify(state.integrated)'));
  assert.equal((await run(c,"(async()=>{return (await completeScheduleOccurrence(financeSchedules()[0].id,'2026-02-28',0,'','',5001,0))})()")),false);
  assert.equal((await run(c,'JSON.stringify(state.integrated)')),before);
 }
});

test('failed final installment storage leaves debt and completion unchanged and retry posts once',async ()=>{
 const c=(await setup());(await run(c,"(async()=>{(await createCardInstallment({name:'저장 실패 검증',purchaseAmount:10000,months:2,purchaseDate:'2026-01-01',firstPaymentDate:'2026-01-25',interestMode:'free'}));return (await completeScheduleOccurrence(financeSchedules()[0].id,'2026-01-25',0,'','',5000,0))})()"));
 // Use the production persistence implementation so quota failure and rollback are real.
 (await run(c,'persist=productionPersist'));
 (await run(c,"lastPersistedState=clone(state);localStorage.setItem=()=>{throw new Error('quota')}"));
 assert.equal((await run(c,"(async()=>{return (await completeScheduleOccurrence(financeSchedules()[0].id,'2026-02-25',0,'','',5000,0))})()")),false);
 assert.equal((await run(c,'integratedReplay().totalDebt')),5000);assert.equal((await run(c,"cardPlanSummary(financeSchedules()[0],'2026-02').completed")),false);
 (await run(c,'localStorage.setItem=()=>{}'));assert.equal((await run(c,"(async()=>{return (await completeScheduleOccurrence(financeSchedules()[0].id,'2026-02-25',0,'','',5000,0))})()")),true);
 assert.equal((await run(c,'integratedReplay().totalDebt')),0);assert.equal((await run(c,"cardPlanSummary(financeSchedules()[0],'2026-02').completed")),true);
 assert.equal((await run(c,"state.integrated.ledger.filter(t=>t.meta?.scheduleDate==='2026-02-25').length")),1);
});

test('three-month principal splits preserve 360000 and 370000 won exactly',async()=>{
 for(const [amount,expected] of [[360000,[120000,120000,120000]],[370000,[123333,123333,123334]]]){
  const c=await setup();c.amount=amount;
  assert.ok(await run(c,"createCardInstallment({name:'3개월',purchaseAmount:amount,months:3,purchaseDate:'2026-01-01',firstPaymentDate:'2026-01-31',interestMode:'free'})"));
  const terms=['2026-01-31','2026-02-28','2026-03-31'].map(date=>{c.date=date;return run(c,'cardInstallmentTerms(financeSchedules()[0],date)')});
  assert.deepEqual(terms.map(t=>t.principal),expected);assert.equal(terms.reduce((n,t)=>n+t.total,0),amount);
 }
});

test('initial interest-free periods survive backup and post interest only after their boundary',async()=>{
 const c=await setup();
 assert.ok(await run(c,"createCardInstallment({name:'부분 무이자',purchaseAmount:370000,months:6,annualRate:12,interestMode:'partial',interestFreeMonths:3,purchaseDate:'2026-01-01',firstPaymentDate:'2026-01-31'})"));
 await run(c,'state=normalizeState(validateBackupPayload(parseBackupZipBytes(createBackupZipBytes(backupPayload()))))');
 let principal=0,interest=0;
 for(let i=0;i<6;i++){
  c.month='2026-'+String(i+1).padStart(2,'0');c.date=run(c,'scheduleDateForMonth(financeSchedules()[0],month)');
  const terms=run(c,'cardInstallmentTerms(financeSchedules()[0],date)');
  assert.equal(terms.interest,i<3?0:Math.round((370000-61666*i)*.01));principal+=terms.principal;interest+=terms.interest;
  c.principal=terms.principal;c.interest=terms.interest;
  assert.equal(await run(c,"completeScheduleOccurrence(financeSchedules()[0].id,date,0,'','',principal,interest)"),true);
 }
 assert.equal(principal,370000);assert.equal(interest,3700);assert.equal(run(c,'integratedReplay().totalDebt'),0);
 assert.equal(run(c,"integratedReplay().assets['cash-main']"),10000000-370000-interest);
 assert.equal(run(c,"cardPlanSummary(financeSchedules()[0],'2026-06').completed"),true);
});

test('invalid initial interest-free periods and malformed rates cannot mutate money',async()=>{
 const c=await setup(),before=run(c,'JSON.stringify(state)');
 for(const bad of [0,-1,3,4,1.5,'bad',null]){
  c.bad=bad;assert.equal(await run(c,"createCardInstallment({name:'거부',purchaseAmount:370000,months:3,annualRate:12,interestMode:'partial',interestFreeMonths:bad,purchaseDate:'2026-01-01',firstPaymentDate:'2026-01-31'})"),'');
  assert.equal(run(c,'JSON.stringify(state)'),before);
 }
 assert.equal(await run(c,"createCardInstallment({name:'거부',purchaseAmount:370000,months:3,annualRate:'broken',interestMode:'paid',purchaseDate:'2026-01-01',firstPaymentDate:'2026-01-31'})"),'');
 assert.equal(run(c,'JSON.stringify(state)'),before);
});
