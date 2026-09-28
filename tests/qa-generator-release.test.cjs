'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {longHorizon}=require('./support/qa-data.cjs');

test('release-only 30 year seed regenerates the same summary hash',()=>{
 const root=path.join(__dirname,'..'),data=longHorizon({years:30}),again=longHorizon({years:30});
 assert.equal(data.hash,again.hash);
 assert.equal(data.rows.length,2+30*12*3+40);
 const context=vm.createContext({Date,Math,Number,String,Object,Array,Map,JSON,__store:{accounts:data.accounts,liabilities:data.liabilities},__rows:data.rows});
 vm.runInContext(fs.readFileSync(path.join(root,'src/domain/integrated-replay.js'),'utf8'),context,{filename:'integrated-replay.js'});
 const result=JSON.parse(JSON.stringify(vm.runInContext('calculateIntegratedReplay(__store,__rows)',context)));
 assert.equal(result.netAssets,result.totalAssets-result.totalDebt);
 assert.ok(result.totalAssets>0);
 assert.equal(result.totalDebt,0);
});
