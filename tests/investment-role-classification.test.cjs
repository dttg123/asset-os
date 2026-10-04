'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
for(const file of ['pension-ledger.js','dist/asset-ledgers.js']){
 test(`${file}: AI power is growth while income assets retain their roles`,()=>{
  const source=fs.readFileSync(file,'utf8');
  const start=source.indexOf('function normalizeInvestmentRole('),end=source.indexOf('function pensionTransactions(',start);
  assert.ok(start>=0&&end>start);
  const ctx=vm.createContext({INVESTMENT_ROLES:['성장','배당','현금흐름','안정','현금']});
  vm.runInContext(source.slice(start,end),ctx);
  const ai={name:'KODEX 미국AI전력핵심인프라',source:'kis',readOnly:true};
  assert.equal(ctx.investmentRoleForHolding(ai),'성장');
  assert.equal(ctx.investmentThemeTag(ai),'AI·전력');
  assert.equal(ctx.investmentRoleForHolding({name:'TIGER 글로벌AI인프라'}),'성장');
  assert.equal(ctx.investmentThemeTag({name:'TIGER 글로벌AI인프라'}),'');
  for(const name of ['맥쿼리인프라','TIGER 미국MSCI리츠','KODEX 미국배당커버드콜'])assert.equal(ctx.investmentRoleForHolding({name}),'현금흐름');
  assert.equal(ctx.investmentRoleForHolding({name:'KODEX 미국배당다우존스'}),'배당');
  assert.equal(ctx.investmentRoleForHolding({name:'KODEX 국고채'}),'안정');
  assert.equal(ctx.investmentRoleForHolding({name:'KODEX CD금리액티브'}),'현금');
  assert.equal(ctx.investmentRoleForHolding({...ai,investmentRole:'배당'}),'배당');
 });
}
