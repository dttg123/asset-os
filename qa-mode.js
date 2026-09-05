'use strict';

const QA_START_YEAR=2026,QA_END_YEAR=2060,QA_MONTHS=(QA_END_YEAR-QA_START_YEAR+1)*12;
const QA_ISA_SKIP_YEARS=new Set([2027,2031,2036,2042,2049,2054,2058]);
const QA_PENSION_SKIP_YEARS=new Set([2033,2041,2052]);
function qaPad(value){return String(value).padStart(2,'0')}
function qaStamp(date,index=0){return `${date}T12:00:00.${String(index%1000).padStart(3,'0')}Z`}
function qaRound(value,unit=1000){return Math.max(unit,Math.round(Number(value||0)/unit)*unit)}
function qaMarketPrice(year,month,base=100000){
 const age=year-QA_START_YEAR,trend=Math.pow(1.045,age),wave=1+Math.sin((age*12+month)*.37)*.08;
 const shock=([2028,2034,2042,2050,2057].includes(year)?.62:[2029,2035,2043,2051,2058].includes(year)?.82:1);
 return qaRound(base*trend*wave*shock,100)
}
function qaMonthlyContribution(total,index,count,year,month,skip){
 const years=Math.ceil(count/12),yearIndex=Math.floor(index/12),monthsInYear=Math.min(12,count-yearIndex*12),yearBase=Math.floor(total/years),yearTarget=yearBase+(yearIndex===years-1?total-yearBase*years:0),base=Math.floor(yearTarget/monthsInYear);if(skip)return 0;
 let amount=base;if(QA_ISA_SKIP_YEARS.has(year)&&month===6)amount+=base;
 if(month===12||index===count-1)amount+=yearTarget-(base*monthsInYear);
 return amount
}

