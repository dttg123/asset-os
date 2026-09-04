'use strict';

let aiStrategyPurpose='buy';

function aiStrategySetting(){
 const saved=setting().aiStrategy||{};
 return{
  purpose:['buy','rebalance','tax'].includes(saved.purpose)?saved.purpose:'buy',
  fundingSource:['new_money','account_cash','next_contribution'].includes(saved.fundingSource)?saved.fundingSource:'new_money',
  amount:Math.max(0,Math.round(Number(saved.amount)||0)),
  horizonYears:Math.max(3,Math.round(Number(saved.horizonYears)||3)),
  riskStyle:'공격형',maxDrawdown:-40,preferNewMoney:true
 }
}

function aiStrategyPrompt(purpose,amount,fundingSource='new_money'){
 const focus=purpose==='rebalance'?'전체 리밸런싱':purpose==='tax'?'연금·절세 전략':'지금 더 투자해도 되는지';
 const sourceLabel=fundingSource==='account_cash'?'계좌 안 현금':fundingSource==='next_contribution'?'다음 납입금':'새로 넣을 돈';
 return `첨부한 Asset OS 자료는 투자판단용 데이터입니다. 앱이나 데이터 구조를 평가하는 보고서가 아니라, ${focus}에 대한 실행 판단을 내려 주세요.\n\n분석 순서\n1. 먼저 현재 국제 정세·금리·환율·미국 및 한국 증시의 핵심 변수를 웹에서 확인하고 상승·중립·하락 시나리오를 짧게 정리해 주세요.\n2. ISA를 별도로 분석해 지금 추가매수·분할매수·대기 중 하나를 고르고, 종목별 금액·수량·순서와 중단 조건을 제시해 주세요.\n3. 연금저축을 별도로 같은 방식으로 분석해 주세요.\n4. IRP는 위험자산 한도와 결제 대기 현금을 먼저 확인한 뒤 별도로 분석해 주세요.\n5. 마지막에 세 계좌를 합쳐 신규 자금 배분과 리밸런싱 실행 순서를 표로 정리해 주세요.\n\n투자 조건\n- 자금 출처: ${sourceLabel}\n- 판단 금액: ${amount.toLocaleString('ko-KR')}원\n- 투자기간: 3년 이상\n- 투자성향: 공격형\n- 감내 가능한 최대 손실: -40%\n- 가능하면 기존 종목 매도보다 신규 자금으로 비중 조정\n\n반드시 포함\n- 과대·과소 비중, 종목·업종·국가 및 동일 테마 중복\n- 추가매수 전후 비중·평단·현금·예상 손실액\n- ISA 한도, 연금 세액공제, IRP 위험자산 한도\n- 오늘 주문은 중복 추천하지 말고 결제 전 현금은 사용 가능하다고 단정하지 않기\n- 자료에 없는 값은 추측하지 말고 '확인 필요'로 표시하기\n- 데이터 문제는 투자판단을 막는 경우에만 맨 앞에 한두 줄로 알리기`;
}

function aiRecentRows(rows,limit=240){return [...(rows||[])].sort((a,b)=>String(b.date||b.orderDate||'').localeCompare(String(a.date||a.orderDate||''))).slice(0,limit)}
function aiIsoAgeHours(value){const time=new Date(value||'').getTime();return Number.isFinite(time)?Math.max(0,(Date.now()-time)/36e5):Infinity}
function aiPurposeLabel(value){return value==='rebalance'?'리밸런싱':value==='tax'?'절세·납입':'추가매수 판단'}
function aiFundingLabel(value){return value==='account_cash'?'계좌 안 현금':value==='next_contribution'?'다음 납입금':'새로 넣을 돈'}

