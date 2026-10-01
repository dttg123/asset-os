'use strict';

type ImportRecord=Record<string,unknown>&{meta?:Record<string,unknown>};
type ImportPension={accounts?:ImportRecord[];projection?:Record<string,unknown>;[key:string]:unknown};
type ImportData={financialProducts?:{items?:ImportRecord[];events?:ImportRecord[]};financeSchedules?:{items?:ImportRecord[]};integrated?:{ledger?:ImportRecord[];[key:string]:unknown};insurance?:{policies?:ImportRecord[]};sourceArchives?:{records?:ImportRecord[]};pensionProjection?:Record<string,unknown>;[key:string]:unknown};
type ImportState=ImportData&{pension?:ImportPension;system:{saveError?:string}};
type InitialImportBundle={format:string;data:ImportData};

declare let state:ImportState;
declare const seed:{pension:ImportPension},KEY:string;
declare function clone<T>(value:T):T;
declare function buildIntegratedSeed():{ledger:ImportRecord[]};
declare function stateInputRecord(value:unknown):value is Record<string,unknown>;
declare function assertStateDataShape(value:unknown):asserts value is Record<string,unknown>;
declare function normalizeState(value:unknown):ImportState;
declare function systemIntegrityIssues():string[];
declare function assertImportFileSize(file:{size?:unknown},label?:string):void;
declare function showNotice(title:string,message:string):void;
declare function showDialog(options:ImportRecord,confirm:()=>void):void;
declare function storeRecoveryCopy(key:string,raw:string):boolean;
declare function stateEnvelopeJson(value:ImportState):string;
declare function persist(notify?:boolean):boolean;
declare function closeSheets(options?:ImportRecord):void;
declare function render():void;
declare function toast(message:string):void;

const INITIAL_IMPORT_FORMAT='asset-os-merge-v1';

function initialImportErrorMessage(error:unknown):string{return error instanceof Error?error.message:String(error||'알 수 없는 오류')}

function mergeRowsById(base:ImportRecord[]=[],incoming:ImportRecord[]=[]):ImportRecord[]{
 const map=new Map((base||[]).map(row=>[String(row.id),clone(row)]));
 for(const row of incoming||[]){
  if(!row?.id)throw new Error('병합 항목 ID가 없습니다.');
  map.set(String(row.id),clone(row));
 }
 return[...map.values()];
}

function resolveInitialImportPlaceholders(candidate:ImportState):ImportState{
 const pensionAccounts:Array<ImportRecord>=Array.isArray(candidate.pension?.accounts)?candidate.pension.accounts:[];
 const byKind=(kind:string)=>pensionAccounts.filter(account=>account.kind===kind&&account.status==='active');
 for(const transaction of candidate.integrated?.ledger||[]){
  const kind=String(transaction.meta?.targetPensionKind||'');
  if(!kind)continue;
  const found=byKind(kind);
  if(found.length!==1)throw new Error(`${kind==='irp'?'IRP':'연금저축'} 연결 계좌가 ${found.length}개라 자동 연결할 수 없습니다.`);
  const date=String(transaction.date||'');
  if(!found[0].openedAt||String(found[0].openedAt)>date)found[0].openedAt=date;
  transaction.meta={...(transaction.meta||{}),targetPensionAccountId:found[0].id};
  delete transaction.meta.targetPensionKind;
 }
 return candidate;
}

function initialImportBundle(input:unknown):InitialImportBundle{
 if(!stateInputRecord(input)||input.format!==INITIAL_IMPORT_FORMAT)throw new Error('Asset OS 초기자료 병합 파일이 아닙니다.');
 const data=input.data??{};assertStateDataShape(data);
 if(data.pensionProjection!=null&&!stateInputRecord(data.pensionProjection))throw new Error('미래연금 기준은 객체여야 합니다.');
 return{format:INITIAL_IMPORT_FORMAT,data:data as ImportData}
}
function buildInitialImportCandidate(input:unknown):ImportState{
 const bundle=initialImportBundle(input);
 const add=bundle.data||{},candidate=clone(state);
 candidate.financialProducts=candidate.financialProducts||{items:[],events:[]};
 candidate.financeSchedules=candidate.financeSchedules||{items:[]};
 candidate.integrated=candidate.integrated||buildIntegratedSeed();
 candidate.insurance=candidate.insurance||{policies:[]};
 candidate.sourceArchives=candidate.sourceArchives||{records:[]};
 candidate.pension=candidate.pension||clone(seed.pension);
 candidate.financialProducts.items=mergeRowsById(candidate.financialProducts.items,add.financialProducts?.items);
 candidate.financialProducts.events=mergeRowsById(candidate.financialProducts.events,add.financialProducts?.events);
 candidate.financeSchedules.items=mergeRowsById(candidate.financeSchedules.items,add.financeSchedules?.items);
 candidate.integrated.ledger=mergeRowsById(candidate.integrated.ledger,add.integrated?.ledger);
 candidate.insurance.policies=mergeRowsById(candidate.insurance.policies,add.insurance?.policies);
 candidate.sourceArchives.records=mergeRowsById(candidate.sourceArchives.records,add.sourceArchives?.records);
 if(add.pensionProjection&&typeof add.pensionProjection==='object')candidate.pension.projection={...(candidate.pension.projection||{}),...clone(add.pensionProjection)};
 const next=resolveInitialImportPlaceholders(normalizeState(candidate)),before=state;
 state=next;
 let issues:string[]=[];
 try{issues=systemIntegrityIssues()}finally{state=before}
 if(issues.length)throw new Error(`무결성 검사 실패: ${issues.slice(0,4).join(' / ')}`);
 return next;
}

async function importInitialMergeFile(file:File):Promise<boolean>{
 let bundle:InitialImportBundle,next:ImportState;
 try{
  assertImportFileSize(file,'초기자료');
  bundle=initialImportBundle(JSON.parse(await file.text()));
  next=buildInitialImportCandidate(bundle);
 }catch(error:unknown){showNotice('병합하지 않았습니다.',initialImportErrorMessage(error));return false}
 const counts={products:bundle.data?.financialProducts?.items?.length||0,events:bundle.data?.financialProducts?.events?.length||0,schedules:bundle.data?.financeSchedules?.items?.length||0,ledger:bundle.data?.integrated?.ledger?.length||0,insurance:bundle.data?.insurance?.policies?.length||0,archive:bundle.data?.sourceArchives?.records?.length||0,projection:!!bundle.data?.pensionProjection};
 showDialog({title:'확정 초기자료를 병합할까요?',message:`현재 원장은 유지하고 같은 ID만 갱신합니다.\n상품 ${counts.products} · 이벤트 ${counts.events} · 일정 ${counts.schedules} · 원장 ${counts.ledger} · 보험 ${counts.insurance} · 검산자료 ${counts.archive}${counts.projection?' · 미래연금 기준 포함':''}`,confirmText:'검증 후 병합',cancelText:'취소'},()=>{
  try{
   storeRecoveryCopy(`${KEY}-pre-import-${Date.now()}`,stateEnvelopeJson(state));
   state=next;
   if(!persist(false))throw new Error(state.system.saveError||'저장 실패');
   closeSheets();render();toast('확정 초기자료를 병합했습니다.');
  }catch(error:unknown){showNotice('병합 실패',initialImportErrorMessage(error))}
 });
 return true;
}
