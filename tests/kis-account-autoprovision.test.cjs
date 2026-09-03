'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const accounts=[];
let persisted=0,sequence=0;
const context=vm.createContext({
 console,Date,Promise,String,Number,Set,FormData,
 state:{brokerKis:{connections:{pension:{accountId:''},irp:{accountId:''}}}},
 pensionStore:()=>({accounts}),
 localYmd:()=> '2026-09-02',
 createPensionAccount:input=>{const account={id:`account-${++sequence}`,...input,status:'active'};accounts.push(account);return{ok:true,account}},
 persist:()=>{persisted++;return true}
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','ui-settings.js'),'utf8'),context,{filename:'ui-settings.js'});

const first=vm.runInContext('ensureKisLocalAccounts()',context);
assert.deepEqual([...first],['pension','irp']);
assert.equal(accounts.length,2);
assert.equal(accounts[0].name,'한국투자 연금저축');
assert.equal(accounts[1].name,'한국투자 IRP');
assert.equal(context.state.brokerKis.connections.pension.accountId,'account-1');
assert.equal(context.state.brokerKis.connections.irp.accountId,'account-2');
assert.equal(persisted,1);

const second=vm.runInContext('ensureKisLocalAccounts()',context);
assert.deepEqual([...second],[]);
assert.equal(accounts.length,2);
assert.equal(persisted,1);
console.log('kis account autoprovision tests: PASS');
