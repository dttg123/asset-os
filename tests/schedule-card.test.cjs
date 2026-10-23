'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
function env(){const storage=new Map(),c=vm.createContext({console,Date,Set,Map,URL,Blob,TextEncoder,TextDecoder,Uint8Array,DataView,ArrayBuffer,Intl,Math,JSON,Number,String,Boolean,Object,RegExp,Promise,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{querySelector:()=>null,querySelectorAll:()=>[],documentElement:{dataset:{}},body:{dataset:{}}},window:{addEventListener:()=>{}},navigator:{},location:{search:'?qa=1',hash:''},setTimeout:()=>0,clearTimeout:()=>{}});for(const f of ['core-config.js','src/integrations/kis-normalization.js','broker-kis.js','data-defaults.js','src/domain/integrated-replay.js','src/domain/integrated-ledger-core.js','src/domain/integrated-ledger.js','src/domain/integrated-ledger-validation.js','src/domain/financial-current.js','src/domain/financial-history.js','src/domain/integrated-spending.js','integrated-schedule-engine.js','integrated-finance-engine.js','src/storage/state-migrations.js','src/storage/snapshot-retention.js','store-state.js','core-accessors.js','src/domain/investment-position.js','pension-contributions.js','pension-ledger.js','pension-assets.js','isa-validation.js','isa-ledger.js','isa-registration.js','isa-maturity-policy.js','integrated-forms.js','ui-render.js','integrated-finance-ui.js','insurance.js','backup.js','export-csv.js','integrated-pages.js','src/app/schedule-completion.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c,{filename:f});const bytes=fs.readFileSync(path.join(root,'tests/fixtures/legacy/schema-v21-30y-backup.zip')),offset=30+bytes.readUInt16LE(26)+bytes.readUInt16LE(28);c.fixture=JSON.parse(require('node:zlib').inflateRawSync(bytes.subarray(offset,offset+bytes.readUInt32LE(18))).toString()).data;vm.runInContext('state=normalizeState(fixture)',c);return c}
const run=(c,s)=>vm.runInContext(s,c);

async function setupCardV2(){const c=await setup();await run(c,"(async()=>{globalThis.cardTestError='';toast=x=>{globalThis.cardTestError=x};globalThis.testCard=await saveCardAccount({name:'가상 국민카드',issuer:'국민카드',paymentDay:14});return globalThis.newPurchase=(extra={})=>createCardPurchase({name:'가상 TV',cardId:testCard,category:'가전·전자',merchant:'가상 가맹점',purchaseAmount:370000,months:3,purchaseDate:'2026-01-01',firstPaymentDate:'2026-01-14',interestMode:'free',...extra})})()");return c}

test('card v2: three independent ledgers preserve gross purchase and exact remainder without modifying investment data',async()=>{
 const c=await setupCardV2(),isa=run(c,'JSON.stringify(state.accounts)'),pension=run(c,'JSON.stringify(state.pension)');assert.ok(await run(c,"(async()=>{return globalThis.v2id=await newPurchase()})()"));
 assert.equal(run(c,'integratedReplay().totalDebt'),370000);assert.equal(run(c,"integratedSpendingAnalysis('2026-01').total"),370000);
 assert.deepEqual(JSON.parse(run(c,"JSON.stringify(['2026-01-14','2026-02-14','2026-03-14'].map(d=>cardInstallmentTerms(financeSchedules()[0],d).principal))")),[123333,123333,123334]);
 assert.equal(run(c,'JSON.stringify(state.accounts)'),isa);assert.equal(run(c,'JSON.stringify(state.pension)'),pension);
 assert.equal(run(c,"cardLedgerDataIssue(state)"),'');
 await run(c,'state=normalizeState(validateBackupPayload(parseBackupZipBytes(createBackupZipBytes(backupPayload()))))');assert.equal(run(c,'cardV2(financeSchedules()[0]).purchaseAmount'),370000);
});

test('card v2: actual issuer bill, discount and points reduce debt once and cash only by actual cash payment',async()=>{
 const c=await setupCardV2();assert.ok(await run(c,"(async()=>{return globalThis.v2id=await newPurchase({purchaseAmount:1200000,months:12})})()"));
 assert.ok(await run(c,"(async()=>{return globalThis.v2bill=await saveCardBill(v2id,{issuedDate:'2026-01-05',dueDate:'2026-01-14',principal:100000,interest:3000,principalDiscount:5000,interestDiscount:0})})()"));
 assert.equal(run(c,'integratedReplay().totalDebt'),1195000);assert.equal(run(c,"integratedSpendingAnalysis('2026-01').total"),1195000);
 assert.equal(run(c,'integratedReplay().assets["cash-main"]'),10000000);assert.equal(run(c,"schedulePlannedAmount(financeSchedules()[0],'2026-01-14')"),98000);
 assert.ok(await run(c,"recordCardPayment(v2id,{billId:v2bill,date:'2026-01-10',pointsPrincipal:2000,pointsInterest:0})"));
 assert.equal(run(c,'integratedReplay().totalDebt'),1100000);assert.equal(run(c,'integratedReplay().assets["cash-main"]'),9904000);
 assert.equal(run(c,"integratedSpendingAnalysis('2026-01').total"),1195000);assert.equal(run(c,"scheduleOccurrences('2026-01')[0].status"),'done');
 const stable=run(c,'JSON.stringify(state)');assert.equal(await run(c,"recordCardPayment(v2id,{billId:v2bill,date:'2026-01-10'})"),'');assert.equal(run(c,'JSON.stringify(state)'),stable);
 await run(c,'state=normalizeState(validateBackupPayload(parseBackupZipBytes(createBackupZipBytes(backupPayload()))))');assert.equal(run(c,'cardLedgerDataIssue(state)'),'');assert.equal(run(c,'integratedReplay().totalDebt'),1100000);
});

test('card v2: one bill prepayment leaves future installments while payoff settles the whole principal',async()=>{
 const c=await setupCardV2();await run(c,"(async()=>{globalThis.v2id=await newPurchase();return globalThis.v2bill=await saveCardBill(v2id,{issuedDate:'2026-01-02',dueDate:'2026-01-14',principal:123333,interest:0})})()");
 assert.ok(await run(c,"recordCardPayment(v2id,{billId:v2bill,date:'2026-01-03'})"));assert.equal(run(c,'cardRemaining(financeSchedules()[0])'),246667);assert.equal(run(c,"scheduleOccurrences('2026-02').length"),1);
 assert.ok(await run(c,"(async()=>{return globalThis.payoff=await recordCardPayment(v2id,{kind:'payoff',date:'2026-01-04',principal:246667,interest:777})})()"));
 assert.equal(run(c,'cardRemaining(financeSchedules()[0])'),0);assert.equal(run(c,"scheduleOccurrences('2026-02').length"),0);assert.equal(run(c,'integratedReplay().assets["cash-main"]'),9629223);
 assert.equal(await run(c,'removeCardPayment(v2id,payoff)'),true);assert.equal(run(c,'cardRemaining(financeSchedules()[0])'),246667);
});

test('card v2: identical same-day same-merchant purchases remain independent through edits, refunds and deletion',async()=>{
 const c=await setupCardV2();await run(c,"(async()=>{globalThis.a=await newPurchase();return globalThis.b=await newPurchase()})()");const other=run(c,'JSON.stringify(financeSchedules().find(s=>s.id===b))');
 assert.equal(await run(c,"updateCardPurchase(a,{name:'수정 TV',cardId:testCard,purchaseAmount:360000,months:3,purchaseDate:'2026-01-01',firstPaymentDate:'2026-01-14',interestMode:'free',category:'가전·전자'})"),true);
 assert.ok(await run(c,"(async()=>{return globalThis.ref=await recordCardRefund(a,{date:'2026-01-02',amount:60000})})()"));assert.equal(run(c,'cardRemaining(financeSchedules().find(s=>s.id===a))'),300000);
 assert.equal(run(c,'JSON.stringify(financeSchedules().find(s=>s.id===b))'),other);assert.equal(await run(c,'removeCardRefund(a,ref)'),true);assert.equal(await run(c,'removeUnpaidCardInstallment(a)'),true);
 assert.equal(run(c,'financeSchedules().length'),1);assert.equal(run(c,'financeSchedules()[0].id'),run(c,'b'));assert.equal(run(c,'integratedReplay().totalDebt'),370000);
});

test('card v2: paid refunds distinguish actual cash, restored points and unpaid principal',async()=>{
 const c=await setupCardV2();await run(c,"(async()=>{globalThis.v2id=await newPurchase({purchaseAmount:100000,months:1});globalThis.v2bill=await saveCardBill(v2id,{issuedDate:'2026-01-02',dueDate:'2026-01-14',principal:100000,interest:0});return await recordCardPayment(v2id,{billId:v2bill,date:'2026-01-03',pointsPrincipal:20000})})()");
 const stable=run(c,'JSON.stringify(state)');assert.equal(await run(c,"recordCardRefund(v2id,{date:'2026-01-04',amount:100000})"),'');assert.equal(run(c,'JSON.stringify(state)'),stable,'refund destination must never be guessed');
 assert.ok(await run(c,"recordCardRefund(v2id,{date:'2026-01-04',amount:100000,cashAmount:80000,pointsAmount:20000})"));assert.equal(run(c,'integratedReplay().assets["cash-main"]'),10000000);assert.equal(run(c,'integratedReplay().totalDebt'),0);assert.equal(run(c,"integratedSpendingAnalysis('2026-01').total"),0);
});

test('card v2: actual bills can differ by one won, interest waiver rounds are explicit, and zero-cash payments survive restore',async()=>{
 const c=await setupCardV2();await run(c,"(async()=>{return globalThis.v2id=await newPurchase({purchaseAmount:360000,months:6,interestMode:'partial',paidInterestRounds:[1,2,3],annualRate:12})})()");
 assert.equal(run(c,"cardInstallmentTerms(financeSchedules()[0],'2026-01-14').interest"),3600);assert.equal(run(c,"cardInstallmentTerms(financeSchedules()[0],'2026-04-14').interest"),0);
 assert.ok(await run(c,"(async()=>{return globalThis.v2bill=await saveCardBill(v2id,{issuedDate:'2026-01-02',dueDate:'2026-01-15',principal:60001,interest:3600})})()"));assert.equal(run(c,"scheduleDateForMonth(financeSchedules()[0],'2026-01')"),'2026-01-15');
 assert.ok(await run(c,"recordCardPayment(v2id,{billId:v2bill,date:'2026-01-03',pointsPrincipal:60001,pointsInterest:3600})"));assert.equal(run(c,'integratedReplay().assets["cash-main"]'),10000000);
 await run(c,'state=normalizeState(validateBackupPayload(parseBackupZipBytes(createBackupZipBytes(backupPayload()))))');assert.equal(run(c,"scheduleOccurrences('2026-01')[0].status"),'done');assert.equal(run(c,'cardRemaining(financeSchedules()[0])'),299999);
});

test('card v2: failed writes and invalid money preserve purchase, bill, payment and non-card ledgers',async()=>{
 const c=await setupCardV2();const before=run(c,'JSON.stringify(state)');await run(c,'persist=()=>false');assert.equal(await run(c,'newPurchase()'),'');assert.equal(run(c,'JSON.stringify(state)'),before);
 await run(c,"(async()=>{persist=()=>true;return globalThis.v2id=await newPurchase()})()");const stable=run(c,'JSON.stringify(state)');await run(c,'persist=()=>false');assert.equal(await run(c,"saveCardBill(v2id,{issuedDate:'2026-01-02',dueDate:'2026-01-14',principal:123333,interest:0})"),'');assert.equal(run(c,'JSON.stringify(state)'),stable);
 await run(c,'persist=()=>true');for(const expression of ["newPurchase({purchaseAmount:1.5})","newPurchase({purchaseAmount:Number.MAX_SAFE_INTEGER+1})","newPurchase({interestMode:'partial',paidInterestRounds:[0,4]})","recordCardRefund(v2id,{date:'2025-12-31',amount:1})"]){assert.equal(await run(c,expression),'');assert.equal(run(c,'JSON.stringify(state)'),stable)}
});

test('card v2: malformed card backups are rejected rather than normalizing away financial evidence',async()=>{
 const c=await setupCardV2();await run(c,"(async()=>{globalThis.v2id=await newPurchase();globalThis.v2bill=await saveCardBill(v2id,{issuedDate:'2026-01-02',dueDate:'2026-01-14',principal:123333,interest:0});return await recordCardPayment(v2id,{billId:v2bill,date:'2026-01-03'})})()");
 for(const corrupt of ["data.financeSchedules.items[0].cardPlan.payments[0].rowIds=[]","data.financeSchedules.items[0].cardPlan.bills='broken'","data.settings.cardAccounts[0].paymentDay=32","data.financeSchedules.items[0].cardPlan.payments[0].cash++"]){c.corrupt=corrupt;assert.throws(()=>run(c,"(()=>{const payload=backupPayload(),data=payload.data;eval(corrupt);return validateBackupPayload(payload)})()"),/카드/)}
 assert.equal(run(c,'cardRemaining(financeSchedules()[0])'),246667);
});

test('card v2: production persistence quota failure rolls back bill and payment as one operation',async()=>{
 const c=await setupCardV2();await run(c,"(async()=>{globalThis.v2id=await newPurchase();persist=productionPersist;lastPersistedState=clone(state);localStorage.setItem=()=>{throw new Error('quota-v2')}})()");
 const before=run(c,'JSON.stringify({integrated:state.integrated,schedules:state.financeSchedules})');assert.equal(await run(c,"saveCardBill(v2id,{issuedDate:'2026-01-02',dueDate:'2026-01-14',principal:123333,interest:10,principalDiscount:100})"),'');assert.equal(run(c,'JSON.stringify({integrated:state.integrated,schedules:state.financeSchedules})'),before);
 await run(c,"(async()=>{localStorage.setItem=()=>{};globalThis.v2bill=await saveCardBill(v2id,{issuedDate:'2026-01-02',dueDate:'2026-01-14',principal:123333,interest:10,principalDiscount:100});lastPersistedState=clone(state);localStorage.setItem=()=>{throw new Error('quota-v2')}})()");
 const stable=run(c,'JSON.stringify({integrated:state.integrated,schedules:state.financeSchedules})');assert.equal(await run(c,"recordCardPayment(v2id,{billId:v2bill,date:'2026-01-03',pointsPrincipal:3000})"),'');assert.equal(run(c,'JSON.stringify({integrated:state.integrated,schedules:state.financeSchedules})'),stable);assert.equal(run(c,'cardRemaining(financeSchedules()[0])'),369900);
});

test('card v2: a fully waived bill records zero cash without losing completion after ZIP restore',async()=>{
 const c=await setupCardV2();await run(c,"(async()=>{globalThis.v2id=await newPurchase({purchaseAmount:10000,months:1});globalThis.v2bill=await saveCardBill(v2id,{issuedDate:'2026-01-02',dueDate:'2026-01-14',principal:10000,interest:0,principalDiscount:10000})})()");
 assert.equal(run(c,'cardPlanSummary(financeSchedules()[0],"2026-01").completed'),false);assert.ok(await run(c,"recordCardPayment(v2id,{billId:v2bill,date:'2026-01-03'})"));assert.equal(run(c,'integratedReplay().assets["cash-main"]'),10000000);
 await run(c,'state=normalizeState(validateBackupPayload(parseBackupZipBytes(createBackupZipBytes(backupPayload()))))');assert.equal(run(c,'cardPlanSummary(financeSchedules()[0],"2026-01").completed'),true);assert.equal(run(c,"scheduleOccurrences('2026-01')[0].status"),'done');
});

test('spending v2: annual sums, refund item identity and category remapping preserve raw financial rows',async()=>{
 const c=await setupCardV2();await run(c,"(async()=>{globalThis.v2id=await newPurchase();await recordCardRefund(v2id,{date:'2026-02-02',amount:70000})})()");
 assert.equal(run(c,"integratedSpendingAnalysis('2026').total"),300000);assert.equal(run(c,"integratedSpendingAnalysis('2026-02').items[0].key"),'가상 TV');assert.equal(run(c,"integratedSpendingAnalysis('2026-02').total"),-70000);
 const before=run(c,'JSON.stringify(state.integrated.ledger)');assert.equal(await run(c,"saveSpendingCategory('가전·전자','가전·생활')"),true);assert.equal(run(c,"integratedSpendingAnalysis('2026').categories[0].key"),'가전·생활');assert.equal(run(c,'JSON.stringify(state.integrated.ledger)'),before);
 const settings=run(c,'JSON.stringify(state.settings)');await run(c,'persist=()=>false');assert.equal(await run(c,"saveSpendingCategory('가전·생활','기타')"),false);assert.equal(run(c,'JSON.stringify(state.settings)'),settings);
});

test('card v2: an actual interest refund restores cash or points without reducing purchase consumption twice',async()=>{
 const c=await setupCardV2();await run(c,"(async()=>{globalThis.v2id=await newPurchase({purchaseAmount:100000,months:1});globalThis.v2bill=await saveCardBill(v2id,{issuedDate:'2026-01-02',dueDate:'2026-01-14',principal:100000,interest:3000});await recordCardPayment(v2id,{billId:v2bill,date:'2026-01-03',pointsInterest:1000})})()");
 assert.equal(run(c,'integratedReplay().assets["cash-main"]'),9898000);assert.ok(await run(c,"recordCardRefund(v2id,{date:'2026-01-04',amount:0,interestCashAmount:2000,interestPointsAmount:1000})"));
 assert.equal(run(c,'integratedReplay().assets["cash-main"]'),9900000);assert.equal(run(c,"integratedSpendingAnalysis('2026-01').total"),100000);assert.equal(run(c,"integratedSummary('2026-01').fixed"),0);assert.equal(run(c,'cardRemaining(financeSchedules()[0])'),0);
 assert.equal(await run(c,"recordCardRefund(v2id,{date:'2026-01-04',amount:0,interestCashAmount:1})"),'');
 await run(c,'state=normalizeState(validateBackupPayload(parseBackupZipBytes(createBackupZipBytes(backupPayload()))))');assert.equal(run(c,'cardLedgerDataIssue(state)'),'');
});

test('card v2: subsequent interest estimates account for confirmed refunds instead of the original balance',async()=>{
 const c=await setupCardV2();await run(c,"(async()=>{globalThis.v2id=await newPurchase({purchaseAmount:360000,months:6,interestMode:'paid',annualRate:12});globalThis.v2bill=await saveCardBill(v2id,{issuedDate:'2026-01-02',dueDate:'2026-01-14',principal:60000,interest:3600});await recordCardPayment(v2id,{billId:v2bill,date:'2026-01-14'});await recordCardRefund(v2id,{date:'2026-01-15',amount:30000})})()");
 assert.equal(run(c,"cardInstallmentTerms(financeSchedules()[0],'2026-02-14').interest"),2700);assert.equal(run(c,'cardRemaining(financeSchedules()[0])'),270000);
});

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

test('same-date equal-amount installments only complete their own linked payment',async()=>{
 const c=await setup();await run(c,"(async()=>{for(const name of ['TV','냉장고'])await createCardInstallment({name,purchaseAmount:360000,months:3,purchaseDate:'2026-01-01',firstPaymentDate:'2026-01-31',interestMode:'free'});await completeScheduleOccurrence(financeSchedules()[0].id,'2026-01-31',0,'','',120000,0)})()");
 assert.equal(run(c,"scheduleCompletionTx(financeSchedules()[1].id,'2026-01-31')"),null);
 assert.equal(run(c,"cardPlanSummary(financeSchedules()[1],'2026-01').paidInstallments"),0);
 assert.equal(await run(c,"completeScheduleOccurrence(financeSchedules()[1].id,'2026-01-31',0,'','',120000,0)"),true);
 assert.equal(run(c,'integratedReplay().totalDebt'),480000);
});

test('deleting scheduled principal removes its paired interest and completion, preserving other payments',async()=>{
 const c=await setup();await run(c,"(async()=>{for(const name of ['TV','냉장고'])await createCardInstallment({name,purchaseAmount:360000,months:3,annualRate:12,purchaseDate:'2026-01-01',firstPaymentDate:'2026-01-31',interestMode:'paid'});for(const s of financeSchedules())await completeScheduleOccurrence(s.id,'2026-01-31',0,'','',120000,3600)})()");
 const other=run(c,"JSON.stringify(state.integrated.ledger.filter(t=>t.meta?.scheduleId===financeSchedules()[1].id))");
 await run(c,"(async()=>{globalThis.sheetDirty=false;showDialog=(_options,confirm)=>{globalThis.confirmDeletion=confirm};closeSheets=()=>{};nav=()=>{};haptic=()=>{};deleteIntegratedTransaction(state.integrated.ledger.find(t=>t.meta?.scheduleId===financeSchedules()[0].id&&t.type==='debtPrincipal').id);await confirmDeletion()})()");
 assert.equal(run(c,"state.integrated.ledger.filter(t=>t.meta?.scheduleId===financeSchedules()[0].id).length"),0);
 assert.equal(run(c,"scheduleCompletionTx(financeSchedules()[0].id,'2026-01-31')"),null);
 assert.equal(run(c,"JSON.stringify(state.integrated.ledger.filter(t=>t.meta?.scheduleId===financeSchedules()[1].id))"),other);
 assert.equal(run(c,'integratedReplay().totalDebt'),600000);
});

test('editing deposit interest note preserves its credited account and product metadata',async()=>{
 const c=await setup();c.FormData=class{constructor(form){this.data=form.data}get(k){return this.data[k]??null}};
 run(c,"state.integrated.accounts.push({id:'deposit-interest',name:'예금',kind:'deposit'});state.integrated.ledger.push({id:'interest-note',date:'2026-01-31',type:'externalIncome',amount:1000,toAccountId:'deposit-interest',productId:'deposit',category:'예금 이자',note:'원래',meta:{financeInterest:true,periodStart:'2026-01-01',periodEnd:'2026-01-31'}});globalThis.editForm={dataset:{editId:'interest-note'},data:{uiType:'externalIncome',date:'2026-01-31',amount:'1000',category:'예금 이자',note:'수정'}}");
 const candidate=run(c,'integratedCandidatesFromForm(editForm)[0]');
 assert.equal(candidate.toAccountId,'deposit-interest');assert.equal(candidate.productId,'deposit');assert.equal(candidate.meta.financeInterest,true);assert.equal(candidate.note,'수정');
});

test('legacy loan matching never equates empty product IDs and ambiguous manual rows stay unlinked',async()=>{
 const c=await setup();run(c,"state.integrated.liabilities.push({id:'loan-a',name:'대출 A'},{id:'loan-b',name:'대출 B'});state.financeSchedules.items=[{id:'a',name:'대출 A',kind:'loan',liabilityId:'loan-a',amount:1000,day:25,active:true},{id:'b',name:'대출 B',kind:'loan',liabilityId:'loan-b',amount:1000,day:25,active:true}];state.integrated.ledger.push({id:'manual-a',date:'2026-01-25',type:'debtInterest',amount:1000,liabilityId:'loan-a',fromAccountId:'cash-main'});");
 assert.equal(run(c,"scheduleCompletionTx('a','2026-01-25').id"),'manual-a');assert.equal(run(c,"scheduleCompletionTx('b','2026-01-25')"),null);
 run(c,"state.financeSchedules.items.push({...financeSchedules()[0],id:'duplicate-a'})");assert.equal(run(c,"scheduleCompletionTx('a','2026-01-25')"),null);
});

test('incomplete loan components are not completed or duplicated, and deletion failure restores the whole group',async()=>{
 const c=await setup();await run(c,"(async()=>{await createCardInstallment({name:'유이자',purchaseAmount:360000,months:3,annualRate:12,purchaseDate:'2026-01-01',firstPaymentDate:'2026-01-31',interestMode:'paid'});await completeScheduleOccurrence(financeSchedules()[0].id,'2026-01-31',0,'','',120000,3600)})()");
 const original=run(c,'JSON.stringify(state.integrated)');
 await run(c,"(async()=>{globalThis.sheetDirty=false;showDialog=(_options,confirm)=>{globalThis.confirmDeletion=confirm};closeSheets=()=>{};nav=()=>{};haptic=()=>{};persist=()=>false;deleteIntegratedTransaction(state.integrated.ledger.find(t=>t.type==='debtInterest').id);await confirmDeletion()})()");
 assert.equal(run(c,'JSON.stringify(state.integrated)'),original);
 run(c,"persist=()=>true;state.integrated.ledger=state.integrated.ledger.filter(t=>t.type!=='debtPrincipal')");
 assert.equal(run(c,"scheduleCompletionTx(financeSchedules()[0].id,'2026-01-31')"),null);
 const partial=run(c,'JSON.stringify(state.integrated)');assert.equal(await run(c,"completeScheduleOccurrence(financeSchedules()[0].id,'2026-01-31',0,'','',120000,3600)"),false);assert.equal(run(c,'JSON.stringify(state.integrated)'),partial);
 await run(c,"(async()=>{deleteIntegratedTransaction(state.integrated.ledger.find(t=>t.type==='debtInterest').id);await confirmDeletion()})()");assert.equal(run(c,"state.integrated.ledger.some(t=>t.meta?.scheduleId)"),false);
});

test('interest edits and deletions synchronize observations, reject invalid periods and roll back failed writes',async()=>{
 const c=await setup();c.FormData=class{constructor(form){this.data=form.data}get(k){return this.data[k]??null}};
 run(c,"globalThis.sheetDirty=false;closeSheets=()=>{};nav=()=>{};haptic=()=>{};integratedFormEntryPreset=()=>null;formShowError=(_form,message)=>{globalThis.formError=message};state.financialProducts={items:[{id:'deposit',name:'예금',type:'deposit',status:'active',startDate:'2026-01-01'}],events:[{id:'observed',productId:'deposit',date:'2026-01-31',type:'interestObserved',amount:1000,note:'원래',meta:{ledgerId:'interest-note',includedInAsset:true,periodStart:'2026-01-01',periodEnd:'2026-01-31'}}]};state.integrated.accounts.push({id:'deposit-interest',name:'예금',kind:'deposit',productId:'deposit'});state.integrated.ledger.push({id:'interest-note',date:'2026-01-31',type:'externalIncome',amount:1000,toAccountId:'deposit-interest',productId:'deposit',category:'예금 이자',note:'원래',meta:{financeInterest:true}});globalThis.editForm={dataset:{editId:'interest-note'},data:{uiType:'externalIncome',date:'2026-01-31',amount:'2000',category:'예금 이자',note:'수정'}}");
 await run(c,'saveIntegratedTransaction(editForm)');assert.equal(run(c,"integratedReplay().assets['deposit-interest']"),2000);assert.equal(run(c,"state.financialProducts.events[0].amount"),2000);assert.equal(run(c,"state.financialProducts.events[0].note"),'수정');
 const before=run(c,'JSON.stringify({integrated:state.integrated,events:state.financialProducts.events})');
 run(c,"editForm.data.date='2026-01-20'");await run(c,'saveIntegratedTransaction(editForm)');assert.match(c.formError,/종료일.*확인일/);assert.equal(run(c,'JSON.stringify({integrated:state.integrated,events:state.financialProducts.events})'),before);
 run(c,"editForm.data.date='2026-01-31';editForm.data.amount='3000';persist=()=>false");await run(c,'saveIntegratedTransaction(editForm)');assert.equal(run(c,'JSON.stringify({integrated:state.integrated,events:state.financialProducts.events})'),before);
 await run(c,"(async()=>{showDialog=(_options,confirm)=>{globalThis.confirmDeletion=confirm};deleteIntegratedTransaction('interest-note');await confirmDeletion()})()");assert.equal(run(c,'JSON.stringify({integrated:state.integrated,events:state.financialProducts.events})'),before);
 await run(c,"(async()=>{persist=()=>true;deleteIntegratedTransaction('interest-note');await confirmDeletion()})()");assert.equal(run(c,"state.financialProducts.events.length"),0);assert.equal(run(c,"integratedReplay().assets['deposit-interest']"),0);
});

test('product-linked repayment and transfer memo edits retain category, funding metadata and account routing',async()=>{
 const c=await setup();c.FormData=class{constructor(form){this.data=form.data}get(k){return this.data[k]??null}};
 run(c,"state.integrated.accounts.push({id:'deposit-interest',name:'예금',kind:'deposit'});state.integrated.ledger.push({id:'repay-note',date:'2026-01-31',type:'debtPrincipal',amount:1000,fromAccountId:'cash-main',liabilityId:'debt-qa',productId:'loan-qa',category:'회사 대출 상환',meta:{fundingSource:'tracked'}},{id:'transfer-note',date:'2026-01-31',type:'internalTransfer',amount:1000,fromAccountId:'cash-main',toAccountId:'deposit-interest',productId:'deposit',category:'예금 납입',meta:{fundingSource:'tracked'}})");
 for(const [id,uiType,category] of [['repay-note','loanPayment','회사 대출 상환'],['transfer-note','savingInvestment','예금 납입']]){
  c.editForm={dataset:{editId:id},data:{uiType,date:'2026-01-31',amount:'1000',principal:'1000',interest:'0',liabilityId:'debt-qa',toAccountId:'deposit-interest',category,note:'메모 변경'}};
  const candidate=run(c,'integratedCandidatesFromForm(editForm)[0]');assert.equal(candidate.category,category);assert.equal(candidate.meta.fundingSource,'tracked');assert.ok(candidate.productId);assert.equal(candidate.fromAccountId,'cash-main');assert.equal(candidate.note,'메모 변경');
 }
});

for(const kind of ['income','expense','insurance','saving','investment','loan'])test(`collision lifecycle matrix: ${kind} keeps schedule identity through retry, correction, deletion and ZIP restore`,async()=>{
 const c=await setup();c.matrixKind=kind;
 run(c,"globalThis.sheetDirty=false;closeSheets=()=>{};nav=()=>{};haptic=()=>{};showDialog=(_options,confirm)=>{globalThis.confirmDeletion=confirm};state.integrated.accounts.push({id:'matrix-target',name:'검사 예금',kind:'deposit'});state.integrated.liabilities.push({id:'matrix-loan-a',name:'검사 대출'},{id:'matrix-loan-b',name:'검사 대출'});state.integrated.ledger.push({id:'matrix-debt-a',date:'2026-01-01',type:'openingLiability',liabilityId:'matrix-loan-a',amount:100000},{id:'matrix-debt-b',date:'2026-01-01',type:'openingLiability',liabilityId:'matrix-loan-b',amount:100000});state.financeSchedules.items=['a','b'].map(suffix=>({id:'matrix-'+suffix,name:'동일 이름',kind:matrixKind,amount:1000,day:25,startDate:'2026-01-01',active:true,targetAccountId:'matrix-target',targetKind:'deposit',liabilityId:'matrix-loan-'+suffix}));persist=productionPersist;lastPersistedState=clone(state)");
 // Actual persistence failure must not mark a payment complete or leak a row.
 const before=run(c,'JSON.stringify(state.integrated.ledger)');run(c,"localStorage.setItem=()=>{throw new Error('matrix quota')}");
 assert.equal(await run(c,"completeScheduleOccurrence('matrix-a','2026-01-25',1000,'','',1000,0)"),false);
 assert.equal(run(c,'JSON.stringify(state.integrated.ledger)'),before);assert.equal(run(c,"scheduleCompletionTx('matrix-a','2026-01-25')"),null);
 run(c,'localStorage.setItem=()=>{}');assert.equal(await run(c,"completeScheduleOccurrence('matrix-a','2026-01-25',1000,'','',1000,0)"),true);
 assert.equal(run(c,"scheduleCompletionTx('matrix-b','2026-01-25')"),null);
 assert.equal(await run(c,"completeScheduleOccurrence('matrix-a','2026-01-25',1000,'','',1000,0)"),false);
 for(const [id,date] of [['matrix-b','2026-01-25'],['matrix-a','2026-02-25'],['matrix-b','2026-02-25']]){c.matrixId=id;c.matrixDate=date;assert.equal(await run(c,"completeScheduleOccurrence(matrixId,matrixDate,1000,'','',1000,0)"),true)}
 assert.equal(await run(c,"updateScheduleActualPayment('matrix-a','2026-01-25',2000,2000,0)"),true);
 assert.equal(run(c,"Number(scheduleCompletionTx('matrix-b','2026-01-25').meta.actualAmount)"),1000);
 await run(c,'state=normalizeState(validateBackupPayload(parseBackupZipBytes(createBackupZipBytes(backupPayload()))))');
 const kept=run(c,"JSON.stringify(state.integrated.ledger.filter(t=>t.meta?.scheduleId&&(t.meta.scheduleId!=='matrix-a'||t.meta.scheduleDate!=='2026-01-25')))");
 await run(c,"(async()=>{deleteIntegratedTransaction(scheduleCompletionTx('matrix-a','2026-01-25').id);await confirmDeletion()})()");
 assert.equal(run(c,"scheduleCompletionTx('matrix-a','2026-01-25')"),null);
 assert.equal(run(c,"JSON.stringify(state.integrated.ledger.filter(t=>t.meta?.scheduleId))"),kept);
 await run(c,'state=normalizeState(validateBackupPayload(parseBackupZipBytes(createBackupZipBytes(backupPayload()))))');
 assert.equal(run(c,"scheduleCompletionTx('matrix-a','2026-01-25')"),null);
 assert.equal(run(c,"state.integrated.ledger.filter(t=>t.meta?.scheduleId).length"),3);
 assert.equal(run(c,"integratedReplay().assets['cash-main']"),10000000+(kind==='income'?3000:-3000));
 assert.equal(run(c,'integratedReplay().totalDebt'),kind==='loan'?197000:200000);
 assert.equal(run(c,"integratedReplay().assets['matrix-target']||0"),['saving','investment'].includes(kind)?3000:0);
});

for(const type of ['externalIncome','expense','internalTransfer','debtPrincipal'])test(`manual transaction matrix: ${type} edits only one duplicate and failed writes preserve money`,async()=>{
 const c=await setup();c.matrixType=type;c.FormData=class{constructor(form){this.data=form.data}get(k){return this.data[k]??null}};
 run(c,"globalThis.sheetDirty=false;closeSheets=()=>{};nav=()=>{};haptic=()=>{};showDialog=(_options,confirm)=>{globalThis.confirmDeletion=confirm};integratedFormEntryPreset=()=>null;formShowError=(_form,message)=>{globalThis.formError=message};state.integrated.accounts.push({id:'manual-target',name:'예금',kind:'deposit'});state.integrated.liabilities.push({id:'manual-loan',name:'대출'});state.integrated.ledger.push({id:'manual-debt',date:'2026-01-01',type:'openingLiability',liabilityId:'manual-loan',amount:100000});for(const suffix of ['a','b'])state.integrated.ledger.push({id:'manual-'+suffix,date:'2026-01-25',type:matrixType,amount:1000,category:'동일 기록',note:'원본',...(matrixType==='externalIncome'?{toAccountId:'cash-main'}:matrixType==='expense'?{fromAccountId:'cash-main'}:matrixType==='internalTransfer'?{fromAccountId:'cash-main',toAccountId:'manual-target'}:{fromAccountId:'cash-main',liabilityId:'manual-loan'})});persist=productionPersist;lastPersistedState=clone(state)");
 const other=run(c,"JSON.stringify(state.integrated.ledger.find(t=>t.id==='manual-b'))");
 c.editForm={dataset:{editId:'manual-a'},data:{uiType:({externalIncome:'externalIncome',expense:'lifeExpense',internalTransfer:'savingInvestment',debtPrincipal:'loanPayment'})[type],date:'2026-01-25',amount:'1500',principal:'1500',interest:'0',category:'동일 기록',note:'한 건만 수정',toAccountId:'manual-target',liabilityId:'manual-loan'}};
 await run(c,'saveIntegratedTransaction(editForm)');assert.equal(run(c,"state.integrated.ledger.find(t=>t.id==='manual-a').amount"),1500);assert.equal(run(c,"JSON.stringify(state.integrated.ledger.find(t=>t.id==='manual-b'))"),other);
 const stable=run(c,'JSON.stringify(state.integrated)');run(c,"editForm.data.amount='2000';editForm.data.principal='2000';localStorage.setItem=()=>{throw new Error('manual quota')}");await run(c,'saveIntegratedTransaction(editForm)');assert.equal(run(c,'JSON.stringify(state.integrated)'),stable);
 run(c,'localStorage.setItem=()=>{}');await run(c,"(async()=>{deleteIntegratedTransaction('manual-a');await confirmDeletion()})()");
 await run(c,'state=normalizeState(validateBackupPayload(parseBackupZipBytes(createBackupZipBytes(backupPayload()))))');
 assert.equal(run(c,"state.integrated.ledger.filter(t=>t.id==='manual-b').length"),1);assert.equal(run(c,"state.integrated.ledger.some(t=>t.id==='manual-a')"),false);
 assert.equal(run(c,"integratedReplay().assets['cash-main']"),10000000+(type==='externalIncome'?1000:-1000));assert.equal(run(c,'integratedReplay().totalDebt'),type==='debtPrincipal'?99000:100000);
});

for(const type of ['expense','externalExpense'])test(`refund dependency matrix: ${type} protects original edits and deletes without touching its duplicate`,async()=>{
 const c=await setup();c.matrixType=type;c.FormData=class{constructor(form){this.data=form.data}get(k){return this.data[k]??null}};
 run(c,"globalThis.sheetDirty=false;closeSheets=()=>{};nav=()=>{};haptic=()=>{};showDialog=(_options,confirm)=>{globalThis.confirmDeletion=confirm};integratedFormEntryPreset=()=>null;formShowError=(_form,message)=>{globalThis.formError=message};for(const suffix of ['a','b'])state.integrated.ledger.push({id:'refund-original-'+suffix,date:'2026-01-25',type:matrixType,amount:1000,category:'동일 지출',...(matrixType==='expense'?{fromAccountId:'cash-main'}:{})});globalThis.refundResult=recordIntegratedRefund('refund-original-a','2026-01-26',500);persist=productionPersist;lastPersistedState=clone(state)");
 assert.equal(c.refundResult.ok,true);const before=run(c,'JSON.stringify(state.integrated)');
 c.editForm={dataset:{editId:'refund-original-a'},data:{uiType:'lifeExpense',date:'2026-01-25',amount:'400',category:'동일 지출',note:'거부'}};
 await run(c,'saveIntegratedTransaction(editForm)');assert.match(c.formError,/환불/);assert.equal(run(c,'JSON.stringify(state.integrated)'),before);
 run(c,"editForm.data.amount='1000';editForm.data.date='2026-01-27'");await run(c,'saveIntegratedTransaction(editForm)');assert.match(c.formError,/환불/);assert.equal(run(c,'JSON.stringify(state.integrated)'),before);
 await run(c,"(async()=>{deleteIntegratedTransaction('refund-original-a');await confirmDeletion()})()");assert.equal(run(c,'JSON.stringify(state.integrated)'),before);
 await run(c,"(async()=>{deleteIntegratedTransaction(refundResult.row.id);await confirmDeletion();deleteIntegratedTransaction('refund-original-a');await confirmDeletion()})()");
 await run(c,'state=normalizeState(validateBackupPayload(parseBackupZipBytes(createBackupZipBytes(backupPayload()))))');
 assert.equal(run(c,"state.integrated.ledger.filter(t=>t.id==='refund-original-b').length"),1);assert.equal(run(c,"state.integrated.ledger.some(t=>t.meta?.refundOf==='refund-original-a')"),false);
 assert.equal(run(c,"integratedReplay().assets['cash-main']"),type==='expense'?9999000:10000000);
});

function historyInput(cardId,extra={}){return {name:'가상 과거 구매',cardId,purchaseAmount:370000,months:3,purchaseDate:'2026-01-01',firstPaymentDate:'2026-01-14',interestMode:'free',category:'기타',historyBaseline:{asOf:'2026-02-10',remainingPrincipal:123300,sourceKey:'synthetic-history-a',includeSpending:false,statements:[{month:'2026-01',round:1,principal:123400,interest:0,remainingPrincipal:246600,status:'paid',source:'synthetic-a'},{month:'2026-02',round:2,principal:123300,interest:0,remainingPrincipal:123300,status:'paid',source:'synthetic-b'},{month:'2026-03',round:3,principal:123300,interest:0,remainingPrincipal:0,status:'scheduled',source:'synthetic-c'}]},...extra}}
test('card history: confirmed principal imports without invented cash or duplicate consumption and repeats are idempotent',async()=>{
 const c=await setupCardV2();c.historyInput=historyInput(run(c,'testCard'));const cash=run(c,"integratedReplay().assets['cash-main']"),isa=run(c,'JSON.stringify(state.accounts)'),pension=run(c,'JSON.stringify(state.pension)');
 const id=await run(c,'importCardHistory(historyInput)');assert.ok(id);c.historyId=id;
 assert.equal(run(c,"integratedReplay().assets['cash-main']"),cash);assert.equal(run(c,'integratedReplay().totalDebt'),123300);assert.equal(run(c,"integratedSpendingAnalysis('2026').total"),0);assert.equal(run(c,'cardV2(financeSchedules()[0]).payments.length'),0);assert.equal(run(c,"scheduleOccurrences('2026-02').length"),0);assert.equal(run(c,"scheduleOccurrences('2027-01').length"),0);
 assert.equal(await run(c,'importCardHistory(historyInput)'),id);assert.equal(run(c,'financeSchedules().length'),1);assert.equal(run(c,'JSON.stringify(state.accounts)'),isa);assert.equal(run(c,'JSON.stringify(state.pension)'),pension);
 await run(c,'state=normalizeState(validateBackupPayload(parseBackupZipBytes(createBackupZipBytes(backupPayload()))))');assert.equal(run(c,'cardLedgerDataIssue(state)'),'');assert.equal(run(c,'cardRemaining(financeSchedules()[0])'),123300);
});
test('card history: paid evidence cannot be charged again, early writes fail and confirmed future bills accept real payment',async()=>{
 const c=await setupCardV2();c.historyInput=historyInput(run(c,'testCard'));const id=await run(c,'importCardHistory(historyInput)');c.historyId=id;
 assert.equal(await run(c,"saveCardBill(historyId,{issuedDate:'2026-02-10',dueDate:'2026-02-14',principal:123300})"),'');
 const bill=await run(c,"saveCardBill(historyId,{issuedDate:'2026-02-10',dueDate:'2026-03-14',principal:123300})");assert.ok(bill);c.historyBill=bill;
 assert.equal(await run(c,"recordCardPayment(historyId,{billId:historyBill,date:'2026-02-09'})"),'');const cash=run(c,"integratedReplay().assets['cash-main']");assert.ok(await run(c,"recordCardPayment(historyId,{billId:historyBill,date:'2026-02-11',pointsPrincipal:300})"));assert.equal(run(c,'cardRemaining(financeSchedules()[0])'),0);assert.equal(run(c,"integratedReplay().assets['cash-main']"),cash-123000);assert.equal(run(c,"integratedSpendingAnalysis('2026').total"),0);
});
test('card history: zero balance is complete while evidence and original amount survive without zero-value financial postings',async()=>{
 const c=await setupCardV2();const input=historyInput(run(c,'testCard'));input.historyBaseline.remainingPrincipal=0;input.historyBaseline.statements=[{month:'2026-01',round:1,principal:370000,interest:0,remainingPrincipal:0,status:'paid',paidDate:'2026-01-05',source:'synthetic-full-prepay'}];c.historyInput=input;
 const id=await run(c,'importCardHistory(historyInput)');assert.ok(id);c.historyId=id;assert.equal(run(c,'cardPlanSummary(financeSchedules()[0],"2026-01").completed'),true);assert.equal(run(c,"state.integrated.ledger.filter(x=>x.amount===0).length"),0);assert.equal(await run(c,'removeUnpaidCardInstallment(historyId)'),false);assert.equal(await run(c,'updateCardPurchase(historyId,historyInput)'),false);
 await run(c,'state=normalizeState(validateBackupPayload(parseBackupZipBytes(createBackupZipBytes(backupPayload()))))');assert.equal(run(c,'cardV2(financeSchedules()[0]).grossAmount'),370000);assert.equal(run(c,'cardV2(financeSchedules()[0]).historyBaseline.statements[0].paidDate'),'2026-01-05');
});
test('card history: inconsistent balances, source collisions, failed persistence and malformed backups preserve originals',async()=>{
 const c=await setupCardV2();const input=historyInput(run(c,'testCard'));c.historyInput=input;const before=run(c,'JSON.stringify(state.integrated)');input.historyBaseline.statements[1].remainingPrincipal=1;assert.equal(await run(c,'importCardHistory(historyInput)'),'');assert.equal(run(c,'JSON.stringify(state.integrated)'),before);
 c.historyInput=historyInput(run(c,'testCard'));await run(c,'persist=async()=>false');assert.equal(await run(c,'importCardHistory(historyInput)'),'');assert.equal(run(c,'JSON.stringify(state.integrated)'),before);await run(c,'persist=async()=>true');assert.ok(await run(c,'importCardHistory(historyInput)'));
 const stable=run(c,'JSON.stringify(state)');c.historyInput.purchaseAmount=370001;assert.equal(await run(c,'importCardHistory(historyInput)'),'');assert.equal(run(c,'JSON.stringify(state)'),stable);
 assert.ok(run(c,"(()=>{const d=clone(state);d.financeSchedules.items[0].cardPlan.historyBaseline.remainingPrincipal++;return !!cardLedgerDataIssue(d)})()"));
});

test('card history: unpaid-only evidence includes current bill in remaining debt without inventing past cash payments',async()=>{
 const c=await setupCardV2();const input=historyInput(run(c,'testCard'),{purchaseAmount:360000,purchaseDiscount:60000,months:6,firstPaymentDate:'2026-03-14'});input.historyBaseline={asOf:'2026-02-10',remainingPrincipal:200000,sourceKey:'synthetic-unpaid-only',includeSpending:false,statements:[{month:'2026-03',round:3,principal:50000,interest:0,remainingPrincipal:150000,status:'scheduled',dueDate:'2026-03-14',source:'synthetic-unpaid'}]};c.historyInput=input;
 const cash=run(c,"integratedReplay().assets['cash-main']");const id=await run(c,'importCardHistory(historyInput)');assert.ok(id);c.historyId=id;
 assert.equal(run(c,'cardRemaining(financeSchedules()[0])'),200000);assert.equal(run(c,"integratedReplay().assets['cash-main']"),cash);assert.equal(run(c,"integratedSpendingAnalysis('2026').total"),0);assert.equal(run(c,'cardV2(financeSchedules()[0]).payments.length'),0);assert.equal(await run(c,'importCardHistory(historyInput)'),id);
 await run(c,'state=normalizeState(validateBackupPayload(parseBackupZipBytes(createBackupZipBytes(backupPayload()))))');assert.equal(run(c,'cardLedgerDataIssue(state)'),'');
 c.historyInput.historyBaseline.remainingPrincipal=150000;assert.equal(await run(c,'importCardHistory(historyInput)'),'');
 const bill=await run(c,"saveCardBill(historyId,{issuedDate:'2026-02-10',dueDate:'2026-03-14',principal:50000})");assert.ok(bill);c.historyBill=bill;assert.ok(await run(c,"recordCardPayment(historyId,{billId:historyBill,date:'2026-02-11'})"));assert.equal(run(c,'cardRemaining(financeSchedules()[0])'),150000);assert.equal(run(c,"integratedReplay().assets['cash-main']"),cash-50000);
});

test('spending classification: display edits preserve independent purchases, cash, debt and source bytes through ZIP and failure',async()=>{
 const c=await setupCardV2();const a=await run(c,"newPurchase({name:'가상 구매 A',merchant:'가상 가맹점',purchaseAmount:120000,months:3})"),b=await run(c,"newPurchase({name:'가상 구매 B',merchant:'가상 가맹점',purchaseAmount:120000,months:3})");c.classifyId=a;c.otherId=b;
 const id=run(c,'cardOriginal(financeSchedules().find(x=>x.id===classifyId)).id');c.txid=id;await run(c,'state.integrated=normalizeIntegrated(state.integrated)');const before=run(c,'JSON.stringify({integrated:state.integrated,schedules:state.financeSchedules})');
 assert.equal(await run(c,"saveSpendingClassifications([txid],'식비','가상 배달음식')"),true);assert.equal(run(c,"integratedSpendingAnalysis('2026-01').items.find(x=>x.key==='가상 배달음식').amount"),120000);assert.equal(run(c,'financeSchedules().length'),2);assert.deepEqual(JSON.parse(run(c,'JSON.stringify({integrated:state.integrated,schedules:state.financeSchedules})')),JSON.parse(before));
 const saved=run(c,'JSON.stringify(setting().spendingClassifications)');await run(c,'persist=async()=>false');assert.equal(await run(c,"saveSpendingClassifications([txid],'쇼핑','변경 실패')"),false);assert.equal(run(c,'JSON.stringify(setting().spendingClassifications)'),saved);await run(c,"persist=async()=>{throw Error('disk')} ");assert.equal(await run(c,"saveSpendingClassifications([txid],'쇼핑','실패')"),false);assert.equal(run(c,'JSON.stringify(setting().spendingClassifications)'),saved);await run(c,'persist=async()=>true');
 await run(c,'state=normalizeState(validateBackupPayload(parseBackupZipBytes(createBackupZipBytes(backupPayload()))))');assert.equal(run(c,'JSON.stringify(setting().spendingClassifications)'),saved);assert.deepEqual(JSON.parse(run(c,'JSON.stringify({integrated:state.integrated,schedules:state.financeSchedules})')),JSON.parse(before));assert.equal(await run(c,"saveSpendingClassifications(['not-a-purchase'],'식비','잘못된 참조')"),false);
});
test('historical purchase labels: unclassified is explicit, merchant grouping keeps original IDs and archived refund identity',async()=>{
 const c=await setupCardV2();const input=historyInput(run(c,'testCard'),{name:'가상 가맹점 · 01-01 · 01',merchant:'가상 가맹점'});input.historyBaseline.includeSpending=true;c.historyInput=input;const a=await run(c,'importCardHistory(historyInput)');assert.ok(a);c.classifyId=a;
 assert.equal(run(c,"integratedSpendingAnalysis('2026-01').items[0].key"),'가상 가맹점');assert.equal(run(c,"integratedSpendingAnalysis('2026-01').categories[0].key"),'미분류');const before=run(c,'JSON.stringify({integrated:state.integrated,schedules:state.financeSchedules})');c.txid=run(c,'cardOriginal(financeSchedules()[0]).id');assert.ok(await run(c,"saveSpendingClassifications([txid],'기타','명시한 기타 항목')"));assert.equal(run(c,"integratedSpendingAnalysis('2026-01').categories[0].key"),'기타');assert.deepEqual(JSON.parse(run(c,'JSON.stringify({integrated:state.integrated,schedules:state.financeSchedules})')),JSON.parse(before));
 // The original can be excluded from operational consumption while refunds retain its edited identity.
 await run(c,"state.financeSchedules.items[0].cardPlan.historyBaseline.includeSpending=false;cardOriginal(financeSchedules()[0]).meta.cardHistoricalPurchase=true");assert.ok(await run(c,"recordCardRefund(classifyId,{date:'2026-02-11',amount:1000})"));assert.equal(run(c,"integratedSpendingAnalysis('2026-02').items[0].key"),'명시한 기타 항목');assert.equal(run(c,"integratedSpendingAnalysis('2026-02').total"),-1000);
});
