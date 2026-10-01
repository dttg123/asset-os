'use strict';
declare function addYears(date:string,years:number):string;
declare function openArchivedAccountDetail(id:string):void;
type BootRecord=Record<string,any>;
type BootAccount=BootRecord&{id:string;holdings:BootRecord[];transactions:BootRecord[]};
type BootState=BootRecord&{accounts:BootAccount[];pension:BootRecord&{accounts:BootRecord[];transactions:BootRecord[];holdings:BootRecord[];contributions:BootRecord[];incomes:BootRecord[]}};
declare let state:BootState;
declare let lastPersistedState:BootState;
declare const seed:BootState;
declare let sheetMode:string;
declare let sheetDirty:boolean;
declare let activeSheetId:string;
declare let holdingRegistrationDraft:BootRecord|null;
declare let suppressSheetPop:boolean;
declare let pendingScrollRestore:number|null;
declare let transactionDisplayLimit:number;
declare let dialogConfirmAction:(()=>void)|null;
declare let assetOsRuntimeApi:BootRecord;
declare const brokerKisClient:{configure:(config:unknown)=>void;consumeRedirect:()=>void};
declare const runtimeErrors:BootRecord[];
declare const BROKER_KIS_PUBLIC_CONFIG:unknown;
declare const APP_VERSION:string;
declare const KEY:string;
declare const SCHEMA_VERSION:number;
declare const QA_MODE:boolean;
declare function clone<T>(value:T):T;
declare function loadState():BootState;
declare function normalizeState(value:unknown):BootState;
declare function currentAccount():BootAccount;
declare function pensionStore():BootState['pension'];
declare function financeSchedules():BootRecord[];
declare function pensionAccount(id:unknown):BootRecord|null;
declare function $(selector:string):any;
declare function $$(selector:string):any[];
declare function $(...args:unknown[]):BootRecord;
declare function $$(...args:unknown[]):BootRecord;
declare function accountMetrics(...args:unknown[]):BootRecord;
declare function actions(...args:unknown[]):void;
declare function allIsaIssues(...args:unknown[]):BootRecord[];
declare function annualContributionTotal(...args:unknown[]):number;
declare function applyHoldingRegistrationToAccount(...args:unknown[]):BootRecord;
declare function applyPensionContributionBatch(...args:unknown[]):BootRecord;
declare function applyPolicyVersion(...args:unknown[]):void;
declare function applyReconcileSnapshot(...args:unknown[]):BootRecord;
declare function applyTheme(...args:unknown[]):void;
declare function archivePensionAccount(...args:unknown[]):BootRecord;
declare function assetAuthGateState(...args:unknown[]):void;
declare function assignPolicyToAccount(...args:unknown[]):BootRecord;
declare function backupPayload(...args:unknown[]):BootRecord;
declare function brokerKisBeginHistory(...args:unknown[]):BootRecord;
declare function brokerKisCompleteSync(...args:unknown[]):BootRecord;
declare function brokerKisEmptyHistory(...args:unknown[]):BootRecord;
declare function brokerKisFailSync(...args:unknown[]):BootRecord;
declare function brokerKisImportBalanceSnapshot(...args:unknown[]):BootRecord;
declare function brokerKisImportOrderSnapshots(...args:unknown[]):BootRecord;
declare function brokerKisImportRights(...args:unknown[]):BootRecord;
declare function brokerKisIssues(...args:unknown[]):BootRecord;
declare function brokerKisKind(...args:unknown[]):string;
declare function brokerKisLatestBalance(...args:unknown[]):BootRecord;
declare function brokerKisLedgerDraft(...args:unknown[]):BootRecord;
declare function brokerKisLinkInstrument(...args:unknown[]):BootRecord;
declare function brokerKisMatchOrder(...args:unknown[]):BootRecord;
declare function brokerKisUpdateHistory(...args:unknown[]):BootRecord;
declare function businessYear(...args:unknown[]):number;
declare function centralIsaContributionRows(...args:unknown[]):BootRecord[];
declare function centralPensionContributionRows(...args:unknown[]):BootRecord[];
declare function closeSheets(...args:unknown[]):void;
declare function cloudResolveConflictOverwrite(...args:unknown[]):BootRecord;
declare function cloudResolveConflictPull(...args:unknown[]):BootRecord;
declare function cloudUser(...args:unknown[]):BootRecord;
declare function completeScheduleOccurrence(...args:unknown[]):BootRecord;
declare function compositionModel(...args:unknown[]):BootRecord;
declare function consistencyIssues(...args:unknown[]):BootRecord[];
declare function createBackupZipBytes(...args:unknown[]):BootRecord;
declare function createPensionAccount(...args:unknown[]):BootRecord;
declare function dividendYieldFor(...args:unknown[]):BootRecord;
declare function dividends(...args:unknown[]):BootRecord[];
declare function financeProductBalance(...args:unknown[]):number;
declare function financeProductBenefitBalance(...args:unknown[]):number;
declare function financeProductEventError(...args:unknown[]):string;
declare function financeProductEvents(...args:unknown[]):BootRecord[];
declare function financeProductRecentInterest(...args:unknown[]):BootRecord[];
declare function financialGrowthBreakdown(...args:unknown[]):BootRecord;
declare function financialGrowthSeries(...args:unknown[]):BootRecord[];
declare function financialProduct(...args:unknown[]):BootRecord;
declare function financialProductEventIssues(...args:unknown[]):BootRecord[];
declare function financialProducts(...args:unknown[]):BootRecord[];
declare function findDuplicateTransaction(...args:unknown[]):BootRecord;
declare function hideDialog(...args:unknown[]):void;
declare function historicalFinancialModel(...args:unknown[]):BootRecord;
declare function importInitialMergeFile(...args:unknown[]):Promise<void>;
declare function initQaMode(...args:unknown[]):void;
declare function integratedFinancialModel(...args:unknown[]):BootRecord;
declare function integratedIssues(...args:unknown[]):BootRecord[];
declare function integratedReplay(...args:unknown[]):BootRecord;
declare function integratedRowsForMonth(...args:unknown[]):BootRecord;
declare function integratedSelectedMonth(...args:unknown[]):string;
declare function integratedStore(...args:unknown[]):BootRecord;
declare function integratedSummary(...args:unknown[]):BootRecord;
declare function integratedValidateCandidate(...args:unknown[]):BootRecord;
declare function investmentRoleForHolding(...args:unknown[]):string;
declare function isCurrentAccount(...args:unknown[]):boolean;
declare function isPastAccount(...args:unknown[]):boolean;
declare function isaAnalysisDisplayRows(...args:unknown[]):BootRecord[];
declare function isaTransactionDateError(...args:unknown[]):string;
declare function localYmd(...args:unknown[]):string;
declare function nav(...args:unknown[]):void;
declare function openAdvancedSettings(...args:unknown[]):void;
declare function openAiStrategy(...args:unknown[]):void;
declare function openBackupHub(...args:unknown[]):void;
declare function openCloudAccountSheet(...args:unknown[]):void;
declare function openInsuranceHub(...args:unknown[]):void;
declare function openKisSettings(...args:unknown[]):void;
declare function openPensionArchiveRecord(...args:unknown[]):void;
declare function openPensionKisOrderDetail(...args:unknown[]):void;
declare function openPensionKisRightDetail(...args:unknown[]):void;
declare function openPensionRiskClassificationForm(...args:unknown[]):void;
declare function openPensionSettings(...args:unknown[]):void;
declare function openPensionTaxProfileForm(...args:unknown[]):void;
declare function openSheet(...args:unknown[]):void;
declare function parseBackupZipBytes(...args:unknown[]):BootRecord;
declare function pensionAccountCash(...args:unknown[]):number;
declare function pensionAccountExposure(...args:unknown[]):BootRecord;
declare function pensionAnalysisDisplayRows(...args:unknown[]):BootRecord[];
declare function pensionAssetLens(...args:unknown[]):BootRecord;
declare function pensionAssetMetrics(...args:unknown[]):BootRecord;
declare function pensionAssetModel(...args:unknown[]):BootRecord;
declare function pensionAssetScope(...args:unknown[]):BootRecord;
declare function pensionContributionBatchCandidate(...args:unknown[]):BootRecord;
declare function pensionHoldingById(...args:unknown[]):BootRecord;
declare function pensionIncomePrincipalAt(...args:unknown[]):number;
declare function pensionIncomeSummary(...args:unknown[]):BootRecord;
declare function pensionIncomeYears(...args:unknown[]):BootRecord[];
declare function pensionMonthly(...args:unknown[]):BootRecord[];
declare function pensionPerformanceContribution(...args:unknown[]):BootRecord;
declare function pensionProjection(...args:unknown[]):BootRecord;
declare function pensionProjectionSeries(...args:unknown[]):BootRecord[];
declare function pensionRiskMetrics(...args:unknown[]):BootRecord;
declare function pensionSnapshotRows(...args:unknown[]):BootRecord[];
declare function pensionSummary(...args:unknown[]):BootRecord;
declare function pensionTransactionDateError(...args:unknown[]):string;
declare function pensionTransactionDelete(...args:unknown[]):boolean;
declare function pensionTransactionIssues(...args:unknown[]):BootRecord[];
declare function pensionTransactionSave(...args:unknown[]):BootRecord;
declare function pensionTransactions(...args:unknown[]):BootRecord[];
declare function persist(...args:unknown[]):boolean;
declare function policyForYear(...args:unknown[]):BootRecord;
declare function qaRenderStats(...args:unknown[]):void;
declare function refreshAllInvestments(...args:unknown[]):void;
declare function refreshCloudProfileUI(...args:unknown[]):void;
declare function refreshFailedInvestments(...args:unknown[]):void;
declare function refreshPensionKisScope(...args:unknown[]):void;
declare function registerHoldingFromBalance(...args:unknown[]):BootRecord;
declare function render(...args:unknown[]):void;
declare function reopenPensionAccount(...args:unknown[]):BootRecord;
declare function replay(...args:unknown[]):BootRecord;
declare function requestCloseSheets(...args:unknown[]):void;
declare function resetLiveData(...args:unknown[]):void;
declare function resetTransientPanels(...args:unknown[]):void;
declare function resolveScheduleIsaAccount(...args:unknown[]):string;
declare function resolveSchedulePensionAccount(...args:unknown[]):string;
declare function restoreBackupFile(...args:unknown[]):Promise<void>;
declare function scheduleOccurrences(...args:unknown[]):BootRecord[];
declare function scheduleUrgentOccurrences(...args:unknown[]):BootRecord[];
declare function setting(...args:unknown[]):BootRecord;
declare function showNotice(...args:unknown[]):void;
declare function signInAssetGoogle(...args:unknown[]):Promise<void>;
declare function startAssetAuthenticatedApp(...args:unknown[]):Promise<void>;
declare function syncCurrentIsaSnapshots(...args:unknown[]):void;
declare function syncCurrentPensionSnapshot(...args:unknown[]):void;
declare function systemIntegrityIssues(...args:unknown[]):BootRecord[];
declare function taxableBreakdown(...args:unknown[]):BootRecord;
declare function toast(...args:unknown[]):void;
declare function transactionNumericError(...args:unknown[]):string;
declare function updateDiagnostics(...args:unknown[]):void;
declare function validateBackupPayload(...args:unknown[]):BootRecord;
declare function visibleHoldingCount(...args:unknown[]):number;
declare function ymd(...args:unknown[]):string;

