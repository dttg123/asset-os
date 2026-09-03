'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const clone=x=>JSON.parse(JSON.stringify(x));
const state={
 pension:{accounts:[{id:'ps-1',kind:'pension',name:'연금',status:'active',openedAt:'2026-09-03'},{id:'irp-1',kind:'irp',name:'IRP',status:'active',openedAt:'2026-09-03'}]},
 integrated:{accounts:[{id:'pension-link',kind:'pension'},{id:'irp-link',kind:'irp'}],liabilities:[],ledger:[]},
 financeSchedules:{items:[]}
};
const centralPensionContributionRows=year=>state.integrated.ledger.filter(t=>['pension-link','irp-link'].includes(t.toAccountId)&&(!year||t.date.startsWith(String(year)))).map(t=>({sourceTxId:t.id,date:t.date,amount:t.amount,kind:t.toAccountId==='irp-link'?'irp':'pension'}));
const context=vm.createContext({console,Date,Number,String,Set,state,clone,localYmd:()=> '2026-09-03',integratedStore:()=>state.integrated,normalizeIntegrated:x=>x,normalizeFinanceSchedules:x=>x,centralPensionContributionRows,won:n=>`${Number(n).toLocaleString('ko-KR')}원`});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','pension-contributions.js'),'utf8'),context,{filename:'pension-contributions.js'});
const run=(code,args=[])=>vm.runInContext(code,Object.assign(context,{__args:args}));
const months=[1,2,3,4,5,6,7,8],input={year:'2026',throughMonth:8,day:25,pensionAmount:500000,irpAmount:250000,pensionAccountId:'ps-1',irpAccountId:'irp-1',months:{pension:months.filter(m=>m!==7),irp:months}};

assert.equal(run('pensionContributionBatchLatestMonth("2026",25)'),8);
assert.equal(run('pensionContributionBatchLatestMonth("2020",25)'),12);
let result=run('applyPensionContributionBatch(__args[0])',[input]);
assert.equal(result.ok,true);assert.equal(result.summary.pension,3500000);assert.equal(result.summary.irp,2000000);assert.equal(result.summary.total,5500000);assert.equal(result.summary.count,15);
assert.equal(state.integrated.ledger.length,15);assert.equal(state.pension.accounts[0].openedAt,'2026-01-25');assert.equal(state.pension.accounts[1].openedAt,'2026-01-25');
const july=centralPensionContributionRows('2026').filter(r=>r.date.startsWith('2026-07'));
assert.equal(july.filter(r=>r.kind==='pension').length,0);assert.equal(july.filter(r=>r.kind==='irp').reduce((s,r)=>s+r.amount,0),250000);
assert.equal(state.financeSchedules.items.find(s=>s.targetKind==='pension').amount,500000);assert.equal(state.financeSchedules.items.find(s=>s.targetKind==='irp').amount,250000);

result=run('applyPensionContributionBatch(__args[0])',[input]);assert.equal(result.ok,true);assert.equal(state.integrated.ledger.length,15,'재실행 중복 금지');
const future=run('pensionContributionBatchCandidate(__args[0])',[{...input,throughMonth:9,months:{pension:months,irp:months}}]);assert.equal(future.ok,false);assert.match(future.error,/8월/);

state.integrated.ledger.push({id:'manual',date:'2026-02-10',type:'externalAssetIn',amount:600000,toAccountId:'pension-link',meta:{targetPensionAccountId:'ps-1'}});
const before=JSON.stringify(state.integrated.ledger),conflict=run('applyPensionContributionBatch(__args[0])',[input]);assert.equal(conflict.ok,false);assert.equal(JSON.stringify(state.integrated.ledger),before,'충돌 시 원본 보존');
console.log('pension contribution batch tests: PASS');
