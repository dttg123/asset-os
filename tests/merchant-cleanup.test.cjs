'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {financialRuntime}=require('./support/financial-runtime.cjs');
test('approved merchant names group branches while preserving unrelated store names and raw records',()=>{
 const r=financialRuntime();r.run('setting().merchantNameCleanup=true');
 const pairs=[['구글페이먼트코리아 유한회사','구글플레이'],['구글페이','구글플레이'],['주식회사 우아한형제들','배달의민족'],['컴포즈커피 전남해남터미널점','컴포즈커피'],['컴포즈커피 해남터미','컴포즈커피'],['지에스(GS)25 해남터미널점','GS25'],['CU(씨유)봉선중앙점','CU'],['파리바게뜨해남2호점','파리바게뜨'],['전자담배 전문점','전자담배 전문점'],['헤일로상점','헤일로상점'],['CUBE STORE','CUBE STORE'],['Google Cloud','Google Cloud']];
 for(const [raw,want] of pairs)assert.equal(r.run('spendingMerchantName(__args[0])',[raw]),want);
 r.run('setting().merchantNameCleanup=false');assert.equal(r.run('spendingMerchantName("컴포즈커피 해남점")'),'컴포즈커피 해남점');
});
test('merchant grouping and game classification keep amounts and refund linkage intact',()=>{
 const r=financialRuntime();r.run('setting().merchantNameCleanup=true;setting().googlePlayIsGaming=true');
 r.run('state.integrated.ledger=__args[0]',[[{id:'g',date:'2026-04-01',type:'externalExpense',amount:15000,category:'쇼핑',meta:{merchant:'구글페이먼트'}},{id:'r',date:'2026-04-02',type:'refund',amount:3000,category:'쇼핑',meta:{refundOf:'g'}},{id:'c1',date:'2026-04-03',type:'externalExpense',amount:1800,category:'식비',meta:{merchant:'컴포즈커피해남터미널점'}},{id:'c2',date:'2026-04-04',type:'externalExpense',amount:1800,category:'식비',meta:{merchant:'컴포즈커피 전남담양터미널점'}}]]);
 const raw=r.run('JSON.stringify(state.integrated.ledger)'),a=r.plain(r.run('integratedSpendingAnalysis("2026-04")'));
 assert.equal(a.total,15600);assert.equal(a.items.find(x=>x.key==='구글플레이').amount,12000);assert.equal(a.items.find(x=>x.key==='컴포즈커피').count,2);assert.equal(a.categories.find(x=>x.key==='게임·취미').amount,12000);assert.equal(r.run('JSON.stringify(state.integrated.ledger)'),raw);
});
