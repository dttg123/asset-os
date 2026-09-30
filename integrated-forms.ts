'use strict';

type IntegratedRecord=Record<string,any>;
type IntegratedStore={accounts:IntegratedRecord[];liabilities:IntegratedRecord[];ledger:IntegratedRecord[];mode?:string;label?:string;[key:string]:any};
type RefundResult={ok:boolean;error?:string;row?:IntegratedRecord};

declare let state:IntegratedRecord,sheetDirty:boolean,integratedLedgerSearch:string,integratedSearchDisplayLimit:number;
declare const $:(selector:string)=>any;
declare function integratedStore():IntegratedStore;
declare function isaContributionModel(account:IntegratedRecord,date:string,store:IntegratedStore):{overage:number};
declare function isCurrentAccount(account:IntegratedRecord):boolean;
declare function localYmd():string;
declare function won(value:unknown):string;
declare function policyForYear(kind:string,year:string):IntegratedRecord;
declare function integratedIssues(store:IntegratedStore):string[];
declare function integratedSelectedMonth():string;
declare function toast(message?:string):void;
declare function integratedFormMarkup(tx:IntegratedRecord|null,preset:IntegratedRecord):string;
declare function openSheet(selector:string,options?:IntegratedRecord):void;
declare function syncIntegratedFormFields():void;
declare function ymd():string;
declare function nextIntegratedSequence(date:string):number;
declare function uid(prefix:string):string;
declare function integratedDefaultCategory(type:string):string;
declare function clone<T>(value:T):T;
declare function pensionAccountsForKind(kind:string,date:string):IntegratedRecord[];
declare function isaAccountsForDate(date:string):IntegratedRecord[];
declare function integratedAccountName(id:string):string;
declare function postedDateError(date:string):string;
declare function financialNumberInRange(value:unknown):boolean;
declare function formatDate(value:unknown):string;
declare function financialProduct(id:string):IntegratedRecord|null;
declare function financialProductActiveOnDate(product:IntegratedRecord,date:string):boolean;
declare function isQaIntegratedFixture(record:IntegratedRecord):boolean;
declare function setting():IntegratedRecord;
declare function integratedMonthKey(date:string):string;
declare function persist():boolean;
declare function closeSheets(options?:IntegratedRecord):void;
declare function nav(module:string,page:string):void;
declare function haptic(kind:string):void;
declare function showDialog(options:IntegratedRecord,confirm:()=>void):void;
declare function integratedTxLabel(record:IntegratedRecord):string;
declare function integratedLedger():IntegratedRecord[];
declare function escapeHtml(value:unknown):string;
declare function signed(value:number):string;
declare function integratedTxAccountsText(record:IntegratedRecord):string;
declare function openFinancialProductDetail(id:string):void;

function integratedPolicyLimitIssues(store:IntegratedStore=integratedStore()):string[]{
 const issues:string[]=[];
 if(typeof isaContributionModel==='function'){
  for(const account of state.accounts.filter(isCurrentAccount)){
   const model=isaContributionModel(account,localYmd(),store);
   if(model.overage>.5)issues.push(`ISA 누적 납입한도를 ${won(model.overage)} 초과합니다.`);
  }
 }
 const accountMap=new Map((store.accounts||[]).map(a=>[a.id,a]));
 const years=[...new Set((store.ledger||[]).map(t=>String(t.date||'').slice(0,4)).filter(x=>/^\d{4}$/.test(x)))];
 for(const year of years){
  let ordinary=0;
  for(const t of store.ledger||[]){
   if(!String(t.date||'').startsWith(year)||t.meta?.analysisOnly||t.meta?.isaTransfer||!['internalTransfer','externalAssetIn'].includes(t.type))continue;
   const kind=accountMap.get(t.toAccountId)?.kind;
   if(['pension','irp'].includes(kind))ordinary+=Number(t.amount)||0;
  }
  const limit=Number(policyForYear('pension',year).annualContributionLimit)||18000000;
  if(ordinary>limit+.5)issues.push(`${year}년 연금계좌 일반 납입한도를 ${won(ordinary-limit)} 초과합니다.`);
 }
 return issues;
}

