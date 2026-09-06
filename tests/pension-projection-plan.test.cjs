'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
let paidThisMonth=0;
const schedules=[
 {id:'ps',kind:'investment',amount:500000,startDate:'2025-01-01',endDate:'',targetKind:'pension',active:true},
 {id:'irp',kind:'investment',amount:250000,startDate:'2025-01-01',endDate:'',targetAccountId:'irp-link',active:true}
];
const context=vm.createContext({console,Math,Number,String,Array,Map,Set,localYmd:()=>'2026-09-06',financeSchedules:()=>schedules,integratedStore:()=>({accounts:[{id:'irp-link',kind:'irp'}]}),pensionCurrentMonthOrdinary:()=>({total:paidThisMonth})});
vm.runInContext(fs.readFileSync('pension-assets.js','utf8'),context,{filename:'pension-assets.js'});
assert.equal(vm.runInContext('pensionProjectionScheduledMonthly()',context),750000);
paidThisMonth=0;assert.equal(vm.runInContext('pensionProjectionScheduledMonthly()',context),750000,'미납월에도 계획 납입액은 유지');
paidThisMonth=1500000;assert.equal(vm.runInContext('pensionProjectionScheduledMonthly()',context),750000,'보충납입월에도 계획 납입액은 유지');
schedules[0].active=false;assert.equal(vm.runInContext('pensionProjectionScheduledMonthly()',context),250000,'중단된 일정은 전망에서 제외');
console.log('pension projection plan tests: PASS');
