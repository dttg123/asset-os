'use strict';
declare const state:{integrated?:IntegratedLedgerStore};
declare const seed:{integrated:IntegratedLedgerStore};
declare function compareIntegratedTransactions(left:IntegratedLedgerRow,right:IntegratedLedgerRow):number;
declare function calculateIntegratedReplay(store:IntegratedLedgerStore,rows:IntegratedLedgerRow[]):{assets:Record<string,number>;liabilities:Record<string,number>;minAssets:Record<string,number>;minLiabilities:Record<string,number>;totalAssets:number;totalDebt:number;netAssets:number};
declare function localYmd():string;
declare function centralIsaContributionRows():IntegratedLedgerRow[];


type IntegratedLedgerRow={id:string;type:string;date:string;sequence?:unknown;amount:number;meta:({qaFixture?:boolean}&Record<string,unknown>);[key:string]:unknown};
type IntegratedLedgerStore={startedAt?:string;ledger:IntegratedLedgerRow[];accounts:Array<{id:string;kind?:string;[key:string]:unknown}>;liabilities:Array<{id:string;[key:string]:unknown}>;[key:string]:unknown};

function ledgerState(){
 return state as {integrated?:IntegratedLedgerStore}
}
function ledgerSeed(){
 return seed as {integrated:IntegratedLedgerStore}
}
function ledgerCompare(left:IntegratedLedgerRow,right:IntegratedLedgerRow){
 return compareIntegratedTransactions(left,right) as number
}
function ledgerCalculateReplay(store:IntegratedLedgerStore,rows:IntegratedLedgerRow[]){
 return calculateIntegratedReplay(store,rows) as {assets:Record<string,number>;liabilities:Record<string,number>;minAssets:Record<string,number>;minLiabilities:Record<string,number>;totalAssets:number;totalDebt:number;netAssets:number}
}
function ledgerLocalYmd(){
 return localYmd() as string
}
function ledgerCentralIsaRows(){
 return centralIsaContributionRows() as IntegratedLedgerRow[]
}

function integratedStore(){return ledgerState().integrated||ledgerSeed().integrated}
function integratedManualLedger(){return [...(integratedStore().ledger||[])]}
function integratedLinkedLedger():IntegratedLedgerRow[]{return []}
function integratedTxOrder(left:IntegratedLedgerRow,right:IntegratedLedgerRow){return ledgerCompare(left,right)}
function nextIntegratedSequence(date:unknown){let max=0;for(const transaction of integratedStore().ledger||[])if(String(transaction.date||'')===String(date)&&Number.isFinite(Number(transaction.sequence)))max=Math.max(max,Number(transaction.sequence));return max+1}
function isQaIntegratedFixture(transaction:IntegratedLedgerRow){return !!transaction?.meta?.qaFixture}
function integratedOperationalLedger(){return [...integratedManualLedger().filter(transaction=>!isQaIntegratedFixture(transaction)),...integratedLinkedLedger().filter(transaction=>!isQaIntegratedFixture(transaction))].sort(integratedTxOrder)}
function integratedAnalysisBalanceLedger(){const start=String(integratedStore().startedAt||''),manual=integratedManualLedger().filter(transaction=>!isQaIntegratedFixture(transaction)),linked=(start?integratedLinkedLedger().filter(transaction=>String(transaction.date)>=start):[]).filter(transaction=>!isQaIntegratedFixture(transaction));return [...manual,...linked].sort(integratedTxOrder)}
function isaCurrentMonthContribution(month:string=ledgerLocalYmd().slice(0,7)){return ledgerCentralIsaRows().filter(transaction=>integratedMonthKey(transaction.date)===month).reduce((sum,transaction)=>sum+(Number(transaction.amount)||0),0)}
function integratedLedger(){return integratedOperationalLedger()}
function integratedBalanceLedger(){const start=String(integratedStore().startedAt||''),manual=integratedManualLedger().filter(transaction=>!isQaIntegratedFixture(transaction)),linked=(start?integratedLinkedLedger().filter(transaction=>String(transaction.date)>=start):[]).filter(transaction=>!isQaIntegratedFixture(transaction));return [...manual,...linked].sort(integratedTxOrder)}
function integratedMonthKey(value:unknown){return String(value||'').slice(0,7)}
function integratedLatestMonth(){const rows=integratedLedger().filter(transaction=>!['openingAsset','openingLiability'].includes(transaction.type||''));return rows.length?integratedMonthKey(rows[rows.length-1].date):ledgerLocalYmd().slice(0,7)}
function integratedReplay(rows:IntegratedLedgerRow[]|null=null,store:IntegratedLedgerStore=integratedStore()){
 const source=store||integratedStore(),useRows=rows===null?integratedBalanceLedger():rows;
 return ledgerCalculateReplay(source,useRows)
}