function aiIsaAccountExport(account,index){
 const metrics=accountMetrics(account),holdingRefs=new Map(),currentPolicy=policy('isa',account),year=String(new Date().getFullYear()),paidThisYear=annualContributionTotal(account);
 const holdings=(metrics.holdings||[]).map((holding,holdingIndex)=>{
  const source=(account.holdings||[]).find(row=>row.id===holding.id)||holding,ref=`ISA${index+1}-H${holdingIndex+1}`;
  holdingRefs.set(String(holding.id||''),ref);
  const quoteAt=source.quoteUpdatedAt||source.priceUpdatedAt||'';
  return{ref,name:holding.name,instrumentCode:source.instrumentCode||'',quoteType:source.quoteType||'',assetClass:holding.assetClass||source.assetClass||'',quantity:Number(holding.quantity??holding.qty)||0,quantityUnit:source.quantityUnit||'share',averagePrice:Number(holding.avgPrice)||0,currentPrice:Number(holding.currentPrice)||0,marketValue:Math.round(Number(holding.marketValue)||0),profitLoss:Math.round((Number(holding.marketValue)||0)-holdingCostValue(holding)),quoteSource:source.quoteSource||'',quoteUpdatedAt:quoteAt,quoteAgeHours:aiIsoAgeHours(quoteAt)}
 });
 const transactions=aiRecentRows(account.transactions).map(tx=>({type:tx.type,date:txDate(tx),status:tx.status||'completed',holdingRef:holdingRefs.get(String(tx.holdingId||''))||'',quantity:Number(tx.quantity??tx.qty)||0,price:Number(tx.price)||0,amount:Number(tx.amount)||0,fee:Number(tx.fee)||0,tax:Number(tx.tax)||0}));
 return{ref:`ISA${index+1}`,type:account.type||'',status:account.status,openedAt:account.openedAt||'',maturityAt:account.maturityAt||'',policy:{name:currentPolicy.name||'',verifiedAt:currentPolicy.verifiedAt||'',annualLimit:Number(currentPolicy.annualLimit)||0,taxExemption:account.type==='서민형'?Number(currentPolicy.lowIncomeExemption)||0:account.type==='농어민형'?Number(currentPolicy.farmerExemption)||0:Number(currentPolicy.generalExemption)||0,taxRate:Number(currentPolicy.taxRate)||0,mandatoryYears:Number(currentPolicy.mandatoryYears)||0},contribution:{year,paid:Math.round(paidThisYear),remaining:Math.max(0,Math.round((Number(currentPolicy.annualLimit)||0)-paidThisYear))},summary:{value:Math.round(metrics.value),cost:Math.round(metrics.cost),cash:Math.round(metrics.cash),profit:Math.round(metrics.profit),returnRate:Number(metrics.rate)||0,componentDelta:Math.round(metrics.value-metrics.cash-(metrics.holdingsValue||0))},holdings,transactions,assetSnapshots:aiRecentRows(account.assetSnapshots,120).map(x=>({date:x.date,cost:Number(x.cost)||0,securitiesValue:Number(x.value)||0,cash:Number(x.cash)||0,totalValue:Number(x.totalValue??x.value)||0,valueBasis:x.meta?.valueBasis||'legacy_unknown',grain:x.meta?.grain||'unknown'}))}
}

function aiPensionAccountExport(account,index){
 const view=pensionAccountView(account),kind=account.kind==='irp'?'IRP':'연금저축',connection=state.brokerKis?.connections?.[account.kind]||{};
 return{ref:`${kind==='IRP'?'IRP':'PENSION'}${index+1}`,kind,status:account.status,openedAt:account.openedAt||'',source:view.kis?'한국투자 조회':'Asset OS 원장',sync:{lastCompleteAt:connection.lastCompleteSyncAt||'',lastBalanceAt:connection.lastBalanceAt||'',lastOrdersAt:connection.lastOrdersAt||'',lastError:connection.lastError||''},summary:{value:Math.round(view.total),cash:Math.round(view.cash),availableCash:view.cashStatus?.availableCash===null?null:Math.round(Number(view.cashStatus?.availableCash)||0),cashConfirmed:view.cashStatus?.confirmed!==false,pendingBuy:Math.round(Number(view.cashStatus?.pendingBuy)||0),securitiesValue:Math.round(view.holdingValue),unallocated:Math.round(view.unallocated),componentDelta:Math.round(view.componentDelta||0)},holdings:view.holdings.map(h=>({name:h.name,productCode:h.productCode||'',productType:h.productType||'',assetClass:h.assetClass||'',quantity:Number(h.qty)||0,averagePrice:Number(h.avgPrice)||0,currentPrice:Number(h.currentPrice)||0,marketValue:Math.round(pensionHoldingValue(h)),profitLoss:Math.round(pensionHoldingValue(h)-pensionHoldingCost(h)),riskClassification:h.risky===true?'risky':h.risky===false?'non_risky':'unclassified',riskSource:h.riskSource||'',readOnly:!!h.readOnly}))}
}

