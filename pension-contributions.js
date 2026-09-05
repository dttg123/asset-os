'use strict';
function pensionStore(){return state.pension}
function pensionAccount(id){return pensionStore().accounts.find(a=>a.id===id)||null}
function pensionAccountKindLabel(kind){return kind==='irp'?'IRP':'연금저축'}
function pensionYearRecords(year=localYmd().slice(0,4)){return centralPensionContributionRows(year)}
function pensionSummary(year=localYmd().slice(0,4)){
 const records=pensionYearRecords(year),p=policyForYear('pension',year),isaP=policyForYear('isa',year),accounts=new Map(pensionStore().accounts.map(a=>[a.id,a]));
 let ordinaryPs=0,ordinaryIrp=0,transferPs=0,transferIrp=0;
 for(const x of records){const a=accounts.get(x.accountId),kind=a?.kind||x.kind;if(!['pension','irp'].includes(kind))continue;const amount=Number(x.amount)||0,isIrp=kind==='irp',isTransfer=x.type==='isaTransfer';if(isTransfer){if(isIrp)transferIrp+=amount;else transferPs+=amount}else{if(isIrp)ordinaryIrp+=amount;else ordinaryPs+=amount}}
 const ordinary=ordinaryPs+ordinaryIrp,transfer=transferPs+transferIrp,total=ordinary+transfer,psTotal=ordinaryPs+transferPs,irpTotal=ordinaryIrp+transferIrp;
 const psLimit=Number(p.annualTaxCreditLimit)||6000000,combinedLimit=Number(p.combinedTaxCreditLimit)||9000000,annualContributionLimit=Number(p.annualContributionLimit)||18000000;
 const regularCreditBase=Math.min(Math.min(psTotal,psLimit)+irpTotal,combinedLimit);
 const extraLimit=Math.min(transfer*(Number(isaP.transferDeductionRate)||.10),Number(isaP.transferDeductionMax)||3000000);
 const totalCreditLimit=combinedLimit+extraLimit,creditBase=Math.min(total,regularCreditBase+extraLimit),creditRate=Number(p.taxCreditRate)||0,estimatedCredit=creditBase*creditRate;
 const goalPs=Number(pensionStore().goal?.pensionSavings)||6000000,goalIrp=Number(pensionStore().goal?.irp)||3000000,goalTotal=goalPs+goalIrp,goalCurrent=Math.min(ordinaryPs,goalPs)+Math.min(ordinaryIrp,goalIrp);
 return{year,records,ordinaryPs,ordinaryIrp,transferPs,transferIrp,ordinary,transfer,total,psTotal,irpTotal,psLimit,combinedLimit,annualContributionLimit,regularCreditBase,extraLimit,totalCreditLimit,creditBase,creditRate,estimatedCredit,remainingCredit:Math.max(0,totalCreditLimit-creditBase),remainingOrdinary:Math.max(0,annualContributionLimit-ordinary),goalPs,goalIrp,goalTotal,goalCurrent}
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
 return{ok:true,data,nextIntegrated:normalizeIntegrated(nextIntegrated),nextPension,nextSchedules:normalizeFinanceSchedules(nextSchedules),summary}
}
function applyPensionContributionBatch(input={}){
 const candidate=pensionContributionBatchCandidate(input);if(!candidate.ok)return candidate;
 state.integrated=candidate.nextIntegrated;state.pension=candidate.nextPension;state.financeSchedules=candidate.nextSchedules;
 return{ok:true,summary:candidate.summary,data:candidate.data}
}
