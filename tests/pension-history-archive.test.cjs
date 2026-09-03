'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const records=[
 {id:'p-r-1',kind:'pensionRealized',date:'2025-01-01',label:'연금 손익',amount:120},
 {id:'p-d-1',kind:'pensionDividend',date:'2025-01-01',label:'연금 배당',amount:30},
 {id:'p-r-2',kind:'pensionRealized',date:'2025-02-01',label:'연금 손익',amount:-20},
 {id:'p-d-2',kind:'pensionDividend',date:'2025-02-01',label:'연금 배당',amount:0},
 {id:'i-r-1',kind:'irpRealized',date:'2025-01-01',label:'IRP 손익',amount:80},
 {id:'i-d-1',kind:'irpDividend',date:'2025-01-01',label:'IRP 배당',amount:10},
 {id:'i-r-2',kind:'irpRealized',date:'2025-02-01',label:'IRP 손익',amount:20},
 {id:'i-d-2',kind:'irpDividend',date:'2025-02-01',label:'IRP 배당',amount:5}
];
const context=vm.createContext({console,Set,Map,String,Number,state:{sourceArchives:{records}},$:()=>null,escapeHtml:String,won:String,signed:String,openSheet:()=>{}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','source-archive.js'),'utf8'),context,{filename:'source-archive.js'});
const summary=scope=>JSON.parse(vm.runInContext(`JSON.stringify(pensionArchivePerformanceSummary('${scope}'))`,context));

assert.deepEqual({...summary('pension'),rows:undefined},{scope:'pension',rows:undefined,count:4,realized:100,income:30,total:130});
assert.deepEqual({...summary('irp'),rows:undefined},{scope:'irp',rows:undefined,count:4,realized:100,income:15,total:115});
assert.deepEqual({...summary('all'),rows:undefined},{scope:'all',rows:undefined,count:8,realized:200,income:45,total:245});
assert.equal(vm.runInContext("pensionArchiveIncomeRecords('all').length",context),3);
assert.equal(vm.runInContext("pensionArchiveTransactionRows('all').length",context),8);
assert.equal(vm.runInContext("pensionArchiveTransactionRows('pension').length",context),4);
assert.equal(vm.runInContext("pensionArchiveTransactionRows('irp').length",context),4);
console.log('pension history archive tests: PASS');