function integratedCandidateIssues(candidateStore:IntegratedStore):string[]{
 const original=state.integrated;
 try{state.integrated=candidateStore;return integratedIssues(candidateStore)}
 finally{state.integrated=original}
}

function integratedEntryDateForMonth(month:unknown=integratedSelectedMonth()):string{
 const m=String(month||''),today=localYmd();
 if(!/^\d{4}-\d{2}$/.test(m))return today;
 const [year,monthNumber]=m.split('-').map(Number),lastDay=new Date(Date.UTC(year,monthNumber,0)).getUTCDate(),day=Math.min(Number(today.slice(8,10))||1,lastDay);
 return `${m}-${String(day).padStart(2,'0')}`;
}

function openIntegratedTransactionForm(id='',preset:IntegratedRecord={}):void{
 const tx=id?integratedStore().ledger.find(t=>t.id===id)||null:null;
 if(tx?.meta?.isaLifecycleAccountId){toast('ISA 정산에 연결된 거래입니다. 회차 기록에서 확인해 주세요.');return}
 if(tx?.type==='refund'){toast('환불 기록은 삭제 후 다시 등록해 주세요.');return}
 if(tx&&tx.meta?.scheduleId){toast('일정에서 생성된 거래는 일정 상세에서 확인해 주세요.');return}
 const formPreset=tx||{...preset,date:preset.date||integratedEntryDateForMonth()};
 $('#formEyebrow').textContent='통합 · 거래기록';$('#formTitle').textContent=tx?'거래 수정':'거래 추가';$('#formBody').innerHTML=integratedFormMarkup(tx,formPreset);
 openSheet('#formSheet',{mode:'input'});syncIntegratedFormFields();
 const form=$('#integratedTxForm') as HTMLFormElement&{elements:any};
 if(form.elements.category)form.elements.category.dataset.auto=tx||formPreset.category?'0':'1';
 form.elements.uiType?.addEventListener('change',()=>{if(form.elements.category)form.elements.category.dataset.auto='1';syncIntegratedFormFields();sheetDirty=true});
 form.elements.toAccountId?.addEventListener('change',()=>{syncIntegratedFormFields();sheetDirty=true});
 form.elements.date?.addEventListener('change',()=>{syncIntegratedFormFields();sheetDirty=true});
 form.addEventListener('input',()=>{sheetDirty=true});
 form.addEventListener('submit',(event:SubmitEvent)=>{event.preventDefault();saveIntegratedTransaction(event.currentTarget as HTMLFormElement)});
}

