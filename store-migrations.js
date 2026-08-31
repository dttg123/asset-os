'use strict';
function stripInvestmentQaFixtures(target){
 const next=target,store=next.integrated||null;
 // 실사용 상태에서는 알려진 QA fixture만 제거한다. 일반 사용자 데이터는 보존한다.
 const hadIntegratedQa=!!store&&((store.ledger||[]).some(x=>x?.meta?.qaFixture)||(store.accounts||[]).some(x=>x?.meta?.qaFixture||/^qa30-/.test(String(x.id||'')))||(store.liabilities||[]).some(x=>x?.meta?.qaFixture||/^qa30-/.test(String(x.id||''))));
 next.accounts=(next.accounts||[]).filter(a=>!['isa-closed','isa-transfer'].includes(String(a.id||'')));
 for(const a of next.accounts){a.assetSnapshots=(a.assetSnapshots||[]).filter(x=>!x?.meta?.qaFixture);a.transactions=(a.transactions||[]).filter(x=>!x?.meta?.qaFixture);delete a.qaDividendHistory}
 if(store){store.ledger=(store.ledger||[]).filter(x=>!x?.meta?.qaFixture);if(hadIntegratedQa){store.accounts=(store.accounts||[]).filter(x=>!x?.meta?.qaFixture&&!/^qa30-/.test(String(x.id||'')));store.liabilities=(store.liabilities||[]).filter(x=>!x?.meta?.qaFixture&&!/^qa30-/.test(String(x.id||'')));if(String(store.startedAt||'')==='1996-09-01')store.startedAt=''}}
 const isa=next.accounts.find(a=>a.id==='isa-active');
 if(isa){
  const fixtureHoldings=new Set(['h-a1','h-a2','h-a3','h-a4','h-a5']),fixtureTx=new Set(['t-a1','t-a2','t-a3','t-a4','t-a5','t-a6','t-a7','t-a8','t-a9']);
  isa.holdings=(isa.holdings||[]).filter(h=>!fixtureHoldings.has(String(h.id||'')));
  isa.transactions=(isa.transactions||[]).filter(t=>!fixtureTx.has(String(t.id||'')));
  if(Number(isa.cashOpening)===780000)isa.cashOpening=0;if(Number(isa.baselineCash)===780000)isa.baselineCash=0;if(isa.baseline&&Number(isa.baseline.cash)===780000)isa.baseline.cash=0;
  if(Number(isa.annualContribution)===12000000)isa.annualContribution=0;if(Number(isa.contributionBaseline)===11000000)isa.contributionBaseline=0;delete isa.qaDividendHistory;
  const tb=isa.taxBreakdown||{};if(Number(tb.gains)===1100000&&Number(tb.losses)===-250000&&Number(tb.dividends)===480000)isa.taxBreakdown={gains:0,losses:0,dividends:0,expenses:0};
 }
 next.pension=next.pension||clone(seed.pension);
 const pHoldIds=new Set(['ph-ps-nasdaq','ph-ps-sp500','ph-ps-dividend','ph-ps-bond','ph-ps-reit','ph-irp-sp500','ph-irp-sox','ph-irp-dividend','ph-irp-bond','ph-irp-cash']),pIncomeIds=new Set(['pi-2026-02','pi-2026-04','pi-2026-06','pi-2026-07']);
 const legacyPensionSnapshots=new Set([
  '2026-01-31|4985000|5150000|7315000|7400000','2026-02-28|5485000|5550000|7565000|7720000','2026-03-31|5985000|6150000|7815000|8050000','2026-04-30|6485000|6650000|8065000|8350000',
  '2026-05-31|6985000|7250000|8315000|8680000','2026-06-30|7485000|7850000|8565000|9020000','2026-07-31|7985000|8550000|8815000|9330000','2026-08-20|8485000|9175000|9065000|9675000'
 ]);
 const pensionSnapshotKey=x=>[String(x?.date||''),Number(x?.pension?.cost)||0,Number(x?.pension?.value)||0,Number(x?.irp?.cost)||0,Number(x?.irp?.value)||0].join('|');
 next.pension.holdings=(next.pension.holdings||[]).filter(x=>!pHoldIds.has(String(x.id||''))&&!x?.meta?.qaFixture);
 next.pension.incomes=(next.pension.incomes||[]).filter(x=>!pIncomeIds.has(String(x.id||''))&&!x?.meta?.qaFixture);
 next.pension.assetSnapshots=(next.pension.assetSnapshots||[]).filter(x=>!x?.meta?.qaFixture&&!legacyPensionSnapshots.has(pensionSnapshotKey(x)));
 return next
}
function applyRealFinanceBootstrap(target){
 const next=target;next.financialProducts=normalizeFinancialProducts(next.financialProducts);next.financeSchedules=normalizeFinanceSchedules(next.financeSchedules);next.moduleVerification={isa:false,pension:false,irp:false,...(next.moduleVerification||{})};syncPensionDerivedHoldings({pension:next.pension});stripInvestmentQaFixtures(next);
 // 기존 검토용 납입 데이터는 실제 초기데이터와 절대 합산하지 않는다.
 next.pension=next.pension||clone(seed.pension);next.pension.contributions=(next.pension.contributions||[]).filter(x=>!/^pc-2026-(?:0[1-8])-(?:ps|irp)$/.test(String(x.id||'')));
 for(const a of next.accounts||[]){if(a.id==='isa-active'){a.transactions=(a.transactions||[]).filter(t=>t.id!=='t-a1');if(Number(a.annualContribution)===12000000)a.annualContribution=0;if(Number(a.contributionBaseline)===11000000)a.contributionBaseline=0}}
 const products=[
  {id:'fp-real-youth-leap',type:'savings',name:'신한 청년도약계좌',institution:'신한은행',status:'active',startDate:'2025-05-27',maturityDate:'2030-05-27',termMonths:60,annualRate:4.5,rateType:'unknown',interestMethod:'unknown',taxMode:'unknown',taxRate:0,paymentStyle:'monthly',scheduledAmount:700000,paymentDay:25,contributionStatus:'active',productSubtype:'youthLeap',governmentSupport:true,memo:'5년 만기 · 월 70만원. 현재 적용금리 4.50%는 2026-08-25 확인값.',rateHistory:[{effectiveFrom:'2026-08-25',rate:4.5}]},
  {id:'fp-real-housing',type:'savings',name:'마이홈플랜 주택청약 종합저축',institution:'신한은행',status:'active',startDate:'2018-02-20',maturityDate:'',termMonths:0,annualRate:3.1,rateType:'variable',interestMethod:'unknown',taxMode:'unknown',taxRate:0,paymentStyle:'free',scheduledAmount:0,paymentDay:0,contributionStatus:'paused',productSubtype:'housingSubscription',governmentSupport:false,memo:'자유납입 · 최근 납입 없음. 현재 적용금리 3.10%는 2026-08-25 확인값.',rateHistory:[{effectiveFrom:'2026-08-25',rate:3.1}]},
  {id:'fp-real-loan',type:'loan',name:'신한 대출 (이름 미설정)',institution:'신한은행',status:'active',startDate:'',maturityDate:'2027-03-31',termMonths:0,annualRate:4.82,rateType:'unknown',interestMethod:'unknown',taxMode:'unknown',taxRate:0,paymentStyle:'lump',scheduledAmount:0,paymentDay:25,contributionStatus:'active',repaymentMethod:'unknown',contractPrincipal:0,memo:'현재 대출잔액 3,800만원. 대출 종류·최초 계약금액·상환방식은 아직 미확인.',rateHistory:[{effectiveFrom:'2026-07-25',rate:4.82}]}
 ];
 for(const p of products)if(!next.financialProducts.items.some(x=>x.id===p.id))next.financialProducts.items.push(p);
 syncFinancialProductStructures(next);
 const youthAccount=financeProductAccountId('fp-real-youth-leap'),housingAccount=financeProductAccountId('fp-real-housing'),loanId=financeProductLiabilityId('fp-real-loan'),has=id=>next.integrated.ledger.some(t=>t.id===id);
 const rows=[
  {id:'real-open-youth-105',date:'2026-08-24',type:'openingAsset',amount:10500000,toAccountId:youthAccount,category:'청년도약계좌 기존 원금',note:'2026-08-25 확인 전 잔액을 기초자산으로 반영',productId:'fp-real-youth-leap'},
  {id:'real-youth-20260825',date:'2026-08-25',type:'externalAssetIn',amount:700000,toAccountId:youthAccount,category:'청년도약계좌 납입',note:'2026-08-25 실제 납입 확인',productId:'fp-real-youth-leap',meta:{scheduleId:'sched-youth',scheduleDate:'2026-08-25',scheduledAmount:700000}},
  {id:'real-open-housing',date:'2026-08-25',type:'openingAsset',amount:8400000,toAccountId:housingAccount,category:'주택청약 기초잔액',note:'2026-08-25 확인 잔액',productId:'fp-real-housing'},
  {id:'real-open-loan',date:'2026-08-25',type:'openingLiability',amount:38000000,liabilityId:loanId,category:'신한 대출 시작 잔액',note:'2026-08-25 확인 잔액',productId:'fp-real-loan'},
  {id:'real-loan-interest-ledger-20260825',date:'2026-08-25',type:'debtInterestExternal',amount:155560,liabilityId:loanId,category:'대출이자',note:'2026-07-25~2026-08-24 약정이자 · 실제 납부 확인',productId:'fp-real-loan',meta:{scheduleId:'sched-loan-interest',scheduleDate:'2026-08-25',scheduledAmount:155560}}
 ];
 for(const r of rows)if(!next.integrated.ledger.some(t=>t.id===r.id))next.integrated.ledger.push(r)
 const ev=id=>next.financialProducts.events.some(e=>e.id===id);if(!ev('real-youth-gov-20260825'))next.financialProducts.events.push({id:'real-youth-gov-20260825',productId:'fp-real-youth-leap',date:'2026-08-25',type:'governmentContribution',amount:273000,label:'정부기여금 누적 확인',note:'2026-08-25 화면에서 확인한 누적액',meta:{includedInAsset:false}});if(!ev('real-loan-interest-20260825'))next.financialProducts.events.push({id:'real-loan-interest-20260825',productId:'fp-real-loan',date:'2026-08-25',type:'interestObserved',amount:155560,label:'최근 이자 납부 확인',note:'2026-08-25 실제 납부액 확인',meta:{periodStart:'2026-07-25',periodEnd:'2026-08-24',rate:4.82}});
 const schedules=[
  {id:'sched-salary',name:'월급',kind:'income',amount:4342250,day:25,startDate:'2026-08-25',recurrence:'monthly',active:true,note:'매월 25일'},
  {id:'sched-pension',name:'연금저축 납입',kind:'investment',amount:500000,day:25,startDate:'2026-08-25',recurrence:'monthly',targetKind:'pension',targetAccountId:'pension-link',active:true,note:'매월 25일 · 통합에서만 납입 기록'},
  {id:'sched-irp',name:'IRP 납입',kind:'investment',amount:250000,day:25,startDate:'2026-08-25',recurrence:'monthly',targetKind:'irp',targetAccountId:'irp-link',active:true,note:'매월 25일 · 통합에서만 납입 기록'},
  {id:'sched-youth',name:'청년도약계좌 납입',kind:'saving',amount:700000,day:25,startDate:'2026-08-25',endDate:'2030-05-27',recurrence:'monthly',productId:'fp-real-youth-leap',active:true,note:'월 70만원'},
  {id:'sched-loan-interest',name:'대출 이자 납부',kind:'loan',amount:155560,amountMode:'estimate',day:25,startDate:'2026-08-25',endDate:'2027-03-31',recurrence:'monthly',productId:'fp-real-loan',liabilityId:loanId,active:true,note:'최근 확인 이자 기준 · 실제 금액이 다르면 추후 수정'},
  {id:'sched-ins-mobile',name:'카카오페이 휴대폰보험',kind:'insurance',amount:5300,day:25,startDate:'2026-08-25',endDate:'2028-01-31',recurrence:'monthly',active:true,needsDate:false,note:'매월 25일'},
  {id:'sched-ins-hanwha',name:'한화 더건강한1040 종합보험',kind:'insurance',amount:26414,day:25,startDate:'2026-08-25',endDate:'2045-08-31',recurrence:'monthly',active:true,needsDate:false,note:'매월 25일'},
  {id:'sched-ins-kb',name:'KB 5.10.10 건강보험',kind:'insurance',amount:49015,day:25,startDate:'2026-08-25',endDate:'2045-09-30',recurrence:'monthly',active:true,needsDate:false,note:'매월 25일'},
  {id:'sched-ins-nh-silson',name:'NH 해아림실손의료비보험',kind:'insurance',amount:13124,day:25,startDate:'2026-08-25',endDate:'2026-09-30',recurrence:'monthly',active:true,needsDate:false,note:'매월 25일 · 회사 실손 중복으로 2026년 9월까지만 납입 후 중지 예정'},
  {id:'sched-ins-nh-health',name:'NH 굿스타트건강보험',kind:'insurance',amount:121256,day:25,startDate:'2026-08-25',endDate:'2045-09-30',recurrence:'monthly',active:true,needsDate:false,attention:'overdue',note:'매월 25일 · 화면 확인 당시 연체 표시'}
 ];
 for(const x of schedules)if(!next.financeSchedules.items.some(s=>s.id===x.id))next.financeSchedules.items.push(x)
 const currentMonth=localYmd().slice(0,7),preferred=String(next.settings.integratedMonth||'');if(!preferred)next.settings.integratedMonth=currentMonth;
 // 첫 저장 전부터 동일 스키마로 정규화해 저장→복원 구조가 변하지 않게 한다.
 next.financialProducts=normalizeFinancialProducts(next.financialProducts);next.financeSchedules=normalizeFinanceSchedules(next.financeSchedules);next.integrated=normalizeIntegrated(next.integrated);syncFinancialProductStructures(next);clampEndedProductSchedules(next);
 return next
}