function aiPensionSection(kind){
 const accounts=pensionStore().accounts.filter(a=>a.status==='active'&&a.kind===kind).map(aiPensionAccountExport);
 const metrics=pensionAssetMetrics(kind),accountIds=new Set(pensionStore().accounts.filter(a=>a.kind===kind).map(a=>a.id));
 const transactions=aiRecentRows((pensionStore().transactions||[]).filter(tx=>accountIds.has(tx.accountId))).map(tx=>({type:tx.type,date:tx.date,holding:pensionHoldingById(tx.holdingId)?.name||'',quantity:Number(tx.qty)||0,price:Number(tx.price)||0,amount:Number(tx.amount)||0,fee:Number(tx.fee)||0,tax:Number(tx.tax)||0}));
 const contributions=aiRecentRows(centralPensionContributionRows().filter(row=>row.kind===kind),120).map(row=>({date:row.date,amount:Number(row.amount)||0,type:row.type||'contribution'}));
 const brokerOrders=aiRecentRows(brokerKisVisibleOrders(state.brokerKis,kind),240).map(order=>({date:order.date||order.orderDate,time:order.time||order.orderTime||'',type:order.type||order.side,productCode:order.productCode||'',productName:order.productName||'',quantity:Number(order.qty??order.quantity)||0,price:Number(order.price)||0,amount:Number(order.amount)||0,status:order.status||''}));
 const income=aiRecentRows(pensionIncomeRecords(kind),240).map(row=>({date:row.date,type:row.type,amount:Number(row.amount)||0,label:row.label||''}));
 const assetSnapshots=aiRecentRows((pensionStore().assetSnapshots||[]).map(row=>({date:row.date,values:kind==='irp'?(row.irp||{}):(row.pension||{}),grain:row.meta?.grain||'month',source:row.meta?.source?.[kind]||'unknown'})),120),year=String(new Date().getFullYear()),yearPaid=contributions.filter(row=>String(row.date).startsWith(year)).reduce((sum,row)=>sum+(Number(row.amount)||0),0),currentPolicy=policy(kind==='irp'?'irp':'pension');
 return{accounts,combined:{value:Math.round(metrics.value),cost:Math.round(metrics.cost),cash:Math.round(metrics.cash),profit:Math.round(metrics.profit),returnRate:Number(metrics.rate)||0},contribution:{year,paid:Math.round(yearPaid)},policy:{name:currentPolicy.name||'',verifiedAt:currentPolicy.verifiedAt||'',annualContributionLimit:Number(currentPolicy.annualContributionLimit)||0,annualTaxCreditLimit:Number(currentPolicy.annualTaxCreditLimit)||0,combinedTaxCreditLimit:Number(currentPolicy.combinedTaxCreditLimit)||0,taxCreditRate:Number(currentPolicy.taxCreditRate)||0,riskyAssetLimit:Number(currentPolicy.riskyAssetLimit)||0},contributions,transactions,brokerOrders,income,assetSnapshots}
}

