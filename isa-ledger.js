'use strict';
function holdingPriceScale(h){const value=Number(h?.priceScale);return Number.isFinite(value)&&value>0?value:1}
function holdingPositionValue(h,qty=h?.qty,price=h?.currentPrice){return (Number(qty)||0)*(Number(price)||0)/holdingPriceScale(h)}
function holdingCostValue(h,qty=h?.qty,price=h?.avgPrice){return holdingPositionValue(h,qty,price)}
function holdingQuantityText(h,qty=h?.qty){return h?.quantityUnit==='face'?`${num(qty)}원 액면`:`${num(qty)}주`}
function transactionPositionValue(h,qty,price){return holdingPositionValue(h,qty,price)}
function replay(account,candidateTxs=null){
 if(!account)return {holdings:[],cash:0,valid:true,error:null,errorTxId:null,realized:0,income:0,fees:0,taxes:0,facts:new Map()};
 if(isPastAccount(account)){
  const holdings=account.holdings.map(h=>{const row={...h,qty:h.snapshotQty??h.baselineQty??0,avgPrice:h.snapshotAvg??h.baselineAvg??0,currentPrice:h.snapshotPrice??h.currentPrice??0,realized:0};return{...row,marketValue:holdingPositionValue(row)}});
  return {holdings,cash:account.cashSnapshot??account.baselineCash??0,valid:true,error:null,realized:0,income:0,fees:0,taxes:0,facts:new Map()};
 }
 const baseDate=account.baseline?.date||account.baselineDate||account.openedAt||'0000-01-01';
 const map=new Map(account.holdings.map(h=>[h.id,{...h,qty:Number(h.baselineQty)||0,avgPrice:Number(h.baselineAvg)||0,currentPrice:Number(h.currentPrice)||0,realized:0}]));
 let cash=Number(account.baseline?.cash??account.baselineCash??account.cashOpening)||0,error=null,errorTxId=null,realized=0,income=0,fees=0,taxes=0;const facts=new Map();
 const baseTxs=candidateTxs||account.transactions,centralRows=centralIsaReplayRows(account);const txs=sortTxs([...baseTxs,...centralRows]).filter(t=>t.status!=='cancelled');
 const byId=new Map(txs.map(t=>[t.id,t])),processed=new Set(),reversedBySource=new Map(),tolerance=Number(account.reconciliationTolerance||10);
 for(const tx of txs){
  const dateError=isaTransactionDateError(account,txDate(tx));if(dateError){error=dateError;errorTxId=tx.id;break}
  if(txDate(tx)<baseDate){error='ISA 기준일 이전 거래는 저장할 수 없습니다.';errorTxId=tx.id;break}
  const numericError=transactionNumericError(tx);if(numericError){error=numericError;errorTxId=tx.id;break}
  const h=tx.holdingId?map.get(tx.holdingId):null,q=Number(tx.qty??0),p=Number(tx.price??0),f=Number(tx.fee??0),tax=Number(tx.tax??0),amount=Number(tx.amount??0);
  if(['deposit','internalTransferIn','feeRefund','taxRefund'].includes(tx.type)){cash+=amount;facts.set(tx.id,{tradeAmount:amount})}
  if(['withdrawal','internalTransferOut'].includes(tx.type)){
   if(amount>cash+1e-8){error='계좌 현금보다 큰 출금은 저장할 수 없습니다.';errorTxId=tx.id;break}
   cash-=amount;facts.set(tx.id,{tradeAmount:amount})
  }
  if(tx.type==='depositReversal'){
   const source=tx.reversesTransactionId?byId.get(tx.reversesTransactionId):null;
   if(!source||!['deposit','internalTransferIn'].includes(source.type)||!processed.has(source.id)){error='입금 취소는 먼저 기록된 원입금 거래를 선택해야 합니다.';errorTxId=tx.id;break}
   const used=reversedBySource.get(source.id)||0,available=Math.max(0,(Number(source.amount)||0)-used);
   if(amount>available+1e-8){error='원입금의 남은 취소 가능금액을 초과했습니다.';errorTxId=tx.id;break}
   if(amount>cash+1e-8){error='계좌 현금보다 큰 입금 취소는 저장할 수 없습니다.';errorTxId=tx.id;break}
   cash-=amount;reversedBySource.set(source.id,used+amount);facts.set(tx.id,{tradeAmount:amount,reversesTransactionId:source.id})
  }
  if(['dividend','distribution','interest'].includes(tx.type)){const net=amount-f-tax;cash+=net;income+=net;fees+=f;taxes+=tax;facts.set(tx.id,{tradeAmount:net,grossAmount:amount})}
  if(['buy','openingAllocation'].includes(tx.type)){
   if(!h){error='등록되지 않은 종목의 매수 기록이 있습니다.';errorTxId=tx.id;break}
   const scale=holdingPriceScale(h),cost=transactionPositionValue(h,q,p)+f+tax,totalCost=holdingCostValue(h)+cost;h.qty+=q;h.avgPrice=h.qty?(totalCost*scale/h.qty):0;cash-=cost;fees+=f;taxes+=tax;facts.set(tx.id,{tradeAmount:cost});
  }
  if(tx.type==='sell'){
   if(!h){error='등록되지 않은 종목의 매도 기록이 있습니다.';errorTxId=tx.id;break}
   if(q>h.qty+1e-8){error=`${h.name} 매도수량이 당시 보유수량을 초과합니다.`;errorTxId=tx.id;break}
   const gain=transactionPositionValue(h,q,p-h.avgPrice)-f-tax,proceeds=transactionPositionValue(h,q,p)-f-tax;h.realized+=gain;realized+=gain;h.qty-=q;cash+=proceeds;fees+=f;taxes+=tax;facts.set(tx.id,{tradeAmount:proceeds,realized:gain});
  }
  if(tx.type==='adjustment'){if(h&&Number.isFinite(Number(tx.setQty)))h.qty=Number(tx.setQty);if(h&&Number.isFinite(Number(tx.setAvg)))h.avgPrice=Number(tx.setAvg);if(Number.isFinite(Number(tx.cashDelta)))cash+=Number(tx.cashDelta);facts.set(tx.id,{tradeAmount:Number(tx.cashDelta)||0})}
  if(['split','reverseSplit'].includes(tx.type)&&h){const ratio=Number(tx.ratio)||1;if(ratio<=0){error='분할·병합 비율이 올바르지 않습니다.';errorTxId=tx.id;break}h.qty*=ratio;h.avgPrice/=ratio;facts.set(tx.id,{tradeAmount:0,corporateAction:true})}
  if(tx.type==='securityTransferIn'&&h){const scale=holdingPriceScale(h),total=holdingCostValue(h)+transactionPositionValue(h,q,p);h.qty+=q;h.avgPrice=h.qty?total*scale/h.qty:0;facts.set(tx.id,{tradeAmount:0})}
  if(tx.type==='securityTransferOut'&&h){if(q>h.qty+1e-8){error=`${h.name} 이전수량이 당시 보유수량을 초과합니다.`;errorTxId=tx.id;break}h.qty-=q;facts.set(tx.id,{tradeAmount:0})}
  if(h&&h.qty<-.0000001){error=`${h.name} 보유수량이 음수가 됩니다.`;errorTxId=tx.id;break}
  if(cash<-.0000001){error='거래 시점의 ISA 계좌 현금이 음수가 됩니다.';errorTxId=tx.id;break}
  if(!Number.isFinite(cash)){error='계좌 현금 계산값이 올바르지 않습니다.';errorTxId=tx.id;break}
  processed.add(tx.id)
 }
 const holdings=[...map.values()].map(h=>({...h,lifecycleStatus:h.qty>0?'active':'archived',marketValue:holdingPositionValue(h)}));
 return {holdings,cash,valid:!error,error,errorTxId,realized,income,fees,taxes,facts}
}
function accountMetrics(account){
 const r=replay(account),holdingsValue=r.holdings.reduce((sum,h)=>sum+h.marketValue,0),cost=r.holdings.reduce((sum,h)=>sum+holdingCostValue(h),0),unrealized=holdingsValue-cost;
 if(isPastAccount(account)){const value=account.maturity?.actualSettlement||holdingsValue+r.cash;return {...r,value,holdingsValue,cost,unrealized,profit:unrealized+r.realized,rate:cost?(unrealized+r.realized)/cost*100:0,totalReturn:unrealized+r.realized+r.income}}
 const value=holdingsValue+r.cash,profit=unrealized+r.realized;return {...r,value,holdingsValue,cost,unrealized,profit,rate:cost?profit/cost*100:0,totalReturn:profit+r.income}
}
function taxableBreakdown(a){const b={gains:Number(a.taxBreakdown?.gains)||0,losses:Number(a.taxBreakdown?.losses)||0,dividends:Number(a.taxBreakdown?.dividends)||0,expenses:Number(a.taxBreakdown?.expenses)||0};const r=replay(a);for(const t of sortTxs(a.transactions||[])){if(t.status==='cancelled'||txDate(t)<(a.baselineDate||a.openedAt||''))continue;const f=r.facts.get(t.id)||{};if(t.type==='sell'&&Number.isFinite(f.realized)){if(f.realized>=0)b.gains+=f.realized;else b.losses+=f.realized}if(['dividend','distribution','interest'].includes(t.type)){b.dividends+=Number(f.grossAmount??t.amount)||0;b.expenses-=Number(t.fee||0)+Number(t.tax||0)}}return b}
function taxableNet(a){const b=taxableBreakdown(a);return b.gains+b.losses+b.dividends+b.expenses}
function exemption(a){const p=policy('isa',a);return a.type==='서민형'?p.lowIncomeExemption:a.type==='농어민형'?p.farmerExemption:p.generalExemption}
function expectedTax(a){return Math.max(0,taxableNet(a)-exemption(a))*policy('isa',a).taxRate}
function dividends(a){return (a.transactions||[]).filter(t=>['dividend','distribution'].includes(t.type)&&t.status!=='cancelled').sort((x,y)=>txDate(y).localeCompare(txDate(x))||txSequence(y)-txSequence(x))}
function dividendNetAmount(t){return Math.max(0,(Number(t?.amount)||0)-(Number(t?.fee)||0)-(Number(t?.tax)||0))}
function dividendAnalysisRecords(a){return dividends(a).filter(x=>!x.meta?.analysisOnly).sort((x,y)=>txDate(y).localeCompare(txDate(x))||txSequence(y)-txSequence(x))}
function periodEndDate(key,period){if(period==='month'){const [y,m]=String(key).split('-').map(Number);if(!y||!m)return ymd();return localYmd(new Date(y,m,0))}return /^\d{4}$/.test(String(key))?`${key}-12-31`:ymd()}
function investmentPrincipalAt(a,endDate){if(isPastAccount(a))return accountMetrics(a).cost;const txs=(a.transactions||[]).filter(t=>txDate(t)<=endDate),r=replay(a,txs);return r.valid?r.holdings.reduce((sum,h)=>sum+holdingCostValue(h),0):0}
function dividendYieldFor(a,key,period,amount){const end=periodEndDate(key,period),principal=investmentPrincipalAt(a,end),rate=principal>0?(Number(amount)||0)/principal*100:null;return{principal,rate}}
function consistencyIssues(a){
 const issues=[],tol=Number(a.reconciliationTolerance||10),r=replay(a);
 const push=(code,title,detail,severity='medium',transactionId='')=>issues.push({id:`${a.id}-${code}-${transactionId||issues.length}`,accountId:a.id,transactionId,title,detail,severity});
 if(!r.valid)push('ledger',r.error||'거래원장 계산 오류','해당 거래와 그 이후 계산을 확인해 주세요.','high',r.errorTxId||'');
 else if(r.cash<-tol)push('cash-negative','계좌 현금이 음수입니다',`${won(Math.abs(r.cash))} 부족합니다. 누락된 입금 또는 매수 기록을 확인해 주세요.`,'high');
 const seen=new Map();
 for(const t of a.transactions||[]){
  if(t.status==='cancelled')continue;
  const key=t.idempotencyKey||stableTxKey(t);
  if(seen.has(key))push('duplicate','중복 거래가 의심됩니다',`${formatDate(txDate(t))} ${typeText(t.type)} 거래가 같은 조건으로 두 번 있습니다.`,'medium',t.id);else seen.set(key,t.id);
  if(t.holdingId&&!a.holdings.some(h=>h.id===t.holdingId)&&['buy','sell','openingAllocation','dividend','distribution','adjustment','securityTransferIn','securityTransferOut'].includes(t.type))push('missing-holding','거래 종목 연결이 끊겼습니다',`${formatDate(txDate(t))} ${typeText(t.type)} 거래의 종목을 찾지 못했습니다.`,'high',t.id);
  const closeDate=a.closedAt||a.maturityAt;if(!isTradeableAccount(a)&&closeDate&&txDate(t)>closeDate)push('after-close',a.status==='maturity_pending'?'만기 후 거래가 있습니다':'종료 후 거래가 있습니다',`${formatDate(txDate(t))} 거래가 ${a.status==='maturity_pending'?'만기일':'계좌 종료일'} 이후입니다.`,'high',t.id);
  if(t.type==='depositReversal'){
   const src=a.transactions.find(x=>x.id===t.reversesTransactionId),used=(a.transactions||[]).filter(x=>x.type==='depositReversal'&&x.status!=='cancelled'&&x.reversesTransactionId===t.reversesTransactionId).reduce((sum,x)=>sum+(Number(x.amount)||0),0);
   if(!src||!['deposit','internalTransferIn'].includes(src.type))push('reversal-source','입금 취소의 원거래가 없습니다',`${formatDate(txDate(t))} 입금 취소 기록을 확인해 주세요.`,'high',t.id);else if(used>(Number(src.amount)||0)+tol)push('reversal-over','원입금보다 많이 취소됐습니다',`원입금 ${won(src.amount)}보다 누적 취소액이 큽니다.`,'high',t.id)
  }
  if(t.linkedBuyId&&!a.transactions.some(x=>x.id===t.linkedBuyId))push('linked-buy','연결된 매수 기록이 없습니다',`${formatDate(txDate(t))} 배당의 재투자 연결을 확인해 주세요.`,'medium',t.id);
  if(t.sourceDividendId&&!a.transactions.some(x=>x.id===t.sourceDividendId))push('linked-dividend','연결된 배당 기록이 없습니다',`${formatDate(txDate(t))} 매수의 배당 연결을 확인해 주세요.`,'medium',t.id)
 }
 const holdingNames=new Map();for(const h of a.holdings||[]){const key=h.securityKey||normalizeName(h.name);if(holdingNames.has(key))push('holding-duplicate','중복 종목 등록이 의심됩니다',`${h.name}이(가) 두 개의 보유종목으로 등록돼 있습니다.`,'medium');else holdingNames.set(key,h.id)}
 const latest=[...(a.reconciliations||[])].sort((x,y)=>String(y.capturedAt||'').localeCompare(String(x.capturedAt||'')))[0];if(latest?.summary?.missing>0)push('reconcile-missing','잔고 대조에서 누락된 종목이 있습니다',`${latest.summary.missing}개 종목은 자동 삭제하지 않았습니다. 원장과 실제 잔고를 확인해 주세요.`,'medium');
 return issues
}
function allIsaIssues(){return state.accounts.flatMap(a=>consistencyIssues(a))}