function integratedCandidatesFromForm(form:HTMLFormElement):IntegratedRecord[]{
 const data=new FormData(form),systemType=form.dataset.systemType||'',editingId=String(form.dataset.editId||''),existing=editingId?(integratedStore().ledger||[]).find(t=>t.id===editingId):null;
 const date=String(data.get('date')||ymd()),note=String(data.get('note')||'').trim(),base={date,note,sequence:existing&&String(existing.date)===date&&Number.isFinite(Number(existing.sequence))?Number(existing.sequence):nextIntegratedSequence(date),createdAt:existing?.createdAt||new Date().toISOString()};
 if(systemType){
  const amount=Number(data.get('amount')),category=String(data.get('category')||systemType);
  if(systemType==='openingAsset')return[{...base,id:form.dataset.editId||uid('igl'),type:'openingAsset',amount,toAccountId:String(data.get('toAccountId')||''),category}];
  if(systemType==='openingLiability')return[{...base,id:form.dataset.editId||uid('igl'),type:'openingLiability',amount,liabilityId:String(data.get('liabilityId')||''),category}];
 }
 const type=String(data.get('uiType')||''),amount=Number(data.get('amount')),category=String(data.get('category')||integratedDefaultCategory(type)).trim();
 if(type==='externalIncome')return[{...base,id:editingId||uid('igl'),type:'externalIncome',amount,toAccountId:'cash-main',category}];
 if(type==='lifeExpense')return[{...base,id:editingId||uid('igl'),type:existing?.type==='externalExpense'?'externalExpense':'expense',fixed:!!existing?.fixed,amount,fromAccountId:existing?.type==='externalExpense'?undefined:'cash-main',category,...(existing?.productId?{productId:existing.productId,meta:clone(existing.meta||{})}:{})}];
 if(type==='savingInvestment'){
  const toAccountId=String(data.get('toAccountId')||''),targetKind=integratedStore().accounts.find(a=>a.id===toAccountId)?.kind||'',requested=String(data.get('targetPensionAccountId')||'');
  const candidates=['pension','irp'].includes(targetKind)?pensionAccountsForKind(targetKind,date):[],resolved=requested&&candidates.some(a=>a.id===requested)?requested:(candidates.length===1?candidates[0].id:'');
  const isaRequested=String(data.get('targetIsaAccountId')||''),isaCandidates=targetKind==='isa'?isaAccountsForDate(date):[],isaResolved=isaRequested&&isaCandidates.some(a=>a.id===isaRequested)?isaRequested:(isaCandidates.length===1?isaCandidates[0].id:'');
  const meta=['pension','irp'].includes(targetKind)?{targetPensionAccountId:resolved,pensionRoutingRequired:!resolved}:targetKind==='isa'?{targetIsaAccountId:isaResolved,isaRoutingRequired:!isaResolved}:{};
  return[{...base,id:editingId||uid('igl'),type:'internalTransfer',amount,fromAccountId:'cash-main',toAccountId,category:category||integratedAccountName(toAccountId),meta}];
 }
 if(type==='loanPayment'){
  const principal=Number(data.get('principal'))||0,interest=Number(data.get('interest'))||0,liabilityId=String(data.get('liabilityId')||''),rows:IntegratedRecord[]=[];
  const principalId=editingId&&existing?.type==='debtPrincipal'?editingId:uid('igl'),interestId=editingId&&existing?.type==='debtInterest'?editingId:uid('igl');
  if(principal>0)rows.push({...base,id:principalId,type:'debtPrincipal',amount:principal,fromAccountId:'cash-main',liabilityId,category:'대출 원금상환'});
  if(interest>0)rows.push({...base,id:interestId,type:'debtInterest',amount:interest,fromAccountId:'cash-main',liabilityId,category:'대출 이자'});
  return rows;
 }
 return[];
}