function qaBuildThirtyFiveYearState(){
 const next=clone(seed),ledger=[],isaAccounts=[],pensionTransactions=[],pensionSnapshots=[];let sequence=0;
 const add=row=>ledger.push({...row,sequence:++sequence,createdAt:qaStamp(row.date,sequence),meta:{...(row.meta||{}),qaGenerated:true}});
 const financialItems=[
  {id:'qa-home-loan',type:'loan',name:'QA 주택담보대출',institution:'테스트은행',status:'active',startDate:'2030-01-01',maturityDate:'2079-12-31',annualRate:4,rateType:'variable',repaymentMethod:'equalPrincipal',contractPrincipal:230000000,termMonths:600,paymentDay:26,rateHistory:[{effectiveFrom:'2030-01-01',rate:4},{effectiveFrom:'2040-01-01',rate:5.2},{effectiveFrom:'2050-01-01',rate:3.4}]},
  {id:'qa-car-loan',type:'loan',name:'QA 자동차대출',institution:'테스트캐피탈',status:'ended',startDate:'2034-01-01',maturityDate:'2038-12-31',endedAt:'2038-12-31',endReason:'paidOff',annualRate:5.2,rateType:'fixed',repaymentMethod:'equalPrincipal',contractPrincipal:30000000,termMonths:60,paymentDay:26},
  {id:'qa-deposit',type:'deposit',name:'QA 정기예금',institution:'테스트은행',status:'active',startDate:'2060-01-01',maturityDate:'2060-12-31',annualRate:3.5,rateType:'fixed',interestMethod:'simple',taxMode:'general',paymentStyle:'lump',contractPrincipal:20000000},
  {id:'qa-savings',type:'savings',name:'QA 월적금',institution:'테스트은행',status:'active',startDate:'2060-01-01',maturityDate:'2060-12-31',annualRate:4.2,rateType:'fixed',interestMethod:'simple',taxMode:'general',paymentStyle:'monthly',scheduledAmount:500000,paymentDay:25,contributionStatus:'active',contractPrincipal:6000000}
 ];
 add({id:'qa-open-cash',date:'2026-01-01',type:'openingAsset',amount:30000000,toAccountId:'cash-main',category:'QA 시작 생활자금'});
 add({id:'qa-open-home-loan',date:'2030-01-01',type:'openingLiability',amount:230000000,liabilityId:'finance-debt-qa-home-loan',category:'주택담보대출 실행'});
 add({id:'qa-open-car-loan',date:'2034-01-01',type:'openingLiability',amount:30000000,liabilityId:'finance-debt-qa-car-loan',category:'자동차대출 실행'});

 for(let cycle=0;cycle<12;cycle++){
  const start=QA_START_YEAR+cycle*3,end=start+2,lastYear=Math.min(end,QA_END_YEAR),count=(lastYear-start+1)*12,id=`qa-isa-${start}`,holdingId=`qa-isa-h-${start}`;
  const targets=[20000000,50000000,60000000],target=Math.round(targets[cycle%3]*count/36),scenario=cycle%3===0?'2천만원':cycle%3===1?'5천만원':'1억원 성장';
  const account={id,name:`QA ISA ${start} · ${scenario}`,type:cycle%4===0?'서민형':'일반형',status:end<=QA_END_YEAR?'closed':'active',openedAt:`${start}-01-01`,closedAt:end<=QA_END_YEAR?`${end}-12-31`:'',maturityAt:`${end}-12-31`,policyId:next.policies.isa.activePolicyId,policyHistory:[],baseline:{date:`${start}-01-01`,cash:0,contribution:0},baselineDate:`${start}-01-01`,baselineCash:0,reconciliationTolerance:10,holdings:[{id:holdingId,name:'QA 미국지수 ETF',securityKey:`QAUSINDEX${start}`,instrumentCode:'379800',quoteType:'stock',quoteSource:'',investmentRole:'성장',baselineQty:0,baselineAvg:0,currentPrice:qaMarketPrice(lastYear,12,100000)}],transactions:[],assetSnapshots:[]};
  let txSequence=0,totalQty=0,cash=0,paid=0;
  for(let i=0;i<count;i++){
   const year=start+Math.floor(i/12),month=i%12+1,md=qaPad(month),date=`${year}-${md}-25`,skip=QA_ISA_SKIP_YEARS.has(year)&&month===5;
   const amount=qaMonthlyContribution(target,i,count,year,month,skip),price=qaMarketPrice(year,month,100000);
   if(amount>0){
    account.transactions.push({id:`${id}-dep-${year}-${md}`,type:'deposit',date,tradeDate:date,sequence:++txSequence,amount,fee:0,tax:0,meta:{qaGenerated:true}});cash+=amount;paid+=amount;
    const qty=Math.max(0,Math.floor((cash/price-0.0001)*10000)/10000),cost=qty*price;if(qty>0){account.transactions.push({id:`${id}-buy-${year}-${md}`,type:'buy',holdingId,date,tradeDate:date,sequence:++txSequence,qty,price,fee:0,tax:0,meta:{qaGenerated:true}});totalQty=Number((totalQty+qty).toFixed(4));cash-=cost}
   }
   if(month===12){const dividend=Math.round(totalQty*120),tax=Math.round(dividend*.154);account.transactions.push({id:`${id}-div-${year}`,type:'dividend',holdingId,date:`${year}-12-26`,tradeDate:`${year}-12-26`,sequence:++txSequence,amount:dividend,fee:0,tax,meta:{qaGenerated:true}});cash+=dividend-tax}
   if(month%3===0){const value=Math.round(totalQty*price);account.assetSnapshots.push({date:`${year}-${md}-28`,cost:paid,value,cash:Math.max(0,Math.round(cash)),totalValue:Math.max(0,Math.round(value+cash)),meta:{qaFixture:true,valueBasis:'securities',totalValueBasis:'securities_plus_cash',grain:'month'}})}
  }
  if(end<=QA_END_YEAR){const price=qaMarketPrice(end,12,112000);account.transactions.push({id:`${id}-close-sell`,type:'sell',holdingId,date:`${end}-12-28`,tradeDate:`${end}-12-28`,sequence:++txSequence,qty:totalQty,price,fee:0,tax:0,meta:{qaGenerated:true}});cash+=totalQty*price;const settlement=Math.round(cash);account.cashSnapshot=settlement;account.holdings[0].snapshotQty=0;account.holdings[0].snapshotAvg=0;account.holdings[0].snapshotPrice=price;account.maturity={decision:'close',actualSettlement:settlement,actualReceived:settlement,actualTax:0};account.assetSnapshots.push({date:`${end}-12-31`,cost:paid,value:0,cash:settlement,totalValue:settlement,meta:{qaFixture:true,valueBasis:'securities',totalValueBasis:'securities_plus_cash',grain:'month'}})}
  isaAccounts.push(account)
 }

 const pensionAccounts=[
  {id:'qa-pension',kind:'pension',name:'QA 한국투자 연금저축',provider:'한국투자증권',status:'active',openedAt:'2026-01-01',closedAt:'',policyId:next.policies.pension.activePolicyId,policyHistory:[]},
  {id:'qa-irp',kind:'irp',name:'QA 한국투자 IRP',provider:'한국투자증권',status:'active',openedAt:'2026-01-01',closedAt:'',policyId:next.policies.irp.activePolicyId,policyHistory:[]}
 ];
 const pensionHoldings=[
  {id:'qa-pension-h',accountId:'qa-pension',name:'QA 연금 미국지수 ETF',productType:'ETF',baselineQty:0,baselineAvgPrice:0,currentPrice:qaMarketPrice(QA_END_YEAR,12,100000),investmentRole:'성장',risky:true},
  {id:'qa-irp-h',accountId:'qa-irp',name:'QA IRP 채권혼합 ETF',productType:'ETF',baselineQty:0,baselineAvgPrice:0,currentPrice:qaMarketPrice(QA_END_YEAR,12,85000),investmentRole:'안정',risky:false}
 ];
 let pensionQty=0,irpQty=0,pensionCost=0,irpCost=0,homeBalance=230000000,carBalance=30000000;
 const leaveMonths=new Set(['2038-05','2047-09']);
 for(let year=QA_START_YEAR;year<=QA_END_YEAR;year++)for(let month=1;month<=12;month++){
  const md=qaPad(month),ym=`${year}-${md}`,salaryDate=`${ym}-21`,transferDate=`${ym}-25`,idx=(year-QA_START_YEAR)*12+month-1,inflation=Math.pow(1.02,year-QA_START_YEAR);
  if(!leaveMonths.has(ym))add({id:`qa-salary-${year}-${md}`,date:salaryDate,type:'externalIncome',amount:qaRound(4342250*Math.pow(1.025,year-QA_START_YEAR),1000),toAccountId:'cash-main',category:'월급'});
  const costs=[['보험',250000,true,5],['통신',70000,true,10],['관리비',180000+(month%4)*18000,true,12],['구독',30000,true,15],['식비',520000+(idx%5)*35000,false,18],['교통',100000+(idx%3)*20000,false,20],['카드값',280000+(idx%7)*55000,false,23],['생활용품',90000+(idx%4)*25000,false,27]];
  for(const [key,raw,fixed,day] of costs)add({id:`qa-expense-${key}-${year}-${md}`,date:`${ym}-${qaPad(day)}`,type:'expense',amount:qaRound(raw*inflation,1000),fromAccountId:'cash-main',fixed,category:key});
  if(idx%29===0)add({id:`qa-extra-medical-${year}-${md}`,date:`${ym}-14`,type:'expense',amount:qaRound((800000+(idx%4)*450000)*inflation,1000),fromAccountId:'cash-main',fixed:false,category:'병원·치과'});
  if(idx%17===8)add({id:`qa-extra-travel-${year}-${md}`,date:`${ym}-14`,type:'expense',amount:qaRound((1200000+(idx%3)*600000)*inflation,1000),fromAccountId:'cash-main',fixed:false,category:'여행'});
  if(idx%61===20)add({id:`qa-extra-appliance-${year}-${md}`,date:`${ym}-14`,type:'expense',amount:qaRound((1800000+(idx%2)*1500000)*inflation,1000),fromAccountId:'cash-main',fixed:false,category:'가전·가구'});
  const pensionSkipped=QA_PENSION_SKIP_YEARS.has(year)&&month===7,pensionAmount=pensionSkipped?0:500000*(QA_PENSION_SKIP_YEARS.has(year)&&month===8?2:1),pensionPrice=qaMarketPrice(year,month,100000),irpPrice=qaMarketPrice(year,month,85000);
  if(pensionAmount){add({id:`qa-pension-transfer-${year}-${md}`,date:transferDate,type:'internalTransfer',amount:pensionAmount,fromAccountId:'cash-main',toAccountId:'pension-link',category:'연금저축 납입',meta:{targetPensionAccountId:'qa-pension'}});const qty=Math.floor(pensionAmount/pensionPrice*10000)/10000;pensionTransactions.push({id:`qa-ptx-pension-${year}-${md}`,accountId:'qa-pension',holdingId:'qa-pension-h',type:'buy',date:transferDate,createdAt:qaStamp(transferDate,1),qty,price:pensionPrice,fee:0,tax:0,note:pensionAmount>500000?'전월 미납 보충매수':'월매수'});pensionQty=Number((pensionQty+qty).toFixed(4));pensionCost+=Math.round(qty*pensionPrice)}
  add({id:`qa-irp-transfer-${year}-${md}`,date:transferDate,type:'internalTransfer',amount:250000,fromAccountId:'cash-main',toAccountId:'irp-link',category:'IRP 납입',meta:{targetPensionAccountId:'qa-irp'}});const iq=Math.floor(250000/irpPrice*10000)/10000;pensionTransactions.push({id:`qa-ptx-irp-${year}-${md}`,accountId:'qa-irp',holdingId:'qa-irp-h',type:'buy',date:transferDate,createdAt:qaStamp(transferDate,2),qty:iq,price:irpPrice,fee:0,tax:0,note:'월매수'});irpQty=Number((irpQty+iq).toFixed(4));irpCost+=Math.round(iq*irpPrice);
  const cycle=Math.floor((year-QA_START_YEAR)/3),cycleStart=QA_START_YEAR+cycle*3,cycleMonths=Math.min((Math.min(cycleStart+2,QA_END_YEAR)-cycleStart+1)*12,36),target=Math.round([20000000,50000000,60000000][cycle%3]*cycleMonths/36),cycleIndex=(year-cycleStart)*12+month-1,skipIsa=QA_ISA_SKIP_YEARS.has(year)&&month===5,isaAmount=qaMonthlyContribution(target,cycleIndex,cycleMonths,year,month,skipIsa);
  if(isaAmount)add({id:`qa-isa-transfer-${year}-${md}`,date:transferDate,type:'internalTransfer',amount:isaAmount,fromAccountId:'cash-main',toAccountId:'isa-link',category:'ISA 납입',meta:{targetIsaAccountId:`qa-isa-${cycleStart}`}});
  if(month===12){const bonus=qaRound((800000+(year%5)*350000)*inflation,1000);add({id:`qa-bonus-${year}`,date:`${year}-12-22`,type:'externalIncome',amount:bonus,toAccountId:'cash-main',category:'성과급'});const pd=Math.round(pensionQty*120),idv=Math.round(irpQty*90);pensionTransactions.push({id:`qa-pension-div-${year}`,accountId:'qa-pension',holdingId:'qa-pension-h',type:'dividend',date:`${year}-12-26`,createdAt:qaStamp(`${year}-12-26`,3),amount:pd,fee:0,tax:Math.round(pd*.154),note:'연금 ETF 분배금'});pensionTransactions.push({id:`qa-irp-div-${year}`,accountId:'qa-irp',holdingId:'qa-irp-h',type:'dividend',date:`${year}-12-26`,createdAt:qaStamp(`${year}-12-26`,4),amount:idv,fee:0,tax:Math.round(idv*.154),note:'IRP ETF 분배금'})}
  pensionSnapshots.push({date:`${ym}-28`,pension:{cost:pensionCost,value:Math.round(pensionQty*pensionPrice),cash:0},irp:{cost:irpCost,value:Math.round(irpQty*irpPrice),cash:0},meta:{qaFixture:true,grain:'month',source:{pension:'asset-os',irp:'asset-os'}}});
  if(year>=2030&&homeBalance>0){const principal=Math.min(homeBalance,383333),rate=year>=2050?.034:year>=2040?.052:.04,interest=Math.round(homeBalance*rate/12);add({id:`qa-home-principal-${year}-${md}`,date:`${ym}-26`,type:'debtPrincipal',amount:principal,fromAccountId:'cash-main',liabilityId:'finance-debt-qa-home-loan',category:'주택대출 원금'});add({id:`qa-home-interest-${year}-${md}`,date:`${ym}-26`,type:'debtInterest',amount:interest,fromAccountId:'cash-main',liabilityId:'finance-debt-qa-home-loan',category:'주택대출 이자',fixed:true});homeBalance-=principal}
  if(year>=2034&&year<=2038&&carBalance>0){const principal=Math.min(carBalance,500000),interest=Math.round(carBalance*.052/12);add({id:`qa-car-principal-${year}-${md}`,date:`${ym}-26`,type:'debtPrincipal',amount:principal,fromAccountId:'cash-main',liabilityId:'finance-debt-qa-car-loan',category:'자동차대출 원금'});add({id:`qa-car-interest-${year}-${md}`,date:`${ym}-26`,type:'debtInterest',amount:interest,fromAccountId:'cash-main',liabilityId:'finance-debt-qa-car-loan',category:'자동차대출 이자',fixed:true});carBalance-=principal}
 }
 next.accounts=isaAccounts;next.settings.selectedAccountId='qa-isa-2059';next.settings.integratedMonth='2060-12';
 next.pension.accounts=pensionAccounts;next.pension.holdings=pensionHoldings;next.pension.transactions=pensionTransactions;next.pension.assetSnapshots=pensionSnapshots;next.pension.projection={birthYear:1995,retirementAge:65,yearsToRetire:0,monthlyContribution:750000,annualReturn:.06,withdrawalRate:.03,inflationRate:.02};
 next.integrated={...buildIntegratedSeed(),startedAt:'2026-01-01',ledger};next.financialProducts={items:financialItems,events:[{id:'qa-interest',productId:'qa-deposit',date:'2060-12-31',type:'interestObserved',amount:700000,label:'QA 이자',note:'가상 데이터'}]};
 next.insurance={policies:[{id:'qa-insurance',name:'QA 건강보험',company:'테스트보험',category:'건강',premium:250000,paymentStyle:'monthly',contractDate:'2026-01-01',coverageEndDate:'2060-12-31',paymentEndDate:'2060-12-31',status:'active',insured:'QA 사용자',contractor:'QA 사용자',coverages:[{name:'진단비',amount:30000000,note:'가상'}],note:'QA 전용'}]};
 const normalized=normalizeState(next),store=normalized.brokerKis,at='2060-12-31T09:00:00Z',pensionPrice=qaMarketPrice(2060,12,100000),irpPrice=qaMarketPrice(2060,12,85000);
 brokerKisImportBalanceSnapshot(store,{date:'2060-12-31',cash:5000000,securitiesValue:Math.round(pensionQty*pensionPrice),totalValue:Math.round(pensionQty*pensionPrice)+5000000,holdings:[{productCode:'QA379800',productName:'QA 미국S&P500 ETF',quantity:pensionQty,avgPrice:pensionQty?pensionCost/pensionQty:0,currentPrice:pensionPrice,marketValue:Math.round(pensionQty*pensionPrice),profitLoss:Math.round(pensionQty*pensionPrice-pensionCost)}]},'pension','qa-pension',at);
 brokerKisImportBalanceSnapshot(store,{date:'2060-12-31',cash:3000000,securitiesValue:Math.round(irpQty*irpPrice),totalValue:Math.round(irpQty*irpPrice)+3000000,holdings:[{productCode:'QAIRP50',productName:'IBK 미국AI TOP10 국채혼합50',quantity:irpQty,avgPrice:irpQty?irpCost/irpQty:0,currentPrice:irpPrice,marketValue:Math.round(irpQty*irpPrice),profitLoss:Math.round(irpQty*irpPrice-irpCost)}]},'irp','qa-irp',at);
 brokerKisImportOrderSnapshots(store,[{orderDate:'2060-12-25',orderTime:'101500',branchNo:'QA',orderNo:'QA0001',productCode:'QA379800',productName:'QA 미국S&P500 ETF',exchangeCode:'KRX',side:'buy',orderQty:5,filledQty:3,filledAmount:3*pensionPrice,remainingQty:2,cancelledQty:0,fee:900,tax:0}], 'pension','qa-pension',at,'2060-12-31');
 brokerKisImportRights(store,[{rightTypeCode:'32',baseDate:'2060-12-01',cashPaymentDate:'2060-12-26',productCode:'QA379800',productName:'QA 미국S&P500 ETF',amount:100000,tax:15000}], 'pension','qa-pension',at);
 brokerKisCompleteSync(store,'pension','qa-pension',at);brokerKisCompleteSync(store,'irp','qa-irp',at);
 normalized.system.qaDataset={version:APP_VERSION,generatedAt:new Date().toISOString(),range:'2026-2060',months:QA_MONTHS,scenario:'real-user-35-years',homeLoanRemaining:homeBalance,carLoanRemaining:carBalance};
 return normalized
}

