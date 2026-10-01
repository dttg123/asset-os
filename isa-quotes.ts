'use strict';

type IsaQuoteRecord=Record<string,any>;
type IsaQuoteRefreshResult=IsaQuoteRecord&{ok:boolean};

declare const QA_MODE:boolean;
declare const brokerKisClient:{quotes:(links:IsaQuoteRecord[])=>Promise<IsaQuoteRefreshResult>};
declare function currentAccount():IsaQuoteRecord|null;
declare function clone<T>(value:T):T;
declare function persist(immediate?:boolean):boolean;
declare function renderKeepingScroll():void;
declare function toast(message:string):void;

let isaQuoteRefreshPromise:Promise<IsaQuoteRefreshResult>|null=null;

function isaQuoteLinks(a:IsaQuoteRecord|null=currentAccount()):IsaQuoteRecord[]{
 return (a?.holdings||[])
  .filter((h:IsaQuoteRecord)=>h.lifecycleStatus!=='archived'&&h.quoteSource==='kis'&&h.instrumentCode&&['stock','bond'].includes(h.quoteType))
  .map((h:IsaQuoteRecord)=>({holdingId:h.id,type:h.quoteType,code:String(h.instrumentCode).trim().toUpperCase()}))
}

function applyIsaQuoteResults(a:IsaQuoteRecord,quotes:IsaQuoteRecord[],fetchedAt:string){
 const before={
  cash:a.baselineCash,
  transactions:JSON.stringify(a.transactions||[]),
  positions:(a.holdings||[]).map((h:IsaQuoteRecord)=>[h.id,h.baselineQty,h.baselineAvg] as [string,unknown,unknown])
 };
 const byKey=new Map<string,IsaQuoteRecord>((quotes||[]).map((q:IsaQuoteRecord)=>[`${q.type}:${String(q.code||'').toUpperCase()}`,q]));
 let updated=0;
 for(const h of a.holdings||[]){
  const quote=byKey.get(`${h.quoteType}:${String(h.instrumentCode||'').toUpperCase()}`);
  if(!quote||!(Number(quote.price)>0))continue;
  h.currentPrice=Number(quote.price);
  h.quoteUpdatedAt=fetchedAt||new Date().toISOString();
  h.quoteStatus='ok';
  h.quoteError='';
  updated++
 }
 const unchanged=before.cash===a.baselineCash&&before.transactions===JSON.stringify(a.transactions||[])&&before.positions.every(([id,qty,avg]:[string,unknown,unknown])=>{
  const h=a.holdings.find((x:IsaQuoteRecord)=>x.id===id);
  return h&&h.baselineQty===qty&&h.baselineAvg===avg
 });
 const linked=isaQuoteLinks(a).length;
 return{ok:unchanged,updated,missing:Math.max(0,linked-updated),error:unchanged?'':'QUOTE_MUTATED_FIXED_DATA'}
}

async function refreshIsaQuotes({manual=false}:{manual?:boolean}={}):Promise<IsaQuoteRefreshResult>{
 const a=currentAccount();
 if(!a)return{ok:false,error:'ISA_ACCOUNT_MISSING'};
 const links=isaQuoteLinks(a);
 if(!links.length)return{ok:false,error:'ISA_QUOTES_NOT_LINKED'};
 if(isaQuoteRefreshPromise)return isaQuoteRefreshPromise;
 isaQuoteRefreshPromise=(async()=>{
  const result=QA_MODE
   ?{ok:true,data:{quotes:links.map((x:IsaQuoteRecord)=>({...x,price:Number(a.holdings.find((h:IsaQuoteRecord)=>h.id===x.holdingId)?.currentPrice)||1})),fetchedAt:new Date().toISOString()}}
   :await brokerKisClient.quotes(links.map(({type,code}:IsaQuoteRecord)=>({type,code})));
  if(!result.ok)return result;
  const snapshot=clone(a),applied=applyIsaQuoteResults(a,result.data.quotes,result.data.fetchedAt);
  if(!applied.ok){Object.assign(a,snapshot);return applied}
  if(!persist(false)){Object.assign(a,snapshot);return{ok:false,error:'PERSIST_FAILED'}}
  if(manual){
   renderKeepingScroll();
   toast(applied.missing?`현재가 ${applied.updated}개 갱신 · ${applied.missing}개 미갱신`:`현재가 ${applied.updated}개 갱신 · 수량·매입가 유지`)
  }
  return{ok:true,updated:applied.updated,missing:applied.missing,fetchedAt:result.data.fetchedAt}
 })().catch((error:unknown)=>({ok:false,error:String(error instanceof Error?error.message:'QUOTE_REFRESH_FAILED')})).finally(()=>{isaQuoteRefreshPromise=null});
 return isaQuoteRefreshPromise
}

document.addEventListener('click',async event=>{
 const button=(event.target as Element|null)?.closest?.('[data-isa-quote-refresh]') as HTMLButtonElement|null;
 if(!button)return;
 button.disabled=true;
 button.textContent='조회 중';
 const result=await refreshIsaQuotes({manual:true});
 if(!result.ok){
  button.disabled=false;
  button.textContent='갱신';
  toast(result.error==='BROKER_AUTH_REQUIRED'?'한국투자 연결 로그인이 필요합니다.':`현재가 갱신 실패 · ${result.error}`)
 }
})
