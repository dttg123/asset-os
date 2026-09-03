'use strict';
function sourceArchiveRecords(){return state.sourceArchives?.records||[]}
function pensionArchiveKinds(scope='all',type='all'){
 const prefix=scope==='pension'?['pension']:scope==='irp'?['irp']:['pension','irp'],suffix=type==='realized'?['Realized']:type==='income'?['Dividend']:['Realized','Dividend'];return prefix.flatMap(p=>suffix.map(s=>p+s))
}
function pensionArchivePerformanceRows(scope='all'){
 const kinds=new Set(pensionArchiveKinds(scope)),months=new Map();for(const r of sourceArchiveRecords()){if(!kinds.has(r.kind)||!/^\d{4}-\d{2}/.test(String(r.date)))continue;const key=String(r.date).slice(0,7),row=months.get(key)||{key,date:`${key}-01`,label:key.slice(2).replace('-','.'),realized:0,income:0,total:0,cumulativeRealized:0,cumulativeIncome:0,cumulativeTotal:0};if(String(r.kind).endsWith('Realized'))row.realized+=Number(r.amount)||0;else row.income+=Number(r.amount)||0;row.total=row.realized+row.income;months.set(key,row)}let realized=0,income=0;return [...months.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(row=>{realized+=row.realized;income+=row.income;return{...row,cumulativeRealized:realized,cumulativeIncome:income,cumulativeTotal:realized+income}})
}
function pensionArchivePerformanceSummary(scope='all'){
 const rows=pensionArchivePerformanceRows(scope),last=rows.at(-1)||{cumulativeRealized:0,cumulativeIncome:0,cumulativeTotal:0};return{scope,rows,count:sourceArchiveRecords().filter(r=>pensionArchiveKinds(scope).includes(r.kind)).length,realized:last.cumulativeRealized,income:last.cumulativeIncome,total:last.cumulativeTotal}
}
function pensionArchiveIncomeRecords(scope='all'){
 const kinds=new Set(pensionArchiveKinds(scope,'income'));return sourceArchiveRecords().filter(r=>kinds.has(r.kind)&&/^\d{4}-\d{2}/.test(String(r.date))&&(Number(r.amount)||0)>0).map(r=>({id:r.id,accountId:'',holdingId:'',accountKind:String(r.kind).startsWith('irp')?'irp':'pension',type:'dividend',date:r.date,amount:Number(r.amount)||0,label:r.label,source:'source-archive'}))
}
function openSourceArchiveHub(){const rows=sourceArchiveRecords(),groups=new Map();for(const r of rows){const key=r.kind||'note',g=groups.get(key)||{kind:key,count:0,total:0};g.count++;g.total+=Number(r.amount)||0;groups.set(key,g)}const labels={pensionRealized:'개인연금 실현손익',irpRealized:'IRP 실현손익',pensionDividend:'개인연금 배당',irpDividend:'IRP 배당',loanInterest:'대출이자 검산',loanFee:'중도상환 수수료',cashFlow:'현금흐름 검산'};$('#sheetEyebrow').textContent='초기자료 · 검산';$('#sheetTitle').textContent=`원본 대조 ${rows.length}건`;$('#sheetBody').innerHTML=`<div class="source-note">이 화면은 사진 원본과 계산값을 대조하는 읽기 전용 자료입니다. KIS 체결·권리 및 실제 원장 합계에는 중복 가산하지 않습니다.</div><div class="sheetrows">${[...groups.values()].map(g=>`<div class="sheetrow"><span>${escapeHtml(labels[g.kind]||g.kind)}<small style="display:block">${g.count}건</small></span><strong>${g.kind==='cashFlow'?won(g.total):signed(g.total)}</strong></div>`).join('')}</div>`;openSheet('#detailSheet')}
