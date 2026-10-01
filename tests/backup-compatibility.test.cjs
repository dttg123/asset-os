'use strict';
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
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
const files=['core-config.js','src/integrations/kis-normalization.js','broker-kis.js','src/domain/integrated-replay.js','src/domain/integrated-ledger-core.js','src/domain/integrated-ledger.js','src/domain/integrated-ledger-validation.js','src/domain/financial-current.js','src/domain/financial-history.js','src/domain/integrated-spending.js','data-defaults.js','integrated-schedule-engine.js','integrated-finance-engine.js','isa-validation.js','src/storage/state-migrations.js','src/storage/snapshot-retention.js','store-state.js','backup.js'];
for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const run=code=>vm.runInContext(code,context),plain=value=>JSON.parse(JSON.stringify(value));

function ledgerContract(data){
 const rows=[];
 for(const account of data.accounts||[])for(const row of account.transactions||[])rows.push(['isa',account.id,row.id,Number(row.amount)||0,Number(row.qty)||0,Number(row.price)||0]);
 for(const key of ['contributions','transactions','incomes'])for(const row of data.pension?.[key]||[])rows.push([`pension-${key}`,row.accountId||'',row.id,Number(row.amount)||0,Number(row.qty)||0,Number(row.price)||0]);
 for(const row of data.integrated?.ledger||[])rows.push(['integrated',row.accountId||row.fromAccountId||row.toAccountId||'',row.id,Number(row.amount)||0,0,0]);
 for(const key of ['orders','rights','matches'])for(const row of data.brokerKis?.[key]||[])rows.push([`kis-${key}`,row.accountId||'',row.id,Number(row.amount)||0,Number(row.quantity)||0,Number(row.price)||0]);
 return rows.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
function ledgerHash(rows){return createHash('sha256').update(JSON.stringify(rows)).digest('hex')}
function restoreRebackupRestore(payload){
 context.__payload=payload;
 const first=plain(run('validateBackupPayload(__payload)'));
 context.__restored=first;
 const currentPayload=plain(run('(()=>{state=clone(__restored);return parseBackupZipBytes(createBackupZipBytes(backupPayload()))})()'));
 context.__currentPayload=currentPayload;
 const second=plain(run('validateBackupPayload(__currentPayload)'));
 return{first,second,currentPayload};
}

function legacyData(){
 return{
  accounts:[{id:'legacy-isa',name:'과거 ISA',status:'active',openedAt:'2025-01-01',holdings:[],transactions:[{id:'legacy-deposit',type:'deposit',date:'2025-01-25',amount:1000000}],assetSnapshots:[]}],
  pension:{accounts:[{id:'legacy-pension',kind:'pension',name:'과거 연금',openedAt:'2025-01-01',status:'active'}],contributions:[{id:'pc-2026-01-ps',accountId:'legacy-pension',date:'2026-01-25',amount:500000}],transactions:[],holdings:[],incomes:[],assetSnapshots:[]},
  integrated:{accounts:[{id:'cash-main',kind:'cash',name:'현금·입출금'}],liabilities:[],ledger:[{id:'demo-salary-2025',date:'2025-01-21',type:'externalIncome',amount:4000000,toAccountId:'cash-main'}]}
 };
}

context.__payload=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/legacy/schema-v4.json'),'utf8'));
const physicalLegacy=plain(run('validateBackupPayload(__payload)'));
assert.equal(physicalLegacy.accounts[0].transactions[0].id,'legacy-deposit','physical schema v4 fixture ISA ledger');
assert.equal(physicalLegacy.pension.contributions[0].amount,500000,'physical schema v4 fixture pension contribution');
assert.equal(physicalLegacy.integrated.ledger[0].amount,4000000,'physical schema v4 fixture integrated ledger');
for(const schema of [8,12,16,20,21]){
 context.__payload=JSON.parse(fs.readFileSync(path.join(root,`tests/fixtures/legacy/schema-v${schema}.json`),'utf8'));
 const migrated=plain(run('validateBackupPayload(__payload)'));
 assert.equal(migrated.accounts[0].transactions[0].id,`v${schema}-deposit`,`physical schema v${schema} fixture transaction`);
 assert.equal(migrated.accounts[0].transactions[0].amount,schema*100000,`physical schema v${schema} amount preservation`);
}
assert.throws(()=>JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/legacy/truncated-backup.json'),'utf8')),SyntaxError);

for(const schema of [4,8,12,16,20,21]){
 const payload=JSON.parse(fs.readFileSync(path.join(root,`tests/fixtures/legacy/schema-v${schema}.json`),'utf8'));
 const {first,second,currentPayload}=restoreRebackupRestore(payload),before=ledgerContract(first),after=ledgerContract(second);
 assert.equal(currentPayload.schemaVersion,21,`schema v${schema} 재백업은 현재 schema를 사용해야 한다`);
 assert.deepEqual(after,before,`schema v${schema} 복원→재백업→재복원에서 원장 ID·금액이 같아야 한다`);
 assert.equal(ledgerHash(after),ledgerHash(before),`schema v${schema} 원장 ID·금액 SHA-256 hash가 같아야 한다`);
}

for(let schema=4;schema<=21;schema++){
 context.__payload={format:'asset-os-backup-v1',schemaVersion:schema,appVersion:schema===4?'v0.1':'v0.6.4',environment:'live',exportedAt:'2026-09-02T00:00:00.000Z',data:legacyData()};
 const normalized=plain(run('validateBackupPayload(__payload)'));
 const migration=plain(run(`migrateStateData(__payload.data,${schema})`));
 const plan=plain(run(`stateMigrationPlan(${schema})`));
 assert.deepEqual(migration.applied,Array.from({length:21-schema},(_,index)=>schema+index+1),`schema ${schema} 순차 마이그레이션`);
 assert.deepEqual(plan.map(step=>step.to),migration.applied,`schema ${schema} 명시적 마이그레이션 계획`);
 assert.ok(plan.every(step=>step.name&&step.to===step.from+1),`schema ${schema} 마이그레이션 단계 이름과 연속성`);
 assert.equal(normalized.accounts[0].transactions[0].id,'legacy-deposit',`schema ${schema} ISA 원장 보존`);
 assert.equal(normalized.pension.contributions[0].id,'pc-2026-01-ps',`schema ${schema} 연금 납입 보존`);
 assert.equal(normalized.integrated.ledger[0].id,'demo-salary-2025',`schema ${schema} 통합 원장 보존`);
 const roundTrip=plain(run('parseBackupZipBytes(createBackupZipBytes(__payload))'));
 assert.equal(roundTrip.schemaVersion,schema);
 assert.equal(roundTrip.appVersion,context.__payload.appVersion);
 assert.equal(roundTrip.data.pension.contributions[0].amount,500000);
}
for(const schema of [3,22]){context.__payload={format:'asset-os-backup-v1',schemaVersion:schema,data:{}};assert.throws(()=>run('validateBackupPayload(__payload)'),/지원하지 않는 데이터 구조/)}
context.__payload={format:'asset-os-backup-v1',schemaVersion:20,appVersion:'v0.6.4',environment:'qa',data:{accounts:[],pension:{},integrated:{ledger:[]}}};
assert.throws(()=>run('validateBackupPayload(__payload)'),/QA 백업은 운영 화면에 복원할 수 없습니다/);
context.assetBackupSettings=()=>({phoneEnabled:false,lastPhoneBackupAt:''});
assert.equal(run('backupHealth(new Date("2026-10-01T00:00:00Z")).level'),'setup');
context.assetBackupSettings=()=>({phoneEnabled:true,lastPhoneBackupAt:'2026-09-30T00:00:00Z'});
assert.equal(run('backupHealth(new Date("2026-10-01T00:00:00Z")).level'),'good');
context.assetBackupSettings=()=>({phoneEnabled:true,lastPhoneBackupAt:'2026-09-25T00:00:00Z'});
assert.equal(run('backupHealth(new Date("2026-10-01T00:00:00Z")).level'),'warn');
context.assetBackupSettings=()=>({phoneEnabled:true,lastPhoneBackupAt:'2026-09-01T00:00:00Z'});
assert.equal(run('backupHealth(new Date("2026-10-01T00:00:00Z")).level'),'danger');
console.log('backup schema 4-21 real-normalization compatibility tests: PASS');
