'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const storage=new Map();
const context=vm.createContext({
 console,Date,Set,Map,Promise,ArrayBuffer,Uint8Array,DataView,TextEncoder,TextDecoder,JSON,Math,Number,String,Boolean,Object,RegExp,Intl,
 location:{search:'',hash:'',pathname:'/asset-os/'},history:{replaceState(){}},
 document:{querySelector:()=>null,querySelectorAll:()=>[],body:{appendChild(){}},documentElement:{classList:{add(){},remove(){}}}},
 window:{addEventListener(){},isSecureContext:false},navigator:{},URL:{createObjectURL:()=>'',revokeObjectURL(){}},Blob:class{},
 localStorage:{get length(){return storage.size},key:i=>[...storage.keys()][i]??null,getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(String(k),String(v)),removeItem:k=>storage.delete(String(k))}
});
const files=['core-config.js','broker-kis.js','integrated-ledger-engine.js','data-defaults.js','integrated-schedule-engine.js','integrated-finance-engine.js','isa-validation.js','store-state.js','backup.js'];
for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const run=code=>vm.runInContext(code,context),plain=value=>JSON.parse(JSON.stringify(value));

function legacyData(){
 return{
  accounts:[{id:'legacy-isa',name:'과거 ISA',status:'active',openedAt:'2025-01-01',holdings:[],transactions:[{id:'legacy-deposit',type:'deposit',date:'2025-01-25',amount:1000000}],assetSnapshots:[]}],
  pension:{accounts:[{id:'legacy-pension',kind:'pension',name:'과거 연금',openedAt:'2025-01-01',status:'active'}],contributions:[{id:'pc-2026-01-ps',accountId:'legacy-pension',date:'2026-01-25',amount:500000}],transactions:[],holdings:[],incomes:[],assetSnapshots:[]},
  integrated:{accounts:[{id:'cash-main',kind:'cash',name:'현금·입출금'}],liabilities:[],ledger:[{id:'demo-salary-2025',date:'2025-01-21',type:'externalIncome',amount:4000000,toAccountId:'cash-main'}]}
 };
}

for(let schema=4;schema<=20;schema++){
 context.__payload={format:'asset-os-backup-v1',schemaVersion:schema,appVersion:schema===4?'v0.1':'v0.6.4',environment:'live',exportedAt:'2026-09-02T00:00:00.000Z',data:legacyData()};
 const normalized=plain(run('validateBackupPayload(__payload)'));
 assert.equal(normalized.accounts[0].transactions[0].id,'legacy-deposit',`schema ${schema} ISA 원장 보존`);
 assert.equal(normalized.pension.contributions[0].id,'pc-2026-01-ps',`schema ${schema} 연금 납입 보존`);
 assert.equal(normalized.integrated.ledger[0].id,'demo-salary-2025',`schema ${schema} 통합 원장 보존`);
 const roundTrip=plain(run('parseBackupZipBytes(createBackupZipBytes(__payload))'));
 assert.equal(roundTrip.schemaVersion,schema);
 assert.equal(roundTrip.appVersion,context.__payload.appVersion);
 assert.equal(roundTrip.data.pension.contributions[0].amount,500000);
}
for(const schema of [3,21]){context.__payload={format:'asset-os-backup-v1',schemaVersion:schema,data:{}};assert.throws(()=>run('validateBackupPayload(__payload)'),/지원하지 않는 데이터 구조/)}
context.__payload={format:'asset-os-backup-v1',schemaVersion:20,appVersion:'v0.6.4',environment:'qa',data:{accounts:[],pension:{},integrated:{ledger:[]}}};
assert.throws(()=>run('validateBackupPayload(__payload)'),/QA 백업은 운영 화면에 복원할 수 없습니다/);
console.log('backup schema 4-20 real-normalization compatibility tests: PASS');
