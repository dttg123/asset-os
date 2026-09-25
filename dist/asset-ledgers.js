/* asset-os source: pension-contributions.js */
'use strict';
function pensionStore(){return state.pension}
function pensionAccount(id){return pensionStore().accounts.find(a=>a.id===id)||null}
function pensionAccountKindLabel(kind){return kind==='irp'?'IRP':'연금저축'}
function pensionYearRecords(year=localYmd().slice(0,4)){return centralPensionContributionRows(year)}
function pensionTaxCreditProfile(year=localYmd().slice(0,4),p=policyForYear('pension',year)){const profile=setting().pensionTaxProfile?.[String(year)]||{},grossSalary=Math.max(0,Number(profile.grossSalary)||0),comprehensiveIncome=Math.max(0,Number(profile.comprehensiveIncome)||0),qualified=grossSalary?grossSalary<=55000000:comprehensiveIncome?comprehensiveIncome<=45000000:false,configured=!!(grossSalary||comprehensiveIncome),rate=configured&&qualified?(Number(p.lowIncomeTaxCreditRate)||.165):(Number(p.taxCreditRate)||.132);return{year:String(year),grossSalary,comprehensiveIncome,configured,qualified,rate}}
function pensionSummary(year=localYmd().slice(0,4)){
 const records=pensionYearRecords(year),p=policyForYear('pension',year),isaP=policyForYear('isa',year),accounts=new Map(pensionStore().accounts.map(a=>[a.id,a]));
 let ordinaryPs=0,ordinaryIrp=0,transferPs=0,transferIrp=0;
 for(const x of records){const a=accounts.get(x.accountId),kind=a?.kind||x.kind;if(!['pension','irp'].includes(kind))continue;const amount=Number(x.amount)||0,isIrp=kind==='irp',isTransfer=x.type==='isaTransfer';if(isTransfer){if(isIrp)transferIrp+=amount;else transferPs+=amount}else{if(isIrp)ordinaryIrp+=amount;else ordinaryPs+=amount}}
 const ordinary=ordinaryPs+ordinaryIrp,transfer=transferPs+transferIrp,total=ordinary+transfer,psTotal=ordinaryPs+transferPs,irpTotal=ordinaryIrp+transferIrp;
 const psLimit=Number(p.annualTaxCreditLimit)||6000000,combinedLimit=Number(p.combinedTaxCreditLimit)||9000000,annualContributionLimit=Number(p.annualContributionLimit)||18000000;
 const regularCreditBase=Math.min(Math.min(psTotal,psLimit)+irpTotal,combinedLimit);
 const extraLimit=Math.min(transfer*(Number(isaP.transferDeductionRate)||.10),Number(isaP.transferDeductionMax)||3000000);
 const totalCreditLimit=combinedLimit+extraLimit,creditBase=Math.min(total,regularCreditBase+extraLimit),taxProfile=pensionTaxCreditProfile(year,p),creditRate=taxProfile.rate,estimatedCredit=creditBase*creditRate;
 const goalPs=Number(pensionStore().goal?.pensionSavings)||6000000,goalIrp=Number(pensionStore().goal?.irp)||3000000,goalTotal=goalPs+goalIrp,goalCurrent=Math.min(ordinaryPs,goalPs)+Math.min(ordinaryIrp,goalIrp);
 return{year,records,ordinaryPs,ordinaryIrp,transferPs,transferIrp,ordinary,transfer,total,psTotal,irpTotal,psLimit,combinedLimit,annualContributionLimit,regularCreditBase,extraLimit,totalCreditLimit,creditBase,creditRate,taxProfile,estimatedCredit,remainingCredit:Math.max(0,totalCreditLimit-creditBase),remainingOrdinary:Math.max(0,annualContributionLimit-ordinary),ordinaryOverage:Math.max(0,ordinary-annualContributionLimit),goalPs,goalIrp,goalTotal,goalCurrent}
}
function pensionMonthly(year=localYmd().slice(0,4)){const rows=Array.from({length:12},(_,i)=>({month:i+1,pension:0,irp:0,total:0,transfer:0,transferPension:0,transferIrp:0})),accounts=new Map(pensionStore().accounts.map(a=>[a.id,a])),source=pensionYearRecords(year);for(const x of source){const m=Number(String(x.date).slice(5,7)),row=rows[m-1],a=accounts.get(x.accountId),kind=a?.kind||x.kind;if(!row||!['pension','irp'].includes(kind))continue;const amount=Number(x.amount)||0,isIrp=kind==='irp';if(x.type==='isaTransfer'){row.transfer+=amount;if(isIrp)row.transferIrp+=amount;else row.transferPension+=amount}else{row[isIrp?'irp':'pension']+=amount;row.total+=amount}}return rows}
function pensionCurrentMonthOrdinary(){const key=localYmd().slice(0,7),accounts=new Map(pensionStore().accounts.map(a=>[a.id,a]));let pension=0,irp=0;for(const x of centralPensionContributionRows().filter(x=>x.type==='contribution'&&String(x.date).startsWith(key))){const a=accounts.get(x.accountId),kind=a?.kind||x.kind;if(kind==='irp')irp+=Number(x.amount)||0;else if(kind==='pension')pension+=Number(x.amount)||0}return{pension,irp,total:pension+irp}}

