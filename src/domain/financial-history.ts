'use strict';

type FinancialHistoryRow={type:string;date?:string;amount?:unknown;delta?:unknown;toAccountId?:string;[key:string]:unknown};
type FinancialHistorySnapshot={date?:string;value?:unknown;totalValue?:unknown;meta?:{qaFixture?:boolean};pension?:{value?:unknown};irp?:{value?:unknown};[key:string]:unknown};
type FinancialHistoryAccount={id:string;kind?:string;productId?:string;openedAt?:string;baselineDate?:string;closedAt?:string;assetSnapshots?:FinancialHistorySnapshot[];[key:string]:unknown};
type FinancialHistoryLiability={id:string;productId?:string;[key:string]:unknown};
type FinancialHistoryStore={accounts:FinancialHistoryAccount[];liabilities:FinancialHistoryLiability[]};
type FinancialHistoryReplay={assets:Record<string,number>;liabilities:Record<string,number>};
type FinancialHistoryProduct={startDate?:string;endedAt?:string;status?:string;maturityDate?:string;settlement?:{date?:string};[key:string]:unknown};

declare function localYmd(value?:Date|string):string;
declare function integratedAnalysisBalanceLedger():FinancialHistoryRow[];
declare function financialProduct(id:string):FinancialHistoryProduct|null;
declare function pensionStore():{accounts:Array<{id:string;kind:string;[key:string]:unknown}>};
declare function pensionAccountActiveOnDate(account:{[key:string]:unknown},asOf:string):boolean;

// The runtime is assembled as ordered classic scripts; these names are supplied by earlier bundles.
function financialHistoryState(){
 // @ts-ignore runtime global supplied by store-state.js
 return state as any
}
function financialHistoryStore(){
 // @ts-ignore runtime global supplied by integrated-ledger.js
 return integratedStore() as unknown as FinancialHistoryStore
}
function financialHistoryReplay(rows:FinancialHistoryRow[],store:FinancialHistoryStore){
 // @ts-ignore runtime global supplied by integrated-ledger.js
 return integratedReplay(rows,store) as FinancialHistoryReplay
}
function financialHistoryQaMode(){
 // @ts-ignore runtime global supplied by core-config.js
 return QA_MODE as boolean
}

function financialProductActiveOnDate(product:FinancialHistoryProduct|null|undefined,asOf:string){
 if(!product)return true;
 const date=String(asOf||localYmd()),end=String(product.endedAt||product.settlement?.date||((product.status==='ended'||product.status==='closed')?product.maturityDate:'')||'');
 if(product.startDate&&date<String(product.startDate))return false;
 if(end&&date>end)return false;
 return true
}

function latestSnapshotAt(list:FinancialHistorySnapshot[]|null|undefined,asOf:string):FinancialHistorySnapshot|null{
 return [...(Array.isArray(list)?list:[])].filter(snapshot=>(!snapshot?.meta?.qaFixture||financialHistoryQaMode())&&String(snapshot.date||'')<=String(asOf||localYmd())).sort((left,right)=>String(left.date||'').localeCompare(String(right.date||''))).at(-1)||null
}

function isaAccountActiveOnDate(account:FinancialHistoryAccount|null|undefined,asOf:string){
 if(!account)return false;
 const date=String(asOf||localYmd()),open=String(account.openedAt||account.baselineDate||'0000-01-01'),close=String(account.closedAt||'');
 return open<=date&&(!close||date<=close)
}

function historicalIsaValue(asOf:string,replayed:FinancialHistoryReplay){
 const linked=Math.max(0,Number(replayed?.assets?.['isa-link']||0)),active=(financialHistoryState().accounts||[]).filter((account:FinancialHistoryAccount)=>isaAccountActiveOnDate(account,asOf));
 if(!active.length)return linked;
 let sum=0,covered=0;
 for(const account of active){const snapshot=latestSnapshotAt(account.assetSnapshots,asOf);if(snapshot){sum+=Math.max(0,Number(snapshot.totalValue??snapshot.value)||0);covered++}}
 return covered===active.length?sum:linked
}

