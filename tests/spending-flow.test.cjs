'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('spending taxonomy: ledger item names never populate picker and explicit categories remain authoritative',async()=>{
 const rows=[{id:'insurance',type:'expense',date:'2026-08-01',amount:100,category:'가상 실손보험',meta:{scheduleId:'policy'}},{id:'gift',type:'expense',date:'2026-08-02',amount:200,category:'어머니용돈'},{id:'same-a',type:'expense',date:'2026-08-03',amount:100,category:'가상 실손보험',meta:{scheduleId:'policy'}},{id:'refund',type:'refund',date:'2026-08-04',amount:50,category:'환불',meta:{refundOf:'insurance'}}],settings={spendingCategoryNames:['직접 추가 분류']},schedules=[{id:'policy',kind:'insurance'}];
 const c=vm.createContext({console,setting:()=>settings,integratedLedger:()=>rows,financeSchedules:()=>schedules,persist:async()=>true,toast:()=>{},integratedMonthKey:x=>String(x).slice(0,7),integratedLatestMonth:()=> '2026-08'});vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/domain/integrated-spending.js'),'utf8'),c);
 const run=s=>vm.runInContext(s,c),json=s=>JSON.parse(run('JSON.stringify('+s+')')),before=JSON.stringify(rows);
 assert.equal(json('spendingCategoryNames()').length,13);assert.ok(!json('spendingCategoryNames()').includes('가상 실손보험'));assert.ok(!json('spendingCategoryNames()').includes('어머니용돈'));
 const analysis=json("integratedSpendingAnalysis('2026-08')");assert.equal(analysis.total,350);assert.equal(analysis.categories.find(x=>x.key==='보험').amount,150);assert.equal(analysis.categories.find(x=>x.key==='용돈·선물').amount,200);assert.equal(analysis.items.find(x=>x.key==='가상 실손보험').count,3);assert.equal(JSON.stringify(rows),before);
 settings.spendingCategoryAliases={'가상 실손보험':'직접 추가 분류'};assert.equal(json("integratedSpendingAnalysis('2026-08')").categories.find(x=>x.key==='직접 추가 분류').amount,150);delete settings.spendingCategoryAliases;
 await run("saveSpendingClassifications(['insurance'],'직접 추가 분류','보험 표시 이름')");assert.equal(json("integratedSpendingAnalysis('2026-08')").categories.find(x=>x.key==='직접 추가 분류').amount,50);assert.equal(JSON.stringify(rows),before);
 await run("saveSpendingCategory('직접 추가 분류','새 분류')");assert.ok(json('spendingCategoryNames()').includes('새 분류'));assert.ok(!json('spendingCategoryNames()').includes('직접 추가 분류'));
});

test('calendar scopes and linked refunds reconcile category, fixed/variable and full-year boundaries without source writes',()=>{
 const rows=[{id:'jan',type:'expense',date:'2026-01-01',amount:100,category:'식비'},{id:'jul',type:'expense',date:'2026-07-01',amount:200,category:'식비'},{id:'policy',type:'expense',date:'2026-08-01',amount:100,category:'가상 보험',fixed:true},{id:'aug',type:'expense',date:'2026-08-31',amount:300,category:'기타'},{id:'refund',type:'refund',date:'2026-08-31',amount:20,category:'환불',fixed:false,meta:{refundOf:'policy'}},{id:'sep',type:'expense',date:'2026-09-30',amount:50,category:'식비'},{id:'next',type:'expense',date:'2027-01-01',amount:900,category:'식비'}],before=JSON.stringify(rows),c=vm.createContext({console,setting:()=>({}),integratedLedger:()=>rows,integratedMonthKey:x=>String(x).slice(0,7),integratedLatestMonth:()=> '2026-08'});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/domain/integrated-spending.js'),'utf8'),c);
 const run=s=>JSON.parse(vm.runInContext('JSON.stringify('+s+')',c));
 for(const [mode,total,count] of [['quarter',630,3],['half',630,6],['year',730,12],['years',730,6]]){const result=run(`integratedSpendingView('2026-08','${mode}')`);assert.equal(result.total,total);assert.equal(result.trend.length,count);assert.equal(result.fixed+result.variable,total);assert.equal(result.categories.reduce((n,x)=>n+x.amount,0),total)}
 const august=run("integratedSpendingAnalysis('2026-08')");assert.equal(august.fixed,80);assert.equal(august.variable,300);assert.equal(august.categories.find(x=>x.key==='보험').amount,80);
 assert.equal(run("integratedSpendingAnalysis('2026-Q1')").previousMonth,'2025-Q4');assert.equal(run("integratedSpendingAnalysis('2026-H1')").previousMonth,'2025-H2');
 assert.equal(run("integratedSpendingView('2026-01','year')").trend[11].month,'2026-12');assert.equal(run("integratedSpendingAnalysis('2026')").total,730);assert.equal(JSON.stringify(rows),before);
});
