'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const context=vm.createContext({console,Date,Set,Map,Promise,APP_VERSION:'v0.5',APP_ENV:'live'});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','backup-v04.js'),'utf8'),context,{filename:'backup-v04.js'});

assert.equal(vm.runInContext("assetManagedBackupName({date:new Date(2026,8,2),version:'v0.5'})",context),'AssetOS_260902_v0.5.zip');
assert.equal(vm.runInContext("assetManagedBackupName({date:new Date(2026,8,2),version:'v0.3',tag:'pre'})",context),'AssetOS_260902_v0.3_pre.zip');
assert.equal(vm.runInContext("assetParseManagedBackup('AssetOS_260902_v0.5_keep.zip').tag",context),'keep');
assert.equal(vm.runInContext("assetParseManagedBackup('unrelated.zip')",context),null);

const names=vm.runInContext(`(()=>{const now=new Date(2026,8,2),days=n=>new Date(2026,8,2-n),row=(n,tag='')=>{const name=assetManagedBackupName({date:days(n),tag});return{name,info:assetParseManagedBackup(name)}};const rows=[row(0),row(1),row(29),row(31),row(32),row(60),row(61),row(300,'pre'),row(400,'keep')];return assetBackupRetentionPlan(rows,now).remove})()`,context);
assert.ok(names.includes('AssetOS_260801_v0.5.zip'));
assert.ok(names.includes('AssetOS_260703_v0.5.zip'));
assert.ok(!names.some(name=>name.endsWith('_pre.zip')||name.endsWith('_keep.zip')));
const qaContext=vm.createContext({console,Date,Set,Map,Promise,APP_VERSION:'v0.5',APP_ENV:'qa'});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','backup-v04.js'),'utf8'),qaContext,{filename:'backup-v04.js'});
assert.equal(vm.runInContext("assetManagedBackupName({date:new Date(2026,8,2)})",qaContext),'AssetOS_QA_260902_v0.5.zip');
assert.equal(vm.runInContext('ASSET_BACKUP_DB',qaContext),'asset-os-backup-v05-qa');
console.log('v0.5 backup retention tests: PASS');
