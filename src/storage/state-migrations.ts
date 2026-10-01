'use strict';

type StateRecord=Record<string,unknown>;
type MigrationResult={data:StateRecord;applied:number[]};
type StateMigration=(data:StateRecord)=>StateRecord;
type MigrationStep={from:number;to:number;name:string;migrate:StateMigration};

declare const SCHEMA_VERSION:number;

function migrationRecord(value:unknown):StateRecord{return value&&typeof value==='object'&&!Array.isArray(value)?value as StateRecord:{}}
function migrationRows(value:unknown):StateRecord[]{return Array.isArray(value)?value.map(migrationRecord):[]}
function migrationClone(value:unknown):StateRecord{return JSON.parse(JSON.stringify(migrationRecord(value))) as StateRecord}
function migrationMutate(data:StateRecord,apply:(next:StateRecord)=>void):StateRecord{apply(data);return data}


// External JSON starts as unknown. Missing legacy sections are allowed; malformed
// present sections are rejected before migration can silently discard an account.
function stateInputRecord(value:unknown):value is StateRecord{return value!==null&&typeof value==='object'&&!Array.isArray(value)}
function stateDataShapeIssue(value:unknown):string{
 if(!stateInputRecord(value))return'원본 데이터는 객체여야 합니다.';
 const objectFields=new Set(['settings','system','policies','moduleVerification','pension','integrated','financialProducts','financeSchedules','insurance','sourceArchives','brokerKis']);
 const collectionFields:Record<string,readonly string[]>={
  '':['accounts'],pension:['accounts','contributions','transactions','holdings','incomes','assetSnapshots'],
  integrated:['accounts','liabilities','ledger'],financialProducts:['items','events'],financeSchedules:['items'],
  insurance:['policies'],sourceArchives:['records'],brokerKis:['orders','rights','balanceSnapshots','matches','instrumentLinks']
 };
 const collection=(record:StateRecord,key:string,path:string):string=>{
  const rows=record[key];if(rows==null)return'';
  if(!Array.isArray(rows))return`${path}는 배열이어야 합니다.`;
  for(let i=0;i<rows.length;i++){const row:unknown=rows[i];if(!stateInputRecord(row))return`${path}[${i}]는 객체여야 합니다.`;if(row.meta!=null&&!stateInputRecord(row.meta))return`${path}[${i}].meta는 객체여야 합니다.`;for(const key of ['amount','qty','quantity','price','currentPrice','avgPrice','fee','tax','value','cost','cash','totalValue','securitiesValue','premium','delta','setQty','setAvg']){const field=row[key];if(field!=null&&(typeof field!=='number'&&typeof field!=='string'||!Number.isFinite(Number(field))))return`${path}[${i}].${key}는 유효한 금액 또는 수량이어야 합니다.`}}
  return''
 };
 for(const key of objectFields)if(value[key]!=null&&!stateInputRecord(value[key]))return`${key}는 객체여야 합니다.`;
 for(const [section,keys] of Object.entries(collectionFields)){
  const record=section?migrationRecord(value[section]):value;
  for(const key of keys){const issue=collection(record,key,section?`${section}.${key}`:key);if(issue)return issue}
 }
 for(const account of migrationRows(value.accounts)){
  for(const key of ['holdings','transactions','assetSnapshots','reconciliations','corporateActions','policyHistory']){const issue=collection(account,key,`accounts.${String(account.id||'?')}.${key}`);if(issue)return issue}
  if(account.baseline!=null&&!stateInputRecord(account.baseline))return'계좌 기준잔고는 객체여야 합니다.';
  for(const tx of migrationRows(account.transactions)){const issue=collection(tx,'revisions','transactions.revisions');if(issue)return issue}
 }
 const pension=migrationRecord(value.pension);
 for(const key of ['projection','goal'])if(pension[key]!=null&&!stateInputRecord(pension[key]))return`pension.${key}는 객체여야 합니다.`;
 for(const policy of migrationRows(migrationRecord(value.insurance).policies)){const issue=collection(policy,'coverages','insurance.coverages');if(issue)return issue}
 for(const [kind,group] of Object.entries(migrationRecord(value.policies))){if(!stateInputRecord(group))return`policies.${kind}는 객체여야 합니다.`;const issue=collection(group,'versions',`policies.${kind}.versions`);if(issue)return issue}
 // Reject prototype keys recursively while preserving unknown future fields.
 const pending:unknown[]=[value];const seen=new Set<object>();
 while(pending.length){const item=pending.pop();if(!item||typeof item!=='object')continue;if(seen.has(item))continue;seen.add(item);for(const [key,child] of Object.entries(item)){if(key==='__proto__'||key==='constructor'||key==='prototype')return'지원하지 않는 데이터 속성입니다.';if(child&&typeof child==='object')pending.push(child)}}
 return''
}
function assertStateDataShape(value:unknown):asserts value is StateRecord{const issue=stateDataShapeIssue(value);if(issue)throw new Error(`저장 데이터 형식 오류: ${issue}`)}

