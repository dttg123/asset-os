'use strict';
type SubscriptionCycle='monthly'|'annual'|'irregular'|'unknown';
type SubscriptionStatus='active'|'ending'|'ended'|'unknown';
type SubscriptionEvent={id:string;date:string;action:string;transactionId?:string;note?:string};
type SubscriptionItem={id:string;name:string;amount:number|null;cycle:SubscriptionCycle;status:SubscriptionStatus;nextDate:string;endDate:string;cancelledAt:string;manageUrl:string;events:SubscriptionEvent[]};
type SubscriptionRule={id:string;subscriptionId:string;merchant:string;method:string;amount:number;enabled:boolean};
type SubscriptionNotice={id:string;subscriptionId:string;transactionId:string;kind:'after-end'|'price-change'|'multiple-matches';status:'pending'|'resolved';resolution:string};
type SubscriptionRegistry={version:1;items:SubscriptionItem[];rules:SubscriptionRule[];notices:SubscriptionNotice[];ignored:string[]};
type SubscriptionTransaction={id:string;date:string;type:string;amount:number;category?:string;meta:Record<string,unknown>;[key:string]:unknown};
declare function setting():Record<string,unknown>;
declare function integratedStore():{ledger:SubscriptionTransaction[]};
declare function localYmd():string;
declare function uid(prefix:string):string;
declare function persist(notify?:boolean):Promise<boolean>;
declare function runStoredCommand<T>(fn:()=>Promise<T>):Promise<T>;
declare function clone<T>(value:T):T;

