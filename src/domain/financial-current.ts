'use strict';
declare const state:{brokerKis:unknown;accounts:CurrentFinancialAccount[];moduleVerification?:Record<string,boolean>};
declare function integratedStore():CurrentFinancialStore;
declare function integratedReplay():CurrentFinancialReplay;
declare function activeFinancialProducts():Array<{id:string}>;
declare function pensionStore():{accounts:CurrentFinancialAccount[]};
declare function brokerKisCurrentKindTotal(store:unknown,kind:string,ids:string[]):CurrentKisTotal|null;
declare function isCurrentAccount(a:CurrentFinancialAccount):boolean;
declare function accountMetrics(a:CurrentFinancialAccount):CurrentFinancialMetrics;
declare function pensionAssetMetrics(kind:string):CurrentFinancialMetrics;
declare function financialProduct(id:string):{status?:string}|null;
declare function integratedLedger():CurrentFinancialRow[];
declare function integratedMonthKey(date:unknown):string;
declare function integratedLatestMonth():string;


type CurrentFinancialAccount={id:string;kind?:string;productId?:string;status?:string;[key:string]:unknown};
type CurrentFinancialLiability={id:string;productId?:string;[key:string]:unknown};
type CurrentFinancialRow={type:string;date?:string;amount?:unknown;fixed?:boolean;fromAccountId?:string;toAccountId?:string;[key:string]:unknown};
type CurrentFinancialStore={accounts:CurrentFinancialAccount[];liabilities:CurrentFinancialLiability[]};
type CurrentFinancialReplay={assets:Record<string,number>;liabilities:Record<string,number>;[key:string]:unknown};
type CurrentFinancialMetrics={value?:number;cost?:number;source?:string;[key:string]:unknown};
type CurrentKisTotal={authoritative?:boolean;totalValue:number;[key:string]:unknown};

function currentFinancialState(){
 return state
}
function currentIntegratedStore(){
 return integratedStore() as CurrentFinancialStore
}
function currentIntegratedReplay(){
 return integratedReplay() as CurrentFinancialReplay
}
function currentActiveProducts(){
 return activeFinancialProducts() as Array<{id:string}>
}
function currentPensionStore(){
 return pensionStore() as {accounts:CurrentFinancialAccount[]}
}
function currentKisKindTotal(kind:'pension'|'irp',accountIds:string[]){
 return brokerKisCurrentKindTotal(currentFinancialState().brokerKis,kind,accountIds) as CurrentKisTotal|null
}
function currentIsaAccount(account:CurrentFinancialAccount){
 return isCurrentAccount(account) as boolean
}
function currentIsaMetrics(account:CurrentFinancialAccount){
 return accountMetrics(account) as CurrentFinancialMetrics
}
function currentPensionMetrics(kind:'pension'|'irp'){
 return pensionAssetMetrics(kind) as CurrentFinancialMetrics
}
function currentFinancialProduct(id:string){
 return financialProduct(id) as {status?:string}|null
}
function currentIntegratedLedger(){
 return integratedLedger() as CurrentFinancialRow[]
}
function currentIntegratedMonthKey(date:unknown){
 return integratedMonthKey(date) as string
}
function currentIntegratedLatestMonth(){
 return integratedLatestMonth() as string
}

function moduleVerified(kind:'isa'|'pension'|'irp'){return !!currentFinancialState().moduleVerification?.[kind]}

function integratedFinancialModel(){
 const replay=currentIntegratedReplay(),store=currentIntegratedStore(),accounts=store.accounts,activeIds=new Set(currentActiveProducts().map(product=>product.id)),verify={isa:moduleVerified('isa'),pension:moduleVerified('pension'),irp:moduleVerified('irp')};
 let cash=0,deposit=0,savings=0,other=0;
 for(const account of accounts){const value=Math.max(0,Number(replay.assets[account.id]||0)),hasResidual=value>.005,productActive=!account.productId||activeIds.has(account.productId);if(account.kind==='cash')cash+=value;else if(account.kind==='parking'&&(productActive||hasResidual))cash+=value;else if(account.kind==='deposit'&&(productActive||hasResidual))deposit+=value;else if(account.kind==='savings'&&(productActive||hasResidual))savings+=value;else if(account.kind==='other')other+=value}
 const linkedIsa=Math.max(0,Number(replay.assets['isa-link']||0)),linkedPension=Math.max(0,Number(replay.assets['pension-link']||0)),linkedIrp=Math.max(0,Number(replay.assets['irp-link']||0)),activePensionAccounts=currentPensionStore().accounts.filter(account=>account.status==='active'),kisPension=currentKisKindTotal('pension',activePensionAccounts.filter(account=>account.kind==='pension').map(account=>account.id)),kisIrp=currentKisKindTotal('irp',activePensionAccounts.filter(account=>account.kind==='irp').map(account=>account.id)),isaAccountMetrics=(currentFinancialState().accounts||[]).filter((account:CurrentFinancialAccount)=>currentIsaAccount(account)).map((account:CurrentFinancialAccount)=>currentIsaMetrics(account)),isaMetrics={value:isaAccountMetrics.reduce((sum:number,metrics:CurrentFinancialMetrics)=>sum+(Number(metrics.value)||0),0),cost:isaAccountMetrics.reduce((sum:number,metrics:CurrentFinancialMetrics)=>sum+(Number(metrics.cost)||0),0)},isaRecorded=verify.isa||isaMetrics.value>.5||isaMetrics.cost>.5,isa=isaRecorded?Math.max(0,isaMetrics.value||0):linkedIsa,pensionMetrics=currentPensionMetrics('pension'),irpMetrics=currentPensionMetrics('irp'),localPension=Math.max(0,pensionMetrics.value||0),localIrp=Math.max(0,irpMetrics.value||0),useKisPension=!!kisPension&&(kisPension.authoritative===true||kisPension.totalValue>.5||localPension<=.5),useKisIrp=!!kisIrp&&(kisIrp.authoritative===true||kisIrp.totalValue>.5||localIrp<=.5),pension=useKisPension?kisPension.totalValue:localPension,irp=useKisIrp?kisIrp.totalValue:localIrp,available={isa:isaRecorded,pension:useKisPension||verify.pension||localPension>.5,irp:useKisIrp||verify.irp||localIrp>.5};
 let debt=0;
 for(const liability of store.liabilities){const value=Math.max(0,Number(replay.liabilities[liability.id]||0)),product=liability.productId?currentFinancialProduct(liability.productId):null;if(product&&product.status!=='active'&&value<=.005)continue;debt+=value}
 const totalAssets=cash+deposit+savings+isa+pension+irp+other;
 return{cash,deposit,savings,isa,pension,irp,other,totalAssets,totalDebt:debt,netAssets:totalAssets-debt,replay,linked:{isa:linkedIsa,pension:linkedPension,irp:linkedIrp},verified:verify,available,currentSources:{isa:isaRecorded?'asset-os':'linked',pension:useKisPension?'kis':pensionMetrics.source||'asset-os',irp:useKisIrp?'kis':irpMetrics.source||'asset-os'},kis:{pension:kisPension,irp:kisIrp},isComplete:available.isa&&available.pension&&available.irp}
}

