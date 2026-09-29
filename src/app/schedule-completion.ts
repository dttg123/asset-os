'use strict';

type Schedule={id:string;name:string;kind:string;amount?:unknown;liabilityId?:string;productId?:string;targetKind?:string;targetPensionAccountId?:string;targetIsaAccountId?:string};
type LedgerRow={id:string;date:string;type:string;amount:number;meta:Record<string,unknown>;[key:string]:unknown};
type CompletionDraft={rows:LedgerRow[];checkAggregate:boolean;targetPensionAccountId?:string;targetIsaAccountId?:string;successMessage:string};
type CompletionResult={ok:false;error:string}|({ok:true}&CompletionDraft);

declare function financeSchedules():Schedule[];
declare function scheduleDateForMonth(schedule:Schedule,month:string):string;
declare function integratedMonthKey(date:string):string;
declare function scheduleCompletionTx(scheduleId:string,date:string):unknown;
declare function postedDateError(date:unknown):string;
declare function integratedReplay():{assets:Record<string,number>};
declare function uid(prefix:string):string;
declare function schedulePensionKind(schedule:Schedule):string;
declare function integratedStore():{accounts:Array<{id:string;kind?:string}>;ledger:LedgerRow[]};
declare function scheduleTargetAccount(schedule:Schedule):string;
declare function resolveSchedulePensionAccount(schedule:Schedule,targetId:string,date:string):string;
declare function resolveScheduleIsaAccount(schedule:Schedule,targetId:string,date:string):string;
declare function pensionAccountKindLabel(kind:string):string;
declare function clone<T>(value:T):T;
declare function integratedValidateCandidate(row:LedgerRow,editingId:string):string;
declare function integratedCandidateIssues(store:{accounts:Array<{id:string;kind?:string}>;ledger:LedgerRow[]}):string[];
declare function setting():{integratedMonth:string;[key:string]:any};
declare function persist(notify?:boolean):boolean;
declare function closeSheets():void;
declare function render():void;
declare function openScheduleDay(date:string):void;
declare function toast(message:string):void;
declare function haptic(kind:string):void;

function validateScheduleCompletionRequest(scheduleId:string,date:string){
 const schedule=financeSchedules().find(item=>item.id===scheduleId);
 if(!schedule)return{ok:false,error:'일정을 찾지 못했습니다.'};
 const expectedDate=scheduleDateForMonth(schedule,integratedMonthKey(date));
 if(expectedDate!==String(date))return{ok:false,error:'해당 일정의 예정일과 일치하지 않습니다.'};
 if(scheduleCompletionTx(scheduleId,date))return{ok:false,error:'이미 완료된 일정입니다.'};
 const dateError=postedDateError(date);
 if(dateError)return{ok:false,error:dateError};
 return{ok:true,schedule}
}

function scheduleCompletionCashError(amount:number):string{
 const cash=Number(integratedReplay().assets['cash-main']||0);
 return cash+1e-8<amount?'생활현금이 부족합니다. 월급 또는 현금 유입을 먼저 완료로 기록해 주세요.':''
}

function calculateLoanScheduleCompletion(schedule:Schedule,date:string,principalOverride:unknown,interestOverride:unknown):CompletionResult{
 const principal=Math.max(0,Number(principalOverride)||0),interest=Math.max(0,Number(interestOverride)||0),amount=principal+interest;
 if(!amount)return{ok:false,error:'실제 원금 또는 이자를 입력해 주세요.'};
 const cashError=scheduleCompletionCashError(amount);
 if(cashError)return{ok:false,error:cashError};
 const baseMeta:Record<string,unknown>={scheduleId:schedule.id,scheduleDate:date,scheduledAmount:Number(schedule.amount)||0,actualAmount:amount,loanPrincipal:principal,loanInterest:interest},rows:LedgerRow[]=[];
 if(principal)rows.push({id:uid('igl'),date,type:'debtPrincipal',amount:principal,fromAccountId:'cash-main',liabilityId:schedule.liabilityId,category:`${schedule.name} 원금`,note:'금융 일정에서 완료 기록',productId:schedule.productId,meta:{...baseMeta,component:'principal'}});
 if(interest)rows.push({id:uid('igl'),date,type:'debtInterest',amount:interest,fromAccountId:'cash-main',liabilityId:schedule.liabilityId,category:`${schedule.name} 이자`,note:'금융 일정에서 완료 기록',productId:schedule.productId,meta:{...baseMeta,component:'interest'}});
 return{ok:true,rows,checkAggregate:true,successMessage:'원금과 이자를 완료로 기록했습니다.'}
}

