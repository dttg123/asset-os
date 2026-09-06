'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('debt change wording follows the direction without a misleading minus sign',()=>{
 const source=fs.readFileSync(path.join(__dirname,'..','chart-financial-growth.js'),'utf8');
 const context={};
 vm.runInNewContext(source,context);
 assert.deepEqual({...context.financialDebtChangeView(87400000)},{label:'부채 감소',amount:87400000,negative:false});
 assert.deepEqual({...context.financialDebtChangeView(-87400000)},{label:'부채 증가',amount:87400000,negative:true});
 assert.deepEqual({...context.financialDebtChangeView(0)},{label:'부채 변동',amount:0,negative:false});
 assert.doesNotMatch(source,/부채 감소<\/span><strong>\$\{a\.debtReduction>=0/);
});
