'use strict';

function qaPad(value){return String(value).padStart(2,'0')}
function qaStamp(date,index=0){return `${date}T12:00:00.${qaPad(index%100).padStart(3,'0')}Z`}

function qaBuildThirtyYearState(){
 const next=clone(seed),ledger=[],isaAccounts=[],pensionTransactions=[];let sequence=0;
 const add=row=>ledger.push({...row,sequence:++sequence,createdAt:qaStamp(row.date,sequence),meta:{...(row.meta||{}),qaGenerated:true}});
 add({id:'qa-open-cash',date:'2026-01-01',type:'openingAsset',amount:1000000,toAccountId:'cash-main',category:'QA 시작 현금'});
 for(let cycle=0;cycle<10;cycle++){
  const start=2026+cycle*3,end=start+2,id=`qa-isa-${start}`,holdingId=`qa-isa-h-${start}`;
  const account={id,name:`QA ISA ${start}`,type:'일반형',status:cycle<9?'closed':'active',openedAt:`${start}-01-01`,closedAt:cycle<9?`${end}-12-31`:'',maturityAt:`${end}-12-31`,policyId:next.policies.isa.activePolicyId,policyHistory:[],baseline:{date:`${start}-01-01`,cash:0,contribution:0},baselineDate:`${start}-01-01`,baselineCash:0,reconciliationTolerance:10,holdings:[{id:holdingId,name:'QA 미국지수 ETF',securityKey:'QAUSINDEX',instrumentCode:'379800',quoteType:'stock',quoteSource:'',investmentRole:'성장',baselineQty:0,baselineAvg:0,currentPrice:160000}],transactions:[],assetSnapshots:[]};
  let txSequence=0;
  for(let year=start;year<=end;year++)for(let month=1;month<=12;month++){
   const md=qaPad(month),date=`${year}-${md}-25`;
   account.transactions.push({id:`${id}-dep-${year}-${md}`,type:'deposit',date,tradeDate:date,sequence:++txSequence,amount:1500000,fee:0,tax:0,meta:{qaGenerated:true}});
   account.transactions.push({id:`${id}-buy-${year}-${md}`,type:'buy',holdingId,date,tradeDate:date,sequence:++txSequence,qty:10,price:130000,fee:0,tax:0,meta:{qaGenerated:true}});
   if(month===12)account.transactions.push({id:`${id}-div-${year}`,type:'dividend',holdingId,date:`${year}-12-26`,tradeDate:`${year}-12-26`,sequence:++txSequence,amount:50000,fee:0,tax:7700,meta:{qaGenerated:true}});
  }
  if(cycle<9)account.transactions.push({id:`${id}-close-sell`,type:'sell',holdingId,date:`${end}-12-28`,tradeDate:`${end}-12-28`,sequence:++txSequence,qty:360,price:150000,fee:0,tax:0,meta:{qaGenerated:true}});
  isaAccounts.push(account);
 }
 const pensionAccounts=[
  {id:'qa-pension',kind:'pension',name:'QA 한국투자 연금저축',provider:'한국투자증권',status:'active',openedAt:'2026-01-01',closedAt:'',policyId:next.policies.pension.activePolicyId,policyHistory:[]},
  {id:'qa-irp',kind:'irp',name:'QA 한국투자 IRP',provider:'한국투자증권',status:'active',openedAt:'2026-01-01',closedAt:'',policyId:next.policies.irp.activePolicyId,policyHistory:[]}
 ];
 const pensionHoldings=[
  {id:'qa-pension-h',accountId:'qa-pension',name:'QA 연금 미국지수 ETF',productType:'ETF',baselineQty:0,baselineAvgPrice:0,currentPrice:140000,investmentRole:'성장',risky:true},
  {id:'qa-irp-h',accountId:'qa-irp',name:'QA IRP 채권혼합 ETF',productType:'ETF',baselineQty:0,baselineAvgPrice:0,currentPrice:120000,investmentRole:'안정',risky:false}
 ];
 for(let year=2026;year<=2055;year++)for(let month=1;month<=12;month++){
  const md=qaPad(month),date=`${year}-${md}-25`,isaStart=2026+Math.floor((year-2026)/3)*3;
  add({id:`qa-salary-${year}-${md}`,date,type:'externalIncome',amount:4342250,toAccountId:'cash-main',category:'월급'});
  for(const [key,amount,fixed] of [['보험',250000,true],['통신',70000,true],['관리비',180000,true],['구독',30000,true],['식비',650000,false],['교통',120000,false],['여가',200000,false],['의료',80000,false]])add({id:`qa-expense-${key}-${year}-${md}`,date,type:'expense',amount,fromAccountId:'cash-main',fixed,category:key});
  add({id:`qa-pension-transfer-${year}-${md}`,date,type:'internalTransfer',amount:500000,fromAccountId:'cash-main',toAccountId:'pension-link',category:'연금저축 납입',meta:{targetPensionAccountId:'qa-pension'}});
  add({id:`qa-irp-transfer-${year}-${md}`,date,type:'internalTransfer',amount:250000,fromAccountId:'cash-main',toAccountId:'irp-link',category:'IRP 납입',meta:{targetPensionAccountId:'qa-irp'}});
  add({id:`qa-isa-transfer-${year}-${md}`,date,type:'internalTransfer',amount:1500000,fromAccountId:'cash-main',toAccountId:'isa-link',category:'ISA 납입',meta:{targetIsaAccountId:`qa-isa-${isaStart}`}});
  pensionTransactions.push({id:`qa-ptx-pension-${year}-${md}`,accountId:'qa-pension',holdingId:'qa-pension-h',type:'buy',date,createdAt:qaStamp(date,1),qty:5,price:100000,fee:0,tax:0,note:'QA 월매수'});
  pensionTransactions.push({id:`qa-ptx-irp-${year}-${md}`,accountId:'qa-irp',holdingId:'qa-irp-h',type:'buy',date,createdAt:qaStamp(date,2),qty:2.5,price:100000,fee:0,tax:0,note:'QA 월매수'});
  if(month===12){
   add({id:`qa-bonus-${year}`,date:`${year}-12-26`,type:'externalIncome',amount:1000000,toAccountId:'cash-main',category:'성과급'});
   pensionTransactions.push({id:`qa-pension-div-${year}`,accountId:'qa-pension',holdingId:'qa-pension-h',type:'dividend',date:`${year}-12-26`,createdAt:qaStamp(`${year}-12-26`,3),amount:100000,fee:0,tax:15000,note:'QA 배당'});
   pensionTransactions.push({id:`qa-irp-div-${year}`,accountId:'qa-irp',holdingId:'qa-irp-h',type:'dividend',date:`${year}-12-26`,createdAt:qaStamp(`${year}-12-26`,4),amount:50000,fee:0,tax:7500,note:'QA 배당'});
  }
 }
 next.accounts=isaAccounts;next.settings.selectedAccountId='qa-isa-2053';next.settings.integratedMonth='2055-12';
 next.pension.accounts=pensionAccounts;next.pension.holdings=pensionHoldings;next.pension.transactions=pensionTransactions;next.pension.projection={birthYear:1990,retirementAge:65,yearsToRetire:0,monthlyContribution:750000,annualReturn:.06,withdrawalRate:.03,inflationRate:.02};
 next.integrated={...buildIntegratedSeed(),startedAt:'2026-01-01',ledger};
 next.financialProducts={items:[{id:'qa-deposit',type:'deposit',name:'QA 정기예금',institution:'테스트은행',status:'active',startDate:'2055-01-01',maturityDate:'2055-12-31',annualRate:3.5,rateType:'fixed',interestMethod:'simple',taxMode:'general',paymentStyle:'lump',contractPrincipal:20000000},{id:'qa-savings',type:'savings',name:'QA 월적금',institution:'테스트은행',status:'active',startDate:'2055-01-01',maturityDate:'2055-12-31',annualRate:4.2,rateType:'fixed',interestMethod:'simple',taxMode:'general',paymentStyle:'monthly',scheduledAmount:500000,paymentDay:25,contributionStatus:'active',contractPrincipal:6000000}],events:[{id:'qa-interest',productId:'qa-deposit',date:'2055-12-31',type:'interestObserved',amount:700000,label:'QA 이자',note:'가상 데이터'}]};
 next.insurance={policies:[{id:'qa-insurance',name:'QA 건강보험',company:'테스트보험',category:'건강',premium:250000,paymentStyle:'monthly',contractDate:'2026-01-01',coverageEndDate:'2055-12-31',paymentEndDate:'2055-12-31',status:'active',insured:'QA 사용자',contractor:'QA 사용자',coverages:[{name:'진단비',amount:30000000,note:'가상'}],note:'QA 전용'}]};
 const normalized=normalizeState(next),store=normalized.brokerKis,at='2055-12-31T09:00:00Z';
 brokerKisImportBalanceSnapshot(store,{date:'2055-12-31',cash:18000000,securitiesValue:162000000,totalValue:180000000,holdings:[{productCode:'QA379800',productName:'QA 미국S&P500 ETF',quantity:900,avgPrice:130000,currentPrice:180000,marketValue:162000000,profitLoss:45000000}]},'pension','qa-pension',at);
 brokerKisImportBalanceSnapshot(store,{date:'2055-12-31',cash:9000000,securitiesValue:81000000,totalValue:90000000,holdings:[{productCode:'QAIRP50',productName:'QA 채권혼합 ETF',quantity:675,avgPrice:100000,currentPrice:120000,marketValue:81000000,profitLoss:13500000}]},'irp','qa-irp',at);
 brokerKisImportOrderSnapshots(store,[{orderDate:'2055-12-25',orderTime:'101500',branchNo:'QA',orderNo:'QA0001',productCode:'QA379800',productName:'QA 미국S&P500 ETF',exchangeCode:'KRX',side:'buy',orderQty:5,filledQty:5,filledAmount:900000,remainingQty:0,cancelledQty:0,fee:900,tax:0}], 'pension','qa-pension',at,'2055-12-31');
 brokerKisImportRights(store,[{rightTypeCode:'32',baseDate:'2055-12-01',cashPaymentDate:'2055-12-26',productCode:'QA379800',productName:'QA 미국S&P500 ETF',amount:100000,tax:15000}], 'pension','qa-pension',at);
 brokerKisCompleteSync(store,'pension','qa-pension',at);brokerKisCompleteSync(store,'irp','qa-irp',at);
 normalized.system.qaDataset={generatedAt:new Date().toISOString(),range:'2026-2055',months:360};
 return normalized
}

