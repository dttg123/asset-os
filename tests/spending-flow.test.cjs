'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('spending taxonomy: ledger item names never populate picker and explicit categories remain authoritative',async()=>{
 const rows=[{id:'insurance',type:'expense',date:'2026-08-01',amount:100,category:'가상 실손보험',meta:{scheduleId:'policy'}},{id:'gift',type:'expense',date:'2026-08-02',amount:200,category:'어머니용돈'},{id:'same-a',type:'expense',date:'2026-08-03',amount:100,category:'가상 실손보험',meta:{scheduleId:'policy'}},{id:'refund',type:'refund',date:'2026-08-04',amount:50,category:'환불',meta:{refundOf:'insurance'}}],settings={spendingCategoryNames:['직접 추가 분류']},schedules=[{id:'policy',kind:'insurance'}];
 const c=vm.createContext({console,setting:()=>settings,integratedLedger:()=>rows,financeSchedules:()=>schedules,persist:async()=>true,toast:()=>{},integratedMonthKey:x=>String(x).slice(0,7),integratedLatestMonth:()=> '2026-08'});vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/domain/integrated-spending.js'),'utf8'),c);
 const run=s=>vm.runInContext(s,c),json=s=>JSON.parse(run('JSON.stringify('+s+')')),before=JSON.stringify(rows);
 assert.equal(json('spendingCategoryNames()').length,13);assert.ok(!json('spendingCategoryNames()').includes('가상 실손보험'));assert.ok(!json('spendingCategoryNames()').includes('어머니용돈'));
 const analysis=json("integratedSpendingAnalysis('2026-08')");assert.equal(analysis.total,350);assert.equal(analysis.categories.find(x=>x.key==='보험').amount,150);assert.equal(analysis.categories.find(x=>x.key==='용돈·선물').amount,200);assert.equal(analysis.items.find(x=>x.key==='가상 실손보험').count,3);assert.equal(JSON.stringify(rows),before);
 await run("saveSpendingClassifications(['insurance'],'직접 추가 분류','보험 표시 이름')");assert.equal(json("integratedSpendingAnalysis('2026-08')").categories.find(x=>x.key==='직접 추가 분류').amount,50);assert.equal(JSON.stringify(rows),before);
 await run("saveSpendingCategory('직접 추가 분류','새 분류')");assert.ok(json('spendingCategoryNames()').includes('새 분류'));assert.ok(!json('spendingCategoryNames()').includes('직접 추가 분류'));
});
