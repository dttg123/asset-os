'use strict';

type IntegratedRow={id:string;type:string;date?:string;sequence?:number;createdAt?:string;amount?:number;fixed?:boolean;category?:string;note?:string;sourceModule?:string;sourceId?:string;productId?:string;meta?:Record<string,unknown>;[key:string]:unknown};
type IntegratedAccount={id:string;kind:string;name:string;productId?:string;[key:string]:unknown};
type IntegratedLiability={id:string;kind:string;name:string;productId?:string;[key:string]:unknown};
type IntegratedStoreShape={mode?:string;label?:string;startedAt?:string;accounts:IntegratedAccount[];liabilities:IntegratedLiability[];ledger:IntegratedRow[]};
type LedgerIndexedAccount={transactions?:IntegratedRow[];ledgerIndex?:Record<string,string[]>;contributionLedger?:string[];cashLedger?:string[];securityLedger?:string[];adjustmentLedger?:string[];[key:string]:unknown};

declare const seed:{integrated:IntegratedStoreShape};
declare function clone<T>(value:T):T;
declare function ymd(value?:Date|string):string;

function rebuildLedgerIndexes(a:LedgerIndexedAccount){
 const ids:{contribution:string[];cash:string[];security:string[];adjustment:string[];income:string[];corporateAction:string[]}={contribution:[],cash:[],security:[],adjustment:[],income:[],corporateAction:[]};
 for(const t of a.transactions||[]){
  if(['deposit','internalTransferIn','depositReversal'].includes(t.type))ids.contribution.push(t.id);
  if(['deposit','internalTransferIn','depositReversal','withdrawal','internalTransferOut','buy','sell','openingAllocation','dividend','distribution','interest','feeRefund','taxRefund'].includes(t.type))ids.cash.push(t.id);
  if(['buy','sell','openingAllocation','securityTransferIn','securityTransferOut'].includes(t.type))ids.security.push(t.id);
  if(t.type==='adjustment')ids.adjustment.push(t.id);
  if(['dividend','distribution','interest'].includes(t.type))ids.income.push(t.id);
  if(['split','reverseSplit','merger','delisting'].includes(t.type))ids.corporateAction.push(t.id);
 }
 a.ledgerIndex=ids;
 a.contributionLedger=[...ids.contribution];a.cashLedger=[...ids.cash];a.securityLedger=[...ids.security];a.adjustmentLedger=[...ids.adjustment];
 return a
}

function normalizeIntegrated(input:unknown):IntegratedStoreShape{
 const src:IntegratedStoreShape=input&&typeof input==='object'?clone(input as IntegratedStoreShape):clone(seed.integrated),base=clone(seed.integrated);
 const out:IntegratedStoreShape={mode:'live',label:String(src.label||base.label),startedAt:/^\d{4}-\d{2}-\d{2}$/.test(String(src.startedAt||''))?String(src.startedAt):'',accounts:Array.isArray(src.accounts)?src.accounts:base.accounts,liabilities:Array.isArray(src.liabilities)?src.liabilities:base.liabilities,ledger:Array.isArray(src.ledger)?src.ledger:base.ledger};
 const allowedKinds=new Set(['cash','deposit','savings','parking','isa','pension','irp','other']);
 out.accounts=out.accounts.map((a,i)=>({...a,id:String(a.id||`integrated-account-${i+1}`),kind:allowedKinds.has(a.kind)?a.kind:'other',name:String(a.name||`자산 ${i+1}`),productId:String(a.productId||'')}));
 out.liabilities=out.liabilities.map((x,i)=>({...x,id:String(x.id||`integrated-liability-${i+1}`),kind:x.kind==='loan'?'loan':'other',name:String(x.name||`부채 ${i+1}`),productId:String(x.productId||'')}));
 const perDate:Record<string,number>={};out.ledger=out.ledger.map((t,i)=>{const date=String(t.date||ymd());perDate[date]=(perDate[date]||0)+1;const sequence=Number.isFinite(Number(t.sequence))?Number(t.sequence):perDate[date],createdAt=String(t.createdAt||`${date}T00:00:00.${String(Math.min(999,perDate[date])).padStart(3,'0')}`);return{...t,id:String(t.id||`integrated-ledger-${i+1}`),date,type:String(t.type||''),amount:Number(t.amount)||0,fixed:!!t.fixed,category:String(t.category||''),note:String(t.note||''),sourceModule:String(t.sourceModule||''),sourceId:String(t.sourceId||''),productId:String(t.productId||''),sequence,createdAt,meta:t.meta&&typeof t.meta==='object'?clone(t.meta):{}}});
 for(const link of base.accounts.filter(a=>['cash','isa','pension','irp'].includes(a.kind)))if(!out.accounts.some(a=>a.id===link.id))out.accounts.push(clone(link));
 return out
}
