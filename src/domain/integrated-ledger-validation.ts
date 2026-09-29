'use strict';

type LedgerValidationAccount={id?:string;kind?:string;[key:string]:unknown};
type LedgerValidationLiability={id?:string;[key:string]:unknown};
type LedgerValidationMeta={analysisOnly?:boolean;targetIsaAccountId?:string;targetPensionAccountId?:string;refundOf?:string;qaFixture?:boolean;[key:string]:unknown};
type LedgerValidationRow={id?:string;type?:string;date?:string;amount?:unknown;delta?:unknown;fromAccountId?:string;toAccountId?:string;accountId?:string;liabilityId?:string;meta?:LedgerValidationMeta;[key:string]:unknown};
type LedgerValidationStore={accounts:LedgerValidationAccount[];liabilities:LedgerValidationLiability[];ledger:LedgerValidationRow[]};
type LedgerValidationReplay={assets:Record<string,number>;liabilities:Record<string,number>;minAssets?:Record<string,number>;minLiabilities?:Record<string,number>};
type LedgerValidationProduct={id:string;name:string;type:string;status?:string};

function validationIntegratedStore(){
 // @ts-ignore runtime global supplied by integrated-ledger.js
 return integratedStore() as LedgerValidationStore
}
function validationPostedDateError(date:unknown){
 // @ts-ignore runtime global supplied by core-config.js
 return postedDateError(date) as string
}
function validationIsaAccounts(date:unknown){
 // @ts-ignore runtime global supplied by isa-ledger.js
 return isaAccountsForDate(date) as Array<{id:string}>
}
function validationPensionAccounts(kind:string,date:unknown){
 // @ts-ignore runtime global supplied by pension-ledger.js
 return pensionAccountsForKind(kind,date) as Array<{id:string}>
}
function validationIsQaFixture(transaction:LedgerValidationRow){
 // @ts-ignore runtime global supplied by integrated-ledger.js
 return isQaIntegratedFixture(transaction) as boolean
}
function validationReplay(rows:LedgerValidationRow[],store:LedgerValidationStore){
 // @ts-ignore runtime global supplied by integrated-ledger.js
 return integratedReplay(rows,store) as LedgerValidationReplay
}
function validationFinancialProducts(){
 // @ts-ignore runtime global supplied by integrated-finance-engine.js
 return financialProducts() as LedgerValidationProduct[]
}
function validationProductAccountId(id:string){
 // @ts-ignore runtime global supplied by integrated-finance-engine.js
 return financeProductAccountId(id) as string
}
function validationProductLiabilityId(id:string){
 // @ts-ignore runtime global supplied by integrated-finance-engine.js
 return financeProductLiabilityId(id) as string
}
function validationWon(value:number){
 // @ts-ignore runtime global supplied by core-visual-utils.js
 return won(value) as string
}