function historicalPensionValue(kind:'pension'|'irp',asOf:string,replayed:FinancialHistoryReplay){
 const linkId=kind==='irp'?'irp-link':'pension-link',linked=Math.max(0,Number(replayed?.assets?.[linkId]||0)),snapshot=latestSnapshotAt(financialHistoryState().pension?.assetSnapshots,asOf);
 if(!snapshot)return linked;
 const row=kind==='irp'?snapshot.irp:snapshot.pension;
 if(!row)return linked;
 return Math.max(0,Number(row.value)||0)
}

function historicalFinancialCoverage(asOf:string,rowsAtDate:FinancialHistoryRow[]|null=null){
 const date=String(asOf||localYmd()).slice(0,10),ledger=rowsAtDate||integratedAnalysisBalanceLedger().filter(transaction=>String(transaction.date||'')<=date),assetEvidence=ledger.some(transaction=>['openingAsset','externalIncome','externalAssetIn','internalTransfer','adjustment'].includes(transaction.type)),missing:string[]=[];
 for(const account of financialHistoryState().accounts||[]){if(!isaAccountActiveOnDate(account,date))continue;if(!latestSnapshotAt(account.assetSnapshots,date))missing.push(`ISA:${account.id}`)}
 const snapshot=latestSnapshotAt(financialHistoryState().pension?.assetSnapshots,date);
 for(const account of pensionStore().accounts||[]){if(!pensionAccountActiveOnDate(account,date))continue;const row=account.kind==='irp'?snapshot?.irp:snapshot?.pension;if(!row)missing.push(`${account.kind}:${account.id}`)}
 return{complete:assetEvidence&&!missing.length,assetEvidence,missing}
}

function historicalFinancialModel(asOf:string=localYmd()){
 const date=String(asOf||localYmd()).slice(0,10),rows=integratedAnalysisBalanceLedger().filter(transaction=>String(transaction.date||'')<=date),store=financialHistoryStore(),replay=financialHistoryReplay(rows,store);
 let cash=0,deposit=0,savings=0,other=0;
 for(const account of store.accounts||[]){const value=Math.max(0,Number(replay.assets[account.id]||0)),product=account.productId?financialProduct(account.productId):null;if(product&&!financialProductActiveOnDate(product,date)&&value<=.005)continue;if(account.kind==='cash'||account.kind==='parking')cash+=value;else if(account.kind==='deposit')deposit+=value;else if(account.kind==='savings')savings+=value;else if(account.kind==='other')other+=value}
 const isa=historicalIsaValue(date,replay),pension=historicalPensionValue('pension',date,replay),irp=historicalPensionValue('irp',date,replay);
 let totalDebt=0;
 for(const liability of store.liabilities||[]){const value=Math.max(0,Number(replay.liabilities[liability.id]||0)),product=liability.productId?financialProduct(liability.productId):null;if(product&&!financialProductActiveOnDate(product,date)&&value<=.005)continue;totalDebt+=value}
 const totalAssets=cash+deposit+savings+isa+pension+irp+other,coverage=historicalFinancialCoverage(date,rows);
 return{asOf:date,cash,deposit,savings,isa,pension,irp,other,totalAssets,totalDebt,netAssets:totalAssets-totalDebt,replay,coverage,isComplete:coverage.complete}
}

function financialGrowthBreakdown(startDate:string,endDate:string){
 const earliest=financialAnalysisEarliestDate(),effectiveStart=String(startDate)<earliest?earliest:String(startDate),start=historicalFinancialModel(effectiveStart),end=historicalFinancialModel(endDate),rows=integratedAnalysisBalanceLedger().filter(transaction=>String(transaction.date||'')>String(start.asOf)&&String(transaction.date||'')<=String(end.asOf));
 let externalNet=0,adjustment=0;
 for(const transaction of rows){const amount=Number(transaction.amount)||0;if(['externalIncome','externalAssetIn','externalDebtPrincipal'].includes(transaction.type)||(transaction.type==='refund'&&transaction.toAccountId))externalNet+=amount;else if(['expense','externalWithdrawal','externalAssetOut','debtInterest'].includes(transaction.type))externalNet-=amount;else if(transaction.type==='adjustment')adjustment+=Number(transaction.delta)||0}
 const netChange=end.netAssets-start.netAssets,assetChange=end.totalAssets-start.totalAssets,debtReduction=start.totalDebt-end.totalDebt,residual=netChange-externalNet-adjustment,rate=start.coverage.complete&&end.coverage.complete&&start.netAssets>0?netChange/start.netAssets*100:null;
 return{start,end,netChange,assetChange,debtReduction,rate,externalNet,adjustment,residual,reconciled:Math.abs(netChange-(externalNet+adjustment+residual))<.01}
}