state=loadState();
lastPersistedState=clone(state);
function applyExternalSavedState(saved:{data:unknown}){
 const interruptedInput=sheetMode==='input'&&sheetDirty;
 if(interruptedInput){
  if(activeSheetId==='#registerSheet')holdingRegistrationDraft=null;
  closeSheets({all:true});
 }
 state=normalizeState(saved.data);
 lastPersistedState=clone(state);
 render();
 if(typeof qaRenderStats==='function')qaRenderStats();
 if(interruptedInput)showNotice('다른 화면에서 변경됨','충돌로 인한 저장 누락을 막기 위해 작성 중이던 입력 화면을 닫고 최신 내용을 반영했습니다. 다시 열어 입력해 주세요.');
 else toast('다른 화면의 최신 변경사항을 반영했습니다.');
 return interruptedInput;
}
window.addEventListener('storage',event=>{
 if(event.storageArea!==localStorage||event.key!==KEY||!event.newValue)return;
 try{
  const saved=JSON.parse(event.newValue);
  if(!saved?.data||Number(saved.schemaVersion)!==SCHEMA_VERSION)return;
  applyExternalSavedState(saved);
 }catch{}
});
$$('.nav').forEach(b=>b.onclick=()=>nav(b.dataset.root));window.addEventListener('hashchange',()=>{resetTransientPanels();window.scrollTo(0,0);render()});$('#profile').onclick=()=>{refreshCloudProfileUI();openSheet('#profileSheet')};$('#scrim').onclick=()=>requestCloseSheets('scrim');$('#dialogScrim').onclick=()=>hideDialog(true);$('#confirmCancel').onclick=()=>hideDialog(true);$('#confirmOk').onclick=()=>{const cb=dialogConfirmAction;hideDialog(false);if(cb)cb()};document.addEventListener('input',e=>{if((e.target instanceof Element&&e.target.closest('.sheet.open'))&&sheetMode==='input')sheetDirty=true});document.addEventListener('submit',e=>{const form=e.target;if(!(form instanceof HTMLFormElement))return;const now=Date.now(),last=Number(form.dataset.lastSubmitAt)||0;if(now-last<500){e.preventDefault();e.stopImmediatePropagation();return}form.dataset.lastSubmitAt=String(now)},true);window.addEventListener('popstate',()=>{if(suppressSheetPop){suppressSheetPop=false;const y=pendingScrollRestore;pendingScrollRestore=null;if(y!=null)requestAnimationFrame(()=>window.scrollTo(0,y));return}if($$('.sheet.open').length)requestCloseSheets('back',true)});
$$('[data-profile-action]').forEach(b=>b.onclick=()=>{const x=b.dataset.profileAction;if(x==='cloud-auth')openCloudAccountSheet();else if(x==='appearance')openSheet('#appearanceSheet');else if(x==='pension-settings')openPensionSettings();else if(x==='backup')openBackupHub();else if(x==='insurance')openInsuranceHub();else if(x==='ai-strategy')openAiStrategy();else if(x==='kis')openKisSettings();else if(x==='advanced')openAdvancedSettings();});
$('#themeToggle').onchange=(e:Event)=>{setting().theme=(e.target as HTMLInputElement).checked?'dark':'light';persist();applyTheme()};$('#fabToggle').onchange=(e:Event)=>{setting().fab=false;(e.target as HTMLInputElement).checked=false;persist();applyTheme()};$('#hapticToggle').onchange=(e:Event)=>{setting().haptics=(e.target as HTMLInputElement).checked;persist();applyTheme()};$('#backupInput').onchange=async (e:Event)=>{const f=(e.target as HTMLInputElement).files?.[0];(e.target as HTMLInputElement).value='';if(f)await restoreBackupFile(f)};$('#initialImportInput').onchange=async (e:Event)=>{const f=(e.target as HTMLInputElement).files?.[0];(e.target as HTMLInputElement).value='';if(f)await importInitialMergeFile(f)};$('#accentChoices').onclick=(e:MouseEvent)=>{const b=(e.target instanceof Element?e.target:null)?.closest<HTMLElement>('[data-value]');if(!b)return;setting().accent=b.dataset.value;persist();applyTheme()};
$('#runDiagnostics').onclick=()=>{let storageOk=true;try{localStorage.setItem('__asset_os_test__','1');localStorage.removeItem('__asset_os_test__')}catch{storageOk=false}const issues=typeof systemIntegrityIssues==='function'?systemIntegrityIssues():[],ok=storageOk&&!issues.length;$('#localStatus').textContent=storageOk?'정상':'확인 필요';$('#localStatus').className='diagnostic-value '+(storageOk?'ok':'wait');updateDiagnostics();toast(ok?'저장·금융 교차검증이 정상입니다.':storageOk?`금융 데이터 확인 필요 · ${issues.length}건`:'로컬 저장 권한을 확인해 주세요.')};
$('#fab').onclick=actions;
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#confirmDialog').hidden)hideDialog(true);else requestCloseSheets('escape')}});
document.addEventListener('click',e=>{const row=(e.target instanceof Element?e.target:null)?.closest<HTMLElement>('[data-pension-archive-tx]');if(row)openPensionArchiveRecord(row.dataset.pensionArchiveTx)});
document.addEventListener('click',e=>{const allRefresh=(e.target instanceof Element?e.target:null)?.closest<HTMLElement>('[data-investment-refresh-all]');if(allRefresh)refreshAllInvestments();const failedRefresh=(e.target instanceof Element?e.target:null)?.closest<HTMLElement>('[data-investment-refresh-failed]');if(failedRefresh)refreshFailedInvestments();const refresh=(e.target instanceof Element?e.target:null)?.closest<HTMLElement>('[data-pension-kis-refresh]');if(refresh)refreshPensionKisScope();const taxProfile=(e.target instanceof Element?e.target:null)?.closest<HTMLElement>('[data-pension-tax-profile]');if(taxProfile)openPensionTaxProfileForm();const risk=(e.target instanceof Element?e.target:null)?.closest<HTMLElement>('[data-pension-risk-classify]');if(risk)openPensionRiskClassificationForm();const order=(e.target instanceof Element?e.target:null)?.closest<HTMLElement>('[data-pension-kis-order]');if(order)openPensionKisOrderDetail(order.dataset.pensionKisOrder);const right=(e.target instanceof Element?e.target:null)?.closest<HTMLElement>('[data-pension-kis-right]');if(right)openPensionKisRightDetail(right.dataset.pensionKisRight)});


