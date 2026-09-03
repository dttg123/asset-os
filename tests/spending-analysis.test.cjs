'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const context=vm.createContext({console,Date,String,Number,Map,Set,Math});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','integrated-ledger-engine.js'),'utf8'),context,{filename:'integrated-ledger-engine.js'});
const rows=[
 {id:'july',date:'2026-07-10',type:'expense',fixed:false,category:'식비',amount:100},
 {id:'fixed',date:'2026-08-01',type:'expense',fixed:true,category:'보험',amount:100},
 {id:'variable',date:'2026-08-02',type:'expense',fixed:false,category:'식비',amount:50},
 {id:'interest',date:'2026-08-03',type:'debtInterest',fixed:false,category:'대출 이자',amount:25},
 {id:'saving',date:'2026-08-04',type:'internalTransfer',category:'저축',amount:999}
];
context.__rows=rows;
vm.runInContext('integratedLedger=()=>__rows',context);
const result=JSON.parse(vm.runInContext("JSON.stringify(integratedSpendingAnalysis('2026-08'))",context));
assert.equal(result.total,175);
assert.equal(result.fixed,125);
assert.equal(result.variable,50);
assert.equal(result.previousTotal,100);
assert.equal(result.change,75);
assert.equal(result.trend.length,6);
assert.deepEqual(result.categories.map(row=>row.key),['보험','식비','대출 이자']);
assert.ok(!result.rows.some(row=>row.id==='saving'));
const summaryRows=[
 {date:'2026-08-01',type:'externalIncome',amount:1000,toAccountId:'cash-main'},
 {date:'2026-08-02',type:'internalTransfer',amount:200,fromAccountId:'cash-main',toAccountId:'pension-link'},
 {date:'2026-08-03',type:'externalAssetIn',amount:500,toAccountId:'pension-link'}
];
context.__summaryRows=summaryRows;
vm.runInContext("integratedLedger=()=>__summaryRows;integratedStore=()=>({accounts:[{id:'cash-main',kind:'cash'},{id:'pension-link',kind:'pension'}]});integratedProductSavingAmount=()=>0;integratedFinancialModel=()=>({replay:{}})",context);
const summary=JSON.parse(vm.runInContext("JSON.stringify(integratedSummary('2026-08'))",context));
assert.equal(summary.invest,700,'월 저축·투자에는 앱 밖 납입도 포함');
assert.equal(summary.trackedInvest,200,'생활현금에서는 추적 계좌 이체만 차감');
assert.equal(summary.operatingCashDelta,800,'앱 밖 납입은 생활현금을 줄이지 않음');
console.log('spending analysis tests: PASS');
