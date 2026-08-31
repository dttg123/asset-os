'use strict';
function pensionStore(){return state.pension}
function pensionAccount(id){return pensionStore().accounts.find(a=>a.id===id)||null}
function pensionAccountKindLabel(kind){return kind==='irp'?'IRP':'연금저축'}
function pensionYearRecords(year=String(new Date().getFullYear())){return centralPensionContributionRows(year)}
function pensionSummary(year=String(new Date().getFullYear())){
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
function pensionMonthly(year=String(new Date().getFullYear())){const rows=Array.from({length:12},(_,i)=>({month:i+1,pension:0,irp:0,total:0,transfer:0,transferPension:0,transferIrp:0})),accounts=new Map(pensionStore().accounts.map(a=>[a.id,a]));for(const x of pensionYearRecords(year)){const m=Number(String(x.date).slice(5,7)),row=rows[m-1],a=accounts.get(x.accountId),kind=a?.kind||x.kind;if(!row||!['pension','irp'].includes(kind))continue;const amount=Number(x.amount)||0,isIrp=kind==='irp';if(x.type==='isaTransfer'){row.transfer+=amount;if(isIrp)row.transferIrp+=amount;else row.transferPension+=amount}else{row[isIrp?'irp':'pension']+=amount;row.total+=amount}}return rows}
function pensionCurrentMonthOrdinary(){const key=localYmd().slice(0,7),accounts=new Map(pensionStore().accounts.map(a=>[a.id,a]));let pension=0,irp=0;for(const x of centralPensionContributionRows().filter(x=>x.type==='contribution'&&String(x.date).startsWith(key))){const a=accounts.get(x.accountId),kind=a?.kind||x.kind;if(kind==='irp')irp+=Number(x.amount)||0;else if(kind==='pension')pension+=Number(x.amount)||0}return{pension,irp,total:pension+irp}}