function integratedValidateCandidate(candidate:IntegratedRecord,editingId=''):string{
 if(candidate.meta?.pensionRoutingRequired)return'복수 연금계좌 중 실제 납입 계좌를 선택해 주세요.';
 if(candidate.meta?.isaRoutingRequired)return'복수 ISA 중 실제 납입 계좌를 선택해 주세요.';
 const dateError=postedDateError(candidate.date);if(dateError)return dateError;
 const accountMap=new Map((integratedStore().accounts||[]).map(a=>[a.id,a])),targetKind=accountMap.get(candidate.toAccountId)?.kind||'',explicitPension=String(candidate.meta?.targetPensionAccountId||''),explicitIsa=String(candidate.meta?.targetIsaAccountId||'');
 if(['internalTransfer','externalAssetIn'].includes(candidate.type)&&['pension','irp'].includes(targetKind)){
  const eligible=pensionAccountsForKind(targetKind,candidate.date);
  if(explicitPension&&!eligible.some(a=>a.id===explicitPension))return'선택한 연금 납입 계좌가 해당 날짜에 운영 중이 아닙니다.';
  if(eligible.length>1&&!explicitPension)return'복수 연금계좌 중 실제 납입 계좌를 선택해 주세요.';
  if(!eligible.length)return'해당 날짜에 운영 중인 연금 납입 계좌가 없습니다.';
 }
 if(['internalTransfer','externalAssetIn'].includes(candidate.type)&&targetKind==='isa'){
  const eligible=isaAccountsForDate(candidate.date);
  if(explicitIsa&&!eligible.some(a=>a.id===explicitIsa))return'선택한 ISA가 해당 날짜에 운영 중이 아닙니다.';
  if(eligible.length>1&&!explicitIsa)return'복수 ISA 중 실제 납입 계좌를 선택해 주세요.';
  if(!eligible.length)return'해당 날짜에 운영 중인 ISA가 없습니다.';
  const target=eligible.find(a=>a.id===(explicitIsa||eligible[0]?.id));
  if(target?.baselineDate&&candidate.date<=target.baselineDate)return`초기 잔고 기준일 ${formatDate(target.baselineDate)} 이후 납입만 추가해 주세요.`;
 }
 for(const id of [candidate.fromAccountId,candidate.toAccountId,candidate.accountId].filter(Boolean)){
  const account=accountMap.get(id),product=account?.productId?financialProduct(account.productId):null;
  if(account&&product&&!financialProductActiveOnDate(product,candidate.date))return`${account.name} 상품의 운영기간 밖 거래는 저장할 수 없습니다.`;
 }
 if(candidate.liabilityId){
  const liability=(integratedStore().liabilities||[]).find(x=>x.id===candidate.liabilityId),product=liability?.productId?financialProduct(liability.productId):null;
  if(liability&&product&&!financialProductActiveOnDate(product,candidate.date))return`${liability.name} 대출의 운영기간 밖 거래는 저장할 수 없습니다.`;
 }
 if(candidate.type==='adjustment'){
  if(!Number.isFinite(Number(candidate.delta)))return'보정금액은 올바른 숫자여야 합니다.';
  if(!financialNumberInRange(candidate.delta))return'보정금액이 너무 커 정확하게 저장할 수 없습니다.';
  if(Number(candidate.delta)===0)return'보정금액은 0원이 될 수 없습니다.';
 }else{
  if(!Number.isFinite(Number(candidate.amount)))return'금액은 1원 이상 입력해 주세요.';
  if(!financialNumberInRange(candidate.amount))return'금액이 너무 커 정확하게 저장할 수 없습니다.';
  if(Number(candidate.amount)<=0)return'금액은 1원 이상 입력해 주세요.';
 }
 if(candidate.type==='internalTransfer'&&candidate.fromAccountId===candidate.toAccountId)return'같은 계좌로는 이체할 수 없습니다.';
 const test=clone(integratedStore());test.ledger=(test.ledger||[]).filter(t=>t.id!==editingId&&!isQaIntegratedFixture(t));test.ledger.push(candidate);
 const issues=[...integratedCandidateIssues(test),...integratedPolicyLimitIssues(test)];
 return issues.length?issues[0].replace('자산 잔액 음수:','잔액이 부족합니다:').replace('부채 잔액 음수:','대출잔액보다 많이 상환할 수 없습니다:'):'';
}

function saveIntegratedTransaction(form:HTMLFormElement):void{
 const rows=integratedCandidatesFromForm(form),editingId=form.dataset.editId||'';
 if(!rows.length){toast('기록할 금액을 입력해 주세요.');return}
 const test=clone(integratedStore());if(editingId)test.ledger=(test.ledger||[]).filter(t=>t.id!==editingId);
 for(const row of rows){const error=integratedValidateCandidate(row,editingId);if(error){toast(error);return}test.ledger.push(row)}
 const combinedIssues=[...integratedCandidateIssues(test),...integratedPolicyLimitIssues(test)];
 if(combinedIssues.length){toast(combinedIssues[0].replace('자산 잔액 음수:','잔액이 부족합니다:').replace('부채 잔액 음수:','대출잔액보다 많이 상환할 수 없습니다:'));return}
 if(editingId)integratedStore().ledger=integratedStore().ledger.filter(t=>t.id!==editingId);
 integratedStore().ledger.push(...rows);integratedStore().mode='live';integratedStore().label='내 통합 거래기록';setting().integratedMonth=integratedMonthKey(rows[0].date);integratedLedgerSearch='';integratedSearchDisplayLimit=50;setting().integratedLedgerFilter='all';
 if(!persist())return;sheetDirty=false;closeSheets({all:true});nav('integrated','ledger');toast('거래를 저장했습니다.');haptic('light');
}

