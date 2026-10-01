'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
function environment(){
 const stored=new Map(),writes=[];
 const context=vm.createContext({
  console,Date,JSON,Map,Set,Uint8Array,ArrayBuffer,DataView,TextEncoder,TextDecoder,Blob,Error,
  SCHEMA_VERSION:21,APP_VERSION:'test',APP_ENV:'live',QA_MODE:false,KEY:'asset-json',BACKUP_FORMAT:'asset-os-backup-v1',
  state:{accounts:[{id:'local',transactions:[{id:'kept',amount:100}]}],system:{}},seed:{accounts:[],system:{}},
  clone:value=>structuredClone(value),normalizeState:value=>structuredClone(value),localYmd:()=> '2026-10-02',
  localStorage:{getItem:key=>stored.get(key)||null,setItem(key,value){writes.push(key);stored.set(key,value)}},
  storeRecoveryCopy(key,value){stored.set(key,value)},pruneRecoveryKeys(){},render(){},toast(){},$:()=>null,
  showNotice(){},showDialog(){},buildIntegratedSeed:()=>({ledger:[]}),systemIntegrityIssues:()=>[],
  setTimeout,clearTimeout
 });
 for(const file of ['src/storage/state-migrations.js','src/domain/cloud-state-policy.js','backup.js','initial-import.js','supabase-sync.js'])vm.runInContext(read(file),context,{filename:file});
 return{context,stored,writes,run:code=>vm.runInContext(code,context)};
}
const malformed=[[],null,17,'data',{accounts:'not-an-array'},{accounts:[null]},{accounts:[[]]},{accounts:[{transactions:[null]}]},{pension:[]},{pension:{holdings:[{qty:{wrong:1}}]}},{integrated:{ledger:[{amount:'not-a-number'}]}},{financialProducts:{items:{id:'one'}}},{insurance:{policies:[{coverages:[false]}]}},{accounts:[{assetSnapshots:[{meta:[]}]}]},JSON.parse('{"settings":{"__proto__":{"polluted":true}}}')];
test('malformed state shapes cannot be migrated or restored over the live ledger',()=>{
 const {context,run}=environment(),before=JSON.stringify(context.state);
 for(const input of malformed){context.__input=input;assert.throws(()=>run('migrateStateData(__input,4)'),/형식 오류/);assert.throws(()=>run('validateBackupPayload({format:"asset-os-backup-v1",schemaVersion:21,data:__input})'),/형식 오류|데이터가 없습니다/);assert.equal(JSON.stringify(context.state),before)}
 assert.equal({}.polluted,undefined);
});
test('legacy missing fields, numeric strings and unknown metadata survive valid migrations',()=>{
 const {context,run}=environment();context.__input={accounts:[{id:'isa',transactions:[{id:'t',amount:'123.45',qty:'.5',meta:{futureField:'keep'}}]}],futureSection:{note:'keep'}};
 const result=run('migrateStateData(__input,4)');assert.equal(result.data.accounts[0].transactions[0].amount,'123.45');assert.equal(result.data.accounts[0].transactions[0].meta.futureField,'keep');assert.equal(result.data.futureSection.note,'keep');assert.equal(context.__input.pension,undefined);
});
test('cloud policy rejects malformed and future-version envelopes before either overwrite direction',()=>{
 const {context,run}=environment();
 for(const input of malformed){context.__input=input;assert.equal(run('cloudPayloadValid({schemaVersion:21,data:__input})'),false);assert.equal(run('cloudReconcilePlan({stored:true,envelope:{data:{accounts:[{id:"local"}]}}},{payload:{data:__input}},"pull").action'),'reject-invalid')}
 assert.equal(run('cloudPayloadValid({schemaVersion:22,data:{}})'),false);assert.equal(run('cloudPayloadValid({schemaVersion:21,savedAt:17,data:{}})'),false);
});
test('failed cloud storage commit leaves the live in-memory ledger untouched',()=>{
 const {context,run,stored}=environment(),before=JSON.stringify(context.state);
 stored.set('asset-json',JSON.stringify({schemaVersion:21,data:context.state}));
 context.localStorage.setItem=()=>{throw new Error('quota exceeded')};
 context.__payload={schemaVersion:21,data:{accounts:[{id:'remote'}]}};
 assert.throws(()=>run('cloudApplyRemoteEnvelope(__payload,9)'),/quota exceeded/);
 assert.equal(JSON.stringify(context.state),before);assert.equal(run('cloudBaseRevision'),0);
 assert.equal(JSON.parse(stored.get('asset-json')).data.accounts[0].id,'local');
});
test('malformed initial merge is rejected before checking or replacing the live state',()=>{
 const {context,run}=environment(),before=JSON.stringify(context.state);
 for(const input of [{integrated:{ledger:[null]}},{pensionProjection:[]},{financialProducts:{items:'bad'}}]){context.__input=input;assert.throws(()=>run('buildInitialImportCandidate({format:"asset-os-merge-v1",data:__input})'));assert.equal(JSON.stringify(context.state),before)}
});
