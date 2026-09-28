'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {longHorizon}=require('./support/qa-data.cjs');

const root=path.join(__dirname,'..');
const context=vm.createContext({Date,Math,Number,String,Object,Array,Map,JSON});
vm.runInContext(fs.readFileSync(path.join(root,'src/domain/integrated-replay.js'),'utf8'),context,{filename:'integrated-replay.js'});
const calculate=data=>JSON.parse(JSON.stringify(vm.runInContext('calculateIntegratedReplay(__store,__rows)',Object.assign(context,{__store:{accounts:data.accounts,liabilities:data.liabilities},__rows:data.rows}))));

test('fixed seed 1, 5 and 10 year profiles are deterministic and internally consistent',()=>{
 for(const years of [1,5,10]){
  const first=longHorizon({years}),second=longHorizon({years});
  assert.equal(first.hash,second.hash,`${years}y hash`);
  assert.deepEqual(first.rows,second.rows,`${years}y rows`);
  const result=calculate(first);
  assert.equal(result.totalAssets,Object.values(result.assets).reduce((sum,value)=>sum+value,0));
  assert.equal(result.totalDebt,Object.values(result.liabilities).reduce((sum,value)=>sum+value,0));
  assert.equal(result.netAssets,result.totalAssets-result.totalDebt);
  assert.ok(first.rows.every(row=>Number.isFinite(Number(row.amount))));
 }
 assert.notEqual(longHorizon({years:5,seed:1}).hash,longHorizon({years:5,seed:2}).hash);
});
