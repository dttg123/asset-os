'use strict';

type IntegratedReplayTransactionType='openingAsset'|'openingLiability'|'refund'|'externalIncome'|'externalAssetIn'|'expense'|'debtInterest'|'externalWithdrawal'|'externalAssetOut'|'debtPrincipal'|'externalDebtPrincipal'|'debtInterestExternal'|'externalExpense'|'internalTransfer'|'adjustment';
interface IntegratedReplayAccount {id?:string}
interface IntegratedReplayLiability {id?:string}
interface IntegratedReplayStore {accounts?:IntegratedReplayAccount[];liabilities?:IntegratedReplayLiability[]}
interface IntegratedReplayTransaction {
 date?:string;sequence?:number|string;createdAt?:string;type?:IntegratedReplayTransactionType;
 amount?:unknown;delta?:unknown;toAccountId?:string;fromAccountId?:string;accountId?:string;liabilityId?:string;
}
interface IntegratedReplayResult {
 assets:Record<string,number>;liabilities:Record<string,number>;minAssets:Record<string,number>;minLiabilities:Record<string,number>;
 totalAssets:number;totalDebt:number;netAssets:number;
}

function compareIntegratedTransactions(a:IntegratedReplayTransaction,b:IntegratedReplayTransaction){
 const date=String(a.date||'').localeCompare(String(b.date||''));if(date)return date;
 const left=Number.isFinite(Number(a.sequence))?Number(a.sequence):null,right=Number.isFinite(Number(b.sequence))?Number(b.sequence):null;
 if(left!==null&&right!==null&&left!==right)return left-right;
 const leftCreated=String(a.createdAt||''),rightCreated=String(b.createdAt||'');if(leftCreated&&rightCreated&&leftCreated!==rightCreated)return leftCreated.localeCompare(rightCreated);return 0
}
function calculateIntegratedReplay(store:IntegratedReplayStore|null|undefined,rows:IntegratedReplayTransaction[]|null|undefined):IntegratedReplayResult{
 const source=store||{},assets=new Map<string|undefined,number>((source.accounts||[]).map(account=>[account.id,0])),liabilities=new Map<string|undefined,number>((source.liabilities||[]).map(liability=>[liability.id,0])),minAssets=new Map<string|undefined,number>((source.accounts||[]).map(account=>[account.id,0])),minLiabilities=new Map<string|undefined,number>((source.liabilities||[]).map(liability=>[liability.id,0])),ordered=[...(rows||[])].sort(compareIntegratedTransactions);
 const addAsset=(id:string|undefined,delta:unknown)=>{if(assets.has(id)){const next=(assets.get(id)||0)+Number(delta||0);assets.set(id,next);minAssets.set(id,Math.min(minAssets.get(id)||0,next))}};
 const addLiability=(id:string|undefined,delta:unknown)=>{if(liabilities.has(id)){const next=(liabilities.get(id)||0)+Number(delta||0);liabilities.set(id,next);minLiabilities.set(id,Math.min(minLiabilities.get(id)||0,next))}};
 for(const transaction of ordered){const amount=Number(transaction.amount)||0;if(!amount&&transaction.type!=='adjustment')continue;switch(transaction.type){case'openingAsset':addAsset(transaction.toAccountId,amount);break;case'openingLiability':addLiability(transaction.liabilityId,amount);break;case'refund':case'externalIncome':case'externalAssetIn':addAsset(transaction.toAccountId,amount);break;case'expense':case'debtInterest':case'externalWithdrawal':case'externalAssetOut':addAsset(transaction.fromAccountId,-amount);break;case'debtPrincipal':addAsset(transaction.fromAccountId,-amount);addLiability(transaction.liabilityId,-amount);break;case'externalDebtPrincipal':addLiability(transaction.liabilityId,-amount);break;case'debtInterestExternal':case'externalExpense':break;case'internalTransfer':addAsset(transaction.fromAccountId,-amount);addAsset(transaction.toAccountId,amount);break;case'adjustment':addAsset(transaction.accountId,Number(transaction.delta)||0);break}}
 const totalAssets=[...assets.values()].reduce((left,right)=>left+right,0),totalDebt=[...liabilities.values()].reduce((left,right)=>left+right,0);
 return{assets:Object.fromEntries(assets),liabilities:Object.fromEntries(liabilities),minAssets:Object.fromEntries(minAssets),minLiabilities:Object.fromEntries(minLiabilities),totalAssets,totalDebt,netAssets:totalAssets-totalDebt}
}
