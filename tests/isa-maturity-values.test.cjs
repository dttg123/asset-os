'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context=vm.createContext({console});
vm.runInContext(fs.readFileSync('isa-maturity-policy.js','utf8'),context,{filename:'isa-maturity-policy.js'});
const form=values=>({get:key=>values[key]});
context.__form=form({actualSettlement:'1000000',actualTax:'100000',actualReceived:'900000'});
assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('maturityActualValues(__form,false)',context))),{ok:true,actualSettlement:1000000,actualTax:100000,actualReceived:900000});
context.__form=form({actualSettlement:'1000000',actualTax:'100000',actualTransferAmount:'900000'});
assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('maturityActualValues(__form,true)',context))),{ok:true,actualSettlement:1000000,actualTax:100000,actualTransferAmount:900000});
for(const values of [
 {actualSettlement:'-1',actualTax:'0',actualReceived:'0'},
 {actualSettlement:'100',actualTax:'101',actualReceived:'0'},
 {actualSettlement:'100',actualTax:'10',actualReceived:'91'},
 {actualSettlement:'not-a-number',actualTax:'0',actualReceived:'0'}
]){context.__form=form(values);assert.equal(vm.runInContext('maturityActualValues(__form,false).ok',context),false)}
console.log('ISA maturity actual-value validation tests: PASS');
