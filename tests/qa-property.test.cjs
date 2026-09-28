'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const fc=require('fast-check');

const root=path.join(__dirname,'..');
const context=vm.createContext({Date,Math,Number,String,Object,Array,Map,JSON});
vm.runInContext(fs.readFileSync(path.join(root,'src/domain/integrated-replay.js'),'utf8'),context,{filename:'integrated-replay.js'});
const calculate=(store,rows)=>JSON.parse(JSON.stringify(vm.runInContext('calculateIntegratedReplay(__store,__rows)',Object.assign(context,{__store:store,__rows:rows}))));
const store={accounts:[{id:'cash'},{id:'savings'}],liabilities:[{id:'loan'}]};
const money=fc.integer({min:0,max:1000000000});

test('property: income and expense arithmetic never produces non-finite totals',()=>{
 fc.assert(fc.property(money,money,(income,expense)=>{
  const result=calculate(store,[{date:'2026-01-01',type:'externalIncome',toAccountId:'cash',amount:income},{date:'2026-01-02',type:'expense',fromAccountId:'cash',amount:expense}]);
  assert.equal(result.assets.cash,income-expense);
  assert.equal(result.netAssets,income-expense);
  assert.ok(Object.values(result).flatMap(value=>typeof value==='object'?Object.values(value):[value]).filter(value=>typeof value==='number').every(Number.isFinite));
 }),{numRuns:200,seed:20260928});
});

test('property: transfers preserve total assets and tracked principal preserves net assets',()=>{
 fc.assert(fc.property(fc.integer({min:1,max:1000000000}),fc.integer({min:0,max:1000000000}),(cash,raw)=>{
  const amount=Math.min(cash,raw),transfer=calculate(store,[{date:'2026-01-01',type:'openingAsset',toAccountId:'cash',amount:cash},{date:'2026-01-02',type:'internalTransfer',fromAccountId:'cash',toAccountId:'savings',amount}]);
  assert.equal(transfer.totalAssets,cash);
  const principal=calculate(store,[{date:'2026-01-01',sequence:1,type:'openingAsset',toAccountId:'cash',amount:cash},{date:'2026-01-01',sequence:2,type:'openingLiability',liabilityId:'loan',amount:cash},{date:'2026-01-02',type:'debtPrincipal',fromAccountId:'cash',liabilityId:'loan',amount}]);
  assert.equal(principal.netAssets,0);
 }),{numRuns:200,seed:20260929});
});

test('property: final balances do not depend on response order when dates are unique',()=>{
 fc.assert(fc.property(fc.array(money,{minLength:1,maxLength:40}),values=>{
  const rows=values.map((amount,index)=>({id:`row-${index}`,date:`2026-${String(Math.floor(index/28)+1).padStart(2,'0')}-${String(index%28+1).padStart(2,'0')}`,type:'externalIncome',toAccountId:index%2?'cash':'savings',amount}));
  const reversed=[...rows].reverse(),left=calculate(store,rows),right=calculate(store,reversed);
  assert.deepEqual(left.assets,right.assets);
  assert.equal(left.totalAssets,right.totalAssets);
 }),{numRuns:100,seed:20260930});
});