function deleteIntegratedTransaction(id:string):void{
 const tx=integratedStore().ledger.find(t=>t.id===id);if(!tx){toast('거래를 찾지 못했습니다.');return}if(tx.meta?.isaLifecycleAccountId){toast('ISA 정산에 연결된 거래는 개별 삭제할 수 없습니다.');return}
 showDialog({title:'이 거래를 삭제할까요?',message:`${tx.date} · ${tx.category||integratedTxLabel(tx)} 기록을 삭제합니다. 관련 합계가 즉시 다시 계산됩니다.`,confirmText:'삭제',cancelText:'취소',danger:true},()=>{
  const before=clone(integratedStore());integratedStore().ledger=integratedStore().ledger.filter(t=>t.id!==id);const issues=integratedCandidateIssues(integratedStore());
  if(issues.length){state.integrated=before;toast('삭제하면 잔액이 맞지 않아 취소했습니다.');return}
  integratedStore().mode='live';integratedStore().label='내 통합 거래기록';if(!persist())return;sheetDirty=false;closeSheets();nav('integrated','ledger');toast('거래를 삭제했습니다.');haptic('light');
 });
}

function eventTarget(event:Event):HTMLElement{return event.currentTarget as HTMLElement}

function openIntegratedTransactionDetail(id:string):void{
 const tx=integratedLedger().find(x=>x.id===id);if(!tx){toast('거래를 찾지 못했습니다.');return}
 const linkedProduct=!!tx.productId,productLinkedManaged=linkedProduct&&['externalAssetIn','externalAssetOut','externalDebtPrincipal','debtInterestExternal','openingAsset','openingLiability'].includes(tx.type);
 $('#sheetEyebrow').textContent='통합 · 거래';$('#sheetTitle').textContent=tx.category||integratedTxLabel(tx);
 const sourceBox=tx.readonly?`<div class="source-note">${tx.sourceModule==='isa'?'ISA':'개인연금'}의 실제 기록을 자동으로 읽은 거래입니다. 통합에서 중복 수정하지 않습니다.</div><button class="diagnostic-action" data-linked-source="${escapeHtml(tx.sourceModule)}">원본 화면 열기</button>`:productLinkedManaged?`<div class="source-note">금융상품과 연결된 거래입니다. 통합에서 따로 수정하면 상품 잔액과 어긋날 수 있어 상품 화면에서 관리합니다.</div><button class="diagnostic-action" data-linked-product="${escapeHtml(tx.productId)}">금융상품 열기</button>`:`<div class="integrated-detail-note">수정·삭제하면 통합 수치가 즉시 다시 계산됩니다.</div><div class="integrated-detail-actions"><button data-integrated-edit="${escapeHtml(tx.id)}">수정</button><button class="danger" data-integrated-delete-detail="${escapeHtml(tx.id)}">삭제</button></div>`;
 $('#sheetBody').innerHTML=`<div class="sheetrows"><div class="sheetrow"><span>날짜</span><strong>${escapeHtml(tx.date)}</strong></div><div class="sheetrow"><span>유형</span><strong>${escapeHtml(integratedTxLabel(tx))}</strong></div><div class="sheetrow"><span>금액</span><strong>${tx.type==='adjustment'?signed(Number(tx.delta)||0):won(tx.amount)}</strong></div>${integratedTxAccountsText(tx)?`<div class="sheetrow"><span>계좌</span><strong>${escapeHtml(integratedTxAccountsText(tx))}</strong></div>`:''}${tx.note?`<div class="sheetrow"><span>메모</span><strong>${escapeHtml(tx.note)}</strong></div>`:''}</div>${sourceBox}${['expense','externalExpense'].includes(tx.type)?`<button class="diagnostic-action" data-refund="${escapeHtml(tx.id)}">환불·부분취소</button>`:''}`;
 openSheet('#detailSheet');
 $('[data-refund]')?.addEventListener('click',()=>openIntegratedRefundForm(tx.id));
 $('[data-integrated-edit]')?.addEventListener('click',(event:Event)=>openIntegratedTransactionForm(eventTarget(event).dataset.integratedEdit));
 $('[data-integrated-delete-detail]')?.addEventListener('click',(event:Event)=>deleteIntegratedTransaction(String(eventTarget(event).dataset.integratedDeleteDetail||'')));
 $('[data-linked-source]')?.addEventListener('click',(event:Event)=>{closeSheets();eventTarget(event).dataset.linkedSource==='isa'?nav('isa','transactions'):nav('pension','contribution')});
 $('[data-linked-product]')?.addEventListener('click',(event:Event)=>{const productId=String(eventTarget(event).dataset.linkedProduct||'');closeSheets({fromPop:true});setTimeout(()=>openFinancialProductDetail(productId),40)});
}