function subscriptionObject(raw:unknown):Record<string,unknown>{return raw!==null&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:{};}
function subscriptionDate(raw:unknown):string{const s=String(raw||'');return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s?s:'';}
function subscriptionNormalize(raw:unknown):SubscriptionRegistry{
 const source=subscriptionObject(raw),seen=new Set<string>();
 const items:SubscriptionItem[]=(Array.isArray(source.items)?source.items:[]).map(value=>{
  const s=subscriptionObject(value),amount=Number(s.amount),events=(Array.isArray(s.events)?s.events:[]).map(value=>{const e=subscriptionObject(value);return{id:String(e.id||''),date:subscriptionDate(e.date),action:String(e.action||''),transactionId:String(e.transactionId||''),note:String(e.note||'')};});
  return{id:String(s.id||''),name:String(s.name||'').slice(0,100),amount:s.amount!==null&&s.amount!==''&&Number.isSafeInteger(amount)&&amount>0?amount:null,cycle:(['monthly','annual','irregular','unknown'].includes(String(s.cycle))?s.cycle:'unknown') as SubscriptionCycle,status:(['active','ending','ended','unknown'].includes(String(s.status))?s.status:'unknown') as SubscriptionStatus,nextDate:subscriptionDate(s.nextDate),endDate:subscriptionDate(s.endDate),cancelledAt:subscriptionDate(s.cancelledAt),manageUrl:subscriptionSafeUrl(s.manageUrl),events};
 }).filter(s=>{if(!s.id||!s.name||seen.has(s.id))return false;seen.add(s.id);return true;});
 const ids=new Set(items.map(s=>s.id));
 const rules:SubscriptionRule[]=(Array.isArray(source.rules)?source.rules:[]).map(value=>{const s=subscriptionObject(value);return{id:String(s.id||''),subscriptionId:String(s.subscriptionId||''),merchant:String(s.merchant||''),method:String(s.method||''),amount:Number(s.amount),enabled:s.enabled===true};}).filter(r=>r.id&&ids.has(r.subscriptionId)&&r.merchant&&Number.isSafeInteger(r.amount)&&r.amount>0);
 const notices:SubscriptionNotice[]=(Array.isArray(source.notices)?source.notices:[]).map(value=>{const s=subscriptionObject(value);return{id:String(s.id||''),subscriptionId:String(s.subscriptionId||''),transactionId:String(s.transactionId||''),kind:(['after-end','price-change','multiple-matches'].includes(String(s.kind))?s.kind:'multiple-matches') as SubscriptionNotice['kind'],status:(s.status==='resolved'?'resolved':'pending') as SubscriptionNotice['status'],resolution:String(s.resolution||'')};}).filter(n=>n.id&&ids.has(n.subscriptionId));
 return{version:1,items,rules,notices:[...new Map(notices.map(n=>[n.id,n])).values()],ignored:Array.isArray(source.ignored)?source.ignored.filter((v):v is string=>typeof v==='string'):[]};
}
function subscriptionSafeUrl(raw:unknown):string{try{const u=new URL(String(raw||''));return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}}
function subscriptionStore():SubscriptionRegistry{return subscriptionNormalize(setting().subscriptionRegistry);}
function subscriptionPut(store:SubscriptionRegistry):void{setting().subscriptionRegistry=subscriptionNormalize(store);}
function subscriptionFind(id:string):SubscriptionItem|undefined{return subscriptionStore().items.find(s=>s.id===id);}
function subscriptionMerchant(t:SubscriptionTransaction):string{return String(t.meta?.merchant||t.meta?.spendingItem||t.note||'').trim();}
function subscriptionSharedMerchant(name:string):boolean{return /구글|google|페이레터|payletter|카카오|네이버|naver|kcp|모빌리언스|이니시스|토스페이먼츠|자동결제|내통장|다날|더즌|원스토어|alipay|pingpong|카페24/i.test(name);}
function subscriptionRows(id:string):SubscriptionTransaction[]{return integratedStore().ledger.filter(t=>t.meta?.subscriptionId===id||t.type==='refund'&&integratedStore().ledger.find(p=>p.id===t.meta?.refundOf)?.meta?.subscriptionId===id).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));}
function subscriptionCurrentStatus(s:SubscriptionItem,today=localYmd()):SubscriptionStatus{return s.endDate&&s.endDate<today&&['active','ending'].includes(s.status)?'ended':s.status;}
function subscriptionTotals(today=localYmd()):{monthly:number;monthlyCount:number;annual:number;annualCount:number;unknownCount:number}{
 const result={monthly:0,monthlyCount:0,annual:0,annualCount:0,unknownCount:0};
 for(const s of subscriptionStore().items){const status=subscriptionCurrentStatus(s,today);if(status==='unknown'){result.unknownCount++;continue;}if(status!=='active')continue;if(s.amount===null||!['monthly','annual'].includes(s.cycle)){result.unknownCount++;continue;}if(s.cycle==='monthly'){result.monthly+=s.amount;result.monthlyCount++;}if(s.cycle==='annual'){result.annual+=s.amount;result.annualCount++;}}
 return result;
}
function subscriptionAddNotice(store:SubscriptionRegistry,s:SubscriptionItem,t:SubscriptionTransaction,kind:SubscriptionNotice['kind']):void{const id='subscription:'+kind+':'+s.id+':'+t.id;if(!store.notices.some(n=>n.id===id))store.notices.push({id,subscriptionId:s.id,transactionId:t.id,kind,status:'pending',resolution:''});}
function subscriptionSyncTransactions():void{
 const original=setting().subscriptionRegistry;if(!original)return;
 const store=subscriptionStore();
 for(const t of integratedStore().ledger){
  if(!['expense','externalExpense'].includes(t.type)||t.meta?.qaFixture||t.meta?.subscriptionId)continue;
  const rules=store.rules.filter(r=>r.enabled&&r.merchant===subscriptionMerchant(t)&&r.method===String(t.meta?.banksaladMethod||'')&&!subscriptionSharedMerchant(r.merchant));
  const byId=[...new Set(rules.map(r=>r.subscriptionId))].filter(id=>!store.ignored.includes(id+':'+t.id));
  if(!byId.length)continue;
  const exact=byId.filter(id=>rules.some(r=>r.subscriptionId===id&&r.amount===t.amount));
  if(exact.length!==1){for(const id of exact.length?exact:byId){const s=store.items.find(s=>s.id===id);if(s)subscriptionAddNotice(store,s,t,exact.length?'multiple-matches':'price-change');}continue;}
  const s=store.items.find(s=>s.id===exact[0]);if(!s)continue;
  const status=subscriptionCurrentStatus(s);
  if(status==='unknown'){subscriptionAddNotice(store,s,t,'multiple-matches');continue;}
  // A historical import does not prove reactivation. Only dates after a known cancellation
  // or expiry can trigger a post-termination charge; undated ended subscriptions need review.
  if(status==='ended'||status==='ending'){
   const boundary=s.endDate||s.cancelledAt;
   if(!boundary||t.date>boundary){subscriptionAddNotice(store,s,t,'after-end');continue;}
  }
  t.meta={...t.meta,subscriptionId:s.id,subscriptionLinkedBy:'approved-rule'};
 }
 subscriptionPut(store);
}
async function subscriptionCommit(change:()=>void):Promise<boolean>{return runStoredCommand(async()=>{const beforeRegistry=setting().subscriptionRegistry===undefined?undefined:clone(setting().subscriptionRegistry),beforeLedger=clone(integratedStore().ledger);try{change();const ok=await persist(false);if(!ok){setting().subscriptionRegistry=beforeRegistry;integratedStore().ledger=beforeLedger;}return ok;}catch(error){setting().subscriptionRegistry=beforeRegistry;integratedStore().ledger=beforeLedger;throw error;}});}
function subscriptionSaveItem(input:Partial<SubscriptionItem>):string{
 const store=subscriptionStore(),id=input.id||uid('subscription'),previous=store.items.find(s=>s.id===id);
 const name=String(input.name||'').trim();if(!name||name.length>100)throw new Error('서비스 이름을 입력해 주세요.');
 if(input.amount!==null&&input.amount!==undefined&&(!Number.isSafeInteger(input.amount)||input.amount<=0))throw new Error('요금은 0원보다 큰 원 단위로 입력해 주세요.');
 for(const key of ['nextDate','endDate','cancelledAt'] as const)if(input[key]&&!subscriptionDate(input[key]))throw new Error('날짜를 확인해 주세요.');
 if(input.manageUrl&&!subscriptionSafeUrl(input.manageUrl))throw new Error('구독 관리 주소는 https 주소로 입력해 주세요.');
 const merged={id,name,amount:null,cycle:'unknown',status:'unknown',nextDate:'',endDate:'',cancelledAt:'',manageUrl:'',events:[],...previous,...input} as SubscriptionItem;
 const normalized=subscriptionNormalize({items:[merged]}).items[0];if(!normalized)throw new Error('구독 정보를 확인해 주세요.');
 store.items=store.items.filter(s=>s.id!==id);store.items.push(normalized);subscriptionPut(store);return id;
}
function subscriptionLink(id:string,transactionIds:string[],learn=false):void{
 const store=subscriptionStore(),s=store.items.find(s=>s.id===id);if(!s)throw new Error('구독을 찾지 못했어요.');
 const selected=integratedStore().ledger.filter(t=>transactionIds.includes(t.id));if(selected.length!==new Set(transactionIds).size||!selected.length)throw new Error('연결할 거래를 선택해 주세요.');
 for(const t of selected){if(!['expense','externalExpense'].includes(t.type)||t.meta?.cardHistoricalPurchase||t.meta?.subscriptionId&&t.meta.subscriptionId!==id)throw new Error('다른 구독에 연결됐거나 연결할 수 없는 거래가 있어요.');if(learn&&subscriptionSharedMerchant(subscriptionMerchant(t)))throw new Error('결제대행사 명의는 자동 연결 규칙으로 사용할 수 없어요.');}
 for(const t of selected){t.meta={...t.meta,subscriptionId:id,subscriptionLinkedBy:'user'};store.ignored=store.ignored.filter(key=>key!==id+':'+t.id);if(learn){const merchant=subscriptionMerchant(t),method=String(t.meta.banksaladMethod||''),key=JSON.stringify([id,merchant,method,t.amount]);if(!store.rules.some(r=>r.id===key))store.rules.push({id:key,subscriptionId:id,merchant,method,amount:t.amount,enabled:true});}}
 subscriptionPut(store);
}
function subscriptionUnlink(id:string,transactionId:string):void{const store=subscriptionStore(),t=integratedStore().ledger.find(t=>t.id===transactionId&&t.meta?.subscriptionId===id);if(!t)return;delete t.meta.subscriptionId;delete t.meta.subscriptionLinkedBy;const key=id+':'+t.id;if(!store.ignored.includes(key))store.ignored.push(key);subscriptionPut(store);}
function subscriptionChangeStatus(id:string,status:SubscriptionStatus,date:string,endDate=''):void{
 const store=subscriptionStore(),s=store.items.find(s=>s.id===id);if(!s)throw new Error('구독을 찾지 못했어요.');if(!subscriptionDate(date)||date>localYmd())throw new Error('변경 날짜를 확인해 주세요.');if(endDate&&!subscriptionDate(endDate))throw new Error('이용 종료일을 확인해 주세요.');if(status==='ending'&&endDate&&endDate<date)throw new Error('남은 이용기간을 확인해 주세요.');
 s.status=status;if(status==='ended'||status==='ending'){s.cancelledAt=date;s.nextDate='';s.endDate=endDate|| (status==='ended'?date:s.endDate);}else if(status==='active'){s.cancelledAt='';s.endDate=endDate;}
 s.events.push({id:uid('subscription-event'),date,action:status});subscriptionPut(store);
}
function subscriptionResolveNotice(noticeId:string,resolution:'rejoin'|'charged'|'other'|'price-confirmed'):void{
 const store=subscriptionStore(),n=store.notices.find(n=>n.id===noticeId),s=store.items.find(s=>s.id===n?.subscriptionId),t=integratedStore().ledger.find(t=>t.id===n?.transactionId);if(!n||!s||!t||n.status==='resolved')return;
 if(resolution==='other'){store.ignored.push(s.id+':'+t.id);}else{t.meta={...t.meta,subscriptionId:s.id,subscriptionLinkedBy:'notification-confirmed'};if(resolution==='rejoin'){s.status='active';s.cancelledAt='';s.endDate='';s.nextDate='';s.events.push({id:uid('subscription-event'),date:t.date,action:'rejoin',transactionId:t.id});}if(resolution==='price-confirmed'){s.amount=t.amount;for(const r of store.rules.filter(r=>r.subscriptionId===s.id&&r.merchant===subscriptionMerchant(t)))r.amount=t.amount;}}
 n.status='resolved';n.resolution=resolution;subscriptionPut(store);
}
function subscriptionPendingNotices():SubscriptionNotice[]{const ids=new Set(integratedStore().ledger.map(t=>t.id));return subscriptionStore().notices.filter(n=>n.status==='pending'&&ids.has(n.transactionId));}