function integratedIssues(store:LedgerValidationStore=validationIntegratedStore()){
 const issues:string[]=[],accountIds=new Set<string|undefined>(),liabilityIds=new Set<string|undefined>(),transactionIds=new Set<string|undefined>();
 for(const account of store.accounts||[]){if(!account.id||accountIds.has(account.id))issues.push(`자산 계좌 ID 중복/누락: ${account.id||'-'}`);accountIds.add(account.id)}
 for(const liability of store.liabilities||[]){if(!liability.id||liabilityIds.has(liability.id))issues.push(`부채 ID 중복/누락: ${liability.id||'-'}`);liabilityIds.add(liability.id)}
 const allowed=new Set(['refund','openingAsset','openingLiability','externalIncome','expense','externalExpense','debtInterest','debtInterestExternal','debtPrincipal','externalDebtPrincipal','externalAssetIn','externalAssetOut','internalTransfer','externalWithdrawal','adjustment']);
 for(const transaction of store.ledger||[]){
  if(!transaction.id||transactionIds.has(transaction.id))issues.push(`원장 ID 중복/누락: ${transaction.id||'-'}`);transactionIds.add(transaction.id);
  const dateError=validationPostedDateError(transaction.date);if(dateError)issues.push(`${dateError}: ${transaction.id}`);
  if(!allowed.has(transaction.type||''))issues.push(`거래유형 오류: ${transaction.id}`);
  if(transaction.type==='adjustment'){if(!Number.isFinite(Number(transaction.delta))||Number(transaction.delta)===0)issues.push(`보정금액 오류: ${transaction.id}`)}else if(!Number.isFinite(Number(transaction.amount))||Number(transaction.amount)<=0)issues.push(`금액 오류: ${transaction.id}`);
  if(transaction.fromAccountId&&!accountIds.has(transaction.fromAccountId))issues.push(`출금계좌 없음: ${transaction.id}`);
  if(transaction.toAccountId&&!accountIds.has(transaction.toAccountId))issues.push(`입금계좌 없음: ${transaction.id}`);
  if(transaction.accountId&&!accountIds.has(transaction.accountId))issues.push(`보정계좌 없음: ${transaction.id}`);
  if(transaction.liabilityId&&!liabilityIds.has(transaction.liabilityId))issues.push(`부채 없음: ${transaction.id}`);
  if(transaction.type==='internalTransfer'&&transaction.fromAccountId===transaction.toAccountId)issues.push(`동일계좌 이체: ${transaction.id}`);
  const targetKind=(store.accounts||[]).find(account=>account.id===transaction.toAccountId)?.kind||'';
  if(!transaction.meta?.analysisOnly&&['internalTransfer','externalAssetIn'].includes(transaction.type||'')&&targetKind==='isa'){
   const eligible=validationIsaAccounts(transaction.date),explicit=String(transaction.meta?.targetIsaAccountId||'');
   if(eligible.length>1&&!explicit)issues.push(`ISA 납입 대상 미지정: ${transaction.id}`);else if(explicit&&!eligible.some(account=>account.id===explicit))issues.push(`ISA 납입 대상 날짜 불일치: ${transaction.id}`)
  }
  if(!transaction.meta?.analysisOnly&&['internalTransfer','externalAssetIn'].includes(transaction.type||'')&&['pension','irp'].includes(targetKind)){
   const explicit=String(transaction.meta?.targetPensionAccountId||''),dated=validationPensionAccounts(targetKind,transaction.date);
   if(dated.length>1&&!explicit)issues.push(`연금 납입 대상 미지정: ${transaction.id}`);else if(explicit&&!dated.some(account=>account.id===explicit))issues.push(`연금 납입 대상 날짜 불일치: ${transaction.id}`)
  }
 }
 const refunds=new Map<string,number>();
 for(const transaction of store.ledger||[])if(transaction.type==='refund'){
  const original=(store.ledger||[]).find(candidate=>candidate.id===transaction.meta?.refundOf);
  if(!original||!['expense','externalExpense'].includes(original.type||'')||(transaction.date as any)<(original.date as any)||transaction.toAccountId!==(original.type==='expense'?original.fromAccountId:''))issues.push(`환불 원거래 또는 날짜 오류: ${transaction.id}`);
  else{const originalId=String(original.id),total=(refunds.get(originalId)||0)+Number(transaction.amount);refunds.set(originalId,total);if(total>Number(original.amount))issues.push(`환불 누계가 원거래 금액을 초과합니다: ${original.id}`)}
 }
 const operationalRows=(store.ledger||[]).filter(transaction=>!validationIsQaFixture(transaction)),replay=validationReplay(operationalRows,store);
 for(const [id,value] of Object.entries(replay.minAssets||replay.assets))if(value<-.0000001)issues.push(`자산 잔액 음수: ${id}`);
 for(const [id,value] of Object.entries(replay.minLiabilities||replay.liabilities))if(value<-.0000001)issues.push(`부채 잔액 음수: ${id}`);
 for(const product of validationFinancialProducts()){
  if(product.status==='active')continue;
  const id=product.type==='loan'?validationProductLiabilityId(product.id):validationProductAccountId(product.id),value=Math.max(0,Number(product.type==='loan'?replay.liabilities[id]:replay.assets[id])||0);
  if(value>.005)issues.push(`종료상품 잔액 잔존: ${product.name} ${validationWon(value)}`)
 }
 return issues
}
