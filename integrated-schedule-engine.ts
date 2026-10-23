'use strict';
type ScheduleRecord=Record<string,unknown>&{id:string;kind?:string;type?:string;date?:string;day?:number|string;startDate?:string;endDate?:string;targetAccountId?:string;targetKind?:string;productId?:string;meta?:Record<string,unknown>;settlement?:{date?:string};transactions?:ScheduleRecord[]};
type ScheduleState=Record<string,unknown>&{accounts:ScheduleRecord[];financeSchedules?:{items:ScheduleRecord[]};financialProducts?:{items:ScheduleRecord[]}};
type ScheduleDraft=ScheduleRecord&{ok:boolean;error:string;successMessage?:string};
type ScheduleOccurrence={schedule:ScheduleRecord;date:string;status:string;tx:ScheduleRecord|null;undated?:boolean};

declare const DEFAULT_FINANCE_DAY:number;
declare const state:ScheduleState;
declare function localYmd(date?:Date):string;
declare function integratedStore():Record<string,unknown>&{accounts:ScheduleRecord[]};
declare function normalizeName(value:unknown):string;
declare function integratedOperationalLedger():ScheduleRecord[];
declare function integratedSelectedMonth():string;
declare function financeProductAccountId(productId:string):string;
declare function pensionStore():{accounts:ScheduleRecord[]};
declare function pensionAccount(id:unknown):ScheduleRecord|null;
declare function validateScheduleCompletionRequest(scheduleId:string,date:string):ScheduleRecord&{ok:boolean;error:string;schedule:ScheduleRecord};
declare function calculateLoanScheduleCompletion(schedule:ScheduleRecord,date:string,principal:number,interest:number):ScheduleDraft;
declare function calculateStandardScheduleCompletion(schedule:ScheduleRecord,date:string,amount:number,pensionAccountId:string,isaAccountId:string):ScheduleDraft;
declare function validateScheduleCompletionDraft(draft:ScheduleDraft):string;
declare function commitScheduleCompletion(schedule:ScheduleRecord,date:string,draft:ScheduleDraft):Promise<boolean>;
declare function renderScheduleCompletion(date:string,message?:string):void;
declare function toast(message:string):void;
declare function isCurrentAccount(account:ScheduleRecord):boolean;
declare function txDate(transaction:ScheduleRecord):string;

