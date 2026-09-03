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
console.log('spending analysis tests: PASS');
