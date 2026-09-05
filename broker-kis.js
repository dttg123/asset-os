'use strict';

const KIS_BROKER_STORE_VERSION=4;
const KIS_ORDER_STATUSES=new Set(['unfilled','partial','filled','cancelled','partial_cancelled']);
const KIS_HISTORY_STATUSES=new Set(['idle','running','paused','complete']);

function brokerKisEmptyStore(){
 return{version:KIS_BROKER_STORE_VERSION,connections:{pension:{accountId:'',lastSyncAt:'',lastCompleteSyncAt:'',lastBalanceAt:'',lastOrdersAt:'',lastRightsAt:'',orderSyncThrough:'',lastError:''},irp:{accountId:'',lastSyncAt:'',lastCompleteSyncAt:'',lastBalanceAt:'',lastOrdersAt:'',lastRightsAt:'',orderSyncThrough:'',lastError:''}},history:{pension:brokerKisEmptyHistory('pension'),irp:brokerKisEmptyHistory('irp')},orders:[],balanceSnapshots:[],rights:[],instrumentLinks:[],matches:[]}
}
function brokerKisText(v,max=160){return String(v??'').trim().slice(0,max)}
function brokerKisNumber(v){const n=Number(String(v??'').replaceAll(',',''));return Number.isFinite(n)?n:0}
function brokerKisNonNegative(v){return Math.max(0,brokerKisNumber(v))}
function brokerKisDate(v){const s=brokerKisText(v,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:''}
function brokerKisTimestamp(v){if(v===undefined||v===null||v==='')return new Date().toISOString();const s=brokerKisText(v,40),d=new Date(s);return s&&!Number.isNaN(d.getTime())?d.toISOString():''}
function brokerKisOptionalTimestamp(v){const s=brokerKisText(v,40),d=new Date(s);return s&&!Number.isNaN(d.getTime())?d.toISOString():''}
function brokerKisKind(v){return v==='pension'||v==='irp'?v:''}
function brokerKisNormalizeConnection(input,migrateLegacy=false){const legacy=brokerKisOptionalTimestamp(input?.lastSyncAt);return{accountId:brokerKisText(input?.accountId,100),lastSyncAt:legacy,lastCompleteSyncAt:brokerKisOptionalTimestamp(input?.lastCompleteSyncAt)||(migrateLegacy?legacy:''),lastBalanceAt:brokerKisOptionalTimestamp(input?.lastBalanceAt),lastOrdersAt:brokerKisOptionalTimestamp(input?.lastOrdersAt),lastRightsAt:brokerKisOptionalTimestamp(input?.lastRightsAt),orderSyncThrough:brokerKisDate(input?.orderSyncThrough),lastError:brokerKisText(input?.lastError,240)}}
function brokerKisEmptyHistory(accountKind='pension'){return{accountKind:brokerKisKind(accountKind),accountId:'',startDate:'',targetDate:'',orderThrough:'',rightsThrough:'',status:'idle',lastError:'',updatedAt:'',completedAt:''}}
function brokerKisNormalizeHistory(input,accountKind='pension'){
 const kind=brokerKisKind(accountKind||input?.accountKind),status=KIS_HISTORY_STATUSES.has(input?.status)?input.status:'idle';
 return{accountKind:kind,accountId:brokerKisText(input?.accountId,100),startDate:brokerKisDate(input?.startDate),targetDate:brokerKisDate(input?.targetDate),orderThrough:brokerKisDate(input?.orderThrough),rightsThrough:brokerKisDate(input?.rightsThrough),status,lastError:brokerKisText(input?.lastError,240),updatedAt:brokerKisOptionalTimestamp(input?.updatedAt),completedAt:brokerKisOptionalTimestamp(input?.completedAt)}
}
function brokerKisBeginHistory(store,input={}){
 const target=store||brokerKisEmptyStore(),kind=brokerKisKind(input.accountKind),accountId=brokerKisText(input.accountId,100),startDate=brokerKisDate(input.startDate),targetDate=brokerKisDate(input.targetDate);
 if(!accountId||!startDate||!targetDate||startDate>targetDate)return{ok:false,error:'KIS_HISTORY_RANGE_INVALID'};
 target.history=target.history||{};const current=brokerKisNormalizeHistory(target.history[kind],kind),same=current.accountId===accountId&&current.startDate===startDate;
 target.history[kind]={...brokerKisEmptyHistory(kind),...(same?current:{}),accountKind:kind,accountId,startDate,targetDate,status:'running',lastError:'',updatedAt:brokerKisTimestamp(input.updatedAt),completedAt:''};
 return{ok:true,history:target.history[kind]}
}
function brokerKisUpdateHistory(store,input={}){
 const target=store||brokerKisEmptyStore(),kind=brokerKisKind(input.accountKind);target.history=target.history||{};const current=brokerKisNormalizeHistory(target.history[kind],kind);
 if(!current.accountId)return{ok:false,error:'KIS_HISTORY_NOT_STARTED'};
 const status=KIS_HISTORY_STATUSES.has(input.status)?input.status:current.status,next={...current,status,lastError:input.lastError===undefined?current.lastError:brokerKisText(input.lastError,240),updatedAt:brokerKisTimestamp(input.updatedAt)};
 for(const key of ['orderThrough','rightsThrough'])if(input[key]!==undefined){const value=brokerKisDate(input[key]);if(input[key]&&(!value||value<current.startDate||value>current.targetDate))return{ok:false,error:'KIS_HISTORY_RANGE_INVALID'};next[key]=value}
 if(status==='complete')next.completedAt=brokerKisTimestamp(input.completedAt||input.updatedAt);else if(input.completedAt==='')next.completedAt='';target.history[kind]=next;return{ok:true,history:next}
}
function brokerKisMarkSync(store,accountKind,accountId,fetchedAt,part=''){const target=store||brokerKisEmptyStore(),kind=brokerKisKind(accountKind),timestamp=brokerKisTimestamp(fetchedAt);if(!kind||!timestamp)return null;target.connections=target.connections||brokerKisEmptyStore().connections;const current=brokerKisNormalizeConnection(target.connections[kind]),partKey=part==='balance'?'lastBalanceAt':part==='orders'?'lastOrdersAt':part==='rights'?'lastRightsAt':'',latest=(a,b)=>!a||b>a?b:a;target.connections[kind]={...current,accountId:brokerKisText(accountId,100),lastSyncAt:latest(current.lastSyncAt,timestamp),lastError:'',...(partKey?{[partKey]:latest(current[partKey],timestamp)}:{})};return target.connections[kind]}
function brokerKisCompleteSync(store,accountKind,accountId,completedAt=new Date().toISOString()){const timestamp=brokerKisTimestamp(completedAt),connection=brokerKisMarkSync(store,accountKind,accountId,timestamp);if(!connection)return null;connection.lastCompleteSyncAt=!connection.lastCompleteSyncAt||timestamp>connection.lastCompleteSyncAt?timestamp:connection.lastCompleteSyncAt;connection.lastError='';return connection}
function brokerKisFailSync(store,accountKind,accountId,error,failedAt=new Date().toISOString()){const target=store||brokerKisEmptyStore(),kind=brokerKisKind(accountKind),timestamp=brokerKisTimestamp(failedAt);if(!kind||!timestamp)return null;target.connections=target.connections||brokerKisEmptyStore().connections;const current=brokerKisNormalizeConnection(target.connections[kind]);target.connections[kind]={...current,accountId:brokerKisText(accountId,100),lastError:brokerKisText(error||'SYNC_FAILED',240),lastSyncAt:current.lastSyncAt||timestamp};return target.connections[kind]}
function brokerKisSide(v){const s=brokerKisText(v,12).toLowerCase();return s==='sell'||s==='01'?'sell':s==='buy'||s==='02'?'buy':''}
function brokerKisKeyPart(v){return encodeURIComponent(brokerKisText(v,180))}
function brokerKisOrderKey(row){
 return['kis',brokerKisKind(row.accountKind),row.accountId,row.orderDate,row.branchNo,row.orderNo,row.productCode,row.exchangeCode,row.side].map(brokerKisKeyPart).join('|')
}
function brokerKisSnapshotSignature(row){
 return[row.orderQty,row.filledQty,row.filledAmount,row.remainingQty,row.cancelledQty,row.fee,row.tax,row.status].map(v=>String(v)).join('|')
}
function brokerKisOrderStatus(row){
 const filled=brokerKisNonNegative(row.filledQty),remaining=brokerKisNonNegative(row.remainingQty),cancelled=brokerKisNonNegative(row.cancelledQty),cancelledFlag=!!row.cancelled||cancelled>0;
 if(cancelledFlag&&filled>0)return'partial_cancelled';
 if(cancelledFlag)return'cancelled';
 if(filled>0&&remaining>0)return'partial';
 if(filled>0)return'filled';
 return'unfilled'
}
function brokerKisNormalizeOrder(row,accountKind='',accountId='',fetchedAt=''){
 const next={
  source:'kis',accountKind:brokerKisKind(accountKind||row?.accountKind),accountId:brokerKisText(accountId||row?.accountId,100),
  orderDate:brokerKisDate(row?.orderDate),orderTime:brokerKisText(row?.orderTime,12),branchNo:brokerKisText(row?.branchNo,40),orderNo:brokerKisText(row?.orderNo,80),
  productCode:brokerKisText(row?.productCode,80),productName:brokerKisText(row?.productName,160),exchangeCode:brokerKisText(row?.exchangeCode,30),side:brokerKisSide(row?.side),
  orderQty:brokerKisNonNegative(row?.orderQty),filledQty:brokerKisNonNegative(row?.filledQty),filledAmount:brokerKisNonNegative(row?.filledAmount),remainingQty:brokerKisNonNegative(row?.remainingQty),cancelledQty:brokerKisNonNegative(row?.cancelledQty),
  fee:brokerKisNonNegative(row?.fee),tax:brokerKisNonNegative(row?.tax),cancelled:!!row?.cancelled,fetchedAt:brokerKisTimestamp(fetchedAt||row?.fetchedAt),revisions:[]
 };
 next.avgPrice=next.filledQty>0?next.filledAmount/next.filledQty:0;next.status=brokerKisOrderStatus(next);next.orderKey=brokerKisOrderKey(next);return next
}
function brokerKisOrderValid(row){return !!row.accountId&&!!row.orderDate&&!!row.orderNo&&!!row.productCode&&!!row.side&&row.filledQty>=0&&row.filledAmount>=0}
function brokerKisRevisionSnapshot(row){return{filledQty:row.filledQty,filledAmount:row.filledAmount,remainingQty:row.remainingQty,cancelledQty:row.cancelledQty,avgPrice:row.avgPrice,status:row.status,fetchedAt:row.fetchedAt}}
function brokerKisImportOrderSnapshots(store,rows,accountKind,accountId,fetchedAt=new Date().toISOString(),orderSyncThrough=''){
 const kind=brokerKisKind(accountKind),timestamp=brokerKisTimestamp(fetchedAt);if(!kind||!timestamp)return{inserted:0,updated:0,skipped:0,rejected:Array.isArray(rows)?rows.length:0,total:(store?.orders||[]).length,error:'KIS_RESPONSE_METADATA_INVALID'};const target=store||brokerKisEmptyStore(),list=Array.isArray(target.orders)?target.orders:(target.orders=[]),byKey=new Map(list.map(x=>[x.orderKey,x]));let inserted=0,updated=0,skipped=0,rejected=0;
 for(const raw of Array.isArray(rows)?rows:[]){
  const next=brokerKisNormalizeOrder(raw,kind,accountId,timestamp);if(!brokerKisOrderValid(next)){rejected++;continue}
  const current=byKey.get(next.orderKey);if(!current){list.push(next);byKey.set(next.orderKey,next);inserted++;continue}
  if(current.fetchedAt&&next.fetchedAt<=current.fetchedAt){skipped++;continue}
  if(brokerKisSnapshotSignature(current)===brokerKisSnapshotSignature(next)){current.fetchedAt=next.fetchedAt;if(next.productName)current.productName=next.productName;skipped++;continue}
  const revisions=Array.isArray(current.revisions)?current.revisions:[];revisions.push({changedAt:next.fetchedAt,before:brokerKisRevisionSnapshot(current),after:brokerKisRevisionSnapshot(next)});
  Object.assign(current,next,{revisions});updated++
 }
 list.sort((a,b)=>a.orderDate.localeCompare(b.orderDate)||a.orderTime.localeCompare(b.orderTime)||a.orderKey.localeCompare(b.orderKey));
 const connection=brokerKisMarkSync(target,kind,accountId,timestamp,'orders'),through=brokerKisDate(orderSyncThrough);if(connection&&through&&(!connection.orderSyncThrough||through>connection.orderSyncThrough))connection.orderSyncThrough=through;
 return{inserted,updated,skipped,rejected,total:list.length}
}
function brokerKisNormalizeHolding(row){
 return{productCode:brokerKisText(row?.productCode,80),productName:brokerKisText(row?.productName,160),quantity:brokerKisNonNegative(row?.quantity),avgPrice:brokerKisNonNegative(row?.avgPrice),currentPrice:brokerKisNonNegative(row?.currentPrice),marketValue:brokerKisNonNegative(row?.marketValue),profitLoss:brokerKisNumber(row?.profitLoss)}
}
function brokerKisRightKey(row){return['kis-right',brokerKisKind(row.accountKind),row.accountId,row.rightTypeCode,row.baseDate,row.cashPaymentDate,row.productCode].map(brokerKisKeyPart).join('|')}
function brokerKisNormalizeRight(row,accountKind='',accountId='',fetchedAt=''){
 const next={source:'kis',accountKind:brokerKisKind(accountKind||row?.accountKind),accountId:brokerKisText(accountId||row?.accountId,100),rightTypeCode:brokerKisText(row?.rightTypeCode,30),baseDate:brokerKisDate(row?.baseDate),cashPaymentDate:brokerKisDate(row?.cashPaymentDate),productCode:brokerKisText(row?.productCode,80),productName:brokerKisText(row?.productName,160),amount:brokerKisNonNegative(row?.amount),tax:brokerKisNonNegative(row?.tax),classification:'unclassified_cash_right',fetchedAt:brokerKisTimestamp(fetchedAt||row?.fetchedAt),revisions:[]};next.netAmount=Math.max(0,next.amount-next.tax);next.rightKey=brokerKisRightKey(next);return next
}
function brokerKisImportRights(store,rows,accountKind,accountId,fetchedAt=new Date().toISOString()){
 const kind=brokerKisKind(accountKind),timestamp=brokerKisTimestamp(fetchedAt);if(!kind||!timestamp)return{inserted:0,updated:0,skipped:0,rejected:Array.isArray(rows)?rows.length:0,total:(store?.rights||[]).length,error:'KIS_RESPONSE_METADATA_INVALID'};const target=store||brokerKisEmptyStore(),list=Array.isArray(target.rights)?target.rights:(target.rights=[]),byKey=new Map(list.map(x=>[x.rightKey,x]));let inserted=0,updated=0,skipped=0,rejected=0;
 for(const raw of Array.isArray(rows)?rows:[]){const next=brokerKisNormalizeRight(raw,kind,accountId,timestamp);if(!next.accountId||!next.rightTypeCode||!next.productCode||(!next.baseDate&&!next.cashPaymentDate)){rejected++;continue}const current=byKey.get(next.rightKey);if(!current){list.push(next);byKey.set(next.rightKey,next);inserted++;continue}if(current.fetchedAt&&next.fetchedAt<=current.fetchedAt){skipped++;continue}if(current.amount===next.amount&&current.tax===next.tax){current.fetchedAt=next.fetchedAt;skipped++;continue}const revisions=Array.isArray(current.revisions)?current.revisions:[];revisions.push({changedAt:next.fetchedAt,before:{amount:current.amount,tax:current.tax,netAmount:current.netAmount},after:{amount:next.amount,tax:next.tax,netAmount:next.netAmount}});Object.assign(current,next,{revisions});updated++}
 list.sort((a,b)=>(a.cashPaymentDate||a.baseDate).localeCompare(b.cashPaymentDate||b.baseDate)||a.rightKey.localeCompare(b.rightKey));brokerKisMarkSync(target,kind,accountId,timestamp,'rights');return{inserted,updated,skipped,rejected,total:list.length}
}
function brokerKisNormalizeCashDetail(input){const src=input&&typeof input==='object'?input:{},optional=key=>src[key]===null||src[key]===undefined||src[key]===''?null:brokerKisNonNegative(src[key]);return{depositCash:optional('depositCash'),settledCash:optional('settledCash'),nextDayCash:optional('nextDayCash'),d2Cash:optional('d2Cash'),todayBuyAmount:optional('todayBuyAmount'),todaySellAmount:optional('todaySellAmount'),availableCash:optional('availableCash')}}
function brokerKisNormalizeBalanceSnapshot(input,accountKind='',accountId='',fetchedAt=''){
 const holdings=(Array.isArray(input?.holdings)?input.holdings:[]).map(brokerKisNormalizeHolding).filter(x=>x.productCode&&x.quantity>=0),kind=brokerKisKind(accountKind||input?.accountKind),date=brokerKisDate(input?.date)||brokerKisTimestamp(fetchedAt||input?.fetchedAt).slice(0,10);
 return{id:['kis-balance',kind,accountId,date].map(brokerKisKeyPart).join('|'),source:'kis',authoritative:input?.authoritative===true,accountKind:kind,accountId:brokerKisText(accountId||input?.accountId,100),date,fetchedAt:brokerKisTimestamp(fetchedAt||input?.fetchedAt),cash:brokerKisNonNegative(input?.cash),cashDetail:brokerKisNormalizeCashDetail(input?.cashDetail),securitiesValue:brokerKisNonNegative(input?.securitiesValue),totalValue:brokerKisNonNegative(input?.totalValue),holdings}
}
function brokerKisImportBalanceSnapshot(store,input,accountKind,accountId,fetchedAt=new Date().toISOString()){
 const kind=brokerKisKind(accountKind),timestamp=brokerKisTimestamp(fetchedAt);if(!kind||!timestamp)return{ok:false,error:'KIS_RESPONSE_METADATA_INVALID'};const target=store||brokerKisEmptyStore(),snapshot=brokerKisNormalizeBalanceSnapshot({...input,authoritative:true},kind,accountId,timestamp);if(!snapshot.accountId)return{ok:false,error:'LOCAL_ACCOUNT_REQUIRED'};
 const list=Array.isArray(target.balanceSnapshots)?target.balanceSnapshots:(target.balanceSnapshots=[]),index=list.findIndex(x=>x.id===snapshot.id);if(index>=0&&list[index].fetchedAt&&snapshot.fetchedAt<=list[index].fetchedAt)return{ok:true,replaced:false,stale:true,snapshot:list[index]};if(index>=0)list[index]=snapshot;else list.push(snapshot);list.sort((a,b)=>a.date.localeCompare(b.date)||a.fetchedAt.localeCompare(b.fetchedAt));brokerKisMarkSync(target,kind,accountId,timestamp,'balance');return{ok:true,replaced:index>=0,snapshot}
}
function brokerKisLatestBalance(store,accountKind,accountId=''){
 return[...(store?.balanceSnapshots||[])].filter(x=>x.accountKind===brokerKisKind(accountKind)&&(!accountId||x.accountId===accountId)).sort((a,b)=>a.fetchedAt.localeCompare(b.fetchedAt)).at(-1)||null
}
function brokerKisCurrentKindTotal(store,accountKind,accountIds){
 const kind=brokerKisKind(accountKind),ids=[...new Set((Array.isArray(accountIds)?accountIds:[]).map(x=>brokerKisText(x,100)).filter(Boolean))];if(!ids.length)return null;
 const snapshots=ids.map(id=>brokerKisLatestBalance(store,kind,id));if(snapshots.some(x=>!x))return null;
 return{source:'kis',authoritative:snapshots.every(x=>x.authoritative===true),accountKind:kind,accountCount:ids.length,totalValue:snapshots.reduce((sum,x)=>sum+brokerKisNonNegative(x.totalValue),0),fetchedAt:snapshots.map(x=>x.fetchedAt).sort()[0],snapshotIds:snapshots.map(x=>x.id)}
}
function brokerKisLinkInstrument(store,input){
 const target=store||brokerKisEmptyStore(),link={accountId:brokerKisText(input?.accountId,100),productCode:brokerKisText(input?.productCode,80),holdingId:brokerKisText(input?.holdingId,100),linkedAt:brokerKisTimestamp(input?.linkedAt)};if(!link.accountId||!link.productCode||!link.holdingId)return{ok:false,error:'INSTRUMENT_LINK_FIELDS_REQUIRED'};
 const list=Array.isArray(target.instrumentLinks)?target.instrumentLinks:(target.instrumentLinks=[]),index=list.findIndex(x=>x.accountId===link.accountId&&x.productCode===link.productCode);if(index>=0)list[index]=link;else list.push(link);return{ok:true,replaced:index>=0,link}
}
function brokerKisLedgerDraft(store,orderKey){
 const order=(store?.orders||[]).find(x=>x.orderKey===orderKey);if(!order||!['buy','sell'].includes(order.side)||order.filledQty<=0)return null;const link=(store?.instrumentLinks||[]).find(x=>x.accountId===order.accountId&&x.productCode===order.productCode);if(!link)return null;
 const match=(store?.matches||[]).find(x=>x.orderKey===orderKey),matched=match&&Number.isFinite(Number(match.matchedQty))?Math.max(0,Number(match.matchedQty)):match?order.filledQty:0,qty=Math.max(0,order.filledQty-matched);if(qty<=0)return null;const ratio=order.filledQty?qty/order.filledQty:0;return{type:order.side,accountId:order.accountId,holdingId:link.holdingId,date:order.orderDate,qty,price:order.avgPrice,amount:0,fee:order.fee*ratio,tax:order.tax*ratio,setQty:0,setAvg:0,note:'KIS 체결 가져오기',source:'kis',externalId:order.orderKey,brokerOrderKey:order.orderKey}
}
function brokerKisVisibleOrders(store,scope='all'){
 const matched=new Map((store?.matches||[]).map(x=>[x.orderKey,x])),safeScope=['all','pension','irp'].includes(scope)?scope:'all';
 return(store?.orders||[]).map(x=>{const match=matched.get(x.orderKey),done=match&&Number.isFinite(Number(match.matchedQty))?Math.max(0,Number(match.matchedQty)):match?x.filledQty:0,qty=Math.max(0,x.filledQty-done),ratio=x.filledQty?qty/x.filledQty:0;return{x,qty,ratio}}).filter(({x,qty})=>qty>0&&(safeScope==='all'||x.accountKind===safeScope)).map(({x,qty,ratio})=>({
  id:x.orderKey,brokerOrder:true,accountKind:x.accountKind,accountId:x.accountId,date:x.orderDate,time:x.orderTime,type:x.side,status:x.status,
  productCode:x.productCode,productName:x.productName||x.productCode,qty,price:x.avgPrice,amount:x.filledAmount*ratio,fee:x.fee*ratio,tax:x.tax*ratio,fetchedAt:x.fetchedAt
 })).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.time).localeCompare(String(a.time))||String(b.id).localeCompare(String(a.id)))
}
function brokerKisMatchOrder(store,orderKey,transactionId,matchedAt=new Date().toISOString(),matchedQty=null){
 const target=store||brokerKisEmptyStore(),order=(target.orders||[]).find(x=>x.orderKey===orderKey);if(!order)return{ok:false,error:'ORDER_NOT_FOUND'};const list=Array.isArray(target.matches)?target.matches:(target.matches=[]),index=list.findIndex(x=>x.orderKey===orderKey),prior=index>=0?list[index]:null,added=matchedQty===null?order.filledQty:Math.max(0,Number(matchedQty)||0),total=Math.min(order.filledQty,(prior&&Number.isFinite(Number(prior.matchedQty))?Number(prior.matchedQty):0)+added),row={orderKey:brokerKisText(orderKey,900),transactionId:brokerKisText(transactionId,120),matchedAt:brokerKisTimestamp(matchedAt),matchedQty:total};if(!row.transactionId)return{ok:false,error:'TRANSACTION_REQUIRED'};if(index>=0)list[index]=row;else list.push(row);return{ok:true,replaced:index>=0,match:row}
}
function brokerKisIssues(store){
 const issues=[],keys=new Set(),rightKeys=new Set(),matches=new Set();for(const x of store?.orders||[]){if(!x.orderKey||keys.has(x.orderKey))issues.push(`KIS 주문키 중복/누락: ${x.orderKey||'-'}`);keys.add(x.orderKey);if(!brokerKisOrderValid(x))issues.push(`KIS 주문 필수값 오류: ${x.orderKey||'-'}`);if(!KIS_ORDER_STATUSES.has(x.status))issues.push(`KIS 주문상태 오류: ${x.orderKey||'-'}`)}for(const x of store?.rights||[]){if(!x.rightKey||rightKeys.has(x.rightKey))issues.push(`KIS 권리키 중복/누락: ${x.rightKey||'-'}`);rightKeys.add(x.rightKey);if(x.classification!=='unclassified_cash_right')issues.push(`KIS 권리 자동분류 금지 위반: ${x.rightKey||'-'}`)}for(const x of store?.matches||[]){if(matches.has(x.orderKey))issues.push(`KIS 원장매칭 중복: ${x.orderKey}`);matches.add(x.orderKey);if(!keys.has(x.orderKey))issues.push(`KIS 원장매칭 주문 없음: ${x.orderKey}`)}return issues
}
function normalizeBrokerKis(input){
 const base=brokerKisEmptyStore(),src=input&&typeof input==='object'?input:{},migrateLegacy=Number(src.version||0)<KIS_BROKER_STORE_VERSION;const out={...base,version:KIS_BROKER_STORE_VERSION,connections:{pension:brokerKisNormalizeConnection(src.connections?.pension,migrateLegacy),irp:brokerKisNormalizeConnection(src.connections?.irp,migrateLegacy)},history:{pension:brokerKisNormalizeHistory(src.history?.pension,'pension'),irp:brokerKisNormalizeHistory(src.history?.irp,'irp')},orders:[],balanceSnapshots:[],rights:[],instrumentLinks:[],matches:[]};
 for(const x of Array.isArray(src.orders)?src.orders:[]){const row=brokerKisNormalizeOrder(x,x.accountKind,x.accountId,x.fetchedAt);row.revisions=Array.isArray(x.revisions)?x.revisions.slice(-50):[];if(brokerKisOrderValid(row)&&!out.orders.some(y=>y.orderKey===row.orderKey))out.orders.push(row)}
 out.balanceSnapshots=(Array.isArray(src.balanceSnapshots)?src.balanceSnapshots:[]).map(x=>brokerKisNormalizeBalanceSnapshot(x,x.accountKind,x.accountId,x.fetchedAt)).filter(x=>x.accountId);
 for(const x of Array.isArray(src.rights)?src.rights:[]){const row=brokerKisNormalizeRight(x,x.accountKind,x.accountId,x.fetchedAt);row.revisions=Array.isArray(x.revisions)?x.revisions.slice(-50):[];if(row.accountId&&row.rightTypeCode&&row.productCode&&!out.rights.some(y=>y.rightKey===row.rightKey))out.rights.push(row)}
 for(const x of Array.isArray(src.instrumentLinks)?src.instrumentLinks:[])brokerKisLinkInstrument(out,x);for(const x of Array.isArray(src.matches)?src.matches:[])if(x?.orderKey&&x?.transactionId&&!out.matches.some(y=>y.orderKey===x.orderKey))out.matches.push({orderKey:brokerKisText(x.orderKey,900),transactionId:brokerKisText(x.transactionId,120),matchedAt:brokerKisTimestamp(x.matchedAt),...(Number.isFinite(Number(x.matchedQty))?{matchedQty:Math.max(0,Number(x.matchedQty))}:{})});
 return out
}
