'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {financialRuntime}=require('./support/financial-runtime.cjs');
const {seeded}=require('./support/qa-data.cjs');

function pensionEnv(){const e=financialRuntime();e.run(`state.pension.accounts=[{id:'money-p',kind:'pension',name:'QA pension',status:'active',openedAt:'2026-01-01'},{id:'money-i',kind:'irp',name:'QA IRP',status:'active',openedAt:'2026-01-01'}];state.pension.holdings=[];state.pension.transactions=[];state.pension.contributions=[];state.brokerKis=brokerKisEmptyStore()`);return e}
function balance(cash,settled,holdings=200000){return{cash,cashDetail:{depositCash:cash,settledCash:settled,nextDayCash:cash,availableCash:Math.min(cash,settled)},securitiesValue:holdings,totalValue:holdings+settled,holdings:holdings?[{productCode:'QA001',productName:'QA ETF',quantity:20,avgPrice:9000,currentPrice:holdings/20,marketValue:holdings,profitLoss:holdings-180000}]:[]}}
function importBalance(e,b,at='2026-10-13T01:00:00Z',kind='pension',id='money-p'){return e.run('brokerKisImportBalanceSnapshot(state.brokerKis,__args[0],__args[1],__args[2],__args[3])',[b,kind,id,at])}
function view(e){return e.plain(e.run(`pensionAccountView(pensionAccount('money-p'))`))}

