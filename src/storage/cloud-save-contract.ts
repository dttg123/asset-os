'use strict';

interface CloudPendingWriteContract {fingerprint:string;requestId:string;expectedRevision:number}
interface CloudSaveRpcResult {outcome:string;new_revision?:unknown;saved_at?:unknown}
interface CloudSaveRpcArguments {p_expected_revision:number;p_payload:object;p_request_id:string}

function cloudRpcResult(data:unknown):CloudSaveRpcResult|null{
 const value=Array.isArray(data)?data[0]:data;
 return value&&typeof value==='object'?value as CloudSaveRpcResult:null
}
function cloudPendingWriteFor(current:CloudPendingWriteContract|null|undefined,fingerprint:string,baseRevision:unknown,createRequestId:()=>string):CloudPendingWriteContract{
 if(current&&current.fingerprint===fingerprint)return current;
 return{fingerprint,requestId:createRequestId(),expectedRevision:Number(baseRevision)||0}
}
function cloudSaveRpcArguments(pending:CloudPendingWriteContract,payload:object):CloudSaveRpcArguments{
 return{p_expected_revision:pending.expectedRevision,p_payload:payload,p_request_id:pending.requestId}
}
