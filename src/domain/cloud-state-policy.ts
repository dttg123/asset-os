'use strict';

type CloudReconcileAction='reject-invalid'|'pull'|'protect-empty'|'push'|'conflict'|'synced';
interface CloudEnvelopeLike {savedAt?:unknown;data?:unknown}
declare function stateDataShapeIssue(value:unknown):string;
declare const SCHEMA_VERSION:number;
interface CloudLocalEnvelope {stored?:boolean;envelope?:CloudEnvelopeLike|null}
interface CloudStateRow {payload?:unknown}
interface CloudReconcilePlan {action:CloudReconcileAction;notify?:boolean}

function cloudObject(value:unknown):Record<string,unknown>{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}}
function cloudCollectionLength(value:unknown){return Array.isArray(value)?value.length:0}
function cloudCanonicalValue(value:unknown):unknown{
 if(Array.isArray(value))return value.map(cloudCanonicalValue);
 if(value&&typeof value==='object'){
  const source=value as Record<string,unknown>,result:Record<string,unknown>={};
  for(const key of Object.keys(source).sort()){const item=cloudCanonicalValue(source[key]);if(item!==undefined)result[key]=item}
  return result
 }
 return value
}
function cloudEnvelopeFingerprint(envelope:CloudEnvelopeLike|null|undefined){try{return JSON.stringify(cloudCanonicalValue(envelope?.data||{}))}catch{return''}}
function cloudEnvelopeTime(envelope:CloudEnvelopeLike|null|undefined){const time=Date.parse(String(envelope?.savedAt||''));return Number.isFinite(time)?time:0}
function cloudPayloadValid(payload:unknown):payload is CloudEnvelopeLike&{data:Record<string,unknown>}{
 if(!payload||typeof payload!=='object'||Array.isArray(payload))return false;
 const source=cloudObject(payload);
 if(source.schemaVersion!==undefined){const version=Number(source.schemaVersion);if(!Number.isInteger(version)||version<4||version>SCHEMA_VERSION)return false}
 if(source.savedAt!==undefined&&typeof source.savedAt!=='string')return false;
 return !stateDataShapeIssue(source.data)
}
function cloudDataHasMeaningfulRecords(data:unknown){
 const source=cloudObject(data),pension=cloudObject(source.pension),integrated=cloudObject(source.integrated),products=cloudObject(source.financialProducts),schedules=cloudObject(source.financeSchedules);
 return !!(cloudCollectionLength(source.accounts)||cloudCollectionLength(pension.accounts)||cloudCollectionLength(pension.contributions)||cloudCollectionLength(pension.transactions)||cloudCollectionLength(pension.holdings)||cloudCollectionLength(pension.incomes)||cloudCollectionLength(products.items)||cloudCollectionLength(products.events)||cloudCollectionLength(schedules.items)||cloudCollectionLength(integrated.ledger))
}
function cloudReconcilePlan(local:CloudLocalEnvelope|null|undefined,row:CloudStateRow|null|undefined,force='auto'):CloudReconcilePlan{
 const remote=row?.payload;
 if(!cloudPayloadValid(remote))return{action:'reject-invalid'};
 const localMeaningful=!!local?.stored&&cloudDataHasMeaningfulRecords(local.envelope?.data);
 const remoteMeaningful=cloudDataHasMeaningfulRecords(remote.data);
 if(!localMeaningful&&remoteMeaningful)return{action:'pull',notify:false};
 if(localMeaningful&&!remoteMeaningful&&force!=='push')return{action:'protect-empty'};
 const localTime=local?.stored?cloudEnvelopeTime(local.envelope):0,remoteTime=cloudEnvelopeTime(remote);
 if(force==='pull'||!local?.stored||remoteTime>localTime)return{action:'pull',notify:true};
 if(force==='push'||localTime>remoteTime)return{action:'push'};
 if(cloudEnvelopeFingerprint(local?.envelope)!==cloudEnvelopeFingerprint(remote))return{action:'conflict'};
 return{action:'synced'}
}
