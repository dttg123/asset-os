'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const clone=value=>JSON.parse(JSON.stringify(value));
const context=vm.createContext({console,Date,Set,ArrayBuffer,Uint8Array,DataView,TextEncoder,TextDecoder,JSON,Math,clone,normalizeState:clone});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','backup.js'),'utf8'),context,{filename:'backup.js'});
for(let schema=4;schema<=20;schema++){
 context.__payload={format:'asset-os-backup-v1',schemaVersion:schema,appVersion:schema===4?'v0.1':'v0.4',exportedAt:'2026-09-02T00:00:00.000Z',data:{accounts:[],pension:{},integrated:{ledger:[]}}};
 assert.doesNotThrow(()=>vm.runInContext('validateBackupPayload(__payload)',context));
 const roundTrip=JSON.parse(vm.runInContext('JSON.stringify(parseBackupZipBytes(createBackupZipBytes(__payload)))',context));
 assert.equal(roundTrip.schemaVersion,schema);
 assert.equal(roundTrip.appVersion,context.__payload.appVersion);
}
for(const schema of [3,21]){context.__payload={format:'asset-os-backup-v1',schemaVersion:schema,data:{}};assert.throws(()=>vm.runInContext('validateBackupPayload(__payload)',context),/지원하지 않는 데이터 구조/)}
console.log('backup schema 4-20 compatibility tests: PASS');
