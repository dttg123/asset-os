'use strict';
function getHolding(a,id){return accountMetrics(a).holdings.find(h=>h.id===id)}
function holdingName(a,id){return a.holdings.find(h=>h.id===id)?.name||'계좌 현금'}
function formatDate(d){if(!d)return'-';const [y,m,day]=d.split('-');return `${y}.${m}.${day}`}
function quantityNumber(value,maxDigits=6){const n=Number(value)||0;return new Intl.NumberFormat('ko-KR',{minimumFractionDigits:0,maximumFractionDigits:maxDigits}).format(n)}
function daysUntil(d){if(!d)return null;const [y,m,day]=d.split('-').map(Number),todayParts=String(typeof localYmd==='function'?localYmd():'').split('-').map(Number),now=todayParts.length===3&&todayParts.every(Number.isFinite)?new Date(todayParts[0],todayParts[1]-1,todayParts[2]):new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate()),target=new Date(y,m-1,day);return Math.ceil((target-today)/86400000)}
function ddayLabel(d){const left=daysUntil(d);if(left===null)return'-';if(left>0)return`D-${left}`;if(left===0)return'D-DAY';return`D+${Math.abs(left)}`}
function polarToCartesian(cx,cy,r,angleDeg){const rad=(angleDeg-90)*Math.PI/180;return{x:cx+r*Math.cos(rad),y:cy+r*Math.sin(rad)}}
function describeArcPath(cx,cy,r,startPct,endPct){const startAngle=startPct/100*360,endAngle=endPct/100*360,span=endAngle-startAngle;if(span>=359.99){const p1=polarToCartesian(cx,cy,r,startAngle),p2=polarToCartesian(cx,cy,r,startAngle+180);return `M ${p1.x.toFixed(3)} ${p1.y.toFixed(3)} A ${r} ${r} 0 1 1 ${p2.x.toFixed(3)} ${p2.y.toFixed(3)} A ${r} ${r} 0 1 1 ${p1.x.toFixed(3)} ${p1.y.toFixed(3)}`}const start=polarToCartesian(cx,cy,r,endAngle),end=polarToCartesian(cx,cy,r,startAngle),largeArcFlag=span<=180?0:1;return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`}
function assetDonutSvg(segments,selected='',dataset='data-donut-group',ariaLabel='자산군 구성'){return `<svg class="donut-svg" viewBox="0 0 100 100" role="img" aria-label="${escapeHtml(ariaLabel)}">${segments.map(x=>{const key=x.key||x.name,is=key===selected;return `<g class="donut-segment ${is?'selected':selected?'dimmed':''}" ${dataset}="${escapeHtml(key)}"><title>${escapeHtml(x.name)} ${x.pct.toFixed(1)}%</title><path d="${escapeHtml(describeArcPath(50,50,38,x.start,x.end))}" fill="none" stroke="${escapeHtml(x.color)}" stroke-width="20" stroke-linecap="butt"/></g>`}).join('')}</svg>`}

function isaContributionRowsForStore(a,store=integratedStore(),throughDate=localYmd()){
 const accounts=store?.accounts||[],rows=[];
 for(const t of store?.ledger||[]){
  if(t.meta?.analysisOnly||isQaIntegratedFixture(t)||!['internalTransfer','externalAssetIn'].includes(t.type)||String(t.date||'')>throughDate)continue;
  if(accounts.find(x=>x.id===t.toAccountId)?.kind!=='isa')continue;
  const dated=state.accounts.filter(x=>isaAccountActiveOnDate(x,t.date)),explicit=String(t.meta?.targetIsaAccountId||''),resolved=explicit&&dated.some(x=>x.id===explicit)?explicit:(dated.length===1?dated[0].id:'');
  if(resolved===a.id)rows.push(t)
 }
 return rows
}
function isaContributionModel(a,asOf=localYmd(),store=integratedStore()){
 const p=policy('isa',a),annualLimit=Math.max(0,Number(p.annualLimit)||0),totalLimit=Math.max(annualLimit,Number(p.totalContributionLimit)||100000000),opened=String(a?.openedAt||a?.baselineDate||asOf),closed=String(a?.closedAt||''),end=closed&&closed<asOf?closed:asOf,openedYear=Number(opened.slice(0,4)),endYear=Number(end.slice(0,4)),eligibleYears=Number.isFinite(openedYear)&&Number.isFinite(endYear)?Math.max(1,endYear-openedYear+1):1,accruedLimit=Math.min(totalLimit,annualLimit*eligibleYears),baselineDate=String(a?.baselineDate||a?.baseline?.date||opened),baseline=Math.max(0,Number(a?.baselineContribution??a?.baseline?.contribution)||0),rows=isaContributionRowsForStore(a,store,asOf).filter(t=>String(t.date||'')>baselineDate),lifetimePaid=baseline+rows.reduce((sum,t)=>sum+(Number(t.amount)||0),0),year=String(asOf).slice(0,4),currentRows=rows.filter(t=>String(t.date||'').startsWith(year)),knownBaseline=String(a?.contributionBaselineYear||'')===year?Math.max(0,Number(a?.contributionBaseline)||0):0,currentYearPaid=knownBaseline+currentRows.reduce((sum,t)=>sum+(Number(t.amount)||0),0),remaining=Math.max(0,accruedLimit-lifetimePaid);
 return{year,annualLimit,totalLimit,eligibleYears,accruedLimit,baseline,lifetimePaid,currentYearPaid,remaining,overage:Math.max(0,lifetimePaid-accruedLimit),carryoverAvailable:Math.max(0,remaining-Math.max(0,annualLimit-currentYearPaid))}
}
function annualContributionTotal(a){return isPastAccount(a)?Number(a.annualContribution||0):isaContributionModel(a).currentYearPaid}
function addYears(dateString,years){const m=String(dateString||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return dateString;const y=Number(m[1])+Math.trunc(Number(years)||0),mi=Number(m[2])-1,day=Math.min(Number(m[3]),new Date(y,mi+1,0).getDate());return `${y}-${String(mi+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`}