function normalizeFinanceSchedules(input:unknown){const src:Record<string,unknown>=input&&typeof input==='object'?input as Record<string,unknown>:{items:[]},items:ScheduleRecord[]=Array.isArray(src.items)?src.items:[];return{items:items.map((x,i)=>({...x,id:String(x.id||`schedule-${i+1}`),name:String(x.name||`일정 ${i+1}`),kind:['income','investment','saving','loan','insurance','expense'].includes(x.kind||'')?x.kind:'expense',amount:Math.max(0,Number(x.amount)||0),amountMode:x.amountMode==='estimate'?'estimate':'fixed',day:(x.day===0||x.day==='0')?0:Math.min(31,Math.max(1,Number(x.day)||DEFAULT_FINANCE_DAY)),recurrence:x.recurrence==='monthly'?'monthly':'monthly',startDate:String(x.startDate||''),endDate:String(x.endDate||''),targetKind:String(x.targetKind||''),targetAccountId:String(x.targetAccountId||''),targetPensionAccountId:String(x.targetPensionAccountId||''),targetIsaAccountId:String(x.targetIsaAccountId||''),productId:String(x.productId||''),liabilityId:String(x.liabilityId||''),active:x.active!==false,note:String(x.note||''),source:String(x.source||'user'),needsDate:!!x.needsDate,attention:String(x.attention||'')}))}}
function financeSchedules():ScheduleRecord[]{return state.financeSchedules?.items||[]}
function clampEndedProductSchedules(target:ScheduleState=state){const products:ScheduleRecord[]=target.financialProducts?.items||[],schedules:ScheduleRecord[]=target.financeSchedules?.items||[];for(const p of products){if(p.status==='active')continue;const end=String(p.endedAt||p.settlement?.date||p.maturityDate||'');if(!end)continue;for(const s of schedules){if(String(s.productId||'')!==String(p.id))continue;if(!s.endDate||String(s.endDate)>end)s.endDate=end}}return target}
function closeFinanceProductSchedules(productId:unknown,date:unknown){const end=String(date||localYmd());for(const s of financeSchedules()){if(String(s.productId||'')!==String(productId))continue;if(!s.endDate||String(s.endDate)>end)s.endDate=end}}
function scheduleMonthDays(month:unknown){const [y,m]=String(month).split('-').map(Number),days=new Date(y,m,0).getDate();return{y,m,days}}
function scheduleDateForMonth(s:ScheduleRecord,month:unknown){if(!s.active||!s.day)return'';const actual=cardV2(s)?.bills.find(b=>b.dueDate.slice(0,7)===String(month));if(actual&&(!actual.settledBy||cardV2(s)?.payments.some(p=>p.billId===actual.id)))return actual.dueDate;const {y,m,days}=scheduleMonthDays(month),day=Math.min(Number(s.day),days),date=`${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;if(s.startDate&&date<s.startDate)return'';if(s.endDate&&date>s.endDate)return'';if(s.cardPlan&&!cardInstallmentTerms(s,date))return'';return date}
function scheduleFallbackMatches(s:ScheduleRecord|undefined,date:unknown,t:ScheduleRecord){
 if(!s||s.cardPlan||t.meta?.scheduleId||t.meta?.cardPlanId||t.meta?.analysisOnly||String(t.date)!==String(date)||(Number(t.amount)||0)!==schedulePlannedAmount(s,String(date)))return false;
 const account=integratedStore().accounts.find((a:ScheduleRecord)=>a.id===t.toAccountId),sameName=normalizeName(t.category)===normalizeName(s.name);
 if(s.kind==='income')return t.type==='externalIncome'&&sameName;
 if(['investment','saving'].includes(s.kind||'')){
  if(!['internalTransfer','externalAssetIn'].includes(t.type||''))return false;
  if(s.productId)return account?.productId===s.productId;
  const target=scheduleTargetAccount(s);if(target&&t.toAccountId!==target)return false;
  const targetKind=s.targetKind||integratedStore().accounts.find((a:ScheduleRecord)=>a.id===target)?.kind||'';
  return account?.kind===targetKind&&(sameName||['isa','pension','irp'].includes(targetKind))
 }
 if(s.kind==='loan'){
  if(!['debtInterest','debtInterestExternal','debtPrincipal','externalDebtPrincipal'].includes(t.type||''))return false;
  if(s.liabilityId)return t.liabilityId===s.liabilityId;
  if(s.productId)return t.productId===s.productId;
  return sameName
 }
 if(['insurance','expense'].includes(s.kind||''))return ['expense','externalExpense'].includes(t.type||'')&&sameName;
 return false
}
function scheduleCompletionTx(scheduleId:string,date:string,sourceRows:ScheduleRecord[]|null=null){
 const rows=sourceRows||integratedOperationalLedger(),schedule=financeSchedules().find(s=>s.id===scheduleId);
 const plan=schedule&&cardV2(schedule),bill=plan?.bills.find(b=>b.dueDate===date),payment=plan?.payments.find(p=>p.billId===bill?.id);
 if(payment)return{id:payment.id,date:payment.date,type:'debtPrincipal',amount:payment.principal,meta:{scheduleId,scheduleDate:date,cardPlanId:scheduleId,cardBillId:bill?.id,loanPrincipal:payment.principal,loanInterest:payment.interest,actualAmount:payment.cash+payment.pointsPrincipal+payment.pointsInterest}};
 const linked=rows.filter(t=>t.meta?.scheduleId===scheduleId&&t.meta?.scheduleDate===date),explicit=linked[0];
 if(explicit){
  if(schedule?.kind==='loan'){
   const principal=Number(explicit.meta?.loanPrincipal||0),interest=Number(explicit.meta?.loanInterest||0);
   const paidPrincipal=linked.filter(t=>['debtPrincipal','externalDebtPrincipal'].includes(t.type||'')&&t.liabilityId===schedule.liabilityId).reduce((sum,t)=>sum+Number(t.amount||0),0);
   const paidInterest=linked.filter(t=>['debtInterest','debtInterestExternal'].includes(t.type||'')&&t.liabilityId===schedule.liabilityId).reduce((sum,t)=>sum+Number(t.amount||0),0);
   if(principal>0&&paidPrincipal!==principal||interest>0&&paidInterest!==interest)return null
  }
  return explicit
 }
 return rows.find(t=>scheduleFallbackMatches(schedule,date,t)&&financeSchedules().filter(s=>scheduleDateForMonth({...s,active:true},date.slice(0,7))===date&&scheduleFallbackMatches(s,date,t)).length===1)||null
}
function scheduleOccurrenceStatus(s:ScheduleRecord,date:string,knownTx?:ScheduleRecord|null){const tx=arguments.length>=3?knownTx:scheduleCompletionTx(s.id,date);if(tx)return'done';const today=localYmd();if(date<today)return'overdue';if(date===today)return'today';const diff=Math.round((new Date(date+'T00:00:00').getTime()-new Date(today+'T00:00:00').getTime())/86400000);return diff<=3?'soon':'planned'}
function scheduleStatusLabel(st:string){return({done:'완료',overdue:'미완료',today:'오늘',soon:'임박',planned:'예정'} as Record<string,string>)[st]||'예정'}
function scheduleOccurrences(month=integratedSelectedMonth()){const rows=integratedOperationalLedger();return financeSchedules().map(s=>{const date=scheduleDateForMonth(s.active?s:{...s,active:true},month);if(!date)return null;const tx=scheduleCompletionTx(s.id,date,rows);if(!s.active&&!tx)return null;return{schedule:s,date,status:scheduleOccurrenceStatus(s,date,tx),tx}}).filter((o):o is ScheduleOccurrence=>!!o&&(o.schedule.kind!=='income'||o.status==='done')).sort((a,b)=>a.date.localeCompare(b.date)||String(a.schedule.name).localeCompare(String(b.schedule.name),'ko'))}
function scheduleUrgentOccurrences(){const today=localYmd(),months=new Set([today.slice(0,7)]);const d=new Date(today+'T00:00:00');d.setDate(d.getDate()+4);months.add(localYmd(d).slice(0,7));const dated=[...months].flatMap(m=>scheduleOccurrences(m)).filter(x=>x.schedule.kind!=='income'&&['overdue','today','soon'].includes(x.status)),undated:ScheduleOccurrence[]=financeSchedules().filter(x=>x.active&&x.needsDate&&x.attention==='overdue').map(s=>({schedule:s,date:'날짜 미설정',status:'overdue',tx:null,undated:true}));return [...undated,...dated].sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.schedule.name).localeCompare(String(b.schedule.name),'ko'))}
function scheduleTargetAccount(s:ScheduleRecord){if(s.targetAccountId)return s.targetAccountId;if(s.targetKind==='pension')return'pension-link';if(s.targetKind==='irp')return'irp-link';if(s.targetKind==='isa')return'isa-link';if(s.productId)return financeProductAccountId(s.productId);return''}
function pensionAccountActiveOnDate(a:ScheduleRecord|null|undefined,date:unknown){if(!a)return false;const d=String(date||localYmd()),start=String(a.openedAt||''),end=String(a.closedAt||'');if(start&&d<start)return false;if(end&&d>end)return false;return true}
function pensionAccountsForKind(kind:string,date=''){return (pensionStore().accounts as ScheduleRecord[]).filter(a=>a.kind===kind&&(!date?pensionAccount(a.id)?.status==='active':pensionAccountActiveOnDate(a,date)))}
function schedulePensionKind(sc:ScheduleRecord){const linkedKind=integratedStore().accounts.find((a:ScheduleRecord)=>a.id===sc?.targetAccountId)?.kind;return ['pension','irp'].includes(sc?.targetKind||'')?sc.targetKind:(['pension','irp'].includes(linkedKind||'')?linkedKind:'')}
function resolveSchedulePensionAccount(sc:ScheduleRecord,explicit='',date=''){const kind=schedulePensionKind(sc);if(!kind)return'';const candidates=pensionAccountsForKind(kind,date||'');const requested=String(explicit||sc?.targetPensionAccountId||'');if(requested&&candidates.some(a=>a.id===requested))return requested;return candidates.length===1?candidates[0].id:''}
function isaAccountsForDate(date=''){const d=String(date||localYmd()),today=localYmd();return (state.accounts as ScheduleRecord[]).filter(a=>{const open=String(a.openedAt||a.baselineDate||''),ends=[String(a.closedAt||''),String(a.maturityAt||'')].filter(Boolean).sort(),end=ends[0]||'';if(open&&d<open)return false;if(end&&d>end)return false;if(d>=today&&a.status!=='active')return false;return true})}
function resolveScheduleIsaAccount(sc:ScheduleRecord,explicit='',date=''){const candidates=isaAccountsForDate(date||''),requested=String(explicit||sc?.targetIsaAccountId||'');if(requested&&candidates.some(a=>a.id===requested))return requested;return candidates.length===1?candidates[0].id:''}
async function completeScheduleOccurrence(scheduleId:string,date:string,amountOverride=0,targetPensionAccountId='',targetIsaAccountId='',loanPrincipalOverride=0,loanInterestOverride=0){
 const request=validateScheduleCompletionRequest(scheduleId,date);
 if(!request.ok){toast(request.error);return false}
 const draft=request.schedule.kind==='loan'?calculateLoanScheduleCompletion(request.schedule,date,loanPrincipalOverride,loanInterestOverride):calculateStandardScheduleCompletion(request.schedule,date,amountOverride,targetPensionAccountId,targetIsaAccountId);
 if(!draft.ok){toast(draft.error);return false}
 const validationError=validateScheduleCompletionDraft(draft);
 if(validationError){toast(validationError);return false}
 if(!(await commitScheduleCompletion(request.schedule,date,draft)))return false;
 renderScheduleCompletion(date,draft.successMessage);
 return true
}
function centralPensionContributionRows(year=''){const rows:ScheduleRecord[]=[];for(const t of integratedOperationalLedger()){if(t.meta?.analysisOnly)continue;if(!['internalTransfer','externalAssetIn'].includes(t.type||''))continue;const accounts:ScheduleRecord[]=integratedStore().accounts||[],pensionAccounts:ScheduleRecord[]=pensionStore().accounts||[],kind=accounts.find(a=>a.id===t.toAccountId)?.kind;if(!['pension','irp'].includes(kind||''))continue;if(year&&!String(t.date).startsWith(String(year)))continue;const explicit=String(t.meta?.pensionAccountId||t.meta?.targetPensionAccountId||''),dated=pensionAccounts.filter(a=>a.kind===kind&&pensionAccountActiveOnDate(a,t.date)),resolved=explicit&&pensionAccounts.some(a=>a.id===explicit&&a.kind===kind)?explicit:(dated.length===1?dated[0].id:'');rows.push({id:`central-${t.id}`,accountId:resolved,kind,type:t.meta?.isaTransfer?'isaTransfer':'contribution',date:String(t.date),amount:Number(t.amount)||0,sourceTxId:t.id,source:'integrated',unresolved:!resolved})}return rows}
function centralIsaContributionRows(year=''){const rows:ScheduleRecord[]=[];for(const t of integratedOperationalLedger()){if(t.meta?.analysisOnly)continue;if(!['internalTransfer','externalAssetIn'].includes(t.type||''))continue;const accounts:ScheduleRecord[]=integratedStore().accounts||[];if(accounts.find(a=>a.id===t.toAccountId)?.kind!=='isa')continue;if(year&&!String(t.date).startsWith(String(year)))continue;const dated=isaAccountsForDate(t.date||''),explicit=String(t.meta?.targetIsaAccountId||''),resolved=explicit&&dated.some(a=>a.id===explicit)?explicit:(dated.length===1?dated[0].id:'');rows.push({...t,accountId:resolved,unresolved:!resolved})}return rows}
function centralIsaReplayRows(account:ScheduleRecord|null|undefined,includeArchived=false){if(!account||(!includeArchived&&!isCurrentAccount(account)))return[];const localCounts=new Map<string,number>();for(const t of account.transactions||[]){if(t.status==='cancelled'||!['deposit','internalTransferIn'].includes(t.type||''))continue;const key=`${txDate(t)}|${Number(t.amount)||0}`;localCounts.set(key,(localCounts.get(key)||0)+1)}const out:ScheduleRecord[]=[];for(const t of centralIsaContributionRows().filter(t=>t.accountId===account.id&&!t.unresolved)){const key=`${String(t.date)}|${Number(t.amount)||0}`,remaining=localCounts.get(key)||0;if(remaining){localCounts.set(key,remaining-1);continue}out.push({id:`virtual-${t.id}`,type:'internalTransferIn',date:String(t.date),amount:Number(t.amount)||0,note:t.note||'통합 납입',status:'posted',sourceTxId:t.id,meta:{centralContribution:true,targetIsaAccountId:account.id}})}return out}

/* v1.9.19 MODULE: financial product rules. Product terms are source-of-truth; balances come from transactions. */

// Scheduled estimates are separate from immutable actual payment rows.
type ScheduleAmountHistory={effectiveFrom:string;amount:number};
type CardPlan={purchaseDate:string;firstPaymentDate:string;purchaseAmount:number;months:number;annualRate:number;interestMode:string;interestFreeMonths?:number};
declare function financialNumberInRange(value:unknown):boolean;
declare function validYmdDate(value:string):boolean;
declare function clone<T>(value:T):T;
declare function uid(prefix:string):string;
declare function integratedCandidateIssues(store:Record<string,unknown>):string[];
declare function persist(notify?:boolean):Promise<boolean>;
function cardInstallmentTerms(s:ScheduleRecord,date:string){
 if(cardV2(s))return cardV2Terms(s,date);
 const plan=s.cardPlan as CardPlan|undefined;if(!plan)return null;
 if(!validYmdDate(String(plan.firstPaymentDate))||!Number.isInteger(plan.months)||plan.months<1||plan.months>60||!Number.isFinite(plan.purchaseAmount)||plan.purchaseAmount<=0||!Number.isFinite(plan.annualRate)||plan.annualRate<0)return null;
 const first=String(plan.firstPaymentDate),index=(Number(date.slice(0,4))-Number(first.slice(0,4)))*12+Number(date.slice(5,7))-Number(first.slice(5,7));
 if(index<0||index>=plan.months)return null;
 const base=Math.floor(plan.purchaseAmount/plan.months),principal=index===plan.months-1?plan.purchaseAmount-base*(plan.months-1):base;
 const freeMonths=plan.interestFreeMonths??0;if(!Number.isInteger(freeMonths)||freeMonths<0||freeMonths>=plan.months)return null;
 const balance=plan.purchaseAmount-base*index,interest=plan.interestMode==='free'||index<freeMonths?0:Math.round(balance*plan.annualRate/1200);
 return{index:index+1,principal,interest,total:principal+interest};
}
function schedulePlannedAmount(s:ScheduleRecord,date:string):number{
 const overrides=s.amountOverrides as Record<string,number>|undefined;
 if(overrides&&Object.hasOwn(overrides,date))return Number(overrides[date])||0;
 const history=Array.isArray(s.amountHistory)?s.amountHistory as ScheduleAmountHistory[]:[];
 const latest=[...history].filter(x=>x&&validYmdDate(x.effectiveFrom)&&Number.isFinite(x.amount)&&x.amount>0&&x.effectiveFrom<=date).sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom)).at(-1);
 return latest?latest.amount:cardInstallmentTerms(s,date)?.total||Number(s.amount)||0;
}
async function updateSchedulePlannedAmount(id:string,date:string,amount:number,scope:string):Promise<boolean>{
 const s=financeSchedules().find(x=>x.id===id);
 if(s&&cardV2(s)){toast('실제 청구는 카드 청구·납부 화면에서 수정해 주세요.');return false}
 if(!s||!validYmdDate(date)||!['once','future'].includes(scope)||!financialNumberInRange(amount)||!Number.isInteger(amount)||amount<=0){toast('일정과 금액을 확인해 주세요.');return false}
 const before=clone(s);
 if(scope==='once')s.amountOverrides={...(s.amountOverrides as Record<string,number>||{}),[date]:amount};
 else {if(s.amountOverrides)delete (s.amountOverrides as Record<string,number>)[date];s.amountHistory=[...(Array.isArray(s.amountHistory)?s.amountHistory as ScheduleAmountHistory[]:[]).filter(x=>x.effectiveFrom!==date),{effectiveFrom:date,amount}];}
 if(!(await persist(false))){Object.assign(s,before);for(const key of ['amountOverrides','amountHistory'])if(!(key in before))delete s[key];return false}
 return true;
}
function cardPlanSummary(s:ScheduleRecord,month:string){
 if(cardV2(s))return cardV2Summary(s,month);
 const plan=s.cardPlan as CardPlan,rows=integratedStore().ledger as ScheduleRecord[];
 const paid=rows.filter(t=>t.liabilityId===s.liabilityId&&['debtPrincipal','externalDebtPrincipal'].includes(t.type||'')).reduce((sum,t)=>sum+Number(t.amount||0),0);
 const date=scheduleDateForMonth({...s,active:true},month),actual=scheduleCompletionTx(s.id,date),terms=cardInstallmentTerms(s,date);
 let paidInstallments=0;const totalInstallments=Number.isInteger(plan.months)&&plan.months>=1&&plan.months<=60?plan.months:0,first=String(plan.firstPaymentDate||'');
 for(let index=0;validYmdDate(first)&&index<totalInstallments;index++){const cursor=new Date(Date.UTC(Number(first.slice(0,4)),Number(first.slice(5,7))-1+index,1)),key=cursor.toISOString().slice(0,7),due=scheduleDateForMonth({...s,active:true},key);if(due&&scheduleCompletionTx(s.id,due,rows))paidInstallments++}
 const remainingPrincipal=Math.max(0,plan.purchaseAmount-paid);
 return{purchaseAmount:plan.purchaseAmount,remainingPrincipal,plannedAmount:date?schedulePlannedAmount(s,date):0,estimatedInterest:terms?.interest||0,actualAmount:actual?Number(actual.meta?.actualAmount??actual.amount)||0:null,paidInstallments,totalInstallments,completed:totalInstallments>0&&paidInstallments===totalInstallments&&remainingPrincipal===0};
}
async function createCardInstallment(input:Record<string,unknown>):Promise<string>{
 if(input.cardLedgerVersion===2)return createCardPurchase(input);
 const amount=Number(input.purchaseAmount),months=Number(input.months),rate=Number(input.annualRate??0),purchaseDate=String(input.purchaseDate||''),first=String(input.firstPaymentDate||''),name=String(input.name||'').trim(),mode=String(input.interestMode),freeMonths=mode==='partial'?Number(input.interestFreeMonths):0;
 if(!name||name.length>80||!validYmdDate(purchaseDate)||!validYmdDate(first)||first<purchaseDate||!Number.isInteger(amount)||amount<=0||!financialNumberInRange(amount)||!Number.isInteger(months)||months<1||months>60||amount<months||!['free','paid','partial'].includes(mode)||!Number.isInteger(freeMonths)||freeMonths<0||freeMonths>=months||(mode==='partial'&&freeMonths<1)||!Number.isFinite(rate)||rate<0||rate>100){toast('구매금액·기간·납부일·이자 설정을 확인해 주세요.');return''}
 const store=integratedStore(),before=clone(store),schedulesBefore=clone(state.financeSchedules),id=uid('card-plan'),liabilityId=uid('card-debt');
 const liabilities=store.liabilities as ScheduleRecord[],ledger=store.ledger as ScheduleRecord[];
 liabilities.push({id:liabilityId,kind:'other',name,cardPlanId:id});
 ledger.push({id:uid('igl'),date:purchaseDate,type:'openingLiability',amount,liabilityId,category:name,meta:{cardPlanId:id}}, {id:uid('igl'),date:purchaseDate,type:'externalExpense',amount,category:name,note:'카드 구매 · 원금 납부는 지출에 다시 포함하지 않음',meta:{cardPlanId:id,cardPurchase:true}});
 const plan:CardPlan={purchaseDate,firstPaymentDate:first,purchaseAmount:amount,months,annualRate:mode==='free'?0:rate,interestMode:mode,...(mode==='partial'?{interestFreeMonths:freeMonths}:{})};
 const s:ScheduleRecord={id,name,kind:'loan',amount:0,amountMode:'estimate',day:Number(first.slice(8,10)),startDate:first,active:true,liabilityId,source:'user',cardPlan:plan};s.amount=cardInstallmentTerms(s,first)?.total||0;
 if(!state.financeSchedules)state.financeSchedules={items:[]};state.financeSchedules.items.push(s);
 const issues=integratedCandidateIssues(store);
 if(issues.length||!(await persist(false))){state.integrated=before;state.financeSchedules=schedulesBefore;if(issues.length)toast(issues[0]);return''}
 return id;
}

async function removeUnpaidCardInstallment(id:string):Promise<boolean>{
 const s=financeSchedules().find(x=>x.id===id);if(!s?.cardPlan)return false;
 const store=integratedStore(),rows=store.ledger as ScheduleRecord[];
 if(rows.some(t=>t.liabilityId===s.liabilityId&&t.type!=='openingLiability')){toast('납부 기록이 있어 구매를 취소할 수 없습니다.');return false}
 if(cardV2(s)?.historyBaseline){toast('과거 명세서 연결은 일반 구매 취소로 삭제할 수 없습니다.');return false}
 const before=clone(store),schedules=clone(state.financeSchedules);
 store.ledger=rows.filter(t=>t.meta?.cardPlanId!==id);store.liabilities=(store.liabilities as ScheduleRecord[]).filter(x=>x.id!==s.liabilityId);
 if(state.financeSchedules)state.financeSchedules.items=financeSchedules().filter(x=>x.id!==id);
 if(!(await persist(false))){state.integrated=before;state.financeSchedules=schedules;return false}
 return true;
}

// Version 2 keeps the purchase, issuer bills and payment records separate.
// Financial postings use the existing replay contract; originals are never deduplicated by value.
type CardAccount={id:string;issuer:string;name:string;paymentDay:number;statementDay?:number;lastFour:string;archived:boolean};
type CardBill={id:string;dueDate:string;issuedDate:string;principal:number;interest:number;principalDiscount:number;interestDiscount:number;note:string;settledBy?:string};
type CardPayment={id:string;billId:string;date:string;kind:'bill'|'payoff';principal:number;interest:number;pointsPrincipal:number;pointsInterest:number;cash:number;rowIds:string[]};
type CardStatementEvidence={month:string;round:number;principal:number;interest:number;remainingPrincipal:number;status:'paid'|'scheduled';paidDate?:string;dueDate?:string;source:string};
type CardHistoryBaseline={asOf:string;remainingPrincipal:number;sourceKey:string;includeSpending:boolean;statements:CardStatementEvidence[]};
type CardLedgerPlan=CardPlan&{ledgerVersion:2;cardId:string;grossAmount:number;purchaseDiscount:number;category:string;merchant:string;paidInterestRounds:number[];bills:CardBill[];payments:CardPayment[];historyBaseline?:CardHistoryBaseline};
declare function setting():Record<string,unknown>;
declare function postedDateError(date:unknown):string;
function cardV2(s:ScheduleRecord):CardLedgerPlan|null{const plan=s.cardPlan as CardLedgerPlan|undefined;return plan?.ledgerVersion===2?plan:null}
function cardAccounts():CardAccount[]{const rows=setting().cardAccounts;return Array.isArray(rows)?rows as CardAccount[]:[]}
function cardMoney(value:unknown):number{const n=Number(value);if(!Number.isSafeInteger(n)||n<0||!financialNumberInRange(n))throw new Error('금액은 허용 범위의 원 단위 정수여야 합니다.');return n}
function cardDate(value:unknown,posted=false):string{const date=String(value||'');if(!validYmdDate(date))throw new Error('날짜를 확인해 주세요.');if(posted){const error=postedDateError(date);if(error)throw new Error(error)}return date}
function cardError(error:unknown):string{return error instanceof Error?error.message:String(error)}
async function saveCardAccount(input:Record<string,unknown>,id=''):Promise<string>{
 const hadCards=Object.hasOwn(setting(),'cardAccounts'),previous=clone(setting().cardAccounts??[]),rows=cardAccounts();
 try{const name=String(input.name||'').trim(),issuer=String(input.issuer||'기타 카드').trim(),day=Number(input.paymentDay),lastFour=String(input.lastFour||'').trim();if(!name||name.length>60||!issuer||issuer.length>40||!Number.isInteger(day)||day<1||day>31||lastFour&&!/^\d{4}$/.test(lastFour))throw new Error('카드 이름·결제일·끝 4자리를 확인해 주세요.');if(input.statementDay&&(!Number.isInteger(Number(input.statementDay))||Number(input.statementDay)<1||Number(input.statementDay)>31))throw new Error('결제확정일을 확인해 주세요.');if(id&&!rows.some(x=>x.id===id))throw new Error('카드를 찾지 못했습니다.');const key=id||uid('card'),record:CardAccount={id:key,name,issuer,paymentDay:day,lastFour,archived:input.archived===true,...(input.statementDay?{statementDay:Number(input.statementDay)}:{})};setting().cardAccounts=[...rows.filter(x=>x.id!==key),record];if(!(await persist(false))){if(hadCards)setting().cardAccounts=previous;else delete setting().cardAccounts;toast('저장하지 못해 변경을 되돌렸어요. 기존 기록은 유지됩니다.');return''}return key}catch(error){toast(cardError(error));return''}
}
function cardRows(s:ScheduleRecord):ScheduleRecord[]{return (integratedStore().ledger as ScheduleRecord[]).filter(x=>x.meta?.cardPlanId===s.id||x.liabilityId===s.liabilityId)}
function cardRemaining(s:ScheduleRecord,date='9999-12-31'):number{const plan=cardV2(s);if(!plan)return 0;const baseline=plan.historyBaseline;if(baseline&&date<baseline.asOf)return 0;return(baseline?.remainingPrincipal??plan.purchaseAmount)-cardRows(s).filter(x=>String(x.date)<=date&&['debtPrincipal','externalDebtPrincipal'].includes(x.type||'')).reduce((n,x)=>n+Number(x.amount||0),0)}
function cardOriginal(s:ScheduleRecord):ScheduleRecord|undefined{return cardRows(s).find(x=>x.meta?.cardPurchase===true)}
function cardBillTotal(bill:CardBill):number{return bill.principal+bill.interest-bill.principalDiscount-bill.interestDiscount}
function cardBillPaid(plan:CardLedgerPlan,bill:CardBill):boolean{return !!bill.settledBy||plan.payments.some(p=>p.billId===bill.id)}
function cardV2Terms(s:ScheduleRecord,date:string){
 const p=cardV2(s);if(!p||!validYmdDate(date))return null;
 const index=(Number(date.slice(0,4))-Number(p.firstPaymentDate.slice(0,4)))*12+Number(date.slice(5,7))-Number(p.firstPaymentDate.slice(5,7));
 const bill=p.bills.find(b=>b.dueDate===date),payment=p.payments.find(x=>x.billId===bill?.id);
 if(bill&&(!bill.settledBy||payment))return{index:p.historyBaseline?.statements.find(x=>x.month===date.slice(0,7))?.round??index+1,principal:bill.principal-bill.principalDiscount,interest:bill.interest-bill.interestDiscount,total:cardBillTotal(bill)};
 if(p.historyBaseline)return null; // Historical imports expose confirmed bills only, never invented past dates or estimates.
 if(index<0||index>=p.months||cardRemaining(s,date)<=0)return null;
 const base=Math.floor(p.purchaseAmount/p.months),principal=Math.min(cardRemaining(s,date),index===p.months-1?p.purchaseAmount-base*(p.months-1):base),interest=p.interestMode==='free'||p.interestMode==='partial'&&!p.paidInterestRounds.includes(index+1)?0:Math.round(Math.max(0,Math.min(p.purchaseAmount-base*index,cardRemaining(s,date)))*p.annualRate/1200);
 return{index:index+1,principal,interest,total:principal+interest};
}
function cardV2Summary(s:ScheduleRecord,month:string){const p=cardV2(s)!;const history=p.historyBaseline?.statements.find(x=>x.month===month),lastPaid=p.historyBaseline?.statements.filter(x=>x.status==='paid').at(-1); const date=scheduleDateForMonth({...s,active:true},month),terms=date?cardV2Terms(s,date):null,bill=p.bills.find(b=>b.dueDate.slice(0,7)===month),payment=bill?p.payments.find(x=>x.billId===bill.id):undefined,remainingPrincipal=Math.max(0,cardRemaining(s));return{purchaseAmount:p.purchaseAmount,remainingPrincipal,plannedAmount:terms?.total??(history?history.principal+history.interest:0),estimatedInterest:terms?.interest||0,actualAmount:payment?payment.cash+payment.pointsPrincipal+payment.pointsInterest:history?.status==='paid'?history.principal+history.interest:null,paidInstallments:Math.min(p.months,(lastPaid?.round||0)+p.bills.filter(b=>cardBillPaid(p,b)).length),totalInstallments:p.months,completed:remainingPrincipal===0&&p.bills.every(b=>cardBillPaid(p,b))}}
function cardPosting(s:ScheduleRecord,date:string,type:string,amount:number,eventId:string,meta:Record<string,unknown>={},cashAccount=''):ScheduleRecord{
 return{id:uid('igl'),date,type,amount,liabilityId:s.liabilityId,category:String(cardV2(s)?.category||s.name),note:'카드 원장 연결',...(cashAccount?(type==='refund'?{toAccountId:cashAccount}:{fromAccountId:cashAccount}):{}),meta:{cardPlanId:s.id,cardEventId:eventId,...meta}};
}
// All multi-record changes use one persisted commit and restore both collections on failure.
async function cardCommit(change:()=>void):Promise<boolean>{const before=clone(integratedStore()),schedules=clone(state.financeSchedules);try{change();const oldIds=new Set((before.ledger as ScheduleRecord[]).map(x=>x.id)),ledger=integratedStore().ledger as ScheduleRecord[];for(const row of ledger)if(!oldIds.has(row.id)){const sequence=Math.max(0,...ledger.filter(x=>x!==row&&x.date===row.date).map(x=>Number(x.sequence)||0))+1;Object.assign(row,{fixed:!!row.fixed,category:String(row.category||''),note:String(row.note||''),sourceModule:String(row.sourceModule||''),sourceId:String(row.sourceId||''),productId:String(row.productId||''),sequence:Number.isFinite(Number(row.sequence))?Number(row.sequence):sequence,createdAt:String(row.createdAt||new Date().toISOString())})}const issues=integratedCandidateIssues(integratedStore()),cardIssue=cardLedgerDataIssue(state);if(cardIssue)throw new Error(cardIssue);if(issues.length)throw new Error(issues[0]);if(!(await persist(false))){state.integrated=before;state.financeSchedules=schedules;toast('저장하지 못해 변경을 되돌렸어요. 기존 기록은 유지됩니다.');return false}return true}catch(error){state.integrated=before;state.financeSchedules=schedules;toast(cardError(error));return false}}
function cardPurchaseInput(input:Record<string,unknown>,existingCardId=''):{name:string;plan:CardLedgerPlan}{
 const name=String(input.name||'').trim(),gross=cardMoney(input.purchaseAmount),discount=cardMoney(input.purchaseDiscount??0),months=Number(input.months),purchaseDate=cardDate(input.purchaseDate,true),first=cardDate(input.firstPaymentDate),mode=String(input.interestMode||'free'),rate=Number(input.annualRate??0),cardId=String(input.cardId||''),category=String(input.category||'기타').trim(),merchant=String(input.merchant||'').trim();
 if(!name||name.length>80||!category||category.length>60||merchant.length>100||!gross||discount>=gross||!Number.isInteger(months)||months<1||months>60||gross-discount<months||first<purchaseDate||!['free','paid','partial'].includes(mode)||!Number.isFinite(rate)||rate<0||rate>100||!cardAccounts().some(x=>x.id===cardId&&(!x.archived||x.id===existingCardId)))throw new Error('구매금액·기간·카드·첫 청구일을 확인해 주세요.');
 const paidInterestRounds=mode==='partial'?(Array.isArray(input.paidInterestRounds)?input.paidInterestRounds.map(Number):[]):[];
 if(mode==='partial'&&(!paidInterestRounds.length||paidInterestRounds.some(n=>!Number.isInteger(n)||n<1||n>months)||new Set(paidInterestRounds).size!==paidInterestRounds.length))throw new Error('부분무이자의 이자 부담 회차를 확인해 주세요.');
 return{name,plan:{ledgerVersion:2,purchaseDate,firstPaymentDate:first,purchaseAmount:gross-discount,grossAmount:gross,purchaseDiscount:discount,months,annualRate:mode==='free'?0:rate,interestMode:mode,cardId,category,merchant,paidInterestRounds,bills:[],payments:[]}};
}
async function createCardPurchase(input:Record<string,unknown>):Promise<string>{let key='';const ok=await cardCommit(()=>{const {name,plan}=cardPurchaseInput(input),id=uid('card-plan'),liabilityId=uid('card-debt'),store=integratedStore(),s:ScheduleRecord={id,name,kind:'loan',amount:0,amountMode:'estimate',day:Number(plan.firstPaymentDate.slice(8)),startDate:plan.firstPaymentDate,active:true,liabilityId,source:'user',cardPlan:plan};(store.liabilities as ScheduleRecord[]).push({id:liabilityId,kind:'other',name,cardPlanId:id,productId:''});(store.ledger as ScheduleRecord[]).push({id:uid('igl'),date:plan.purchaseDate,type:'openingLiability',amount:plan.purchaseAmount,liabilityId,category:plan.category,meta:{cardPlanId:id}},{id:uid('igl'),date:plan.purchaseDate,type:'externalExpense',amount:plan.purchaseAmount,category:plan.category,note:merchantLabel(plan,name),meta:{cardPlanId:id,cardPurchase:true,spendingItem:name,merchant:plan.merchant,cardId:plan.cardId}});if(!state.financeSchedules)state.financeSchedules={items:[]};state.financeSchedules.items.push(normalizeFinanceSchedules({items:[s]}).items[0]);key=id});return ok?key:''}
// Import is a confirmed balance observation, not a fabricated historical cash payment.
function cardHistoryIssue(value:unknown,purchaseAmount:number,purchaseDate:string,months:number):string{
 const b=value as CardHistoryBaseline|undefined,validDate=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v,money=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
 if(!b||!validDate(b.asOf)||b.asOf<purchaseDate||!money(b.remainingPrincipal)||b.remainingPrincipal>purchaseAmount||typeof b.sourceKey!=='string'||!b.sourceKey||b.sourceKey.length>160||typeof b.includeSpending!=='boolean'||!Array.isArray(b.statements)||!b.statements.length)return'과거 카드 기준일·원금·출처를 확인해 주세요.';
 let previous:CardStatementEvidence|undefined;const seen=new Set<string>();let lastPaid:CardStatementEvidence|undefined,pending=0;
 for(const row of b.statements){if(!row||!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month)||seen.has(row.month)||previous&&row.month<=previous.month||!Number.isInteger(row.round)||row.round<1||row.round>months||!money(row.principal)||row.principal>purchaseAmount||!money(row.interest)||!Number.isSafeInteger(row.principal+row.interest)||!money(row.remainingPrincipal)||row.remainingPrincipal>purchaseAmount||!['paid','scheduled'].includes(row.status)||typeof row.source!=='string'||!row.source||row.source.length>500||row.paidDate&&(!validDate(row.paidDate)||row.paidDate<purchaseDate||row.paidDate>b.asOf||row.status!=='paid')||row.dueDate&&(!validDate(row.dueDate)||row.dueDate.slice(0,7)!==row.month||row.dueDate<purchaseDate))return'과거 명세서 회차·금액·출처가 잘못되었습니다.';
  if(previous&&(previous.remainingPrincipal-row.principal!==row.remainingPrincipal||row.round<=previous.round))return'과거 명세서의 원금과 다음 잔액이 일치하지 않습니다.';
  if(row.status==='paid'){if(pending)return'납부 확인 순서를 확인해 주세요.';lastPaid=row}else pending+=row.principal;
  seen.add(row.month);previous=row;
 }
 if((lastPaid?lastPaid.remainingPrincipal:b.statements[0].principal+b.statements[0].remainingPrincipal)!==b.remainingPrincipal||pending>b.remainingPrincipal)return'납부 확인 잔액과 가져오기 기준 원금이 다릅니다.';return'';
}
async function importCardHistory(input:Record<string,unknown>):Promise<string>{
 let key='';const ok=await cardCommit(()=>{const {name,plan}=cardPurchaseInput(input),baseline=clone(input.historyBaseline) as CardHistoryBaseline,issue=cardHistoryIssue(baseline,plan.purchaseAmount,plan.purchaseDate,plan.months);if(issue)throw new Error(issue);cardDate(baseline.asOf,true);
  const existing=financeSchedules().find(x=>cardV2(x)?.historyBaseline?.sourceKey===baseline.sourceKey);if(existing){const old=cardV2(existing)!;if(existing.name!==name||old.cardId!==plan.cardId||old.grossAmount!==plan.grossAmount||old.purchaseDiscount!==plan.purchaseDiscount||old.purchaseDate!==plan.purchaseDate||old.months!==plan.months||JSON.stringify(old.historyBaseline)!==JSON.stringify(baseline))throw new Error('같은 출처의 가져오기 내용이 달라 자동으로 덮어쓰지 않았습니다.');key=existing.id;return}
  plan.historyBaseline=baseline;const id=uid('card-history'),liabilityId=uid('card-debt'),store=integratedStore(),schedule:ScheduleRecord={id,name,kind:'loan',amount:0,amountMode:'estimate',day:Number(plan.firstPaymentDate.slice(8)),startDate:baseline.asOf,active:true,liabilityId,source:'statement-history',cardPlan:plan};
  (store.liabilities as ScheduleRecord[]).push({id:liabilityId,kind:'other',name,cardPlanId:id,productId:''});const rows=store.ledger as ScheduleRecord[];
  if(baseline.remainingPrincipal)rows.push({id:uid('igl'),date:baseline.asOf,type:'openingLiability',amount:baseline.remainingPrincipal,liabilityId,category:plan.category,note:'명세서로 확인한 과거 카드 잔여 원금',meta:{cardPlanId:id,cardHistoryBaseline:true}});
  rows.push({id:uid('igl'),date:plan.purchaseDate,type:'externalExpense',amount:plan.purchaseAmount,category:plan.category,note:merchantLabel(plan,name),meta:{cardPlanId:id,cardPurchase:true,cardHistoricalPurchase:!baseline.includeSpending,spendingItem:name,merchant:plan.merchant,cardId:plan.cardId}});
  if(!state.financeSchedules)state.financeSchedules={items:[]};state.financeSchedules.items.push(normalizeFinanceSchedules({items:[schedule]}).items[0]);key=id;
 });return ok?key:'';
}
function merchantLabel(plan:CardLedgerPlan,name:string):string{return plan.merchant?`${name} · ${plan.merchant}`:name}
async function updateCardPurchase(id:string,input:Record<string,unknown>):Promise<boolean>{return cardCommit(()=>{const s=financeSchedules().find(x=>x.id===id),old=s&&cardV2(s);if(!s||!old)throw new Error('구매 기록을 찾지 못했습니다.');if(old.historyBaseline)throw new Error('과거 명세서 연결은 원본 대조를 거쳐 수정해 주세요.');if(old.bills.length||old.payments.length||cardRows(s).some(x=>x.meta?.cardEventId))throw new Error('청구·납부·환불 기록을 먼저 되돌린 뒤 구매를 수정해 주세요.');const {name,plan}=cardPurchaseInput(input,old.cardId);s.name=name;s.cardPlan=plan;s.day=Number(plan.firstPaymentDate.slice(8));s.startDate=plan.firstPaymentDate;for(const row of cardRows(s)){row.date=plan.purchaseDate;row.amount=plan.purchaseAmount;row.category=plan.category;if(row.meta?.cardPurchase){row.note=merchantLabel(plan,name);row.meta={...row.meta,spendingItem:name,merchant:plan.merchant,cardId:plan.cardId}}}const debt=(integratedStore().liabilities as ScheduleRecord[]).find(x=>x.id===s.liabilityId);if(debt)debt.name=name})}
function requireCard(id:string):{s:ScheduleRecord;p:CardLedgerPlan}{const s=financeSchedules().find(x=>x.id===id),p=s&&cardV2(s);if(!s||!p)throw new Error('카드 구매 기록을 찾지 못했습니다.');return{s,p}}
async function saveCardBill(id:string,input:Record<string,unknown>,billId=''):Promise<string>{let key='';const ok=await cardCommit(()=>{
 const {s,p}=requireCard(id),old=p.bills.find(b=>b.id===billId);if(p.historyBaseline?.statements.some(x=>x.status==='paid'&&x.month===String(input.dueDate||'').slice(0,7)))throw new Error('이미 납부 확인된 과거 명세서는 다시 청구할 수 없습니다.');if(billId&&!old)throw new Error('청구 기록을 찾지 못했습니다.');if(old&&cardBillPaid(p,old))throw new Error('납부를 먼저 되돌린 뒤 청구 기록을 수정해 주세요.');
 const dueDate=cardDate(input.dueDate),issuedDate=cardDate(input.issuedDate,true),principal=cardMoney(input.principal),interest=cardMoney(input.interest??0),principalDiscount=cardMoney(input.principalDiscount??0),interestDiscount=cardMoney(input.interestDiscount??0);
 if(issuedDate<p.purchaseDate||dueDate<issuedDate||principalDiscount>principal||interestDiscount>interest||!principal&&!interest||p.bills.some(b=>b.id!==billId&&b.dueDate.slice(0,7)===dueDate.slice(0,7)))throw new Error('청구일·원금·이자·할인을 확인해 주세요. 같은 달의 명세서는 기존 건을 수정해 주세요.');
 const store=integratedStore();if(old){cardAssertLatestEvent(s,old.id);store.ledger=(store.ledger as ScheduleRecord[]).filter(x=>x.meta?.cardEventId!==old.id)}
 const reserved=p.bills.filter(b=>b.id!==billId&&!cardBillPaid(p,b)).reduce((sum,b)=>sum+b.principal-b.principalDiscount,0);if(principal>cardRemaining(s)-reserved)throw new Error('청구 원금 합계가 남은 카드 원금을 초과합니다.');
 key=billId||uid('card-bill');const bill:CardBill={id:key,dueDate,issuedDate,principal,interest,principalDiscount,interestDiscount,note:String(input.note||'').slice(0,300)};p.bills=p.bills.filter(b=>b.id!==key);p.bills.push(bill);
 if(principalDiscount){const original=cardOriginal(s)!;const rows=store.ledger as ScheduleRecord[];rows.push(cardPosting(s,issuedDate,'externalDebtPrincipal',principalDiscount,key,{cardCredit:'discount'}));rows.push({...cardPosting(s,issuedDate,'refund',principalDiscount,key,{refundOf:original.id,cardCredit:'discount'}),toAccountId:''})}
 });return ok?key:''}
function cardAssertLatestEvent(s:ScheduleRecord,eventId:string):void{const rows=cardRows(s).filter(x=>x.meta?.cardEventId),last=rows.at(-1);if(rows.some(x=>x.meta?.cardEventId===eventId)&&last?.meta?.cardEventId!==eventId)throw new Error('이후 카드 기록을 먼저 되돌린 뒤 수정·삭제해 주세요.');}
async function removeCardBill(id:string,billId:string):Promise<boolean>{return cardCommit(()=>{const {s,p}=requireCard(id),bill=p.bills.find(b=>b.id===billId);if(!bill||cardBillPaid(p,bill))throw new Error('납부 기록이 없는 청구만 삭제할 수 있습니다.');cardAssertLatestEvent(s,billId);integratedStore().ledger=(integratedStore().ledger as ScheduleRecord[]).filter(x=>x.meta?.cardEventId!==billId);p.bills=p.bills.filter(b=>b.id!==billId)})}
function cardPaymentRows(s:ScheduleRecord,date:string,principal:number,interest:number,pointsPrincipal:number,pointsInterest:number,eventId:string,bill:CardBill|null):ScheduleRecord[]{
 if(pointsPrincipal>principal||pointsInterest>interest)throw new Error('포인트가 해당 원금 또는 이자를 초과합니다.');
 const metadata:Record<string,unknown>={cardPayment:true,...(bill?{cardBillId:bill.id,scheduleId:s.id,scheduleDate:bill.dueDate,loanPrincipal:principal,loanInterest:interest,actualAmount:principal+interest,scheduledAmount:cardBillTotal(bill)}:{cardPayoff:true})},rows:ScheduleRecord[]=[];
 for(const [type,amount,cash,component] of [['debtPrincipal',principal-pointsPrincipal,true,'principal'],['externalDebtPrincipal',pointsPrincipal,false,'principal'],['debtInterest',interest-pointsInterest,true,'interest'],['debtInterestExternal',pointsInterest,false,'interest']] as const)if(amount)rows.push(cardPosting(s,date,type,amount,eventId,{...metadata,component,cardPoints:!cash},cash?'cash-main':''));return rows;
}
async function recordCardPayment(id:string,input:Record<string,unknown>):Promise<string>{let key='';const ok=await cardCommit(()=>{
 const {s,p}=requireCard(id),date=cardDate(input.date,true),payoff=input.kind==='payoff',bill=payoff?null:p.bills.find(b=>b.id===String(input.billId||''));
 if(date<p.purchaseDate||p.historyBaseline&&date<p.historyBaseline.asOf||!payoff&&!bill)throw new Error('납부일과 청구 기록을 확인해 주세요.');if(bill&&(cardBillPaid(p,bill)||date<bill.issuedDate))throw new Error('이미 납부했거나 명세서 확인일보다 이른 납부입니다.');
 const principal=payoff?cardMoney(input.principal):bill!.principal-bill!.principalDiscount,interest=payoff?cardMoney(input.interest??0):bill!.interest-bill!.interestDiscount,pointsPrincipal=cardMoney(input.pointsPrincipal??0),pointsInterest=cardMoney(input.pointsInterest??0);
 if(payoff&&(principal!==cardRemaining(s,date)||principal<=0)||principal>cardRemaining(s,date))throw new Error('남은 원금과 상환 원금을 확인해 주세요.');
 key=uid('card-payment');const rows=cardPaymentRows(s,date,principal,interest,pointsPrincipal,pointsInterest,key,bill||null),cash=principal+interest-pointsPrincipal-pointsInterest;(integratedStore().ledger as ScheduleRecord[]).push(...rows);
 p.payments.push({id:key,billId:bill?.id||'',date,kind:payoff?'payoff':'bill',principal,interest,pointsPrincipal,pointsInterest,cash,rowIds:rows.map(x=>x.id)});if(payoff)for(const b of p.bills)if(!cardBillPaid(p,b))b.settledBy=key;
 });return ok?key:''}
async function removeCardPayment(id:string,paymentId:string):Promise<boolean>{return cardCommit(()=>{const {s,p}=requireCard(id),payment=p.payments.find(x=>x.id===paymentId);if(!payment||p.payments.at(-1)?.id!==paymentId)throw new Error('마지막 납부부터 되돌려 주세요.');cardAssertLatestEvent(s,paymentId);integratedStore().ledger=(integratedStore().ledger as ScheduleRecord[]).filter(x=>x.meta?.cardEventId!==paymentId);p.payments=p.payments.filter(x=>x.id!==paymentId);for(const b of p.bills)if(b.settledBy===paymentId)delete b.settledBy})}
function cardInterestRefundRows(s:ScheduleRecord,date:string,eventId:string,cash:number,points:number):ScheduleRecord[]{
 const all=cardRows(s),out:ScheduleRecord[]=[];for(const [type,amount] of [['debtInterest',cash],['debtInterestExternal',points]] as const){let left=amount;for(const original of all.filter(x=>x.type===type&&String(x.date)<=date)){const used=all.filter(x=>x.type==='refund'&&x.meta?.refundOf===original.id).reduce((sum,x)=>sum+Number(x.amount||0),0),part=Math.min(left,Number(original.amount||0)-used);if(part>0){out.push({...cardPosting(s,date,'refund',part,eventId,{refundOf:original.id,cardInterestRefund:true,cardCashRefund:type==='debtInterest',cardPointsRefund:type==='debtInterestExternal',cardCredit:'refund'},type==='debtInterest'?'cash-main':''),fixed:true,...(type==='debtInterestExternal'?{toAccountId:''}:{})});left-=part}if(!left)break}if(left)throw new Error('돌려받은 이자·포인트가 실제 납부한 이자를 초과합니다.')}return out;
}
async function recordCardRefund(id:string,input:Record<string,unknown>):Promise<string>{let key='';const ok=await cardCommit(()=>{const {s,p}=requireCard(id),date=cardDate(input.date,true),amount=cardMoney(input.amount??0),interestCash=cardMoney(input.interestCashAmount??0),interestPoints=cardMoney(input.interestPointsAmount??0),original=cardOriginal(s);if(!original||date<p.purchaseDate||!amount&&!interestCash&&!interestPoints)throw new Error('환불 금액과 날짜를 확인해 주세요.');const refunded=cardRows(s).filter(x=>x.type==='refund'&&!x.meta?.cardInterestRefund).reduce((sum,x)=>sum+Number(x.amount||0),0);if(amount+refunded>p.purchaseAmount)throw new Error('환불·할인 합계가 구매금액을 초과합니다.');const cash=cardMoney(input.cashAmount??0),points=cardMoney(input.pointsAmount??0),debt=amount-cash-points,remaining=Math.max(0,cardRemaining(s,date)),paidCash=p.payments.filter(x=>x.date<=date).reduce((sum,x)=>sum+x.principal-x.pointsPrincipal,0),paidPoints=p.payments.filter(x=>x.date<=date).reduce((sum,x)=>sum+x.pointsPrincipal,0),refundedCash=cardRows(s).filter(x=>x.type==='refund'&&x.meta?.cardCashRefund&&!x.meta?.cardInterestRefund).reduce((sum,x)=>sum+Number(x.amount||0),0),refundedPoints=cardRows(s).filter(x=>x.type==='refund'&&x.meta?.cardPointsRefund&&!x.meta?.cardInterestRefund).reduce((sum,x)=>sum+Number(x.amount||0),0);if(debt<0||debt>remaining||cash+refundedCash>paidCash||points+refundedPoints>paidPoints)throw new Error('환불의 현금·포인트·미납 원금 구분을 확인해 주세요.');key=uid('card-refund');const interestRows=cardInterestRefundRows(s,date,key,interestCash,interestPoints),rows=integratedStore().ledger as ScheduleRecord[];rows.push(...interestRows);if(debt){rows.push(cardPosting(s,date,'externalDebtPrincipal',debt,key,{cardCredit:'refund'}));rows.push({...cardPosting(s,date,'refund',debt,key,{refundOf:original.id,cardCredit:'refund'}),toAccountId:''})}if(cash)rows.push(cardPosting(s,date,'refund',cash,key,{refundOf:original.id,cardCashRefund:true,cardCredit:'refund'},'cash-main'));if(points)rows.push({...cardPosting(s,date,'refund',points,key,{refundOf:original.id,cardPointsRefund:true,cardCredit:'refund'}),toAccountId:''})});return ok?key:''}
async function removeCardRefund(id:string,eventId:string):Promise<boolean>{return cardCommit(()=>{const {s}=requireCard(id);if(!cardRows(s).some(x=>x.meta?.cardEventId===eventId&&x.meta?.cardCredit==='refund'))throw new Error('환불 기록을 찾지 못했습니다.');cardAssertLatestEvent(s,eventId);integratedStore().ledger=(integratedStore().ledger as ScheduleRecord[]).filter(x=>x.meta?.cardEventId!==eventId)})}

// Pure boundary validation also runs before startup migration and backup restore.
function cardLedgerDataIssue(data:Record<string,unknown>):string{
 const record=(x:unknown):Record<string,unknown>=>x&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:{},money=(x:unknown)=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0,date=(x:unknown)=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
 const settings=record(data.settings),cards=settings.cardAccounts,cardIds=new Set<string>();
 if(cards!==undefined){if(!Array.isArray(cards))return'카드 목록은 배열이어야 합니다.';for(const raw of cards){const c=record(raw),id=String(c.id||'');if(!id||cardIds.has(id)||typeof c.name!=='string'||!c.name||!Number.isInteger(c.paymentDay)||Number(c.paymentDay)<1||Number(c.paymentDay)>31||c.lastFour&&!/^\d{4}$/.test(String(c.lastFour))||c.statementDay!==undefined&&(!Number.isInteger(c.statementDay)||Number(c.statementDay)<1||Number(c.statementDay)>31))return'카드 이름·ID·결제일 형식이 잘못되었습니다.';cardIds.add(id)}}
 const schedules=record(data.financeSchedules).items,ledger=record(data.integrated).ledger;if(!Array.isArray(schedules))return'';const rows=Array.isArray(ledger)?ledger.map(record):[],ids=new Set<string>();
 for(const raw of schedules){const s=record(raw),p=record(s.cardPlan);if(p.ledgerVersion!==2)continue;
  if(!cardIds.has(String(p.cardId))||!date(p.purchaseDate)||!date(p.firstPaymentDate)||String(p.firstPaymentDate)<String(p.purchaseDate)||!money(p.purchaseAmount)||!p.purchaseAmount||!money(p.grossAmount)||!money(p.purchaseDiscount)||Number(p.grossAmount)-Number(p.purchaseDiscount)!==p.purchaseAmount||!Number.isInteger(p.months)||Number(p.months)<1||Number(p.months)>60||!['free','paid','partial'].includes(String(p.interestMode))||!Number.isFinite(p.annualRate)||Number(p.annualRate)<0||Number(p.annualRate)>100||!Array.isArray(p.paidInterestRounds)||p.paidInterestRounds.some(n=>!Number.isInteger(n)||Number(n)<1||Number(n)>Number(p.months))||!Array.isArray(p.bills)||!Array.isArray(p.payments))return'카드 구매 조건 또는 청구·납부 원장 형식이 잘못되었습니다.';
  const linked=rows.filter(x=>record(x.meta).cardPlanId===s.id),original=linked.filter(x=>record(x.meta).cardPurchase===true),opening=linked.filter(x=>x.type==='openingLiability'),baseline=p.historyBaseline as CardHistoryBaseline|undefined;
  if(baseline){const issue=cardHistoryIssue(baseline,Number(p.purchaseAmount),String(p.purchaseDate),Number(p.months));if(issue)return issue;if(ids.has('history:'+baseline.sourceKey))return'과거 카드 출처가 중복되었습니다.';ids.add('history:'+baseline.sourceKey)}
  const openingAmount=baseline?.remainingPrincipal??p.purchaseAmount;
  if(original.length!==1||original[0].amount!==p.purchaseAmount||opening.length!==(openingAmount?1:0)||openingAmount&&(opening[0].amount!==openingAmount||opening[0].liabilityId!==s.liabilityId||baseline&&opening[0].date!==baseline.asOf)||baseline&&record(original[0].meta).cardHistoricalPurchase!==!baseline.includeSpending)return'카드 구매·원금 연결이 일치하지 않습니다.';
  const bills=p.bills.map(record),billIds=new Set<string>(),months=new Set<string>();let billedPrincipal=0;
  for(const b of bills){const key=String(b.id||''),month=String(b.dueDate).slice(0,7);if(!key||ids.has(key)||months.has(month)||!date(b.dueDate)||!date(b.issuedDate)||String(b.issuedDate)<String(p.purchaseDate)||String(b.dueDate)<String(b.issuedDate)||['principal','interest','principalDiscount','interestDiscount'].some(k=>!money(b[k]))||Number(b.principalDiscount)>Number(b.principal)||Number(b.interestDiscount)>Number(b.interest)||!Number.isSafeInteger(Number(b.principal)+Number(b.interest)))return'카드 청구 금액·날짜·ID가 잘못되었습니다.';ids.add(key);billIds.add(key);months.add(month);billedPrincipal+=Number(b.principal);const credit=linked.filter(x=>record(x.meta).cardEventId===key),principalCredit=credit.filter(x=>x.type==='externalDebtPrincipal').reduce((sum,x)=>sum+Number(x.amount||0),0),refundCredit=credit.filter(x=>x.type==='refund'&&record(x.meta).refundOf===original[0].id).reduce((sum,x)=>sum+Number(x.amount||0),0);if(principalCredit!==b.principalDiscount||refundCredit!==b.principalDiscount)return'카드 청구할인과 원금·소비 연결이 일치하지 않습니다.'}
  if(billedPrincipal>Number(p.purchaseAmount))return'카드 청구 원금 합계가 구매 원금을 초과합니다.';
  const paidBills=new Set<string>(),paymentIds=new Set<string>();
  for(const rawPayment of p.payments){const pay=record(rawPayment),key=String(pay.id||''),billId=String(pay.billId||'');if(!key||ids.has(key)||!date(pay.date)||String(pay.date)<String(p.purchaseDate)||baseline&&String(pay.date)<baseline.asOf||!['bill','payoff'].includes(String(pay.kind))||['principal','interest','pointsPrincipal','pointsInterest','cash'].some(k=>!money(pay[k]))||Number(pay.pointsPrincipal)>Number(pay.principal)||Number(pay.pointsInterest)>Number(pay.interest)||pay.cash!==Number(pay.principal)+Number(pay.interest)-Number(pay.pointsPrincipal)-Number(pay.pointsInterest)||!Array.isArray(pay.rowIds)||!Number.isSafeInteger(Number(pay.principal)+Number(pay.interest)))return'카드 납부 금액·날짜·ID가 잘못되었습니다.';ids.add(key);paymentIds.add(key);if(pay.kind==='bill'){const b=bills.find(x=>x.id===billId);if(!b||paidBills.has(billId)||String(pay.date)<String(b.issuedDate)||pay.principal!==Number(b.principal)-Number(b.principalDiscount)||pay.interest!==Number(b.interest)-Number(b.interestDiscount))return'카드 납부와 실제 청구 연결이 일치하지 않습니다.';paidBills.add(billId)}else if(billId)return'전액 상환을 특정 회차 납부로 저장할 수 없습니다.';
   const postings=linked.filter(x=>record(x.meta).cardEventId===key);if(postings.length!==pay.rowIds.length||postings.some(x=>!(pay.rowIds as unknown[]).includes(x.id)||x.date!==pay.date))return'카드 납부와 금융 원장 연결이 누락되었습니다.';const sum=(type:string)=>postings.filter(x=>x.type===type).reduce((n,x)=>n+Number(x.amount||0),0);if(sum('debtPrincipal')!==Number(pay.principal)-Number(pay.pointsPrincipal)||sum('externalDebtPrincipal')!==pay.pointsPrincipal||sum('debtInterest')!==Number(pay.interest)-Number(pay.pointsInterest)||sum('debtInterestExternal')!==pay.pointsInterest)return'카드 현금·포인트 납부와 원장이 일치하지 않습니다.';
  }
  for(const b of bills)if(b.settledBy&&!p.payments.some(raw=>{const pay=record(raw);return pay.id===b.settledBy&&pay.kind==='payoff'}))return'카드 청구의 전액 상환 연결이 없습니다.';
 }
 return'';
}