function aiStrategyPreflight(payload,amount,fundingSource){
 const blockers=[],warnings=[];
 const isaHoldings=payload.isa.accounts.flatMap(a=>a.holdings),stale7=isaHoldings.filter(h=>h.quoteAgeHours>168),stale3=isaHoldings.filter(h=>h.quoteAgeHours>72&&h.quoteAgeHours<=168);
 if(payload.isa.accounts.some(a=>Math.abs(a.summary.componentDelta)>1))blockers.push('ISA 합계와 보유·현금 구성값이 일치하지 않습니다.');
 if(stale7.length)blockers.push(`ISA 현재가가 7일 넘게 오래된 종목 ${stale7.length}개가 있습니다.`);else if(stale3.length)warnings.push(`ISA 현재가가 3일 넘게 오래된 종목 ${stale3.length}개가 있습니다.`);
 const pensionAccounts=[...payload.pensionSavings.accounts,...payload.irp.accounts];
 const kisAccounts=pensionAccounts.filter(a=>a.source==='한국투자 조회'),staleKis=kisAccounts.filter(a=>aiIsoAgeHours(a.sync?.lastCompleteAt)>36);
 if(pensionAccounts.some(a=>Math.abs(a.summary.componentDelta)>1))blockers.push('연금 조회 합계에 종목 상세가 없는 금액이 있습니다.');
 if(pensionAccounts.some(a=>a.summary.cashConfirmed===false))blockers.push('당일 체결 때문에 연금 예수금의 실제 사용 가능액이 확정되지 않았습니다.');
 if(kisAccounts.some(a=>a.sync?.lastError))blockers.push('한국투자 잔고·체결 갱신이 부분 완료 상태입니다.');
 if(staleKis.length)blockers.push(`한국투자 전체 갱신이 36시간 넘게 오래된 계좌 ${staleKis.length}개가 있습니다.`);
 if(payload.irp.risk.classificationComplete===false)blockers.push('IRP에 위험자산 분류가 확인되지 않은 종목이 있습니다.');
 if(amount<=0)blockers.push('판단할 투자금액이 0원입니다.');
 if(fundingSource==='account_cash'){
  const accounts=[...payload.isa.accounts,...pensionAccounts],unconfirmed=accounts.some(a=>a.summary.cashConfirmed===false),available=accounts.reduce((sum,a)=>sum+Math.max(0,Number(a.summary.availableCash??a.summary.cash)||0),0);
  if(unconfirmed)blockers.push('계좌 안 현금을 쓰려면 당일 체결 정산 후 사용 가능액을 먼저 확인해야 합니다.');
  else if(amount>available)blockers.push(`판단 금액이 확인된 계좌 현금 ${Math.round(available).toLocaleString('ko-KR')}원을 초과합니다.`);
 }
 return{ready:blockers.length===0,blockers,warnings}
}

function buildAiStrategyPayload(purpose,amount,fundingSource='new_money'){
 const isaAccounts=state.accounts.filter(isCurrentAccount).map(aiIsaAccountExport),pensionSavings=aiPensionSection('pension'),irpSection=aiPensionSection('irp'),projection=pensionProjection(),risk=pensionRiskMetrics();
 const payload={format:'asset-os-ai-strategy-v2',generatedAt:new Date().toISOString(),privacy:{excluded:['이름','이메일','계좌번호','메모','API 키','토큰']},request:{purpose:aiPurposeLabel(purpose),fundingSource:aiFundingLabel(fundingSource),additionalInvestmentWon:amount,prompt:aiStrategyPrompt(purpose,amount,fundingSource)},profile:{investmentHorizon:'3년 이상',riskStyle:'공격형',maximumDrawdownTolerance:'-40%',rebalancePreference:'가능하면 매도보다 신규 자금으로 조정'},isa:{accounts:isaAccounts,combined:{value:isaAccounts.reduce((s,x)=>s+x.summary.value,0),cost:isaAccounts.reduce((s,x)=>s+x.summary.cost,0),cash:isaAccounts.reduce((s,x)=>s+x.summary.cash,0),profit:isaAccounts.reduce((s,x)=>s+x.summary.profit,0)}},pensionSavings,irp:{...irpSection,risk:{riskyValue:Math.round(risk.risky),unclassifiedValue:Math.round(risk.unknown),confirmedRatio:Number(risk.ratio)||0,maximumPossibleRatio:Number(risk.maxRatio)||0,limit:Number(risk.limit)||70,classificationComplete:!!risk.classificationComplete}},combinedPlan:{totalValue:Math.round(payloadNumber(pensionSavings.combined.value)+payloadNumber(irpSection.combined.value)+isaAccounts.reduce((s,x)=>s+x.summary.value,0)),projection:{retirementAge:projection.retirementAge,currentAge:projection.currentAge,monthlyContribution:Math.round(projection.monthly),annualReturnRate:Number(projection.annual)||0,inflationRate:Number(projection.inflation)||0,expectedAssetsAtRetirement:Math.round(projection.future),expectedMonthlyPension:Math.round(projection.monthlyPension)}}};
 payload.dataQuality=aiStrategyPreflight(payload,amount,fundingSource);
 return payload
}
function payloadNumber(value){return Number(value)||0}