function calculateStandardScheduleCompletion(schedule:Schedule,date:string,amountOverride:unknown,targetPensionAccountId:string,targetIsaAccountId:string):CompletionResult{
 const amount=Math.max(0,Number(amountOverride)||Number(schedule.amount)||0);
 if(!amount)return{ok:false,error:'금액을 확인해 주세요.'};
 const pensionKind=schedulePensionKind(schedule),isIsa=schedule.targetKind==='isa'||integratedStore().accounts.find(account=>account.id===scheduleTargetAccount(schedule))?.kind==='isa';
 const resolvedPension=pensionKind?resolveSchedulePensionAccount(schedule,targetPensionAccountId,date):'';
 const resolvedIsa=isIsa?resolveScheduleIsaAccount(schedule,targetIsaAccountId,date):'';
 const meta:Record<string,unknown>={scheduleId:schedule.id,scheduleDate:date,scheduledAmount:Number(schedule.amount)||0,actualAmount:amount};
 if(pensionKind){if(!resolvedPension)return{ok:false,error:`${pensionAccountKindLabel(pensionKind)} 납입 계좌를 선택해 주세요.`};meta.targetPensionAccountId=resolvedPension}
 if(isIsa){if(!resolvedIsa)return{ok:false,error:'실제 ISA 납입 계좌를 선택해 주세요.'};meta.targetIsaAccountId=resolvedIsa}
 let transaction:LedgerRow|null=null;
 if(schedule.kind==='income')transaction={id:uid('igl'),date,type:'externalIncome',amount,toAccountId:'cash-main',category:schedule.name,note:'금융 일정에서 완료 기록',meta};
 else if(['investment','saving'].includes(schedule.kind)){
  const to=scheduleTargetAccount(schedule);
  if(!to)return{ok:false,error:'연결 대상이 없습니다.'};
  const cashError=scheduleCompletionCashError(amount);
  if(cashError)return{ok:false,error:cashError};
  transaction={id:uid('igl'),date,type:'internalTransfer',amount,fromAccountId:'cash-main',toAccountId:to,category:schedule.name,note:'금융 일정에서 완료 기록',meta}
 }else if(['insurance','expense'].includes(schedule.kind)){
  const cashError=scheduleCompletionCashError(amount);
  if(cashError)return{ok:false,error:cashError};
  transaction={id:uid('igl'),date,type:'expense',fixed:true,amount,fromAccountId:'cash-main',category:schedule.name,note:'금융 일정에서 완료 기록',meta}
 }
 if(!transaction)return{ok:false,error:'아직 자동 기록을 지원하지 않는 일정입니다.'};
 return{ok:true,rows:[transaction],checkAggregate:false,targetPensionAccountId:resolvedPension,targetIsaAccountId:resolvedIsa,successMessage:'완료로 기록했습니다.'}
}

function validateScheduleCompletionDraft(draft:CompletionDraft):string{
 const candidateStore=draft.checkAggregate?clone(integratedStore()):null;
 for(const row of draft.rows){
  const error=integratedValidateCandidate(row,'');
  if(error)return error;
  if(candidateStore)candidateStore.ledger.push(row)
 }
 if(!candidateStore)return'';
 const issues=integratedCandidateIssues(candidateStore);
 return issues.length?issues[0].replace('자산 잔액 음수:','잔액이 부족합니다:').replace('부채 잔액 음수:','대출잔액보다 많이 상환할 수 없습니다:'):''
}

function commitScheduleCompletion(schedule:Schedule,date:string,draft:CompletionDraft):boolean{
 if(draft.targetPensionAccountId)schedule.targetPensionAccountId=draft.targetPensionAccountId;
 if(draft.targetIsaAccountId)schedule.targetIsaAccountId=draft.targetIsaAccountId;
 integratedStore().ledger.push(...draft.rows);
 setting().integratedMonth=integratedMonthKey(date);
 return persist(false)
}

function renderScheduleCompletion(date:string,message:string):void{
 closeSheets();render();setTimeout(()=>openScheduleDay(date),60);toast(message);haptic('light')
}