function pensionContributionBatchScheduleId(kind){return `pension-contribution-${kind}-monthly`}
function pensionContributionBatchLinkId(kind){return kind==='irp'?'irp-link':'pension-link'}
function pensionContributionBatchLatestMonth(year,day=25,today=localYmd()){
 const y=Number(year),currentYear=Number(String(today).slice(0,4));
 if(y<currentYear)return 12;if(y>currentYear)return 0;
 const month=Number(String(today).slice(5,7)),date=Number(String(today).slice(8,10));
 return Math.max(0,month-(date<Number(day)?1:0))
}
function pensionContributionBatchInput(input={}){
 const year=String(input.year||localYmd().slice(0,4)),day=Math.min(28,Math.max(1,Number(input.day)||25)),throughMonth=Math.min(12,Math.max(0,Number(input.throughMonth)||0));
 const months={pension:[...(input.months?.pension||[])].map(Number).filter(m=>m>=1&&m<=throughMonth),irp:[...(input.months?.irp||[])].map(Number).filter(m=>m>=1&&m<=throughMonth)};
 return{year,day,throughMonth,pensionAmount:Math.max(0,Number(input.pensionAmount)||0),irpAmount:Math.max(0,Number(input.irpAmount)||0),pensionAccountId:String(input.pensionAccountId||''),irpAccountId:String(input.irpAccountId||''),months:{pension:[...new Set(months.pension)].sort((a,b)=>a-b),irp:[...new Set(months.irp)].sort((a,b)=>a-b)}}
}
function pensionContributionBatchCandidate(input={}){
 const data=pensionContributionBatchInput(input),latest=pensionContributionBatchLatestMonth(data.year,data.day),today=localYmd();
 if(!/^\d{4}$/.test(data.year)||Number(data.year)<2000||Number(data.year)>Number(today.slice(0,4)))return{ok:false,error:'기록 연도를 확인해 주세요.'};
 if(data.throughMonth<1||data.throughMonth>latest)return{ok:false,error:`${data.year}년은 ${latest?latest+'월':'아직'}까지 납입 완료로 기록할 수 있습니다.`};
 const nextIntegrated=clone(integratedStore()),nextPension=clone(pensionStore()),nextSchedules=clone(state.financeSchedules||{items:[]}),generated=[],summary={pension:0,irp:0,total:0,count:0};
 for(const kind of ['pension','irp']){
  const amount=Number(data[`${kind}Amount`])||0,selected=data.months[kind],accountId=data[`${kind}AccountId`],account=nextPension.accounts.find(a=>a.id===accountId&&a.kind===kind&&a.status==='active');
  if(amount&&!selected.length)return{ok:false,error:`${pensionAccountKindLabel(kind)}의 납입 월을 하나 이상 선택해 주세요.`};
  if((amount||selected.length)&&!account)return{ok:false,error:`운영 중인 ${pensionAccountKindLabel(kind)} 계좌를 선택해 주세요.`};
  const scheduleId=pensionContributionBatchScheduleId(kind),generatedIds=new Set((nextIntegrated.ledger||[]).filter(t=>t.meta?.pensionBatch&&t.meta?.batchYear===data.year&&t.meta?.batchKind===kind).map(t=>t.id));
  const manualRows=centralPensionContributionRows(data.year).filter(r=>r.kind===kind&&!generatedIds.has(r.sourceTxId));
  for(const month of selected){
   const monthKey=`${data.year}-${String(month).padStart(2,'0')}`,manual=manualRows.filter(r=>String(r.date).startsWith(monthKey)).reduce((sum,r)=>sum+(Number(r.amount)||0),0);
   if(manual>amount)return{ok:false,error:`${data.year}년 ${month}월 ${pensionAccountKindLabel(kind)} 기존 기록 ${won(manual)}이 설정액 ${won(amount)}보다 큽니다. 기존 거래를 먼저 확인해 주세요.`};
   const delta=amount-manual;if(!delta)continue;
   const date=`${monthKey}-${String(data.day).padStart(2,'0')}`,id=`igl-pension-batch-${data.year}-${kind}-${String(month).padStart(2,'0')}`;
   generated.push({id,date,type:'externalAssetIn',amount:delta,toAccountId:pensionContributionBatchLinkId(kind),category:`${pensionAccountKindLabel(kind)} 납입`,note:'월 납입 기록 맞추기',sourceModule:'pension-contribution-batch',sourceId:`${data.year}-${kind}-${month}`,meta:{pensionBatch:true,batchYear:data.year,batchKind:kind,targetPensionAccountId:accountId,scheduleId,scheduleDate:date,scheduledAmount:amount,actualAmount:amount}});
   summary[kind]+=delta;summary.total+=delta;summary.count++;
  }
  nextIntegrated.ledger=(nextIntegrated.ledger||[]).filter(t=>!(t.meta?.pensionBatch&&t.meta?.batchYear===data.year&&t.meta?.batchKind===kind));
  nextIntegrated.ledger.push(...generated.filter(t=>t.meta.batchKind===kind));
  if(account&&selected.length){const first=`${data.year}-${String(selected[0]).padStart(2,'0')}-${String(data.day).padStart(2,'0')}`;if(!account.openedAt||account.openedAt>first)account.openedAt=first}
  const items=nextSchedules.items||(nextSchedules.items=[]),schedule={id:scheduleId,name:`${pensionAccountKindLabel(kind)} 월 납입`,kind:'investment',amount,amountMode:'fixed',day:data.day,recurrence:'monthly',startDate:`${data.year}-01-${String(data.day).padStart(2,'0')}`,endDate:'',targetKind:kind,targetAccountId:pensionContributionBatchLinkId(kind),targetPensionAccountId:accountId,active:amount>0,note:'월 납입 기록 맞추기에서 관리',source:'pension-contribution-batch'};
  const scheduleIndex=items.findIndex(s=>s.id===scheduleId);if(scheduleIndex>=0)items[scheduleIndex]={...items[scheduleIndex],...schedule};else items.push(schedule)
 }
 const normalizedIntegrated=normalizeIntegrated(nextIntegrated),limitIssue=typeof integratedPolicyLimitIssues==='function'?integratedPolicyLimitIssues(normalizedIntegrated).find(x=>x.includes('연금계좌 일반 납입한도')):'';
 if(limitIssue)return{ok:false,error:limitIssue};
 return{ok:true,data,nextIntegrated:normalizedIntegrated,nextPension,nextSchedules:normalizeFinanceSchedules(nextSchedules),summary}
}
function applyPensionContributionBatch(input={}){
 const candidate=pensionContributionBatchCandidate(input);if(!candidate.ok)return candidate;
 state.integrated=candidate.nextIntegrated;state.pension=candidate.nextPension;state.financeSchedules=candidate.nextSchedules;
 return{ok:true,summary:candidate.summary,data:candidate.data}
}
;
/* asset-os source: pension-ledger.js */
'use strict';
function normalizeInvestmentRole(value,h=null){
 const v=String(value||'');if(INVESTMENT_ROLES.includes(v))return v;
 const legacy={방어:'안정',테마:'성장','현금성 자산':'현금'};if(legacy[v])return legacy[v];
 const text=`${h?.name||''} ${h?.assetClass||''} ${h?.productType||''}`.toLowerCase();
 if(/현금성|머니|kofr|cd금리|mmf|cash/.test(text))return'현금';
 if(/커버드|인컴|월배당|리츠|부동산|인프라|income|reit/.test(text))return'현금흐름';
 if(/배당|dividend|퀄리티/.test(text))return'배당';
 if(/채권|국고채|국채|회사채|bond|골드|금\b/.test(text))return'안정';
 return'성장'
}
function investmentRoleForHolding(h){return normalizeInvestmentRole(h?.investmentRole||h?.assetClass,h)}
function investmentThemeTag(h){const explicit=String(h?.themeTag||'').trim();if(explicit)return explicit;const text=String(h?.name||'').toLowerCase();if(/반도체|sox|필라델피아/.test(text))return'반도체';if(/나스닥/.test(text))return'미국 성장';if(/s&p|sp500/.test(text))return'미국 대표';if(/리츠|부동산|인프라/.test(text))return'리츠';if(/국고채|국채|채권/.test(text))return'채권';return''}
function investmentRoleMeta(h){const role=investmentRoleForHolding(h),tag=investmentThemeTag(h);return tag?`${role} · ${tag}`:role}
function pensionTransactions(scope='all'){return pensionStore().transactions.filter(t=>{const a=pensionAccount(t.accountId);return a&&(scope==='all'||a.kind===scope)}).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.createdAt||'').localeCompare(String(a.createdAt||'')))}
function pensionTradeLabel(type){return({contribution:'납입',isaTransfer:'ISA 만기 이전',buy:'매수',sell:'매도',dividend:'배당금',distribution:'분배금',interest:'이자',other_right:'기타 권리',adjustment:'보정'})[type]||type}
function pensionPositionFromLedger(h,transactions=pensionStore().transactions){let qty=Math.max(0,Number(h.baselineQty??h.qty)||0),avg=Math.max(0,Number(h.baselineAvgPrice??h.avgPrice)||0);const rows=transactions.filter(t=>t.holdingId===h.id&&['buy','sell','adjustment'].includes(t.type)).sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.createdAt||'').localeCompare(String(b.createdAt||''))||String(a.id).localeCompare(String(b.id)));for(const t of rows){if(t.type==='buy'){const q=Math.max(0,Number(t.qty)||0),price=Math.max(0,Number(t.price)||0),oldCost=qty*avg,newCost=q*price+Math.max(0,Number(t.fee)||0)+Math.max(0,Number(t.tax)||0);qty+=q;avg=qty?((oldCost+newCost)/qty):0}else if(t.type==='sell'){qty=Math.max(0,qty-Math.max(0,Number(t.qty)||0));if(qty<=1e-9){qty=0;avg=0}}else if(t.type==='adjustment'){qty=Math.max(0,Number(t.setQty)||0);avg=qty?Math.max(0,Number(t.setAvg)||0):0}}return{qty,avg}}
function syncPensionDerivedHoldings(target=state){const ps=target?.pension;if(!ps)return;const txs=Array.isArray(ps.transactions)?ps.transactions:[];for(const h of ps.holdings||[]){const pos=pensionPositionFromLedger(h,txs);h.qty=pos.qty;h.avgPrice=pos.avg;h.investmentRole=normalizeInvestmentRole(h.investmentRole||h.assetClass,h);h.assetClass=h.investmentRole}}
function pensionTradeCashDelta(t){const fee=Math.max(0,Number(t.fee)||0),tax=Math.max(0,Number(t.tax)||0);if(t.type==='buy')return-((Number(t.qty)||0)*(Number(t.price)||0)+fee+tax);if(t.type==='sell')return (Number(t.qty)||0)*(Number(t.price)||0)-fee-tax;if(['dividend','distribution','interest','other_right'].includes(t.type))return (Number(t.amount)||0)-fee-tax;return 0}
function pensionTransactionIssues(transactions=pensionStore().transactions){
 const issues=[],byHolding=new Map(),cashByAccount=new Map();
 for(const a of pensionStore().accounts||[]){cashByAccount.set(a.id,0);if(!validYmdDate(a.openedAt))issues.push(`${a.id}: 계좌 개설일 오류`);else if(a.openedAt>localYmd())issues.push(`${a.id}: 미래 개설 계좌`);if(a.closedAt&&(!validYmdDate(a.closedAt)||a.closedAt<a.openedAt))issues.push(`${a.id}: 계좌 종료일 오류`) }
 for(const h of pensionStore().holdings){byHolding.set(h.id,{qty:Math.max(0,Number(h.baselineQty??h.qty)||0),avg:Math.max(0,Number(h.baselineAvgPrice??h.avgPrice)||0)})}
 const events=[];
 for(const c of centralPensionContributionRows()){if(c.unresolved){issues.push(`${c.id}: 납입 대상 계좌 미지정`);continue}events.push({kind:'contribution',date:String(c.date||''),createdAt:'',id:c.id,accountId:c.accountId,amount:Number(c.amount)||0})}
 for(const t of transactions||[])events.push({kind:'transaction',date:String(t.date||''),createdAt:String(t.createdAt||''),id:String(t.id||''),tx:t});
 events.sort((a,b)=>String(a.date).localeCompare(String(b.date))||(a.kind==='contribution'?-1:b.kind==='contribution'?1:String(a.createdAt).localeCompare(String(b.createdAt))||String(a.id).localeCompare(String(b.id))));
 for(const ev of events){
  if(ev.kind==='contribution'){cashByAccount.set(ev.accountId,(cashByAccount.get(ev.accountId)||0)+ev.amount);continue}
  const t=ev.tx,a=pensionAccount(t.accountId);if(!a){issues.push(`${t.id}: 계좌 없음`);continue}
  const dateError=pensionTransactionDateError(a,t.date);if(dateError){issues.push(`${t.id}: ${dateError}`);continue}
  const fee=Number(t.fee??0),tax=Number(t.tax??0);if(!Number.isFinite(fee)||!Number.isFinite(tax)||fee<0||tax<0){issues.push(`${t.id}: 수수료/세금 오류`);continue}
  if(['buy','sell','adjustment'].includes(t.type)){
   const h=pensionStore().holdings.find(x=>x.id===t.holdingId),pos=byHolding.get(t.holdingId);if(!h||!pos||h.accountId!==t.accountId){issues.push(`${t.id}: 종목/계좌 연결 오류`);continue}
   if(t.type==='buy'){
    if(!(Number(t.qty)>0&&Number(t.price)>0))issues.push(`${t.id}: 매수 수량/단가 오류`);else{const q=Number(t.qty),need=q*Number(t.price)+(Number(t.fee)||0)+(Number(t.tax)||0),cash=cashByAccount.get(t.accountId)||0;if(need>cash+1e-8){issues.push(`${t.id}: 계좌 현금 부족`);continue}const oldCost=pos.qty*pos.avg;pos.qty+=q;pos.avg=pos.qty?(oldCost+need)/pos.qty:0;cashByAccount.set(t.accountId,cash-need)}
   }else if(t.type==='sell'){
    if(!(Number(t.qty)>0&&Number(t.price)>0))issues.push(`${t.id}: 매도 수량/단가 오류`);else if(Number(t.qty)>pos.qty+1e-8)issues.push(`${t.id}: 보유수량 초과매도`);else if(fee+tax>Number(t.qty)*Number(t.price)+1e-8)issues.push(`${t.id}: 매도 수수료와 세금이 매도대금을 초과`);else{const q=Number(t.qty),cash=(cashByAccount.get(t.accountId)||0)+q*Number(t.price)-fee-tax;if(cash<-1e-8){issues.push(`${t.id}: 매도 비용으로 계좌 현금 음수`);continue}pos.qty-=q;if(pos.qty<=1e-9){pos.qty=0;pos.avg=0}cashByAccount.set(t.accountId,cash)}
   }else{if(Number(t.setQty)<0||Number(t.setAvg)<0)issues.push(`${t.id}: 보정값 오류`);else{pos.qty=Number(t.setQty)||0;pos.avg=pos.qty?(Number(t.setAvg)||0):0}}
  }else if(['dividend','distribution','interest','other_right'].includes(t.type)){
   if(!(Number(t.amount)>0)){issues.push(`${t.id}: 수령액 오류`);continue}if(fee+tax>Number(t.amount)+1e-8){issues.push(`${t.id}: 수수료와 세금이 세전 수령액을 초과`);continue}if(t.holdingId){const h=pensionStore().holdings.find(x=>x.id===t.holdingId);if(!h||h.accountId!==t.accountId){issues.push(`${t.id}: 수령 종목 연결 오류`);continue}}const cash=(cashByAccount.get(t.accountId)||0)+(Number(t.amount)||0)-fee-tax;if(cash<-1e-8){issues.push(`${t.id}: 수령 비용으로 계좌 현금 음수`);continue}cashByAccount.set(t.accountId,cash)
  }
 }
 return issues
}
function pensionTransactionSave(candidate,editingId=''){const account=pensionAccount(candidate?.accountId);if(!account||account.status!=='active')return{ok:false,error:'운영 중인 연금저축·IRP 계좌에만 새 거래를 저장할 수 있습니다.',issues:['비활성 계좌 거래']};const tx={...candidate,id:editingId||uid('ptx'),createdAt:editingId?(pensionStore().transactions.find(x=>x.id===editingId)?.createdAt||new Date().toISOString()):new Date().toISOString()};let list=pensionStore().transactions.filter(x=>x.id!==editingId);list.push(tx);const issues=pensionTransactionIssues(list);if(issues.length)return{ok:false,error:issues[0],issues};pensionStore().transactions=list;syncPensionDerivedHoldings();return{ok:true,tx}}
let pensionTransactionDeleteError='';
function pensionTransactionDelete(id){pensionTransactionDeleteError='';const current=pensionStore().transactions,next=current.filter(x=>x.id!==id);if(next.length===current.length){pensionTransactionDeleteError='거래를 찾지 못했습니다.';return false}const issues=pensionTransactionIssues(next);if(issues.length){pensionTransactionDeleteError=issues[0];return false}pensionStore().transactions=next;syncPensionDerivedHoldings();return true}
;
/* asset-os source: pension-assets.js */
'use strict';
function pensionAssetScope(){return ['all','pension','irp'].includes(setting().pensionAssetScope)?setting().pensionAssetScope:'all'}
function pensionAssetLens(){return 'assetClass'}
function pensionHoldingAccount(h){return pensionAccount(h.accountId)}
function pensionHoldingValue(h){const market=Number(h.marketValue),calculated=(Number(h.qty)||0)*(Number(h.currentPrice)||0);return h.readOnly&&Number.isFinite(market)&&market>0?market:calculated}
function pensionHoldingCost(h){const market=Number(h.marketValue),profit=Number(h.profitLoss);if(h.readOnly&&Number.isFinite(market)&&market>0&&Number.isFinite(profit))return Math.max(0,market-profit);return (Number(h.qty)||0)*(Number(h.avgPrice)||0)}
function pensionKisSnapshot(account){return account?brokerKisLatestBalance(state.brokerKis,account.kind,account.id):null}
function pensionKisSnapshotUsable(snapshot){return !!snapshot&&(snapshot.authoritative===true||(Number(snapshot.totalValue)||0)>.5||(Number(snapshot.cash)||0)>.5||(Number(snapshot.securitiesValue)||0)>.5||(snapshot.holdings||[]).some(h=>(Number(h.quantity)||0)>1e-8||(Number(h.marketValue)||0)>.5))}
function pensionRiskClassificationKey(holding){return String(holding?.productCode||holding?.name||holding?.productName||'').normalize('NFKC').trim().toUpperCase()}
function pensionKisRiskClassification(holding){const manual=setting().irpRiskClassifications?.[pensionRiskClassificationKey(holding)];if(manual==='risky')return{risky:true,riskClassification:'사용자 확인 위험자산',riskSource:'사용자 확인'};if(manual==='safe')return{risky:false,riskClassification:'사용자 확인 비위험자산',riskSource:'사용자 확인'};const name=String(holding?.productName||holding?.name||'').replaceAll(' ','');if(/(?:IBK|ITF)미국AITOP10국채혼합50/i.test(name))return{risky:false,riskClassification:'퇴직연금 100% 편입 가능 채권혼합형',riskSource:'IBK 상품 분류'};if(/KODEX미국AI테크TOP10/i.test(name))return{risky:true,riskClassification:'주식형 위험자산',riskSource:'삼성자산운용 상품 분류'};return{risky:null,riskClassification:'분류 확인 필요',riskSource:''}}
function openPensionRiskClassificationForm(){const unknown=pensionAssetMetrics('irp').holdings.filter(h=>h.risky!==true&&h.risky!==false);if(!unknown.length)return toast('확인할 미분류 종목이 없습니다.');$('#formEyebrow').textContent='IRP · 위험자산';$('#formTitle').textContent='종목 분류 확인';$('#formBody').innerHTML=`<form id="irpRiskClassificationForm" class="form"><div class="source-note">금융회사 상품 상세의 ‘퇴직연금 위험자산’ 여부를 확인한 뒤 선택하세요. 미확인 종목은 한도 여유에서 제외됩니다.</div>${unknown.map((h,i)=>`<div class="field"><label>${escapeHtml(h.name)}</label><select name="risk-${i}" data-risk-key="${escapeHtml(pensionRiskClassificationKey(h))}"><option value="">확인 필요</option><option value="risky">위험자산</option><option value="safe">비위험자산·100% 편입 가능</option></select></div>`).join('')}<button class="form-btn primary">분류 저장</button></form>`;openSheet('#formSheet',{mode:'input'});$('#irpRiskClassificationForm').onsubmit=e=>{e.preventDefault();const map={...(setting().irpRiskClassifications||{})};for(const select of e.currentTarget.querySelectorAll('[data-risk-key]')){if(select.value)map[select.dataset.riskKey]=select.value;else delete map[select.dataset.riskKey]}setting().irpRiskClassifications=map;if(!persist(false))return;sheetDirty=false;closeSheets();render();toast('IRP 위험자산 분류를 저장했습니다.')}}
function pensionKisViewHoldings(account,snapshot){return(snapshot?.holdings||[]).filter(h=>(Number(h.quantity)||0)>1e-8||(Number(h.marketValue)||0)>.5).map((h,index)=>({id:`kis-view|${account.id}|${h.productCode||index}`,source:'kis',readOnly:true,accountId:account.id,productCode:h.productCode,name:h.productName||h.productCode||'종목명 미제공',qty:Number(h.quantity)||0,avgPrice:Number(h.avgPrice)||0,currentPrice:Number(h.currentPrice)||0,marketValue:Number(h.marketValue)||0,profitLoss:Number(h.profitLoss)||0,...pensionKisRiskClassification(h)}))}
function pensionLocalAccountCash(accountId){let total=0;for(const x of centralPensionContributionRows())if(x.accountId===accountId)total+=Number(x.amount)||0;for(const t of pensionStore().transactions||[])if(t.accountId===accountId)total+=pensionTradeCashDelta(t);return Math.max(0,total)}
function pensionLinkedScopeValue(scope){if(typeof integratedReplay!=='function')return 0;const assets=integratedReplay()?.assets||{},pension=Math.max(0,Number(assets['pension-link'])||0),irp=Math.max(0,Number(assets['irp-link'])||0);return scope==='pension'?pension:scope==='irp'?irp:pension+irp}
function pensionAccountCashStatus(account,snapshot=pensionKisSnapshot(account)){if(!snapshot)return{displayCash:pensionLocalAccountCash(account?.id),availableCash:pensionLocalAccountCash(account?.id),confirmed:true,pendingBuy:0,label:'거래 가능 현금'};const detail=snapshot.cashDetail||{},hasSettlement=detail.settledCash!==null&&detail.settledCash!==undefined||detail.nextDayCash!==null&&detail.nextDayCash!==undefined,available=hasSettlement?Math.max(0,Number(detail.availableCash)||0):null,day=String(snapshot.date||snapshot.fetchedAt||'').slice(0,10),pendingBuy=brokerKisVisibleOrders(state.brokerKis,account.kind).filter(x=>x.accountId===account.id&&x.date===day&&x.type==='buy').reduce((sum,x)=>sum+(Number(x.amount)||0),0);return{displayCash:Math.max(0,Number(snapshot.cash)||0),availableCash:available,confirmed:hasSettlement||pendingBuy<=0,pendingBuy,label:hasSettlement?'결제 반영 가능현금':pendingBuy>0?'예수금 · 당일 체결 확인 필요':'예수금'}}
function pensionAccountView(account){const snapshot=pensionKisSnapshot(account),kis=pensionKisSnapshotUsable(snapshot),holdings=kis?pensionKisViewHoldings(account,snapshot):pensionStore().holdings.filter(h=>h.accountId===account.id),cash=kis?Math.max(0,Number(snapshot.cash)||0):pensionLocalAccountCash(account.id),cashStatus=pensionAccountCashStatus(account,snapshot),holdingValue=holdings.reduce((sum,h)=>sum+pensionHoldingValue(h),0),total=kis?Math.max(0,Number(snapshot.totalValue)||cash+holdingValue):cash+holdingValue,componentDelta=total-cash-holdingValue,unallocated=Math.max(0,componentDelta);return{account,snapshot,kis,holdings,cash,cashStatus,holdingValue,total,componentDelta,unallocated}}
function pensionScopedHoldings(scope=pensionAssetScope()){
 return pensionStore().accounts.filter(a=>a.status==='active'&&(scope==='all'||a.kind===scope)).flatMap(a=>pensionAccountView(a).holdings)
}
function pensionAccountCash(accountId){const account=pensionAccount(accountId);return account?pensionAccountView(account).cash:pensionLocalAccountCash(accountId)}
function pensionSpendableCashStatus(scope=pensionAssetScope()){const views=pensionStore().accounts.filter(a=>a.status==='active'&&(scope==='all'||a.kind===scope)).map(pensionAccountView),pending=views.filter(v=>v.kis&&!v.cashStatus.confirmed),allConfirmed=!pending.length,available=views.reduce((sum,v)=>sum+(v.kis?(v.cashStatus.availableCash===null?v.cash:v.cashStatus.availableCash):v.cash),0),display=views.reduce((sum,v)=>sum+v.cash,0),pendingBuy=pending.reduce((sum,v)=>sum+v.cashStatus.pendingBuy,0);return{allConfirmed,available,display,pendingBuy,label:allConfirmed?'거래 가능 현금':'예수금 · 정산 확인 필요'}}
function pensionAccountExposure(accountId){const account=pensionAccount(accountId),view=account?pensionAccountView(account):null,holdings=view?.holdings||[],qty=holdings.reduce((n,h)=>n+Math.max(0,Number(h.qty)||0),0),value=view?.total||holdings.reduce((n,h)=>n+pensionHoldingValue(h),0),cash=view?.cash||pensionLocalAccountCash(accountId);return{qty,value,cash,hasAssets:value>.5||qty>1e-8||Math.abs(cash)>.5}}
function createPensionAccount(input={}){const kind=input.kind==='irp'?'irp':'pension',openedAt=String(input.openedAt||ymd()),dateError=postedDateError(openedAt);if(dateError)return{ok:false,error:dateError};const name=String(input.name||'').trim()||`${pensionAccountKindLabel(kind)} ${pensionStore().accounts.filter(a=>a.kind===kind).length+1}`,account={id:uid(kind==='irp'?'irp':'ps'),kind,name,provider:String(input.provider||'').trim(),status:'active',openedAt,closedAt:'',policyId:policyGroup(kind).activePolicyId||'',policyHistory:[]};pensionStore().accounts.push(account);return{ok:true,account}}
function archivePensionAccount(accountId){const a=pensionAccount(accountId);if(!a||a.status!=='active')return{ok:false,error:'운영 중인 계좌가 아닙니다.'};const e=pensionAccountExposure(accountId);if(e.hasAssets)return{ok:false,error:`보유자산 또는 계좌 현금이 남아 있습니다. 종목 ${quantityNumber(e.qty)}주 · 현금 ${won(e.cash)}`};a.status='archived';a.closedAt=ymd();return{ok:true,account:a}}
function reopenPensionAccount(accountId){const a=pensionAccount(accountId);if(!a||a.status==='active')return{ok:false,error:'재개할 보관 계좌가 아닙니다.'};a.status='active';a.closedAt='';return{ok:true,account:a}}
function pensionAssetMetrics(scope=pensionAssetScope()){
 const active=pensionStore().accounts.filter(a=>a.status==='active'&&(scope==='all'||a.kind===scope)),views=active.map(pensionAccountView),holdings=views.flatMap(x=>x.holdings),holdingValue=holdings.reduce((s,h)=>s+pensionHoldingValue(h),0),holdingCost=holdings.reduce((s,h)=>s+pensionHoldingCost(h),0),cash=views.reduce((s,x)=>s+x.cash,0),kisUnallocated=views.reduce((s,x)=>s+x.unallocated,0),detailedValue=holdingValue+cash+kisUnallocated,kinds=scope==='all'?['pension','irp']:[scope],linkedUnallocated=kinds.reduce((sum,kind)=>{const kindViews=views.filter(x=>x.account.kind===kind),kindDetailed=kindViews.reduce((n,x)=>n+x.total,0),authoritative=kindViews.length>0&&kindViews.every(x=>x.kis&&x.snapshot?.authoritative===true);return sum+(kindDetailed>.5||authoritative?0:pensionLinkedScopeValue(kind))},0),unallocated=kisUnallocated+linkedUnallocated,value=detailedValue+linkedUnallocated,cost=holdingCost+cash+unallocated,profit=holdingValue-holdingCost,hasKis=views.some(x=>x.kis),source=hasKis&&linkedUnallocated>.5?'mixed':hasKis?'kis':linkedUnallocated>.5?'linked':'asset-os',unallocatedRows=[];
 if(kisUnallocated>.5)unallocatedRows.push({key:'kis-unallocated',name:'한투 기타자산',value:kisUnallocated,detail:'한투 API가 종목 상세를 제공하지 않은 평가액'});if(linkedUnallocated>.5)unallocatedRows.push({key:'linked-unallocated',name:'연결 원장 잔액',value:linkedUnallocated,detail:'납입·통합 원장에는 있으나 종목과 연결되지 않은 금액'});
 return{scope,holdings,cash,holdingValue,holdingCost,unallocated,unallocatedRows,value,cost,profit,rate:cost?profit/cost*100:0,accounts:active.length,source}
}
function pensionAssetScopeLabel(scope=pensionAssetScope()){return scope==='pension'?'연금저축':scope==='irp'?'IRP':'전체'}
function pensionAssetModel(scope=pensionAssetScope(),lens='assetClass'){
 const m=pensionAssetMetrics(scope),colors=['#2f6fed','#15977e','#735ddd','#d18a1f','#7b8798'],groups=new Map();
 for(const h of m.holdings){const key=investmentRoleForHolding(h),entry=groups.get(key)||{key,name:key,value:0,cost:0,count:0,holdingIds:[]};entry.value+=pensionHoldingValue(h);entry.cost+=pensionHoldingCost(h);entry.count++;entry.holdingIds.push(h.id);groups.set(key,entry)}
 if(m.cash>0){const key='현금',entry=groups.get(key)||{key,name:key,value:0,cost:0,count:0,holdingIds:[]};entry.value+=m.cash;entry.cost+=m.cash;groups.set(key,entry)}
 for(const row of m.unallocatedRows){const key=row.key,entry={key,name:row.name,value:row.value,cost:row.value,count:0,holdingIds:[],detail:row.detail};groups.set(key,entry)}
 const order=INVESTMENT_ROLES;const arr=[...groups.values()].sort((a,b)=>{const ai=order.indexOf(a.key),bi=order.indexOf(b.key);return (ai<0?999:ai)-(bi<0?999:bi)||b.value-a.value}),total=arr.reduce((s,x)=>s+x.value,0)||1;let acc=0;
 const segments=arr.map((x,i)=>{const start=acc,pct=x.value/total*100;acc+=pct;return{...x,pct,start,end:acc,color:colors[i%colors.length],profit:x.value-x.cost}});return{...m,lens:'investmentRole',segments,total}
}
function pensionAssetGroupHoldings(scope,role){const m=pensionAssetMetrics(scope);return m.holdings.filter(h=>investmentRoleForHolding(h)===role).sort((a,b)=>pensionHoldingValue(b)-pensionHoldingValue(a)||String(a.name).localeCompare(String(b.name),'ko'))}
function pensionRiskMetrics(){const m=pensionAssetMetrics('irp'),risky=m.holdings.filter(h=>h.risky===true).reduce((s,h)=>s+pensionHoldingValue(h),0),unknown=m.holdings.filter(h=>h.risky!==true&&h.risky!==false).reduce((s,h)=>s+pensionHoldingValue(h),0),ratio=m.value?risky/m.value*100:0,maxRatio=m.value?(risky+unknown)/m.value*100:0,limit=Math.max(0,Math.min(100,(Number(policy('irp').riskyAssetLimit)||.70)*100));return{...m,risky,unknown,ratio,maxRatio,limit,remaining:limit-ratio,classificationComplete:unknown<=.5}}
function pensionIncomeRecords(scope=pensionAssetScope()){
 const allowedAccounts=new Set(pensionStore().accounts.filter(a=>scope==='all'||a.kind===scope).map(a=>a.id)),allowedHoldings=new Set(pensionStore().holdings.filter(h=>allowedAccounts.has(h.accountId)).map(h=>h.id)),legacy=pensionStore().incomes.filter(x=>allowedAccounts.has(x.accountId)&&(x.holdingId?allowedHoldings.has(x.holdingId):true)),txIncome=(pensionStore().transactions||[]).filter(t=>['dividend','distribution','interest','other_right'].includes(t.type)&&allowedAccounts.has(t.accountId)&&(t.holdingId?allowedHoldings.has(t.holdingId):true)).map(t=>({...t,id:t.id,accountId:t.accountId,holdingId:t.holdingId,type:t.type,date:t.date,amount:Math.max(0,(Number(t.amount)||0)-(Number(t.fee)||0)-(Number(t.tax)||0)),grossAmount:Number(t.amount)||0,tax:Number(t.tax)||0,fee:Number(t.fee)||0,source:'transaction'})),kisRights=typeof brokerKisRightIncomeRecords==='function'?brokerKisRightIncomeRecords(state.brokerKis,scope==='all'?'':scope).filter(x=>allowedAccounts.has(x.accountId)):[],ledger=[...legacy,...txIncome,...kisRights];return pensionReconcileIncome(ledger,typeof pensionArchiveIncomeRecords==='function'?pensionArchiveIncomeRecords(scope):[])

}
function pensionIncomePrincipalAt(scope,key='',mode=''){const rows=pensionSnapshotRows(scope);if(!rows.length)return key?null:pensionAssetMetrics(scope).cost;let end=localYmd();if(mode==='month'&&/^\d{4}-\d{2}$/.test(String(key))){const [y,m]=String(key).split('-').map(Number);end=localYmd(new Date(y,m,0))}else if(mode==='year'&&/^\d{4}$/.test(String(key)))end=`${key}-12-31`;const snap=rows.filter(x=>String(x.date||'')<=end).at(-1);return Math.max(0,Number(snap?.cost)||0)}
function pensionIncomeRate(scope,amount,key='',mode=''){const cost=key?pensionIncomePrincipalAt(scope,key,mode):pensionAssetMetrics(scope).cost;return cost>0?(Number(amount)||0)/cost*100:null}
function pensionIncomeSummary(scope=pensionAssetScope()){
 const records=pensionIncomeRecords(scope),year=localYmd().slice(0,4),total=records.reduce((s,x)=>s+(Number(x.amount)||0),0),yearTotal=records.filter(x=>String(x.date).startsWith(year)).reduce((s,x)=>s+(Number(x.amount)||0),0),yieldRate=pensionIncomeRate(scope,yearTotal,year,'year'),totalYieldRate=pensionIncomeRate(scope,total);return{records,total,yearTotal,yieldRate,totalYieldRate,year,count:records.length}
}
function pensionIncomeMonths(scope=pensionAssetScope(),year=localYmd().slice(0,4)){const rows=Array.from({length:12},(_,i)=>({key:`${year}-${String(i+1).padStart(2,'0')}`,month:i+1,label:`${i+1}월`,amount:0}));for(const x of pensionIncomeRecords(scope).filter(x=>String(x.date).startsWith(year))){const m=Number(String(x.date).slice(5,7));if(rows[m-1])rows[m-1].amount+=Number(x.amount)||0}return rows}
function pensionIncomeYears(scope=pensionAssetScope()){const current=Number(localYmd().slice(0,4)),records=pensionIncomeRecords(scope),recordYears=records.map(x=>Number(String(x.date).slice(0,4))).filter(Number.isFinite),start=recordYears.length?Math.min(...recordYears):current,years=[];for(let y=start;y<=current;y++){const amount=records.filter(x=>String(x.date).startsWith(String(y))).reduce((sum,x)=>sum+(Number(x.amount)||0),0);years.push({key:String(y),year:y,label:String(y),amount})}return years}
function pensionProjectionScheduledMonthly(){if(typeof financeSchedules!=='function')return 0;const today=localYmd(),accountKinds=new Map((typeof integratedStore==='function'?integratedStore().accounts:[]).map(account=>[account.id,account.kind]));return financeSchedules().filter(schedule=>schedule.active!==false&&(!schedule.startDate||schedule.startDate<=today)&&(!schedule.endDate||schedule.endDate>=today)).filter(schedule=>['pension','irp'].includes(schedule.targetKind)||['pension','irp'].includes(accountKinds.get(schedule.targetAccountId))).reduce((sum,schedule)=>sum+Math.max(0,Number(schedule.amount)||0),0)}
function pensionProjection(){const p=pensionStore().projection||{},m=pensionAssetMetrics('all'),currentYear=Number(localYmd().slice(0,4)),birthYear=Math.max(1900,Math.min(currentYear,Math.round(Number(p.birthYear)||Number(seed.pension.projection.birthYear)||currentYear))),retirementAge=Math.max(1,Math.min(100,Math.round(Number(p.retirementAge)||Number(seed.pension.projection.retirementAge)||65))),currentAge=Math.max(0,currentYear-birthYear),years=Math.max(0,retirementAge-currentAge),scheduled=pensionProjectionScheduledMonthly(),monthly=Math.max(0,Number(p.monthlyContribution)||scheduled||0),annual=Math.max(0,Number(p.annualReturn)||0),r=annual/12,n=Math.round(years*12),future=r>0?m.value*Math.pow(1+r,n)+monthly*(Math.pow(1+r,n)-1)/r:m.value+monthly*n,withdrawal=Math.max(0,Number(p.withdrawalRate)||0),inflation=Math.max(0,Number(p.inflationRate)||0),monthlyPension=future*withdrawal/12,futureReal=inflation>0?future/Math.pow(1+inflation,years):future,monthlyPensionReal=futureReal*withdrawal/12;return{...p,birthYear,current:m.value,years,yearsToRetire:years,monthly,annual,future,withdrawal,monthlyPension,inflation,retirementAge,currentAge,futureReal,monthlyPensionReal}}
function pensionPerformanceContribution(scope=pensionAssetScope()){const model=pensionAssetModel(scope,'assetClass'),base=Math.max(0,model.cost),rows=model.segments.map(x=>({name:x.name,key:x.key,value:x.value,cost:x.cost,profit:x.profit,rate:x.cost?x.profit/x.cost*100:0,contribution:base?x.profit/base*100:0,pct:x.pct,color:x.color}));return{scope,totalRate:model.rate,totalProfit:model.profit,totalCost:model.cost,rows,ranked:[...rows].sort((a,b)=>Math.abs(b.contribution)-Math.abs(a.contribution))}}
function pensionHoldingById(id){return pensionScopedHoldings('all').find(h=>h.id===id)||null}

