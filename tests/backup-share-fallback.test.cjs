'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

let downloaded='',notice=[],sharedFile=null;
const context=vm.createContext({
 console,Date,Set,Map,Promise,TextEncoder,TextDecoder,Uint8Array,DataView,Blob,
 APP_VERSION:'v0.6.8',APP_ENV:'qa',SCHEMA_VERSION:20,state:{},
 clone:value=>value,localYmd:()=>'2060-12-31',assetManagedBackupName:()=> 'AssetOS_QA_601231_v0.6.8.zip',
 File:class{constructor(parts,name,options){this.parts=parts;this.name=name;this.type=options.type}},
 navigator:{share:async data=>{sharedFile=data.files[0];const error=new Error('Permission denied');error.name='NotAllowedError';throw error},canShare:()=>true},
 showNotice:(title,message)=>{notice=[title,message]},toast:()=>{},
 URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}},document:{createElement:()=>({href:'',set download(value){downloaded=value},click(){},remove(){}}),body:{appendChild(){}}},
 setTimeout:()=>{},normalizeState:value=>value,$:()=>null
});
const source=fs.readFileSync(path.resolve(__dirname,'..','backup.js'),'utf8');
vm.runInContext(`${source}\nthis.__shareDriveBackup=shareDriveBackup;this.__parseBackupFile=parseBackupFile;`,context);

(async()=>{
 const ok=await context.__shareDriveBackup();
 assert.equal(ok,true);
 assert.equal(downloaded,'AssetOS_QA_601231_v0.6.8.zip');
 assert.equal(sharedFile.name,'AssetOS_QA_601231_v0.6.8.txt');
 assert.equal(sharedFile.type,'text/plain');
 assert.match(notice[0],/공유 대신 ZIP/);
 assert.doesNotMatch(notice.join(' '),/공유 실패/);
 const txtBytes=new TextEncoder().encode(JSON.stringify({format:'asset-os-backup-v1',schemaVersion:20,data:{ok:true}}));
 const txt=await context.__parseBackupFile({name:'AssetOS_backup.txt',arrayBuffer:async()=>txtBytes.buffer});
 assert.equal(txt.data.ok,true);
 console.log('backup share fallback tests: PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
