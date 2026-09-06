'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ledger=[
 {id:'jan',date:'2026-01-01',type:'externalAssetIn',amount:500000,toAccountId:'finance-asset-saving'},
 {id:'jul',date:'2026-07-01',type:'externalAssetIn',amount:500000,toAccountId:'finance-asset-saving'}
];
const context=vm.createContext({console,Date,Math,Number,String,Array,Set,Map,clone:value=>JSON.parse(JSON.stringify(value)),uid:()=>'',ymd:()=>'2026-12-31',localYmd:()=>'2026-12-31',integratedOperationalLedger:()=>ledger,integratedReplay:()=>({assets:{'finance-asset-saving':1000000},liabilities:{}}),buildIntegratedSeed:()=>({accounts:[],liabilities:[],ledger:[]})});
vm.runInContext(fs.readFileSync('integrated-finance-engine.js','utf8'),context,{filename:'integrated-finance-engine.js'});
context.__product={id:'saving',type:'savings',startDate:'2026-01-01',maturityDate:'2026-12-31',annualRate:12,interestMethod:'simple',taxMode:'general',taxRate:15.4};
const result=JSON.parse(JSON.stringify(vm.runInContext('financeProductInterestEstimate(__product)',context)));
const expectedGross=500000*.12*(364/365)+500000*.12*(183/365);
assert.ok(Math.abs(result.gross-expectedGross)<.01,String(result.gross)+' != '+String(expectedGross));
assert.ok(result.gross<100000,'월납 적금을 현재잔액 전체의 1년 이자로 과대계산하면 안 됨');
assert.ok(Math.abs(result.tax-result.gross*.154)<.01);
ledger.push({id:'oct-out',date:'2026-10-01',type:'externalAssetOut',amount:200000,fromAccountId:'finance-asset-saving'});
context.integratedReplay=()=>({assets:{'finance-asset-saving':800000},liabilities:{}});
const afterWithdrawal=JSON.parse(JSON.stringify(vm.runInContext('financeProductInterestEstimate(__product)',context)));
assert.ok(afterWithdrawal.gross<result.gross,'중도 출금 이후 기간의 이자는 감소해야 함');
console.log('financial product dated-interest tests: PASS');