assetOsRuntimeApi={version:APP_VERSION,schemaVersion:SCHEMA_VERSION,getState:()=>clone(state),replaceState:(data:BootRecord)=>{state=normalizeState(data);persist(false);render();return clone(state)},reset:resetLiveData,metrics:(id:string)=>accountMetrics(state.accounts.find(a=>a.id===id)||currentAccount()),replay:(account:BootRecord,txs:BootRecord[])=>replay(normalizeState({settings:seed.settings,policies:seed.policies,accounts:[account]}).accounts[0],txs),normalize:normalizeState,ymd,addYears,applyReconcileSnapshot:(accountId:string,snapshot:BootRecord)=>{const a=state.accounts.find(x=>x.id===accountId);const r=applyReconcileSnapshot(a,snapshot);if(r.ok&&!persist(false))return{ok:false,error:'PERSIST_FAILED'};return r},findDuplicateTransaction:(accountId:string,tx:BootRecord)=>findDuplicateTransaction(state.accounts.find(x=>x.id===accountId),tx),annualContributionTotal:(id:string)=>annualContributionTotal(state.accounts.find(a=>a.id===id)||currentAccount()),registerHoldingFromBalance:(accountId:string,input:BootRecord)=>{const a=state.accounts.find(x=>x.id===accountId);const r=registerHoldingFromBalance(a,input);if(r.ok&&!persist(false))return{ok:false,error:'PERSIST_FAILED'};return r},applyHoldingRegistration:(accountId:string,draft:BootRecord)=>applyHoldingRegistrationToAccount(state.accounts.find(x=>x.id===accountId),draft),openArchivedAccountDetail,applyPolicyVersion:(kind:string,id:string)=>applyPolicyVersion(kind,id),assignPolicyToAccount:(accountId:string,policyId:string,effectiveFrom:string)=>{const r=assignPolicyToAccount(accountId,policyId,effectiveFrom||ymd());persist(false);return r},taxableBreakdown:(id:string)=>taxableBreakdown(state.accounts.find(a=>a.id===id)||currentAccount()),consistencyIssues:(id:string)=>clone(consistencyIssues(state.accounts.find(a=>a.id===id)||currentAccount())),allIsaIssues:()=>clone(allIsaIssues()),dividendCompositionModel:(accountId:string)=>clone(compositionModel(state.accounts.find(a=>a.id===accountId)||currentAccount())),dividendYieldFor:(accountId:string,key:string,period:string,amount:number)=>dividendYieldFor(state.accounts.find(a=>a.id===accountId)||currentAccount(),key,period,amount),transactionHistory:(accountId:string,txId:string)=>clone((state.accounts.find(a=>a.id===accountId)||currentAccount()).transactions.find(t=>t.id===txId)?.revisions||[]),persist:()=>persist(false),isCurrentAccount:(a:BootRecord)=>isCurrentAccount(a),isPastAccount:(a:BootRecord)=>isPastAccount(a),transactionNumericError:(t:BootRecord)=>transactionNumericError(t),isaTransactionDateError:(id:string,date:string)=>isaTransactionDateError(state.accounts.find(a=>a.id===id),date),pensionTransactionDateError:(id:string,date:string)=>pensionTransactionDateError(pensionAccount(id),date),visibleHoldingCount:(id:string)=>visibleHoldingCount(state.accounts.find(a=>a.id===id)),setTransactionLimit:(n:number)=>{transactionDisplayLimit=Number(n)||50;render()},pensionContributionBatchCandidate:(input:BootRecord)=>clone(pensionContributionBatchCandidate(clone(input||{}))),applyPensionContributionBatch:(input:BootRecord)=>clone(applyPensionContributionBatch(clone(input||{}))),pensionSummary:(year:string)=>clone(pensionSummary(year||String(businessYear()))),pensionMonthly:(year:string)=>clone(pensionMonthly(year||String(businessYear()))),pensionAssetMetrics:(scope:string)=>clone(pensionAssetMetrics(scope||pensionAssetScope())),pensionAssetModel:(scope:string,lens:string)=>clone(pensionAssetModel(scope||pensionAssetScope(),lens||pensionAssetLens())),pensionRiskMetrics:()=>clone(pensionRiskMetrics()),pensionIncomeSummary:(scope:string)=>clone(pensionIncomeSummary(scope||pensionAssetScope())),pensionIncomeYears:(scope:string)=>clone(pensionIncomeYears(scope||pensionAssetScope())),pensionIncomePrincipalAt:(scope:string,key:string,mode:string)=>pensionIncomePrincipalAt(scope||pensionAssetScope(),key||'',mode||''),pensionProjection:()=>clone(pensionProjection()),pensionProjectionSeries:()=>clone(pensionProjectionSeries()),pensionPerformanceContribution:(scope:string)=>clone(pensionPerformanceContribution(scope||pensionAssetScope())),pensionSnapshotRows:(scope:string)=>clone(pensionSnapshotRows(scope||'all')),pensionAnalysisDisplayRows:(scope:string,period:string)=>clone(pensionAnalysisDisplayRows(scope||'all',period||'1y')),integratedSummary:(month:string)=>clone(integratedSummary(month)),integratedReplay:()=>clone(integratedReplay()),integratedIssues:()=>clone(integratedIssues()),systemIntegrityIssues:()=>clone(systemIntegrityIssues()),financialProductEventIssues:()=>clone(financialProductEventIssues()),financeProductEventError:(e:BootRecord)=>financeProductEventError(clone(e)),integratedStore:()=>clone(integratedStore()),integratedValidateCandidate:(candidate:BootRecord,editingId:string)=>integratedValidateCandidate(clone(candidate),editingId||''),integratedRowsForMonth:(month:string)=>clone(integratedRowsForMonth(month)),integratedFinancialModel:()=>clone(integratedFinancialModel()),historicalFinancialModel:(date:string)=>clone(historicalFinancialModel(date||localYmd())),financialGrowthBreakdown:(start:string,end:string)=>clone(financialGrowthBreakdown(start,end)),financialGrowthSeries:(period:string)=>clone(financialGrowthSeries(period||'6m')),backupPayload:()=>clone(backupPayload()),backupZip:()=>createBackupZipBytes(),parseBackupZip:(bytes:Uint8Array)=>clone(parseBackupZipBytes(bytes)),validateBackupPayload:(p:BootRecord)=>clone(validateBackupPayload(clone(p))),syncCurrentIsaSnapshots:()=>{syncCurrentIsaSnapshots();return clone(state.accounts.filter(isCurrentAccount).map(a=>({id:a.id,snapshots:a.assetSnapshots})))},syncCurrentPensionSnapshot:()=>{syncCurrentPensionSnapshot();return clone(state.pension.assetSnapshots)},financialProducts:()=>clone(financialProducts()),financeProductBalance:(id:string)=>financeProductBalance(financialProduct(id)),financeProductBenefitBalance:(id:string)=>financeProductBenefitBalance(financialProduct(id)),financeProductRecentInterest:(id:string)=>clone(financeProductRecentInterest(financialProduct(id))),financeProductEvents:(id:string)=>clone(financeProductEvents(id)),financeSchedules:()=>clone(financeSchedules()),scheduleOccurrences:(month:string)=>clone(scheduleOccurrences(month||integratedSelectedMonth())),scheduleUrgent:()=>clone(scheduleUrgentOccurrences()),centralPensionRows:(year:string)=>clone(centralPensionContributionRows(year||'')),centralIsaRows:(year:string)=>clone(centralIsaContributionRows(year||'')),completeScheduleOccurrence:(id:string,date:string,amount:number,pensionTarget:string,isaTarget:string)=>completeScheduleOccurrence(id,date,amount,pensionTarget,isaTarget),resolveSchedulePensionAccount:(id:string,target:string,date:string)=>resolveSchedulePensionAccount(financeSchedules().find(x=>x.id===id),target,date),resolveScheduleIsaAccount:(id:string,target:string,date:string)=>resolveScheduleIsaAccount(financeSchedules().find(x=>x.id===id),target,date),pensionAccountCash:(id:string)=>pensionAccountCash(id),pensionAccountExposure:(id:string)=>clone(pensionAccountExposure(id)),createPensionAccount:(input:BootRecord)=>clone(createPensionAccount(clone(input||{}))),archivePensionAccount:(id:string)=>clone(archivePensionAccount(id)),reopenPensionAccount:(id:string)=>clone(reopenPensionAccount(id)),runtimeErrors:()=>runtimeErrors,pensionTransactions:(scope:string)=>clone(pensionTransactions(scope||'all')),pensionTransactionIssues:(txs:BootRecord[])=>clone(pensionTransactionIssues(txs?clone(txs):pensionStore().transactions)),pensionTransactionSave:(tx:BootRecord,id:string)=>{const r=pensionTransactionSave(clone(tx),id||'');if(r.ok)persist(false);return clone(r)},pensionTransactionDelete:(id:string)=>{const r=pensionTransactionDelete(id);if(r)persist(false);return r},investmentRole:(h:BootRecord)=>investmentRoleForHolding(h),policyForYear:(kind:string,year:string)=>clone(policyForYear(kind,year)),isaComposition:(id:string)=>clone(compositionModel(state.accounts.find(a=>a.id===id)||currentAccount())),pensionCounts:()=>({accounts:state.pension.accounts.length,contributions:state.pension.contributions.length,transactions:state.pension.transactions.length,holdings:state.pension.holdings.length,incomes:state.pension.incomes.length}),isaAnalysisDisplayRows:(period:string)=>clone(isaAnalysisDisplayRows(currentAccount(),period||'1y')),counts:()=>({accounts:state.accounts.length,holdings:state.accounts.reduce((sum,a)=>sum+a.holdings.length,0),dividends:state.accounts.reduce((sum,a)=>sum+dividends(a).length,0)})};
assetOsRuntimeApi.brokerKis={
 store:()=>clone(state.brokerKis),
 issues:()=>clone(brokerKisIssues(state.brokerKis)),
 importOrders:(rows:BootRecord[],kind:string,accountId:string,fetchedAt:string,orderSyncThrough:string)=>{const a=pensionAccount(accountId);if(!a||a.kind!==brokerKisKind(kind))return{ok:false,error:'KIS_ACCOUNT_LINK_MISMATCH'};const before=clone(state.brokerKis),result=brokerKisImportOrderSnapshots(state.brokerKis,clone(rows||[]),kind,accountId,fetchedAt||new Date().toISOString(),orderSyncThrough||'');if(result.error){state.brokerKis=before;return{ok:false,...clone(result)}}if(!persist(false)){state.brokerKis=before;return{ok:false,error:'PERSIST_FAILED'}}return{ok:true,...clone(result)}},
 importBalance:(input:BootRecord,kind:string,accountId:string,fetchedAt:string)=>{const a=pensionAccount(accountId);if(!a||a.kind!==brokerKisKind(kind))return{ok:false,error:'KIS_ACCOUNT_LINK_MISMATCH'};const before=clone(state.brokerKis),result=brokerKisImportBalanceSnapshot(state.brokerKis,clone(input||{}),kind,accountId,fetchedAt||new Date().toISOString());if(!result.ok)return result;if(!persist(false)){state.brokerKis=before;return{ok:false,error:'PERSIST_FAILED'}}return clone(result)},
 linkInstrument:(input:BootRecord)=>{const h=pensionHoldingById(input?.holdingId);if(!h||h.accountId!==input?.accountId)return{ok:false,error:'KIS_INSTRUMENT_LINK_MISMATCH'};const before=clone(state.brokerKis),result=brokerKisLinkInstrument(state.brokerKis,clone(input||{}));if(!result.ok)return result;if(!persist(false)){state.brokerKis=before;return{ok:false,error:'PERSIST_FAILED'}}return clone(result)},
 ledgerDraft:(orderKey:string)=>clone(brokerKisLedgerDraft(state.brokerKis,orderKey)),
 matchOrder:(orderKey:string,transactionId:string)=>{if(!pensionStore().transactions.some(x=>x.id===transactionId))return{ok:false,error:'PENSION_TRANSACTION_NOT_FOUND'};const tx=pensionStore().transactions.find(x=>x.id===transactionId),before=clone(state.brokerKis),result=brokerKisMatchOrder(state.brokerKis,orderKey,transactionId,new Date().toISOString(),tx!.qty);if(!result.ok)return result;if(!persist(false)){state.brokerKis=before;return{ok:false,error:'PERSIST_FAILED'}}return clone(result)},
 importRights:(rows:BootRecord[],kind:string,accountId:string,fetchedAt:string)=>{const a=pensionAccount(accountId);if(!a||a.kind!==brokerKisKind(kind))return{ok:false,error:'KIS_ACCOUNT_LINK_MISMATCH'};const before=clone(state.brokerKis),result=brokerKisImportRights(state.brokerKis,clone(rows||[]),kind,accountId,fetchedAt||new Date().toISOString());if(result.error){state.brokerKis=before;return{ok:false,...clone(result)}}if(!persist(false)){state.brokerKis=before;return{ok:false,error:'PERSIST_FAILED'}}return{ok:true,...clone(result)}},
 latestBalance:(kind:string,accountId:string)=>clone(brokerKisLatestBalance(state.brokerKis,kind,accountId)),
 history:(kind:string)=>clone(state.brokerKis.history?.[brokerKisKind(kind)]||brokerKisEmptyHistory(kind)),
 beginHistory:(input:BootRecord)=>{const before=clone(state.brokerKis),result=brokerKisBeginHistory(state.brokerKis,clone(input||{}));if(!result.ok)return result;if(!persist(false)){state.brokerKis=before;return{ok:false,error:'PERSIST_FAILED'}}return clone(result)},
 updateHistory:(input:BootRecord)=>{const before=clone(state.brokerKis),result=brokerKisUpdateHistory(state.brokerKis,clone(input||{}));if(!result.ok)return result;if(!persist(false)){state.brokerKis=before;return{ok:false,error:'PERSIST_FAILED'}}return clone(result)},
 completeSync:(kind:string,accountId:string,completedAt:string)=>{const a=pensionAccount(accountId);if(!a||a.kind!==brokerKisKind(kind))return{ok:false,error:'KIS_ACCOUNT_LINK_MISMATCH'};const before=clone(state.brokerKis),connection=brokerKisCompleteSync(state.brokerKis,kind,accountId,completedAt||new Date().toISOString());if(!persist(false)){state.brokerKis=before;return{ok:false,error:'PERSIST_FAILED'}}return{ok:true,connection:clone(connection)}},
 failSync:(kind:string,accountId:string,error:string,failedAt:string)=>{const before=clone(state.brokerKis),connection=brokerKisFailSync(state.brokerKis,kind,accountId,error,failedAt||new Date().toISOString());if(!persist(false)){state.brokerKis=before;return{ok:false,error:'PERSIST_FAILED'}}return{ok:false,error:connection.lastError,connection:clone(connection)}}
};
assetOsRuntimeApi.brokerKisClient=brokerKisClient;if(QA_MODE)(window as Window&{__assetOS?:BootRecord}).__assetOS=assetOsRuntimeApi;else try{delete (window as Window&{__assetOS?:BootRecord}).__assetOS}catch{};
brokerKisClient.configure(BROKER_KIS_PUBLIC_CONFIG);
brokerKisClient.consumeRedirect();
if(typeof initQaMode==='function')initQaMode();
$('#assetAuthButton').onclick=async()=>{if(cloudUser())await startAssetAuthenticatedApp();else await signInAssetGoogle()};
$('#assetAuthPull').onclick=cloudResolveConflictPull;
$('#assetAuthOverwrite').onclick=cloudResolveConflictOverwrite;
startAssetAuthenticatedApp().catch(()=>assetAuthGateState('error','연결 확인 중 오류가 발생했습니다. 다시 시도해 주세요.'));
