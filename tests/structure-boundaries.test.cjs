'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const context=vm.createContext({Date,Math,Number,String,Object,Array,Map,JSON});
for(const file of ['src/storage/cloud-save-contract.js','src/domain/cloud-state-policy.js','src/domain/integrated-replay.js','src/domain/investment-position.js','integrated-ledger-engine.js','src/app/schedule-completion.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const plain=value=>JSON.parse(JSON.stringify(value));
const run=(source,values={})=>vm.runInContext(source,Object.assign(context,values));

test('cloud reconciliation policy preserves every overwrite decision',()=>{
 const envelope=(savedAt,accounts=[])=>({savedAt,data:{accounts,pension:{},integrated:{ledger:[]}}});
 const plan=(local,row,force='auto')=>plain(run('cloudReconcilePlan(__local,__row,__force)',{__local:local,__row:row,__force:force}));
 assert.deepEqual(plan({stored:false,envelope:null},{payload:{bad:true}}),{action:'reject-invalid'});
 assert.deepEqual(plan({stored:true,envelope:envelope('2026-01-02')},{payload:envelope('2026-01-01',[{id:'remote'}])}),{action:'pull',notify:false});
 assert.deepEqual(plan({stored:true,envelope:envelope('2026-01-01',[{id:'local'}])},{payload:envelope('2026-01-02')}),{action:'protect-empty'});
 assert.deepEqual(plan({stored:true,envelope:envelope('2026-01-01',[{id:'local'}])},{payload:envelope('2026-01-02')},'push'),{action:'pull',notify:true},'newer remote keeps precedence, matching the legacy branch order');
 assert.deepEqual(plan({stored:true,envelope:envelope('2026-01-01',[{id:'same'}])},{payload:envelope('2026-01-02',[{id:'same'}])}),{action:'pull',notify:true});
 assert.deepEqual(plan({stored:true,envelope:envelope('2026-01-02',[{id:'same'}])},{payload:envelope('2026-01-01',[{id:'same'}])}),{action:'push'});
 assert.deepEqual(plan({stored:true,envelope:envelope('2026-01-01',[{id:'local'}])},{payload:envelope('2026-01-01',[{id:'remote'}])}),{action:'conflict'});
 assert.deepEqual(plan({stored:true,envelope:{savedAt:'2026-01-01',data:{b:{z:1,a:2},a:[1,2]}}},{payload:{savedAt:'2026-01-01',data:{a:[1,2],b:{a:2,z:1}}}}),{action:'synced'});
 assert.equal(run("cloudEnvelopeFingerprint({data:{a:[1,2]}})!==cloudEnvelopeFingerprint({data:{a:[2,1]}})"),true,'array order remains meaningful');
});

test('cloud save contract keeps one request id across an idempotent retry',()=>{
 let calls=0;context.__requestId=()=>`request-${++calls}`;
 const first=plain(run("cloudPendingWriteFor(null,'fingerprint-a',7,__requestId)"));
 const retry=plain(run("cloudPendingWriteFor(__current,'fingerprint-a',99,__requestId)",{__current:first}));
 const changed=plain(run("cloudPendingWriteFor(__current,'fingerprint-b',8,__requestId)",{__current:first}));
 assert.deepEqual(first,{fingerprint:'fingerprint-a',requestId:'request-1',expectedRevision:7});
 assert.deepEqual(retry,first);assert.equal(calls,2,'only a changed payload creates one additional request id');
 assert.deepEqual(changed,{fingerprint:'fingerprint-b',requestId:'request-2',expectedRevision:8});
 assert.deepEqual(plain(run("cloudSaveRpcArguments(__pending,{data:{id:'asset'}})",{__pending:first})),{p_expected_revision:7,p_payload:{data:{id:'asset'}},p_request_id:'request-1'});
 assert.deepEqual(plain(run("cloudRpcResult([{outcome:'saved',new_revision:8}])")),{outcome:'saved',new_revision:8});
});

test('integrated replay pure calculator matches the frozen ledger result and adapter',()=>{
 const store={accounts:[{id:'cash'},{id:'saving'}],liabilities:[{id:'loan'}]};
 const rows=[
  {id:'refund',date:'2026-01-10',type:'refund',toAccountId:'cash',amount:25},
  {id:'early-expense',date:'2026-01-01',type:'expense',fromAccountId:'cash',amount:50},
  {id:'open-cash',date:'2026-01-02',type:'openingAsset',toAccountId:'cash',amount:1000},
  {id:'open-loan',date:'2026-01-02',sequence:2,type:'openingLiability',liabilityId:'loan',amount:500},
  {id:'expense',date:'2026-01-03',type:'expense',fromAccountId:'cash',amount:100},
  {id:'income',date:'2026-01-04',type:'externalIncome',toAccountId:'cash',amount:200},
  {id:'asset-in',date:'2026-01-05',type:'externalAssetIn',toAccountId:'saving',amount:50},
  {id:'asset-out',date:'2026-01-06',type:'externalAssetOut',fromAccountId:'saving',amount:10},
  {id:'transfer',date:'2026-01-07',type:'internalTransfer',fromAccountId:'cash',toAccountId:'saving',amount:300},
  {id:'principal',date:'2026-01-08',type:'debtPrincipal',fromAccountId:'cash',liabilityId:'loan',amount:200},
  {id:'external-principal',date:'2026-01-08',sequence:2,type:'externalDebtPrincipal',liabilityId:'loan',amount:50},
  {id:'adjustment',date:'2026-01-09',type:'adjustment',accountId:'saving',delta:-20},
  {id:'ignored',date:'2026-01-09',sequence:2,type:'externalExpense',amount:999}
 ];
 const before=JSON.stringify(rows);
 const expected={assets:{cash:575,saving:320},liabilities:{loan:250},minAssets:{cash:-50,saving:0},minLiabilities:{loan:0},totalAssets:895,totalDebt:250,netAssets:645};
 const calculated=plain(run('calculateIntegratedReplay(__store,__rows)',{__store:store,__rows:rows}));
 assert.deepEqual(calculated,expected);
 assert.equal(JSON.stringify(rows),before,'pure calculator must not reorder or mutate caller rows');
 run('integratedStore=()=>__store;integratedBalanceLedger=()=>__rows',{__store:store,__rows:rows});
 assert.deepEqual(plain(run('integratedReplay()')),expected,'legacy global API remains a compatible adapter');
});

test('typed ISA value math and pension position math preserve fractional trades',()=>{
 const holding={id:'holding-a',priceScale:10000,baselineQty:0,baselineAvgPrice:0};
 assert.equal(run('holdingPositionValue(__holding,980000,10222.704081632653)',{__holding:holding}),1001825);
 const rows=[
  {id:'buy-1',holdingId:'holding-a',type:'buy',date:'2026-01-01',createdAt:'1',qty:3.5,price:100,fee:1,tax:0},
  {id:'buy-2',holdingId:'holding-a',type:'buy',date:'2026-01-02',createdAt:'2',qty:1.5,price:200,fee:1,tax:0},
  {id:'sell',holdingId:'holding-a',type:'sell',date:'2026-01-03',createdAt:'3',qty:5,price:250,fee:0,tax:0},
  {id:'buy-3',holdingId:'holding-a',type:'buy',date:'2026-01-04',createdAt:'4',qty:2.5,price:80,fee:.5,tax:0}
 ];
 assert.deepEqual(plain(run('calculatePensionPosition(__holding,__rows)',{__holding:holding,__rows:rows})),{qty:2.5,avg:80.2});
});

test('schedule completion separates calculation from commit and render effects',()=>{
 run("__uid=0;uid=prefix=>prefix+'-'+(++__uid);integratedReplay=()=>({assets:{'cash-main':1000}});schedulePensionKind=()=>'';integratedStore=()=>({accounts:[],ledger:[]});scheduleTargetAccount=s=>s.targetAccountId||'';resolveSchedulePensionAccount=()=>'';resolveScheduleIsaAccount=()=>''");
 const loan={id:'loan-schedule',name:'주택대출',kind:'loan',amount:0,liabilityId:'loan-main',productId:'mortgage'};
 const loanDraft=plain(run("calculateLoanScheduleCompletion(__loan,'2026-09-25',300,50)",{__loan:loan}));
 assert.equal(loanDraft.ok,true);assert.equal(loanDraft.checkAggregate,true);assert.equal(loanDraft.rows.length,2);
 assert.deepEqual(loanDraft.rows.map(row=>[row.type,row.amount,row.meta.component]),[['debtPrincipal',300,'principal'],['debtInterest',50,'interest']]);
 assert.equal(loanDraft.rows[0].meta.actualAmount,350);
 const income={id:'salary',name:'급여',kind:'income',amount:700};
 const incomeDraft=plain(run("calculateStandardScheduleCompletion(__income,'2026-09-25',0,'','')",{__income:income}));
 assert.equal(incomeDraft.ok,true);assert.equal(incomeDraft.rows[0].type,'externalIncome');assert.equal(incomeDraft.rows[0].amount,700);
 run("integratedReplay=()=>({assets:{'cash-main':99}})");
 const expense=plain(run("calculateStandardScheduleCompletion({id:'bill',name:'보험료',kind:'insurance',amount:100},'2026-09-25',0,'','')"));
 assert.deepEqual(expense,{ok:false,error:'생활현금이 부족합니다. 월급 또는 현금 유입을 먼저 완료로 기록해 주세요.'});
});