test('money: actual discrepancy amounts reconcile without changing source cash or holdings',()=>{
 const e=pensionEnv(),b=balance(51361,15963,34799500),original=JSON.stringify(b);b.totalValue=34815463;
 importBalance(e,b);const v=view(e);
 assert.equal(v.rawComponentDelta,-35398);assert.equal(v.cash,15963);assert.equal(v.total,34815463);assert.equal(v.componentDelta,0);assert.equal(e.run('pensionBalanceIssueRows().length'),0);assert.equal(JSON.stringify(b),original);
});
test('money: sale proceeds belong to settlement cash, not unidentified assets',()=>{
 const e=pensionEnv();importBalance(e,balance(100000,300000));const v=view(e);
 assert.equal(v.cash,300000);assert.equal(v.cashBasis,'settlement');assert.equal(v.unallocated,0);assert.equal(e.run(`pensionAssetMetrics('pension').value`),500000);assert.equal(e.run(`pensionAssetModel('pension').segments.find(x=>x.key==='현금').value`),300000);
});
test('money: a zero settlement balance is explicit and never falls back to deposit cash',()=>{
 const e=pensionEnv();importBalance(e,balance(100000,0));const v=view(e);assert.equal(v.cash,0);assert.equal(v.total,200000);assert.equal(v.componentDelta,0);
});
test('money: missing settlement evidence stays unresolved and does not fabricate cash',()=>{
 const e=pensionEnv(),b=balance(100000,64602);b.cashDetail={depositCash:100000,settledCash:100000,nextDayCash:100000};importBalance(e,b);const v=view(e);
 assert.equal(v.cash,100000);assert.equal(v.componentDelta,-35398);assert.equal(e.run('pensionBalanceIssueRows().length'),1);assert.equal(v.total,264602);
});
test('money: undisclosed fund holdings remain other assets rather than invented securities',()=>{
 const e=pensionEnv();importBalance(e,{cash:10000,cashDetail:{settledCash:10000},securitiesValue:4000000,totalValue:4010000,holdings:[],summaryOnly:true});
 assert.equal(view(e).unallocated,4000000);assert.equal(view(e).cash,10000);assert.equal(e.run(`pensionAssetMetrics('pension').value`),4010000);
});
test('money: incomplete or invalid balance responses cannot erase the last good balance',()=>{
 const e=pensionEnv();importBalance(e,balance(100000,64602));const before=JSON.stringify(e.plain(e.run('state.brokerKis')));
 for(const invalid of [{},{cash:0},{cash:0,totalValue:null},{cash:0,totalValue:''},{cash:0,totalValue:'bad'},{cash:NaN,totalValue:0},{cash:-1,totalValue:0},{cash:0,totalValue:Infinity},{cash:0,totalValue:0,holdings:{}},{cash:0,totalValue:0,holdings:[null]}]){
  assert.equal(importBalance(e,invalid,'2026-10-13T02:00:00Z').ok,false,JSON.stringify(invalid));assert.equal(JSON.stringify(e.plain(e.run('state.brokerKis'))),before,'a rejected response must not change sync metadata either');
 }
 assert.equal(importBalance(e,{cash:0,securitiesValue:0,totalValue:0,holdings:[]},'2026-10-13T03:00:00Z').ok,true);assert.equal(view(e).total,0);
});
test('money: stale and repeated responses cannot duplicate balances or overwrite newer values',()=>{
 const e=pensionEnv();importBalance(e,balance(100000,64602));const snapshot=JSON.stringify(e.plain(e.run('state.brokerKis.balanceSnapshots')));
 for(let i=0;i<50;i++){assert.equal(importBalance(e,balance(900000,900000),'2026-10-13T00:00:00Z').stale,true);assert.equal(importBalance(e,balance(100000,64602)).stale,true)}
 assert.equal(JSON.stringify(e.plain(e.run('state.brokerKis.balanceSnapshots'))),snapshot);assert.equal(view(e).total,264602);
});
test('money: multi-account headlines and composition agree, without adding linked opening balances twice',()=>{
 const e=pensionEnv();importBalance(e,balance(100000,64602));importBalance(e,balance(5000,5000,300000),'2026-10-13T01:00:00Z','irp','money-i');
 e.run(`state.pension.accounts.push({id:'money-manual',kind:'pension',name:'QA manual',status:'active',openedAt:'2026-01-01'});state.integrated.ledger.push({id:'manual-in',date:'2026-01-01',type:'externalAssetIn',toAccountId:'pension-link',amount:50000,meta:{targetPensionAccountId:'money-manual'}});state.integrated.ledger.push({id:'old-link',date:'2026-01-01',type:'openingAsset',toAccountId:'pension-link',amount:900000})`);
 assert.equal(e.run(`pensionAssetMetrics('all').value`),619602);assert.equal(e.run('integratedFinancialModel().pension'),314602);assert.equal(e.run('integratedFinancialModel().irp'),305000);assert.equal(e.run(`pensionAssetModel('all').total`),619602);
});
test('money: explicit zero broker balances do not reuse obsolete local cash for account exposure',()=>{
 const e=pensionEnv();e.run(`state.integrated.ledger.push({id:'old-in',date:'2026-01-01',type:'externalAssetIn',toAccountId:'pension-link',amount:100000,meta:{targetPensionAccountId:'money-p'}})`);importBalance(e,{cash:0,totalValue:0,securitiesValue:0,holdings:[]});
 const exposure=e.plain(e.run(`pensionAccountExposure('money-p')`));assert.equal(exposure.cash,0);assert.equal(exposure.value,0);assert.equal(exposure.hasAssets,false);
});
test('money: latest automatic ISA and pension history follows a confirmed zero balance',()=>{
 const e=pensionEnv();const today=e.run('localYmd()');
 e.run(`state.moduleVerification={isa:true,pension:true,irp:true};state.accounts=[{id:'money-isa',name:'QA ISA',status:'active',openedAt:'2026-01-01',baseline:{date:'2026-01-01',cash:0,contribution:0},holdings:[],transactions:[],assetSnapshots:[{date:localYmd(),cost:100000,value:100000,totalValue:100000,meta:{autoSnapshot:true}}]}];state.pension.assetSnapshots=[{date:localYmd(),pension:{cost:100000,value:100000,cash:100000},irp:{cost:5000,value:5000,cash:5000},meta:{autoSnapshot:true}}]`);
 importBalance(e,{cash:0,totalValue:0,securitiesValue:0,holdings:[]});importBalance(e,{cash:0,totalValue:0,securitiesValue:0,holdings:[]},'2026-10-13T01:00:00Z','irp','money-i');e.run('syncCurrentIsaSnapshots();syncCurrentPensionSnapshot()');
 assert.equal(e.run(`state.accounts[0].assetSnapshots.find(x=>x.date===localYmd()).totalValue`),0);assert.equal(e.run(`state.pension.assetSnapshots.at(-1).pension.value`),0);assert.equal(e.run(`state.pension.assetSnapshots.at(-1).irp.value`),0);assert.equal(e.run(`historicalFinancialModel(__args[0]).pension`,[today]),0);
});
test('money: confirmed settlement cash reconciles across 1,000 deterministic buy/sell balances',()=>{
 const e=pensionEnv(),random=seeded(20261014);
 for(let i=0;i<1000;i++){const deposit=Math.floor(random()*10000000),settlement=Math.floor(random()*10000000),securities=Math.floor(random()*100000000),at=new Date(Date.UTC(2026,9,13,0,0,i)).toISOString();importBalance(e,balance(deposit,settlement,securities),at);const v=view(e);assert.equal(v.cash,settlement,`case ${i}`);assert.equal(v.componentDelta,0);assert.equal(v.unallocated,0);assert.equal(v.total,securities+settlement)}
});
test('money: ZIP round trip, local save/reload and storage failure preserve every transaction and broker snapshot',()=>{
 const e=pensionEnv();importBalance(e,balance(51361,15963,34799500));importBalance(e,balance(5257,5257,7338380),'2026-10-13T01:00:00Z','irp','money-i');
 e.run(`state.integrated.ledger.push({id:'money-income',type:'externalIncome',date:'2026-01-01',toAccountId:'cash-main',amount:1000000});state=normalizeState(state);lastPersistedState=clone(state)`);
 const before=e.plain(e.run('({ledger:state.integrated.ledger,broker:state.brokerKis})'));
 assert.equal(e.run('persist(false)'),true);e.run('state=loadState()');assert.deepEqual(e.plain(e.run('({ledger:state.integrated.ledger,broker:state.brokerKis})')),before);
 const restored=e.plain(e.run('validateBackupPayload(parseBackupZipBytes(createBackupZipBytes()))'));assert.deepEqual(restored.integrated.ledger,before.ledger);assert.deepEqual(restored.brokerKis,before.broker);
 e.run(`localStorage.setItem=()=>{throw new Error('QuotaExceededError')};state.integrated.ledger.push({id:'uncommitted',type:'externalIncome',date:'2026-01-02',toAccountId:'cash-main',amount:999999})`);
 assert.equal(e.run('persist(false)'),false);assert.deepEqual(e.plain(e.run('state.integrated.ledger')),before.ledger);assert.equal(view(e).cash,15963);
});
test('money: independent ISA cash/position oracle agrees for 1,500 sequential transactions including fees and taxes',()=>{
 const e=financialRuntime(),random=seeded(20261015),baseline=100000000,account={id:'oracle',status:'active',openedAt:'2026-01-01',baseline:{date:'2026-01-01',cash:baseline,contribution:0},baselineCash:baseline,holdings:[{id:'oracle-h',name:'QA ETF',baselineQty:0,baselineAvg:0,currentPrice:1000}],transactions:[]};
 let cash=baseline,qty=0,cost=0,realized=0,income=0;
 for(let i=0;i<1500;i++){
  const price=100+Math.floor(random()*10000),fee=Math.floor(random()*100),tax=Math.floor(random()*50),type=qty===0?'buy':random()<.45?'buy':random()<.8?'sell':'dividend';
  const row={id:`oracle-${i}`,type,holdingId:'oracle-h',date:'2026-10-13',tradeDate:'2026-10-13',sequence:i+1,qty:0,price,fee,tax};
  if(type==='buy'){row.qty=1+Math.floor(random()*10);const paid=row.qty*price+fee+tax;cash-=paid;qty+=row.qty;cost+=paid}
  else if(type==='sell'){row.qty=Math.min(qty,1+Math.floor(random()*10));const basis=cost*row.qty/qty,received=row.qty*price-fee-tax;cash+=received;realized+=received-basis;qty-=row.qty;cost=qty?cost-basis:0}
  else{row.amount=1000+Math.floor(random()*10000);cash+=row.amount-fee-tax;income+=row.amount-fee-tax}
  account.transactions.push(row);const result=e.plain(e.run('replay(__args[0])',[account]));assert.equal(result.valid,true);assert.ok(Math.abs(result.cash-cash)<.001);assert.equal(result.holdings[0].qty,qty);assert.ok(Math.abs(result.holdings[0].avgPrice*qty-cost)<.001);assert.ok(Math.abs(result.realized-realized)<.001);assert.ok(Math.abs(result.income-income)<.001);assert.ok(Math.abs((result.cash+qty*1000-baseline)-(realized+income+qty*1000-cost))<.001,'cash + holdings must conserve realized/unrealized/net income');
 }
});
test('money: 500 mixed cash/debt scenarios conserve net assets through transfers, principal, refunds and withdrawals',()=>{
 const e=financialRuntime(),random=seeded(20261016),store={accounts:[{id:'cash'},{id:'saving'}],liabilities:[{id:'loan'}]};
 for(let i=0;i<500;i++){
  const opening=10000000,loan=2000000,income=Math.floor(random()*1000000),expense=Math.floor(random()*1000000),refund=Math.floor(expense*random()),transfer=Math.floor(random()*1000000),principal=Math.floor(random()*loan),interest=Math.floor(random()*100000),externalPrincipal=Math.floor(random()*(loan-principal)),assetIn=Math.floor(random()*1000000),assetOut=Math.floor(assetIn*random()),withdraw=Math.floor(random()*100000),adjustment=Math.floor(random()*20000)-10000;
  const rows=[['openingAsset',opening,{toAccountId:'cash'}],['openingLiability',loan,{liabilityId:'loan'}],['externalIncome',income,{toAccountId:'cash'}],['expense',expense,{fromAccountId:'cash'}],['refund',refund,{toAccountId:'cash'}],['internalTransfer',transfer,{fromAccountId:'cash',toAccountId:'saving'}],['debtPrincipal',principal,{fromAccountId:'cash',liabilityId:'loan'}],['debtInterest',interest,{fromAccountId:'cash'}],['externalDebtPrincipal',externalPrincipal,{liabilityId:'loan'}],['externalAssetIn',assetIn,{toAccountId:'saving'}],['externalAssetOut',assetOut,{fromAccountId:'saving'}],['externalWithdrawal',withdraw,{fromAccountId:'cash'}],['adjustment',0,{accountId:'cash',delta:adjustment}],['externalExpense',999999,{}],['debtInterestExternal',999999,{}]].map(([type,amount,extra],index)=>({id:`${i}-${index}`,type,amount,date:'2026-10-13',sequence:index,...extra}));
  const expectedCash=opening+income-expense+refund-transfer-principal-interest-withdraw+adjustment,expectedSaving=transfer+assetIn-assetOut,expectedDebt=loan-principal-externalPrincipal;
  const result=e.plain(e.run('calculateIntegratedReplay(__args[0],__args[1])',[store,[...rows].reverse()]));assert.equal(result.assets.cash,expectedCash);assert.equal(result.assets.saving,expectedSaving);assert.equal(result.totalDebt,expectedDebt);assert.equal(result.netAssets,opening-loan+income-expense+refund-interest+externalPrincipal+assetIn-assetOut-withdraw+adjustment);
 }
});
test('money: 400 manual pension saves match an independent position/cash oracle and reject invalid edits without mutation',()=>{
 const e=pensionEnv(),random=seeded(20261017),opening=10000000;
 const fixed=Date.parse('2026-10-13T01:00:00Z');e.context.Date=class extends Date{constructor(...args){super(...(args.length?args:[fixed]))}static now(){return fixed}};
 e.run(`state.integrated.ledger=[{id:'oracle-pension-in',date:'2026-01-01',type:'externalAssetIn',toAccountId:'pension-link',amount:10000000,meta:{targetPensionAccountId:'money-p'}}];state.pension.holdings=[{id:'money-h',accountId:'money-p',name:'QA ETF',baselineQty:0,baselineAvgPrice:0,currentPrice:1000}]`);
 let cash=opening,qty=0,cost=0;
 for(let i=0;i<400;i++){
  const price=100+Math.floor(random()*10000),fee=Math.floor(random()*100),tax=Math.floor(random()*50),type=qty===0?'buy':random()<.5?'buy':random()<.75?'sell':'distribution',row={accountId:'money-p',holdingId:'money-h',type,date:'2026-10-13',qty:0,price,fee,tax};
  if(type==='buy'){row.qty=1+Math.floor(random()*10);const paid=row.qty*price+fee+tax;cash-=paid;qty+=row.qty;cost+=paid}
  else if(type==='sell'){row.qty=Math.min(qty,1+Math.floor(random()*10));const basis=cost*row.qty/qty;cash+=row.qty*price-fee-tax;qty-=row.qty;cost=qty?cost-basis:0}
  else{row.amount=1000+Math.floor(random()*10000);cash+=row.amount-fee-tax}
  const result=e.plain(e.run('pensionTransactionSave(__args[0])',[row]));assert.equal(result.ok,true,result.error);const m=e.plain(e.run(`pensionAssetMetrics('pension')`));assert.ok(Math.abs(m.cash-cash)<.001);assert.equal(m.holdings[0].qty,qty);assert.ok(Math.abs(m.holdingCost-cost)<.001,`case ${i}: ${m.holdingCost} != ${cost}`);assert.ok(Math.abs(m.value-(cash+qty*1000))<.001);
  if(i%20===0){const before=JSON.stringify(e.plain(e.run('state.pension'))),rejected=e.run('pensionTransactionSave(__args[0],__args[1])',[{...row,qty:1,price:0,type:'buy'},result.tx.id]);assert.equal(rejected.ok,false);assert.equal(JSON.stringify(e.plain(e.run('state.pension'))),before)}
 }
});
test('money: equal-time trade order survives editing and ZIP restore despite opposite ID ordering',()=>{
 const e=pensionEnv();e.run(`state.integrated.ledger=[{id:'in',date:'2026-01-01',type:'externalAssetIn',toAccountId:'pension-link',amount:2000,meta:{targetPensionAccountId:'money-p'}}];state.pension.holdings=[{id:'h',accountId:'money-p',name:'QA ETF',baselineQty:0,baselineAvgPrice:0,currentPrice:1000}];state.pension.transactions=[{id:'z-first',accountId:'money-p',holdingId:'h',date:'2026-10-13',createdAt:'2026-10-13T01:00:00Z',type:'buy',qty:2,price:100},{id:'b-second',accountId:'money-p',holdingId:'h',date:'2026-10-13',createdAt:'2026-10-13T01:00:00Z',type:'sell',qty:1,price:200},{id:'a-third',accountId:'money-p',holdingId:'h',date:'2026-10-13',createdAt:'2026-10-13T01:00:00Z',type:'buy',qty:1,price:300}];syncPensionDerivedHoldings()`);
 assert.equal(e.run(`pensionAssetMetrics('pension').holdingCost`),400);assert.equal(e.run(`pensionTransactionIssues().length`),0);
 assert.equal(e.run(`pensionTransactionSave({...state.pension.transactions[0],price:110},'z-first').ok`),true);assert.equal(e.run(`pensionAssetMetrics('pension').holdingCost`),410);assert.equal(e.run(`pensionAssetMetrics('pension').cash`),1680);
 e.run('state=validateBackupPayload(parseBackupZipBytes(createBackupZipBytes()))');assert.equal(e.run(`pensionAssetMetrics('pension').holdingCost`),410);assert.deepEqual(e.plain(e.run('state.pension.transactions.map(x=>x.id)')),['z-first','b-second','a-third']);
});