function recordIntegratedRefund(originalId:string,date:string,amount:number):RefundResult{
 const original=integratedStore().ledger.find(t=>t.id===originalId);
 if(!original||!['expense','externalExpense'].includes(original.type))return{ok:false,error:'환불할 지출 기록을 찾지 못했습니다.'};
 const row={id:uid('refund'),date,type:'refund',amount:Number(amount),toAccountId:original.type==='expense'?original.fromAccountId:'',category:original.category,fixed:original.fixed,note:'원거래 환불',meta:{refundOf:original.id}};
 const error=integratedValidateCandidate(row);if(error)return{ok:false,error};integratedStore().ledger.push(row);return{ok:true,row};
}

function openIntegratedRefundForm(id:string):void{
 const tx=integratedStore().ledger.find(t=>t.id===id);if(!tx)return;
 const refunded=integratedStore().ledger.filter(row=>row.type==='refund'&&row.meta?.refundOf===id).reduce((sum,row)=>sum+Number(row.amount),0),remaining=Number(tx.amount)-refunded;
 $('#formEyebrow').textContent='통합 · 환불';$('#formTitle').textContent='환불·부분취소 기록';
 $('#formBody').innerHTML=`<form id="refundForm" class="form"><div class="readonly-row"><span>환불 가능한 잔액</span><strong>${won(remaining)}</strong></div><div class="field"><label>환불일</label><input name="date" type="date" value="${escapeHtml(localYmd())}" required></div><div class="field"><label>실제 환불액</label><input name="amount" type="number" min="1" max="${escapeHtml(remaining)}" value="${escapeHtml(remaining)}" required></div><div class="source-note">원래 지출은 보존하며 환불한 달의 소비에서 차감합니다.</div><button class="form-btn primary">환불 저장</button></form>`;
 openSheet('#formSheet',{mode:'input'});
 ($('#refundForm') as HTMLFormElement).onsubmit=(event:SubmitEvent)=>{
  event.preventDefault();const form=event.currentTarget as HTMLFormElement,data=new FormData(form),before=clone(state),result=recordIntegratedRefund(id,String(data.get('date')),Number(data.get('amount')));
  if(!result.ok){toast(result.error);return}
  setting().integratedMonth=integratedMonthKey(String(data.get('date')));setting().integratedLedgerFilter='all';integratedLedgerSearch='';
  if(!persist()){state=before;return}sheetDirty=false;closeSheets({all:true});nav('integrated','ledger');toast('환불을 기록했습니다.');
 };
}