function aiStrategyFile(purpose,amount,fundingSource){const payload=buildAiStrategyPayload(purpose,amount,fundingSource),blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});return{file:new File([blob],'투자분석.json',{type:'application/json'}),payload}}
async function shareAiStrategyFile(purpose,amount,fundingSource){
 const {file,payload}=aiStrategyFile(purpose,amount,fundingSource);
 if(!payload.dataQuality.ready){showNotice('공유 전 확인',payload.dataQuality.blockers.join('\n'));return false}
 if(!(navigator.share&&navigator.canShare?.({files:[file]}))){showNotice('공유 기능 필요','이 기기에서는 파일 공유를 지원하지 않습니다. Android의 Chrome 또는 설치된 Asset OS에서 다시 시도해 주세요.');return false}
 try{await navigator.share({title:'Asset OS 투자분석',text:'ISA·연금저축·IRP 투자판단 자료입니다.',files:[file]});toast('투자분석 자료를 공유했습니다.');return true}catch(error){if(error?.name!=='AbortError')showNotice('공유 실패','파일을 공유하지 못했습니다. 잠시 후 다시 시도해 주세요.');return false}
}

function aiStrategyMarkup(){
 const saved=aiStrategySetting();aiStrategyPurpose=saved.purpose;
 return `<form id="aiStrategyForm" class="form ai-strategy-form"><div class="ai-purpose-grid">${[['buy','추가매수 판단'],['rebalance','리밸런싱'],['tax','절세·납입']].map(([key,label])=>`<button type="button" class="ai-purpose ${saved.purpose===key?'active':''}" data-ai-purpose="${key}">${label}</button>`).join('')}</div><div class="field"><label>사용할 돈</label><select name="fundingSource"><option value="new_money" ${saved.fundingSource==='new_money'?'selected':''}>새로 넣을 돈</option><option value="account_cash" ${saved.fundingSource==='account_cash'?'selected':''}>계좌 안 현금</option><option value="next_contribution" ${saved.fundingSource==='next_contribution'?'selected':''}>다음 납입금</option></select></div><div class="field"><label>판단할 금액</label><input name="amount" type="number" inputmode="numeric" min="0" step="10000" value="${saved.amount||''}" placeholder="예: 3,000,000"></div><div class="ai-amount-preset">${[500000,1000000,3000000,5000000].map(v=>`<button type="button" data-ai-amount="${v}">${v/10000}만원</button>`).join('')}</div><div class="source-note">현재 국제 상황을 먼저 확인한 뒤 ISA·연금저축·IRP를 각각 분석하고, 마지막에 실행 순서를 합칩니다. 개인정보와 연결 비밀값은 제외합니다.</div><div class="form-actions one"><button class="form-btn primary">공유하기</button></div></form>`
}
function openAiStrategy(){
 const saved=aiStrategySetting();$('#sheetEyebrow').textContent='통합 투자자료';$('#sheetTitle').textContent='AI 투자전략';$('#sheetBody').innerHTML=aiStrategyMarkup();openSheet('#detailSheet');
 const form=$('#aiStrategyForm');$$('[data-ai-purpose]').forEach(button=>button.onclick=()=>{aiStrategyPurpose=button.dataset.aiPurpose;$$('[data-ai-purpose]').forEach(x=>x.classList.toggle('active',x===button))});$$('[data-ai-amount]').forEach(button=>button.onclick=()=>{form.amount.value=button.dataset.aiAmount});
 form.onsubmit=async event=>{event.preventDefault();const data=new FormData(form),amount=Math.max(0,Math.round(Number(data.get('amount'))||0)),fundingSource=String(data.get('fundingSource')||'new_money');if(amount<=0)return toast('판단할 금액을 입력해 주세요.');setting().aiStrategy={...saved,purpose:aiStrategyPurpose,fundingSource,amount};if(!persist(false))return;await shareAiStrategyFile(aiStrategyPurpose,amount,fundingSource)}
}