function integratedProductSavingAmount(rows:CurrentFinancialRow[]){
 const accountMap=new Map(currentIntegratedStore().accounts.map(account=>[account.id,account]));
 return rows.filter(transaction=>transaction.type==='internalTransfer'&&['deposit','savings'].includes(accountMap.get(transaction.toAccountId||'')?.kind||'')).reduce((sum,transaction)=>sum+(Number(transaction.amount)||0),0)
}

function integratedSummary(month:string=currentIntegratedLatestMonth(),currentModel:ReturnType<typeof integratedFinancialModel>|null=null,sourceRows:CurrentFinancialRow[]|null=null){
 const rows=(sourceRows||currentIntegratedLedger()).filter(transaction=>currentIntegratedMonthKey(transaction.date)===month),accountMap=new Map(currentIntegratedStore().accounts.map(account=>[account.id,account])),sum=(predicate:(transaction:CurrentFinancialRow)=>boolean)=>rows.filter(predicate).reduce((total,transaction)=>total+(Number(transaction.amount)||0),0),income=sum(transaction=>transaction.type==='externalIncome'),fixed=sum(transaction=>(['expense','externalExpense'].includes(transaction.type)&&!!transaction.fixed)||['debtInterest','debtInterestExternal'].includes(transaction.type)),variable=sum(transaction=>['expense','externalExpense'].includes(transaction.type)&&!transaction.fixed),principal=sum(transaction=>['debtPrincipal','externalDebtPrincipal'].includes(transaction.type)),externalOut=sum(transaction=>transaction.type==='externalWithdrawal'),linkedInvest=sum(transaction=>['internalTransfer','externalAssetIn'].includes(transaction.type)&&['isa','pension','irp'].includes(accountMap.get(transaction.toAccountId||'')?.kind||'')),productSaving=integratedProductSavingAmount(rows)+sum(transaction=>transaction.type==='externalAssetIn'&&['deposit','savings'].includes(accountMap.get(transaction.toAccountId||'')?.kind||'')),invest=linkedInvest+productSaving,otherTransfers=sum(transaction=>transaction.type==='internalTransfer'&&!['isa','pension','irp','deposit','savings','parking','cash'].includes(accountMap.get(transaction.toAccountId||'')?.kind||'')),trackedInvest=sum(transaction=>transaction.type==='internalTransfer'&&transaction.fromAccountId==='cash-main'&&['isa','pension','irp','deposit','savings'].includes(accountMap.get(transaction.toAccountId||'')?.kind||'')),operatingCashDelta=income+sum(transaction=>transaction.type==='refund'&&transaction.toAccountId==='cash-main')-sum(transaction=>(transaction.type==='expense'||transaction.type==='debtInterest')&&transaction.fromAccountId==='cash-main')-sum(transaction=>transaction.type==='debtPrincipal'&&transaction.fromAccountId==='cash-main')-trackedInvest-sum(transaction=>transaction.type==='externalWithdrawal'&&transaction.fromAccountId==='cash-main'),model=currentModel||integratedFinancialModel();
 return{month,rows,income,fixed:fixed-sum(transaction=>transaction.type==='refund'&&!!transaction.fixed),variable:variable-sum(transaction=>transaction.type==='refund'&&!transaction.fixed),principal,invest,linkedInvest,productSaving,externalOut,otherTransfers,trackedInvest,operatingCashDelta,...model,replay:model.replay}
}