const STATE_MIGRATIONS:readonly MigrationStep[]=[
 {from:4,to:5,name:'initialize pension and integrated collections',migrate:data=>migrationMutate(data,next=>{next.settings=migrationRecord(next.settings);const pension=migrationRecord(next.pension);next.pension=pension;for(const key of ['accounts','contributions','transactions','holdings','incomes','assetSnapshots'])pension[key]=migrationRows(pension[key]);const integrated=migrationRecord(next.integrated);next.integrated=integrated;for(const key of ['accounts','liabilities','ledger'])integrated[key]=migrationRows(integrated[key])})},
 {from:5,to:6,name:'initialize financial product collections',migrate:data=>migrationMutate(data,next=>{const products=migrationRecord(next.financialProducts);next.financialProducts=products;products.items=migrationRows(products.items);products.events=migrationRows(products.events)})},
 {from:6,to:7,name:'initialize finance schedules',migrate:data=>migrationMutate(data,next=>{const schedules=migrationRecord(next.financeSchedules);next.financeSchedules=schedules;schedules.items=migrationRows(schedules.items)})},
 {from:7,to:8,name:'initialize insurance policies',migrate:data=>migrationMutate(data,next=>{const insurance=migrationRecord(next.insurance);next.insurance=insurance;insurance.policies=migrationRows(insurance.policies)})},
 {from:8,to:9,name:'initialize source archives',migrate:data=>migrationMutate(data,next=>{const archives=migrationRecord(next.sourceArchives);next.sourceArchives=archives;archives.records=migrationRows(archives.records)})},
 {from:9,to:10,name:'initialize module verification',migrate:data=>migrationMutate(data,next=>{next.moduleVerification={isa:false,pension:false,irp:false,...migrationRecord(next.moduleVerification)}})},
 {from:10,to:11,name:'initialize ISA account collections',migrate:data=>migrationMutate(data,next=>{for(const account of migrationRows(next.accounts)){account.holdings=migrationRows(account.holdings);account.transactions=migrationRows(account.transactions);account.assetSnapshots=migrationRows(account.assetSnapshots)}})},
 {from:11,to:12,name:'initialize policies and system state',migrate:data=>migrationMutate(data,next=>{next.policies=migrationRecord(next.policies);next.system=migrationRecord(next.system)})},
 {from:12,to:13,name:'initialize KIS collections',migrate:data=>migrationMutate(data,next=>{const broker=migrationRecord(next.brokerKis);next.brokerKis=broker;for(const key of ['balanceSnapshots','orders','rights'])broker[key]=migrationRows(broker[key])})},
 {from:13,to:14,name:'initialize reconciliation collections',migrate:data=>migrationMutate(data,next=>{for(const account of migrationRows(next.accounts)){account.reconciliations=migrationRows(account.reconciliations);account.corporateActions=migrationRows(account.corporateActions)}})},
 {from:14,to:15,name:'initialize transaction revisions',migrate:data=>migrationMutate(data,next=>{for(const account of migrationRows(next.accounts))for(const tx of migrationRows(account.transactions))tx.revisions=migrationRows(tx.revisions)})},
 {from:15,to:16,name:'initialize account policy history',migrate:data=>migrationMutate(data,next=>{for(const account of migrationRows(next.accounts))account.policyHistory=migrationRows(account.policyHistory)})},
 {from:16,to:17,name:'initialize pension projection and goal',migrate:data=>migrationMutate(data,next=>{const pension=migrationRecord(next.pension);next.pension=pension;pension.projection=migrationRecord(pension.projection);pension.goal=migrationRecord(pension.goal)})},
 {from:17,to:18,name:'initialize tax and risk settings',migrate:data=>migrationMutate(data,next=>{const settings=migrationRecord(next.settings);next.settings=settings;settings.pensionTaxProfile=migrationRecord(settings.pensionTaxProfile);settings.irpRiskClassifications=migrationRecord(settings.irpRiskClassifications)})},
 {from:18,to:19,name:'initialize integrated ledger metadata',migrate:data=>migrationMutate(data,next=>{for(const row of migrationRows(migrationRecord(next.integrated).ledger))row.meta=migrationRecord(row.meta)})},
 {from:19,to:20,name:'initialize integrated ledger filter',migrate:data=>migrationMutate(data,next=>{const settings=migrationRecord(next.settings);next.settings=settings;if(typeof settings.integratedLedgerFilter!=='string')settings.integratedLedgerFilter='all'})},
 {from:20,to:21,name:'initialize storage diagnostics',migrate:data=>migrationMutate(data,next=>{const system=migrationRecord(next.system);next.system=system;if(typeof system.loadWarning!=='string')system.loadWarning='';if(typeof system.saveError!=='string')system.saveError=''})}
];
const STATE_MIGRATION_BY_VERSION=new Map(STATE_MIGRATIONS.map(step=>[step.from,step]));

function stateMigrationPlan(fromVersion:number,toVersion=SCHEMA_VERSION):{from:number;to:number;name:string}[]{
 const source=Number(fromVersion),target=Number(toVersion);
 if(!Number.isInteger(source)||!Number.isInteger(target)||source<4||target>SCHEMA_VERSION||source>target)throw new Error(`지원하지 않는 저장 형식 ${fromVersion}`);
 const plan:{from:number;to:number;name:string}[]=[];
 for(let version=source;version<target;version++){const step=STATE_MIGRATION_BY_VERSION.get(version);if(!step||step.to!==version+1)throw new Error(`누락된 데이터 마이그레이션 ${version}→${version+1}`);plan.push({from:step.from,to:step.to,name:step.name})}
 return plan
}
function migrateStateData(data:unknown,fromVersion:number,toVersion=SCHEMA_VERSION):MigrationResult{
 assertStateDataShape(data);
 const plan=stateMigrationPlan(fromVersion,toVersion),next=migrationClone(data),applied:number[]=[];
 for(const descriptor of plan){const step=STATE_MIGRATION_BY_VERSION.get(descriptor.from);if(!step)throw new Error(`누락된 데이터 마이그레이션 ${descriptor.from}→${descriptor.to}`);step.migrate(next);applied.push(step.to)}
 return{data:next,applied}
}
