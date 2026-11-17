'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {financialRuntime}=require('./support/financial-runtime.cjs');
test('ledger totals use every merchant payment before pagination and preserve separate same-day rows and refunds',()=>{
 const r=financialRuntime();vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../integrated-pages.js'),'utf8'),r.context);
 const rows=Array.from({length:65},(_,i)=>({id:'coffee-'+i,date:'2026-05-25',type:'externalExpense',category:'식비',amount:1800,meta:{merchant:'컴포즈커피 '+i+'점'}}));
 rows.push({id:'refund',date:'2026-05-26',type:'refund',amount:1800,meta:{refundOf:'coffee-0'}},{id:'other',date:'2026-05-25',type:'externalExpense',category:'기타',amount:100,meta:{merchant:'컴포즈커피 다른점'}},{id:'income',date:'2026-05-25',type:'externalIncome',amount:1000,category:'급여',meta:{}});
 r.run('setting().merchantNameCleanup=true;state.integrated.ledger=__args[0]',[rows]);const before=r.run('JSON.stringify(state.integrated.ledger)');
 const blocks=r.plain(r.run('integratedLedgerMerchantBlocks(integratedLedger())')),coffee=blocks.find(x=>x.category==='식비');
 assert.equal(blocks.length,3);assert.equal(coffee.rows.length,66);assert.equal(coffee.net,115200);assert.equal(new Set(coffee.rows.map(x=>x.id)).size,66);assert.equal(r.run('JSON.stringify(state.integrated.ledger)'),before);
});
