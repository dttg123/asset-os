'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('AI download preserves the analysis file and honors data blockers',()=>{
 const c=vm.createContext({console});vm.runInContext(fs.readFileSync('ai-strategy.js','utf8'),c);
 vm.runInContext(`let saved=null,notice='',message='',ready=true;const testFile={name:'투자분석.txt',type:'text/plain'};aiStrategyFile=()=>({file:testFile,payload:{dataQuality:{ready,blockers:['잔액 확인']}}});downloadBytes=(...args)=>saved=args;showNotice=(title,text)=>notice=text;toast=text=>message=text;`,c);
 assert.equal(vm.runInContext("downloadAiStrategyFile('rebalance',0,'new_money')",c),true);
 assert.equal(vm.runInContext("saved[0]===testFile&&saved[1]==='투자분석.txt'&&saved[2]==='text/plain'",c),true);
 vm.runInContext('ready=false;saved=null;',c);assert.equal(vm.runInContext("downloadAiStrategyFile('buy',100,'account_cash')",c),false);assert.equal(vm.runInContext('saved',c),null);assert.equal(vm.runInContext('notice',c),'잔액 확인');
});