function qaDatasetStats(){const replayed=integratedReplay(),isa=state.accounts.reduce((n,a)=>n+(a.transactions||[]).length,0),pension=(state.pension.transactions||[]).length,integrated=(state.integrated.ledger||[]).length;return{isa,pension,integrated,total:isa+pension+integrated,totalAssets:replayed.totalAssets,cash:replayed.assets['cash-main']||0}}
function qaRenderStats(){const box=$('#qaStats');if(!box)return;const s=qaDatasetStats();box.textContent=`2026–2055 · ${nf.format(s.total)}건 · 원장자산 ${displayWon(s.totalAssets)}`}
function qaGenerateThirtyYears(){if(!QA_MODE)return false;state=qaBuildThirtyYearState();lastPersistedState=clone(state);const ok=persist(false);render();qaRenderStats();toast(ok?'QA 30년 데이터 생성을 완료했습니다.':'QA 데이터 저장에 실패했습니다.');return ok}
function qaResetData(){if(!QA_MODE)return false;localStorage.removeItem(QA_STORAGE_KEY);state=normalizeState(seed);lastPersistedState=clone(state);persist(false);render();qaRenderStats();toast('QA 데이터만 초기화했습니다.');return true}
function qaRunMistakes(){if(!QA_MODE)return false;const before={integrated:state.integrated.ledger.length,pension:state.pension.transactions.length};const checks=[integratedValidateCandidate({id:'qa-mistake-zero',date:'2055-12-30',type:'expense',amount:0,fromAccountId:'cash-main'}),integratedValidateCandidate({id:'qa-mistake-same',date:'2055-12-30',type:'internalTransfer',amount:1000,fromAccountId:'cash-main',toAccountId:'cash-main'}),integratedValidateCandidate({id:'qa-mistake-over',date:'2055-12-30',type:'expense',amount:1e12,fromAccountId:'cash-main'}),pensionTransactionSave({accountId:'qa-irp',holdingId:'qa-irp-h',type:'sell',date:'2055-12-30',qty:999999,price:100000,fee:0,tax:0}).error];const blocked=checks.filter(Boolean).length===4&&before.integrated===state.integrated.ledger.length&&before.pension===state.pension.transactions.length;state.system.qaMistakes={checkedAt:new Date().toISOString(),blocked,checks};persist(false);toast(blocked?'실수 4종이 모두 차단됐습니다.':'실수 차단 결과를 확인해 주세요.');return blocked}
function initQaMode(){if(!QA_MODE)return;document.documentElement.classList.add('qa-mode');const banner=$('#qaBanner');if(banner)banner.hidden=false;$('#qaGenerate').onclick=()=>showDialog({title:'QA 30년 데이터 생성',message:'QA 저장소만 덮어씁니다. 운영 데이터와 Supabase에는 접근하지 않습니다.',confirmText:'생성',cancelText:'취소'},qaGenerateThirtyYears);$('#qaMistakes').onclick=qaRunMistakes;$('#qaReset').onclick=()=>showDialog({title:'QA 데이터 초기화',message:'이 브라우저의 QA 데이터만 삭제합니다. 운영 데이터는 유지됩니다.',confirmText:'QA만 초기화',cancelText:'취소'},qaResetData);qaRenderStats()}
