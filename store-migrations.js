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
function applyRealFinanceBootstrap(target){return target}
