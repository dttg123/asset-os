'use strict';
function normalizeInvestmentRole(value,h=null){
 const v=String(value||'');if(INVESTMENT_ROLES.includes(v))return v;
 const legacy={방어:'안정',테마:'성장','현금성 자산':'현금'};if(legacy[v])return legacy[v];
 const text=`${h?.name||''} ${h?.assetClass||''} ${h?.productType||''}`.toLowerCase();
 if(/현금성|머니|kofr|cd금리|mmf|cash/.test(text))return'현금';
 if(/커버드|인컴|월배당|리츠|부동산|인프라|income|reit/.test(text))return'현금흐름';
 if(/배당|dividend|퀄리티/.test(text))return'배당';
 if(/채권|국고채|국채|회사채|bond|골드|금\b/.test(text))return'안정';
 return'성장'
}
function investmentRoleForHolding(h){return normalizeInvestmentRole(h?.investmentRole||h?.assetClass,h)}
function investmentThemeTag(h){const explicit=String(h?.themeTag||'').trim();if(explicit)return explicit;const text=String(h?.name||'').toLowerCase();if(/반도체|sox|필라델피아/.test(text))return'반도체';if(/나스닥/.test(text))return'미국 성장';if(/s&p|sp500/.test(text))return'미국 대표';if(/리츠|부동산|인프라/.test(text))return'리츠';if(/국고채|국채|채권/.test(text))return'채권';return''}
function investmentRoleMeta(h){const role=investmentRoleForHolding(h),tag=investmentThemeTag(h);return tag?`${role} · ${tag}`:role}
function pensionTransactions(scope='all'){return pensionStore().transactions.filter(t=>{const a=pensionAccount(t.accountId);return a&&(scope==='all'||a.kind===scope)}).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.createdAt||'').localeCompare(String(a.createdAt||'')))}
function pensionTradeLabel(type){return({buy:'매수',sell:'매도',dividend:'배당',interest:'이자',adjustment:'보정'})[type]||type}
function pensionPositionFromLedger(h,transactions=pensionStore().transactions){let qty=Math.max(0,Number(h.baselineQty??h.qty)||0),avg=Math.max(0,Number(h.baselineAvgPrice??h.avgPrice)||0);const rows=transactions.filter(t=>t.holdingId===h.id&&['buy','sell','adjustment'].includes(t.type)).sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.createdAt||'').localeCompare(String(b.createdAt||''))||String(a.id).localeCompare(String(b.id)));for(const t of rows){if(t.type==='buy'){const q=Math.max(0,Number(t.qty)||0),price=Math.max(0,Number(t.price)||0),oldCost=qty*avg,newCost=q*price+Math.max(0,Number(t.fee)||0)+Math.max(0,Number(t.tax)||0);qty+=q;avg=qty?((oldCost+newCost)/qty):0}else if(t.type==='sell'){qty=Math.max(0,qty-Math.max(0,Number(t.qty)||0));if(qty<=1e-9){qty=0;avg=0}}else if(t.type==='adjustment'){qty=Math.max(0,Number(t.setQty)||0);avg=qty?Math.max(0,Number(t.setAvg)||0):0}}return{qty,avg}}
function syncPensionDerivedHoldings(target=state){const ps=target?.pension;if(!ps)return;const txs=Array.isArray(ps.transactions)?ps.transactions:[];for(const h of ps.holdings||[]){const pos=pensionPositionFromLedger(h,txs);h.qty=pos.qty;h.avgPrice=pos.avg;h.investmentRole=normalizeInvestmentRole(h.investmentRole||h.assetClass,h);h.assetClass=h.investmentRole}}
function pensionTradeCashDelta(t){const fee=Math.max(0,Number(t.fee)||0),tax=Math.max(0,Number(t.tax)||0);if(t.type==='buy')return-((Number(t.qty)||0)*(Number(t.price)||0)+fee+tax);if(t.type==='sell')return (Number(t.qty)||0)*(Number(t.price)||0)-fee-tax;if(['dividend','interest'].includes(t.type))return (Number(t.amount)||0)-fee-tax;return 0}
function pensionTransactionIssues(transactions=pensionStore().transactions){
 const issues=[],byHolding=new Map(),cashByAccount=new Map();
 for(const a of pensionStore().accounts||[]){cashByAccount.set(a.id,0);if(!validYmdDate(a.openedAt))issues.push(`${a.id}: 계좌 개설일 오류`);else if(a.openedAt>localYmd())issues.push(`${a.id}: 미래 개설 계좌`);if(a.closedAt&&(!validYmdDate(a.closedAt)||a.closedAt<a.openedAt))issues.push(`${a.id}: 계좌 종료일 오류`) }
 for(const h of pensionStore().holdings){byHolding.set(h.id,{qty:Math.max(0,Number(h.baselineQty??h.qty)||0),avg:Math.max(0,Number(h.baselineAvgPrice??h.avgPrice)||0)})}
 const events=[];
 for(const c of centralPensionContributionRows()){if(c.unresolved){issues.push(`${c.id}: 납입 대상 계좌 미지정`);continue}events.push({kind:'contribution',date:String(c.date||''),createdAt:'',id:c.id,accountId:c.accountId,amount:Number(c.amount)||0})}
 for(const t of transactions||[])events.push({kind:'transaction',date:String(t.date||''),createdAt:String(t.createdAt||''),id:String(t.id||''),tx:t});
 events.sort((a,b)=>String(a.date).localeCompare(String(b.date))||(a.kind==='contribution'?-1:b.kind==='contribution'?1:String(a.createdAt).localeCompare(String(b.createdAt))||String(a.id).localeCompare(String(b.id))));
 for(const ev of events){
  if(ev.kind==='contribution'){cashByAccount.set(ev.accountId,(cashByAccount.get(ev.accountId)||0)+ev.amount);continue}
  const t=ev.tx,a=pensionAccount(t.accountId);if(!a){issues.push(`${t.id}: 계좌 없음`);continue}
  const dateError=pensionTransactionDateError(a,t.date);if(dateError){issues.push(`${t.id}: ${dateError}`);continue}
  const fee=Number(t.fee??0),tax=Number(t.tax??0);if(!Number.isFinite(fee)||!Number.isFinite(tax)||fee<0||tax<0){issues.push(`${t.id}: 수수료/세금 오류`);continue}
  if(['buy','sell','adjustment'].includes(t.type)){
   const h=pensionStore().holdings.find(x=>x.id===t.holdingId),pos=byHolding.get(t.holdingId);if(!h||!pos||h.accountId!==t.accountId){issues.push(`${t.id}: 종목/계좌 연결 오류`);continue}
   if(t.type==='buy'){
    if(!(Number(t.qty)>0&&Number(t.price)>0))issues.push(`${t.id}: 매수 수량/단가 오류`);else{const q=Number(t.qty),need=q*Number(t.price)+(Number(t.fee)||0)+(Number(t.tax)||0),cash=cashByAccount.get(t.accountId)||0;if(need>cash+1e-8){issues.push(`${t.id}: 계좌 현금 부족`);continue}const oldCost=pos.qty*pos.avg;pos.qty+=q;pos.avg=pos.qty?(oldCost+need)/pos.qty:0;cashByAccount.set(t.accountId,cash-need)}
   }else if(t.type==='sell'){
    if(!(Number(t.qty)>0&&Number(t.price)>0))issues.push(`${t.id}: 매도 수량/단가 오류`);else if(Number(t.qty)>pos.qty+1e-8)issues.push(`${t.id}: 보유수량 초과매도`);else if(fee+tax>Number(t.qty)*Number(t.price)+1e-8)issues.push(`${t.id}: 매도 수수료와 세금이 매도대금을 초과`);else{const q=Number(t.qty),cash=(cashByAccount.get(t.accountId)||0)+q*Number(t.price)-fee-tax;if(cash<-1e-8){issues.push(`${t.id}: 매도 비용으로 계좌 현금 음수`);continue}pos.qty-=q;if(pos.qty<=1e-9){pos.qty=0;pos.avg=0}cashByAccount.set(t.accountId,cash)}
   }else{if(Number(t.setQty)<0||Number(t.setAvg)<0)issues.push(`${t.id}: 보정값 오류`);else{pos.qty=Number(t.setQty)||0;pos.avg=pos.qty?(Number(t.setAvg)||0):0}}
  }else if(['dividend','interest'].includes(t.type)){
   if(!(Number(t.amount)>0)){issues.push(`${t.id}: 수령액 오류`);continue}if(fee+tax>Number(t.amount)+1e-8){issues.push(`${t.id}: 수수료와 세금이 세전 수령액을 초과`);continue}if(t.holdingId){const h=pensionStore().holdings.find(x=>x.id===t.holdingId);if(!h||h.accountId!==t.accountId){issues.push(`${t.id}: 수령 종목 연결 오류`);continue}}const cash=(cashByAccount.get(t.accountId)||0)+(Number(t.amount)||0)-fee-tax;if(cash<-1e-8){issues.push(`${t.id}: 수령 비용으로 계좌 현금 음수`);continue}cashByAccount.set(t.accountId,cash)
  }
 }
 return issues
}
function pensionTransactionSave(candidate,editingId=''){const account=pensionAccount(candidate?.accountId);if(!account||account.status!=='active')return{ok:false,error:'운영 중인 연금저축·IRP 계좌에만 새 거래를 저장할 수 있습니다.',issues:['비활성 계좌 거래']};const tx={...candidate,id:editingId||uid('ptx'),createdAt:editingId?(pensionStore().transactions.find(x=>x.id===editingId)?.createdAt||new Date().toISOString()):new Date().toISOString()};let list=pensionStore().transactions.filter(x=>x.id!==editingId);list.push(tx);const issues=pensionTransactionIssues(list);if(issues.length)return{ok:false,error:issues[0],issues};pensionStore().transactions=list;syncPensionDerivedHoldings();return{ok:true,tx}}
let pensionTransactionDeleteError='';
function pensionTransactionDelete(id){pensionTransactionDeleteError='';const current=pensionStore().transactions,next=current.filter(x=>x.id!==id);if(next.length===current.length){pensionTransactionDeleteError='거래를 찾지 못했습니다.';return false}const issues=pensionTransactionIssues(next);if(issues.length){pensionTransactionDeleteError=issues[0];return false}pensionStore().transactions=next;syncPensionDerivedHoldings();return true}