function pensionReconcileIncome(details,archives){
 // Archives are historical monthly totals, not individual cash movements.
 // Retain their unitemized remainder; never drop a whole month for one payment.
 const rows=[],remaining=new Map(),matched=new Set();
 const key=x=>{const holding=x.holdingId&&typeof pensionHoldingById==='function'?pensionHoldingById(x.holdingId):null,product=x.productCode||holding?.productCode||holding?.code;return x.accountId&&product?[x.accountId,product,x.date,brokerKisIncomeCategory(x.type),Number(x.amount)||0,Number(x.tax)||0].join('|'):''};
 const broker=details.filter(x=>x.brokerRight);
 for(const x of details){
  if(!x.brokerRight){const k=key(x),same=k?broker.find(b=>!matched.has(b.id)&&key(b)===k):null;if(same){matched.add(same.id);continue}}
  if(rows.some(r=>r.id===x.id&&r.source===x.source))continue;
  rows.push({...x});
 }
 for(const x of rows){
  if(!['dividend','distribution'].includes(x.type))continue;
  const kind=x.accountKind||pensionAccount(x.accountId)?.kind;
  const key=kind+'|'+String(x.date).slice(0,7);
  remaining.set(key,(remaining.get(key)||0)+(Number(x.amount)||0));
 }
 for(const x of archives){
  const key=x.accountKind+'|'+String(x.date).slice(0,7),original=Number(x.amount)||0,covered=Math.min(original,remaining.get(key)||0);
  remaining.set(key,Math.max(0,(remaining.get(key)||0)-covered));
  rows.push({...x,archive:true,readOnly:true,originalAmount:original,amount:Math.max(0,original-covered),reconciledAmount:covered,label:covered?'과거 월합계 · 미상세분':x.label});
 }
 return rows.sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.id).localeCompare(String(a.id)));
}
function pensionVisibleTransactionRows(scope='all'){
 const incomes=pensionIncomeRecords(scope),manual=pensionTransactions(scope).filter(x=>!['dividend','distribution','interest','other_right'].includes(x.type)),orders=brokerKisVisibleOrders(state.brokerKis,scope);
 const realized=typeof pensionArchiveTransactionRows==='function'?pensionArchiveTransactionRows(scope).filter(x=>x.type!=='dividend'):[];
 const contributions=typeof centralPensionContributionRows==='function'?centralPensionContributionRows().filter(t=>scope==='all'||t.kind===scope).map(t=>({...t,accountKind:t.kind,linkedContribution:true})):[];
 return [...manual,...orders,...incomes,...realized,...contributions].sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.time||'').localeCompare(String(a.time||''))||String(b.id).localeCompare(String(a.id)));
}
;
/* asset-os source: isa-validation.js */
'use strict';
function statusText(s){return ({active:'운영 중',maturity_pending:'만기 대기',closed:'일반 해지 완료',transferred:'연금 전환 완료',archived:'보관'})[s]||s}
function validYmdDate(v){const s=String(v||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const [y,m,d]=s.split('-').map(Number),dt=new Date(`${s}T12:00:00`);return dt.getFullYear()===y&&dt.getMonth()+1===m&&dt.getDate()===d}
function postedDateError(date){const d=String(date||'');if(!validYmdDate(d))return'날짜를 확인해 주세요.';if(d>localYmd())return'미래 날짜의 완료 거래는 저장할 수 없습니다.';return''}
function isaTransactionDateError(a,date){const d=String(date||''),basic=postedDateError(d);if(basic)return basic;const opened=String(a?.openedAt||a?.baselineDate||a?.baseline?.date||'');if(opened&&d<opened)return'ISA 개설일 이전 거래는 저장할 수 없습니다.';const end=String(a?.closedAt||a?.maturityAt||'');if(end&&d>end)return'ISA 만기·종료일 이후 거래는 저장할 수 없습니다.';return''}
function pensionTransactionDateError(a,date){const d=String(date||''),basic=postedDateError(d);if(basic)return basic;const opened=String(a?.openedAt||'');if(opened&&d<opened)return`${pensionAccountKindLabel(a?.kind||'pension')} 개설일 이전 거래는 저장할 수 없습니다.`;const end=String(a?.closedAt||'');if(end&&d>end)return`${pensionAccountKindLabel(a?.kind||'pension')} 종료일 이후 거래는 저장할 수 없습니다.`;return''}
function isCurrentAccount(a){return !!a&&['active','maturity_pending'].includes(a.status)}
function isTradeableAccount(a){return !!a&&a.status==='active'}
function isPastAccount(a){return !!a&&['closed','transferred','archived'].includes(a.status)}
function transactionNumericError(tx){
 const finite=v=>Number.isFinite(Number(v)),fee=Number(tx.fee??0),tax=Number(tx.tax??0);
 if(!finite(fee)||!finite(tax)||fee<0||tax<0)return '수수료와 세금은 0 이상의 올바른 숫자여야 합니다.';
 if(['buy','sell','openingAllocation'].includes(tx.type)){const q=Number(tx.qty),p=Number(tx.price);if(!finite(q)||q<=0)return '수량은 0보다 커야 합니다.';if(!finite(p)||p<=0)return '단가는 0보다 커야 합니다.';if(tx.type==='sell'&&fee+tax>q*p+1e-8)return '매도 수수료와 세금 합계가 매도금액을 초과할 수 없습니다.'}
 if(['securityTransferIn','securityTransferOut'].includes(tx.type)){const q=Number(tx.qty);if(!finite(q)||q<=0)return '이전 수량은 0보다 커야 합니다.'}
 if(['deposit','internalTransferIn','depositReversal','withdrawal','internalTransferOut','dividend','distribution','interest','feeRefund','taxRefund'].includes(tx.type)){const amount=Number(tx.amount);if(!finite(amount)||amount<=0)return '금액은 0보다 커야 합니다.';if(['dividend','distribution','interest'].includes(tx.type)&&fee+tax>amount+1e-8)return '수수료와 세금 합계가 세전 수령액을 초과할 수 없습니다.'}
 if(tx.type==='adjustment'){for(const key of ['setQty','setAvg','cashDelta'])if(tx[key]!=null&&tx[key]!==''&&!finite(tx[key]))return '잔고 조정값은 올바른 숫자여야 합니다.';if(tx.setQty!=null&&Number(tx.setQty)<0)return '조정 수량은 음수가 될 수 없습니다.';if(tx.setAvg!=null&&Number(tx.setAvg)<0)return '조정 평균단가는 음수가 될 수 없습니다.'}
 return ''
}
function typeText(t){return ({buy:'매수',sell:'매도',openingAllocation:'기초자금 매수반영',dividend:'배당',distribution:'ETF 분배금',interest:'예수금 이자',deposit:'외부 입금',internalTransferIn:'통합→ISA 이체',depositReversal:'입금 취소·반환',withdrawal:'일반 출금',internalTransferOut:'ISA→통합 이체',adjustment:'잔고 조정',split:'액면분할',reverseSplit:'병합',merger:'합병',delisting:'상장폐지',feeRefund:'수수료 환급',taxRefund:'세금 환급'})[t]||t}
;
/* asset-os source: isa-ledger.js */
'use strict';
function holdingPriceScale(h){const value=Number(h?.priceScale);return Number.isFinite(value)&&value>0?value:1}
function holdingPositionValue(h,qty=h?.qty,price=h?.currentPrice){return (Number(qty)||0)*(Number(price)||0)/holdingPriceScale(h)}
function holdingCostValue(h,qty=h?.qty,price=h?.avgPrice){return holdingPositionValue(h,qty,price)}
function holdingQuantityText(h,qty=h?.qty){return h?.quantityUnit==='face'?`${num(qty)}원 액면`:`${quantityNumber(qty)}주`}
function transactionPositionValue(h,qty,price){return holdingPositionValue(h,qty,price)}
function replay(account,candidateTxs=null,includeCentral=true){
 if(!account)return {holdings:[],cash:0,valid:true,error:null,errorTxId:null,realized:0,income:0,fees:0,taxes:0,facts:new Map()};
 if(isPastAccount(account)){
  const holdings=account.holdings.map(h=>{const row={...h,qty:h.snapshotQty??h.baselineQty??0,avgPrice:h.snapshotAvg??h.baselineAvg??0,currentPrice:h.snapshotPrice??h.currentPrice??0,realized:0};return{...row,marketValue:holdingPositionValue(row)}});
  return {holdings,cash:account.cashSnapshot??account.baselineCash??0,valid:true,error:null,realized:0,income:0,fees:0,taxes:0,facts:new Map()};
 }
 const baseDate=account.baseline?.date||account.baselineDate||account.openedAt||'0000-01-01';
 const map=new Map(account.holdings.map(h=>[h.id,{...h,qty:Number(h.baselineQty)||0,avgPrice:Number(h.baselineAvg)||0,currentPrice:Number(h.currentPrice)||0,realized:0}]));
 let cash=Number(account.baseline?.cash??account.baselineCash??account.cashOpening)||0,error=null,errorTxId=null,realized=0,income=0,fees=0,taxes=0;const facts=new Map();
 const baseTxs=candidateTxs||account.transactions,centralRows=includeCentral?centralIsaReplayRows(account):[];const txs=sortTxs([...baseTxs,...centralRows]).filter(t=>t.status!=='cancelled');
 const byId=new Map(txs.map(t=>[t.id,t])),processed=new Set(),reversedBySource=new Map(),tolerance=Number(account.reconciliationTolerance||10);
 for(const tx of txs){
  const dateError=isaTransactionDateError(account,txDate(tx));if(dateError){error=dateError;errorTxId=tx.id;break}
  if(txDate(tx)<baseDate){error='ISA 기준일 이전 거래는 저장할 수 없습니다.';errorTxId=tx.id;break}
  const numericError=transactionNumericError(tx);if(numericError){error=numericError;errorTxId=tx.id;break}
  const h=tx.holdingId?map.get(tx.holdingId):null,q=Number(tx.qty??0),p=Number(tx.price??0),f=Number(tx.fee??0),tax=Number(tx.tax??0),amount=Number(tx.amount??0);
  if(['deposit','internalTransferIn','feeRefund','taxRefund'].includes(tx.type)){cash+=amount;facts.set(tx.id,{tradeAmount:amount})}
  if(['withdrawal','internalTransferOut'].includes(tx.type)){
   if(amount>cash+1e-8){error='계좌 현금보다 큰 출금은 저장할 수 없습니다.';errorTxId=tx.id;break}
   cash-=amount;facts.set(tx.id,{tradeAmount:amount})
  }
  if(tx.type==='depositReversal'){
   const source=tx.reversesTransactionId?byId.get(tx.reversesTransactionId):null;
   if(!source||!['deposit','internalTransferIn'].includes(source.type)||!processed.has(source.id)){error='입금 취소는 먼저 기록된 원입금 거래를 선택해야 합니다.';errorTxId=tx.id;break}
   const used=reversedBySource.get(source.id)||0,available=Math.max(0,(Number(source.amount)||0)-used);
   if(amount>available+1e-8){error='원입금의 남은 취소 가능금액을 초과했습니다.';errorTxId=tx.id;break}
   if(amount>cash+1e-8){error='계좌 현금보다 큰 입금 취소는 저장할 수 없습니다.';errorTxId=tx.id;break}
   cash-=amount;reversedBySource.set(source.id,used+amount);facts.set(tx.id,{tradeAmount:amount,reversesTransactionId:source.id})
  }
  if(['dividend','distribution','interest'].includes(tx.type)){const net=amount-f-tax;cash+=net;income+=net;fees+=f;taxes+=tax;facts.set(tx.id,{tradeAmount:net,grossAmount:amount})}
  if(['buy','openingAllocation'].includes(tx.type)){
   if(!h){error='등록되지 않은 종목의 매수 기록이 있습니다.';errorTxId=tx.id;break}
   const scale=holdingPriceScale(h),cost=transactionPositionValue(h,q,p)+f+tax,totalCost=holdingCostValue(h)+cost;h.qty+=q;h.avgPrice=h.qty?(totalCost*scale/h.qty):0;cash-=cost;fees+=f;taxes+=tax;facts.set(tx.id,{tradeAmount:cost});
  }
  if(tx.type==='sell'){
   if(!h){error='등록되지 않은 종목의 매도 기록이 있습니다.';errorTxId=tx.id;break}
   if(q>h.qty+1e-8){error=`${h.name} 매도수량이 당시 보유수량을 초과합니다.`;errorTxId=tx.id;break}
   const gain=transactionPositionValue(h,q,p-h.avgPrice)-f-tax,proceeds=transactionPositionValue(h,q,p)-f-tax;h.realized+=gain;realized+=gain;h.qty-=q;cash+=proceeds;fees+=f;taxes+=tax;facts.set(tx.id,{tradeAmount:proceeds,realized:gain});
  }
  if(tx.type==='adjustment'){if(h&&Number.isFinite(Number(tx.setQty)))h.qty=Number(tx.setQty);if(h&&Number.isFinite(Number(tx.setAvg)))h.avgPrice=Number(tx.setAvg);if(Number.isFinite(Number(tx.cashDelta)))cash+=Number(tx.cashDelta);facts.set(tx.id,{tradeAmount:Number(tx.cashDelta)||0})}
  if(['split','reverseSplit'].includes(tx.type)&&h){const ratio=Number(tx.ratio)||1;if(ratio<=0){error='분할·병합 비율이 올바르지 않습니다.';errorTxId=tx.id;break}h.qty*=ratio;h.avgPrice/=ratio;facts.set(tx.id,{tradeAmount:0,corporateAction:true})}
  if(tx.type==='securityTransferIn'&&h){const scale=holdingPriceScale(h),total=holdingCostValue(h)+transactionPositionValue(h,q,p);h.qty+=q;h.avgPrice=h.qty?total*scale/h.qty:0;facts.set(tx.id,{tradeAmount:0})}
  if(tx.type==='securityTransferOut'&&h){if(q>h.qty+1e-8){error=`${h.name} 이전수량이 당시 보유수량을 초과합니다.`;errorTxId=tx.id;break}h.qty-=q;facts.set(tx.id,{tradeAmount:0})}
  if(h&&h.qty<-.0000001){error=`${h.name} 보유수량이 음수가 됩니다.`;errorTxId=tx.id;break}
  if(cash<-.0000001){error='거래 시점의 ISA 계좌 현금이 음수가 됩니다.';errorTxId=tx.id;break}
  if(!Number.isFinite(cash)){error='계좌 현금 계산값이 올바르지 않습니다.';errorTxId=tx.id;break}
  processed.add(tx.id)
 }
 const holdings=[...map.values()].map(h=>({...h,lifecycleStatus:h.qty>0?'active':'archived',marketValue:holdingPositionValue(h)}));
 return {holdings,cash,valid:!error,error,errorTxId,realized,income,fees,taxes,facts}
}
function auditReplay(account,candidateTxs=null){return isPastAccount(account)?replay({...account,status:'active'},candidateTxs||account.transactions,false):replay(account,candidateTxs)}
function accountMetrics(account){
 const r=replay(account),holdingsValue=r.holdings.reduce((sum,h)=>sum+h.marketValue,0),cost=r.holdings.reduce((sum,h)=>sum+holdingCostValue(h),0),unrealized=holdingsValue-cost;
 if(isPastAccount(account)){const value=account.maturity?.actualSettlement??holdingsValue+r.cash;return {...r,value,holdingsValue,cost,unrealized,profit:unrealized+r.realized,rate:cost?(unrealized+r.realized)/cost*100:0,totalReturn:unrealized+r.realized+r.income}}
 const value=holdingsValue+r.cash,profit=unrealized+r.realized;return {...r,value,holdingsValue,cost,unrealized,profit,rate:cost?profit/cost*100:0,totalReturn:profit+r.income}
}
function isaHoldingTaxTreatment(h){const kind=String(h?.assetClass||'').trim();if(['국내주식','국내주식 ETF','개별채권'].includes(kind))return'exempt';if(['해외주식 ETF','채권 ETF','현금성 ETF'].includes(kind))return'taxable-estimate';return'unknown'}
function taxableBreakdown(a){const b={gains:Number(a.taxBreakdown?.gains)||0,losses:Number(a.taxBreakdown?.losses)||0,dividends:Number(a.taxBreakdown?.dividends)||0,expenses:Number(a.taxBreakdown?.expenses)||0,excludedGains:0,excludedLosses:0,unclassified:0,estimatedBasis:0};const r=replay(a),holdings=new Map((a.holdings||[]).map(h=>[h.id,h]));for(const t of sortTxs(a.transactions||[])){if(t.status==='cancelled'||txDate(t)<(a.baselineDate||a.openedAt||''))continue;const f=r.facts.get(t.id)||{};if(t.type==='sell'&&Number.isFinite(f.realized)){const treatment=isaHoldingTaxTreatment(holdings.get(t.holdingId));if(treatment==='unknown'){b.unclassified+=Math.abs(f.realized);continue}if(treatment==='exempt'){if(f.realized>=0)b.excludedGains+=f.realized;else b.excludedLosses+=f.realized;continue}b.estimatedBasis+=Math.abs(f.realized);if(f.realized>=0)b.gains+=f.realized;else b.losses+=f.realized}if(['dividend','distribution','interest'].includes(t.type)){b.dividends+=Number(f.grossAmount??t.amount)||0;b.expenses-=Number(t.fee||0)}}return b}
function taxableNet(a){const b=taxableBreakdown(a);return b.gains+b.losses+b.dividends+b.expenses}
function exemption(a){const p=policy('isa',a);return a.type==='서민형'?p.lowIncomeExemption:a.type==='농어민형'?p.farmerExemption:p.generalExemption}
function expectedTax(a){return Math.max(0,taxableNet(a)-exemption(a))*policy('isa',a).taxRate}
function dividends(a){return (a.transactions||[]).filter(t=>['dividend','distribution'].includes(t.type)&&t.status!=='cancelled').sort((x,y)=>txDate(y).localeCompare(txDate(x))||txSequence(y)-txSequence(x))}
function dividendNetAmount(t){return Math.max(0,(Number(t?.amount)||0)-(Number(t?.fee)||0)-(Number(t?.tax)||0))}
function dividendAnalysisRecords(a){return dividends(a).filter(x=>!x.meta?.analysisOnly).sort((x,y)=>txDate(y).localeCompare(txDate(x))||txSequence(y)-txSequence(x))}
function periodEndDate(key,period){if(period==='month'){const [y,m]=String(key).split('-').map(Number);if(!y||!m)return ymd();return localYmd(new Date(y,m,0))}return /^\d{4}$/.test(String(key))?`${key}-12-31`:ymd()}
function investmentPrincipalAt(a,endDate){if(isPastAccount(a))return accountMetrics(a).cost;const txs=(a.transactions||[]).filter(t=>txDate(t)<=endDate),r=replay(a,txs);return r.valid?r.holdings.reduce((sum,h)=>sum+holdingCostValue(h),0):0}
function dividendYieldFor(a,key,period,amount){const end=periodEndDate(key,period),principal=investmentPrincipalAt(a,end),rate=principal>0?(Number(amount)||0)/principal*100:null;return{principal,rate}}
function consistencyIssues(a){
 const issues=[],tol=Number(a.reconciliationTolerance||10),r=auditReplay(a);
 const push=(code,title,detail,severity='medium',transactionId='')=>issues.push({id:`${a.id}-${code}-${transactionId||issues.length}`,accountId:a.id,transactionId,title,detail,severity});
 if(!r.valid)push('ledger',r.error||'거래원장 계산 오류','해당 거래와 그 이후 계산을 확인해 주세요.','high',r.errorTxId||'');
 else if(r.cash<-tol)push('cash-negative','계좌 현금이 음수입니다',`${won(Math.abs(r.cash))} 부족합니다. 누락된 입금 또는 매수 기록을 확인해 주세요.`,'high');
 const seen=new Map();
 for(const t of a.transactions||[]){
  if(t.status==='cancelled')continue;
  const key=t.idempotencyKey||stableTxKey(t);
  if(seen.has(key))push('duplicate','중복 거래가 의심됩니다',`${formatDate(txDate(t))} ${typeText(t.type)} 거래가 같은 조건으로 두 번 있습니다.`,'medium',t.id);else seen.set(key,t.id);
  if(t.holdingId&&!a.holdings.some(h=>h.id===t.holdingId)&&['buy','sell','openingAllocation','dividend','distribution','adjustment','securityTransferIn','securityTransferOut'].includes(t.type))push('missing-holding','거래 종목 연결이 끊겼습니다',`${formatDate(txDate(t))} ${typeText(t.type)} 거래의 종목을 찾지 못했습니다.`,'high',t.id);
  const closeDate=a.closedAt||a.maturityAt;if(!isTradeableAccount(a)&&closeDate&&txDate(t)>closeDate)push('after-close',a.status==='maturity_pending'?'만기 후 거래가 있습니다':'종료 후 거래가 있습니다',`${formatDate(txDate(t))} 거래가 ${a.status==='maturity_pending'?'만기일':'계좌 종료일'} 이후입니다.`,'high',t.id);
  if(t.type==='depositReversal'){
   const src=a.transactions.find(x=>x.id===t.reversesTransactionId),used=(a.transactions||[]).filter(x=>x.type==='depositReversal'&&x.status!=='cancelled'&&x.reversesTransactionId===t.reversesTransactionId).reduce((sum,x)=>sum+(Number(x.amount)||0),0);
   if(!src||!['deposit','internalTransferIn'].includes(src.type))push('reversal-source','입금 취소의 원거래가 없습니다',`${formatDate(txDate(t))} 입금 취소 기록을 확인해 주세요.`,'high',t.id);else if(used>(Number(src.amount)||0)+tol)push('reversal-over','원입금보다 많이 취소됐습니다',`원입금 ${won(src.amount)}보다 누적 취소액이 큽니다.`,'high',t.id)
  }
  if(t.linkedBuyId&&!a.transactions.some(x=>x.id===t.linkedBuyId))push('linked-buy','연결된 매수 기록이 없습니다',`${formatDate(txDate(t))} 배당의 재투자 연결을 확인해 주세요.`,'medium',t.id);
  if(t.sourceDividendId&&!a.transactions.some(x=>x.id===t.sourceDividendId))push('linked-dividend','연결된 배당 기록이 없습니다',`${formatDate(txDate(t))} 매수의 배당 연결을 확인해 주세요.`,'medium',t.id)
 }
 const holdingNames=new Map();for(const h of a.holdings||[]){const key=h.securityKey||normalizeName(h.name);if(holdingNames.has(key))push('holding-duplicate','중복 종목 등록이 의심됩니다',`${h.name}이(가) 두 개의 보유종목으로 등록돼 있습니다.`,'medium');else holdingNames.set(key,h.id)}
 const latest=[...(a.reconciliations||[])].sort((x,y)=>String(y.capturedAt||'').localeCompare(String(x.capturedAt||'')))[0];if(latest?.summary?.missing>0)push('reconcile-missing','잔고 대조에서 누락된 종목이 있습니다',`${latest.summary.missing}개 종목은 자동 삭제하지 않았습니다. 원장과 실제 잔고를 확인해 주세요.`,'medium');
 const tax=taxableBreakdown(a);if(tax.unclassified>.5)push('tax-unclassified','ISA 과세분류가 확인되지 않은 매도가 있습니다',`${won(tax.unclassified)} 규모의 실현손익은 예상세금에서 제외했습니다. 종목 자산군을 확인해 주세요.`,'medium');
 return issues
}
function allIsaIssues(){return state.accounts.flatMap(a=>consistencyIssues(a))}
;
/* asset-os source: isa-quotes.js */
'use strict';
let isaQuoteRefreshPromise=null;
function isaQuoteLinks(a=currentAccount()){return (a?.holdings||[]).filter(h=>h.lifecycleStatus!=='archived'&&h.quoteSource==='kis'&&h.instrumentCode&&['stock','bond'].includes(h.quoteType)).map(h=>({holdingId:h.id,type:h.quoteType,code:String(h.instrumentCode).trim().toUpperCase()}))}
function applyIsaQuoteResults(a,quotes,fetchedAt){const before={cash:a.baselineCash,transactions:JSON.stringify(a.transactions||[]),positions:(a.holdings||[]).map(h=>[h.id,h.baselineQty,h.baselineAvg])},byKey=new Map((quotes||[]).map(q=>[`${q.type}:${String(q.code||'').toUpperCase()}`,q]));let updated=0;for(const h of a.holdings||[]){const quote=byKey.get(`${h.quoteType}:${String(h.instrumentCode||'').toUpperCase()}`);if(!quote||!(Number(quote.price)>0))continue;h.currentPrice=Number(quote.price);h.quoteUpdatedAt=fetchedAt||new Date().toISOString();h.quoteStatus='ok';h.quoteError='';updated++}const unchanged=before.cash===a.baselineCash&&before.transactions===JSON.stringify(a.transactions||[])&&before.positions.every(([id,qty,avg])=>{const h=a.holdings.find(x=>x.id===id);return h&&h.baselineQty===qty&&h.baselineAvg===avg}),linked=isaQuoteLinks(a).length;return{ok:unchanged,updated,missing:Math.max(0,linked-updated),error:unchanged?'':'QUOTE_MUTATED_FIXED_DATA'}}
async function refreshIsaQuotes({manual=false}={}){const a=currentAccount();if(!a)return{ok:false,error:'ISA_ACCOUNT_MISSING'};const links=isaQuoteLinks(a);if(!links.length)return{ok:false,error:'ISA_QUOTES_NOT_LINKED'};if(isaQuoteRefreshPromise)return isaQuoteRefreshPromise;isaQuoteRefreshPromise=(async()=>{const result=QA_MODE?{ok:true,data:{quotes:links.map(x=>({...x,price:Number(a.holdings.find(h=>h.id===x.holdingId)?.currentPrice)||1})),fetchedAt:new Date().toISOString()}}:await brokerKisClient.quotes(links.map(({type,code})=>({type,code})));if(!result.ok)return result;const snapshot=clone(a),applied=applyIsaQuoteResults(a,result.data.quotes,result.data.fetchedAt);if(!applied.ok){Object.assign(a,snapshot);return applied}if(!persist(false)){Object.assign(a,snapshot);return{ok:false,error:'PERSIST_FAILED'}}if(manual){renderKeepingScroll();toast(applied.missing?`현재가 ${applied.updated}개 갱신 · ${applied.missing}개 미갱신`:`현재가 ${applied.updated}개 갱신 · 수량·매입가 유지`)}return{ok:true,updated:applied.updated,missing:applied.missing,fetchedAt:result.data.fetchedAt}})().catch(error=>({ok:false,error:String(error?.message||'QUOTE_REFRESH_FAILED')})).finally(()=>{isaQuoteRefreshPromise=null});return isaQuoteRefreshPromise}
document.addEventListener('click',async event=>{const button=event.target.closest?.('[data-isa-quote-refresh]');if(!button)return;button.disabled=true;button.textContent='조회 중';const result=await refreshIsaQuotes({manual:true});if(!result.ok){button.disabled=false;button.textContent='갱신';toast(result.error==='BROKER_AUTH_REQUIRED'?'한국투자 연결 로그인이 필요합니다.':`현재가 갱신 실패 · ${result.error}`)}})