function financialAnalysisEarliestDate(){
 const ledger=integratedAnalysisBalanceLedger(),assetStart=ledger.filter(transaction=>['openingAsset','externalIncome','externalAssetIn','internalTransfer','adjustment'].includes(transaction.type)&&transaction.date).map(transaction=>String(transaction.date).slice(0,10)).sort()[0];
 if(!assetStart)return localYmd();
 const dates=[assetStart,localYmd()];
 for(const account of financialHistoryState().accounts||[])for(const snapshot of account.assetSnapshots||[])if((!snapshot?.meta?.qaFixture||financialHistoryQaMode())&&snapshot.date&&String(snapshot.date)>=assetStart)dates.push(String(snapshot.date).slice(0,10));
 for(const snapshot of financialHistoryState().pension?.assetSnapshots||[])if((!snapshot?.meta?.qaFixture||financialHistoryQaMode())&&snapshot.date&&String(snapshot.date)>=assetStart)dates.push(String(snapshot.date).slice(0,10));
 return[...new Set(dates)].sort().find(date=>historicalFinancialCoverage(date).complete)||localYmd()
}

function shiftMonthsYmd(date:string,delta:number){
 const match=String(date||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
 if(!match)return String(date||'');
 const total=Number(match[1])*12+(Number(match[2])-1)+Math.trunc(Number(delta)||0),year=Math.floor(total/12),monthIndex=total-year*12,day=Math.min(Number(match[3]),new Date(year,monthIndex+1,0).getDate());
 return `${year}-${String(monthIndex+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}

function financialAnalysisStart(period:string,end:string=localYmd()){
 return period==='3m'?shiftMonthsYmd(end,-3):period==='6m'?shiftMonthsYmd(end,-6):period==='1y'?shiftMonthsYmd(end,-12):period==='3y'?shiftMonthsYmd(end,-36):financialAnalysisEarliestDate()
}

function monthEndYmd(year:number,monthIndex:number){return localYmd(new Date(Number(year),Number(monthIndex)+1,0,12))}

function financialGrowthSeries(period:string='6m'){
 const end=localYmd(),requested=financialAnalysisStart(period,end),earliest=financialAnalysisEarliestDate(),start=requested<earliest?earliest:requested,startDate=new Date(start+'T12:00:00'),endDate=new Date(end+'T12:00:00'),raw:Array<ReturnType<typeof historicalFinancialModel>&{label:string}>=[];
 let year=startDate.getFullYear(),month=startDate.getMonth();
 while(year<endDate.getFullYear()||(year===endDate.getFullYear()&&month<=endDate.getMonth())){const date=monthEndYmd(year,month),asOf=date>end?end:date,model=historicalFinancialModel(asOf);if(asOf>=start&&model.coverage.complete)raw.push({...model,label:`${String(year).slice(-2)}.${String(month+1).padStart(2,'0')}`});month++;if(month>11){month=0;year++}}
 if(!raw.length){const model=historicalFinancialModel(end);raw.push({...model,label:end.slice(2,7).replace('-','.')})}
 const months=raw.length;
 if(months<=18)return raw;
 const grain=months>60?'year':'quarter',map=new Map<string,(typeof raw)[number]>();
 for(const row of raw){const date=new Date(row.asOf+'T12:00:00'),key=grain==='year'?String(date.getFullYear()):`${date.getFullYear()}-Q${Math.floor(date.getMonth()/3)+1}`,label=grain==='year'?String(date.getFullYear()):`${String(date.getFullYear()).slice(-2)} Q${Math.floor(date.getMonth()/3)+1}`;map.set(key,{...row,label})}
 return [...map.values()]
}
