'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

test('debt-only history is never used as a comparable asset baseline',()=>{
 const context=vm.createContext({Date,Math,Number,String,Map,Set,console,QA_MODE:false});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..','integrated-ledger-engine.js'),'utf8'),context);
 context.state={accounts:[{id:'isa',openedAt:'2025-01-01',status:'active',assetSnapshots:[{date:'2025-01-31',value:100,totalValue:100}]}],pension:{accounts:[],assetSnapshots:[]}};
 context.__ledger=[
  {id:'debt',date:'2023-01-01',type:'openingLiability',amount:1000,liabilityId:'loan'},
  {id:'cash',date:'2025-01-01',type:'openingAsset',amount:200,toAccountId:'cash'}
 ];
 context.__store={accounts:[{id:'cash',kind:'cash'},{id:'isa-link',kind:'isa'}],liabilities:[{id:'loan',kind:'loan'}],ledger:context.__ledger};
 Object.assign(context,{localYmd:()=> '2026-09-07',integratedAnalysisBalanceLedger:()=>context.__ledger,integratedStore:()=>context.__store,pensionStore:()=>context.state.pension,financialProduct:()=>null,activeFinancialProducts:()=>[],pensionAccountActiveOnDate:()=>false});
 assert.equal(vm.runInContext('historicalFinancialCoverage("2023-12-31").complete',context),false);
 assert.equal(vm.runInContext('financialAnalysisEarliestDate()',context),'2025-01-31');
 const series=JSON.parse(vm.runInContext('JSON.stringify(financialGrowthSeries("all"))',context));
 assert.ok(series.every(row=>row.asOf>='2025-01-31'),JSON.stringify(series.slice(0,3)));
});