function qaDatasetStats(){const model=integratedFinancialModel(),isa=state.accounts.reduce((n,a)=>n+(a.transactions||[]).length,0),pension=(state.pension.transactions||[]).length,integrated=(state.integrated.ledger||[]).length,round=n=>Math.round(Number(n)*100)/100;return{isa,pension,integrated,total:isa+pension+integrated,totalAssets:round(model.totalAssets),totalDebt:round(model.totalDebt),netAssets:round(model.netAssets),cash:round(model.cash),isaAccounts:state.accounts.length,months:state.system.qaDataset?.months||0}}
function qaRenderStats(){const box=$('#qaStats');if(!box)return;const s=qaDatasetStats();box.textContent=`2026–2060 · ${nf.format(s.total)}건 · 순자산 ${displayWon(s.netAssets)} · 대출 ${displayWon(s.totalDebt)}`}
function qaGenerateThirtyFiveYears(){if(!QA_MODE)return false;state=qaBuildThirtyFiveYearState();lastPersistedState=clone(state);const ok=persist(false);render();qaRenderStats();toast(ok?'QA 35년 실사용 데이터를 만들었습니다.':'QA 데이터 저장에 실패했습니다.');return ok}
function qaResetData(){if(!QA_MODE)return false;localStorage.removeItem(QA_STORAGE_KEY);state=normalizeState(seed);lastPersistedState=clone(state);persist(false);render();qaRenderStats();toast('QA 데이터만 초기화했습니다.');return true}
function qaRunMistakes(){if(!QA_MODE)return false;const before={integrated:state.integrated.ledger.length,pension:state.pension.transactions.length};const checks=[integratedValidateCandidate({id:'qa-mistake-zero',date:'2060-12-30',type:'expense',amount:0,fromAccountId:'cash-main'}),integratedValidateCandidate({id:'qa-mistake-same',date:'2060-12-30',type:'internalTransfer',amount:1000,fromAccountId:'cash-main',toAccountId:'cash-main'}),integratedValidateCandidate({id:'qa-mistake-over',date:'2060-12-30',type:'expense',amount:1e12,fromAccountId:'cash-main'}),integratedValidateCandidate({id:'qa-mistake-loan',date:'2060-12-30',type:'debtPrincipal',amount:1e12,fromAccountId:'cash-main',liabilityId:'finance-debt-qa-home-loan'}),pensionTransactionSave({accountId:'qa-irp',holdingId:'qa-irp-h',type:'sell',date:'2060-12-30',qty:999999,price:100000,fee:0,tax:0}).error];const blocked=checks.filter(Boolean).length===5&&before.integrated===state.integrated.ledger.length&&before.pension===state.pension.transactions.length;state.system.qaMistakes={checkedAt:new Date().toISOString(),blocked,checks};persist(false);toast(blocked?'실수 5종이 모두 차단됐습니다.':'실수 차단 결과를 확인해 주세요.');return blocked}
function initQaMode(){if(!QA_MODE)return;document.documentElement.classList.add('qa-mode');const banner=$('#qaBanner');if(banner)banner.hidden=false;$$('.statuschip').forEach(x=>x.textContent=`${APP_VERSION} QA`);const versionValue=$('#diagnosticsSheet .diagnostic-row:first-child .diagnostic-value');if(versionValue)versionValue.textContent=`${APP_VERSION} QA`;if(state.system?.qaDataset?.version!==APP_VERSION){state=qaBuildThirtyFiveYearState();lastPersistedState=clone(state);persist(false)}$('#qaGenerate').onclick=()=>showDialog({title:'QA 35년 실사용 데이터 생성',message:'QA 저장소만 덮어씁니다. 운영 데이터와 Supabase에는 접근하지 않습니다.',confirmText:'생성',cancelText:'취소'},qaGenerateThirtyFiveYears);$('#qaMistakes').onclick=qaRunMistakes;$('#qaReset').onclick=()=>showDialog({title:'QA 데이터 초기화',message:'이 브라우저의 QA 데이터만 삭제합니다. 운영 데이터는 유지됩니다.',confirmText:'QA만 초기화',cancelText:'취소'},qaResetData);qaRenderStats()}
