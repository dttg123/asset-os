'use strict';
type VisualRecord=Record<string,unknown>;
type VisualHolding=VisualRecord&{id:string;name:string};
type VisualAccount=VisualRecord&{id:string;holdings:VisualHolding[];baseline?:{date?:string;contribution?:unknown}};
type VisualTransaction=VisualRecord&{type:string;date:string;toAccountId?:string;meta?:{analysisOnly?:boolean;targetIsaAccountId?:string}};
type VisualStore={accounts:Array<{id:string;kind:string}>;ledger:VisualTransaction[]};
type DonutSegment={key?:string;name:string;pct:number;start:number;end:number;color:string};
declare const state:{accounts:VisualAccount[]};
declare function accountMetrics(account:VisualAccount):{holdings:VisualHolding[]};
declare function localYmd():string;
declare function escapeHtml(value:unknown):string;
declare function integratedStore():VisualStore;
declare function isQaIntegratedFixture(row:VisualTransaction):boolean;
declare function isaAccountActiveOnDate(account:VisualRecord,date:string):boolean;
declare function policy(kind:string,account:VisualRecord):VisualRecord;
declare function isPastAccount(account:VisualRecord):boolean;
function getHolding(a:VisualAccount,id:unknown):VisualHolding|undefined{return accountMetrics(a).holdings.find((h:VisualHolding)=>h.id===id)}
function holdingName(a:VisualAccount,id:unknown):string{return a.holdings.find((h:VisualHolding)=>h.id===id)?.name||'계좌 현금'}
function formatDate(d:unknown):string{if(!d)return'-';const [y,m,day]=String(d).split('-');return `${y}.${m}.${day}`}
function quantityNumber(value:unknown,maxDigits=6):string{const n=Number(value)||0;return new Intl.NumberFormat('ko-KR',{minimumFractionDigits:0,maximumFractionDigits:maxDigits}).format(n)}
function daysUntil(d:unknown):number|null{if(!d)return null;const [y,m,day]=String(d).split('-').map(Number),todayParts=String(typeof localYmd==='function'?localYmd():'').split('-').map(Number),now=todayParts.length===3&&todayParts.every(Number.isFinite)?new Date(todayParts[0],todayParts[1]-1,todayParts[2]):new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate()),target=new Date(y,m-1,day);return Math.ceil((target.getTime()-today.getTime())/86400000)}
function ddayLabel(d:unknown):string{const left=daysUntil(d);if(left===null)return'-';if(left>0)return`D-${left}`;if(left===0)return'D-DAY';return`D+${Math.abs(left)}`}
function polarToCartesian(cx:number,cy:number,r:number,angleDeg:number){const rad=(angleDeg-90)*Math.PI/180;return{x:cx+r*Math.cos(rad),y:cy+r*Math.sin(rad)}}
function describeArcPath(cx:number,cy:number,r:number,startPct:number,endPct:number):string{const startAngle=startPct/100*360,endAngle=endPct/100*360,span=endAngle-startAngle;if(span>=359.99){const p1=polarToCartesian(cx,cy,r,startAngle),p2=polarToCartesian(cx,cy,r,startAngle+180);return `M ${p1.x.toFixed(3)} ${p1.y.toFixed(3)} A ${r} ${r} 0 1 1 ${p2.x.toFixed(3)} ${p2.y.toFixed(3)} A ${r} ${r} 0 1 1 ${p1.x.toFixed(3)} ${p1.y.toFixed(3)}`}const start=polarToCartesian(cx,cy,r,endAngle),end=polarToCartesian(cx,cy,r,startAngle),largeArcFlag=span<=180?0:1;return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`}
function assetDonutSvg(segments:DonutSegment[],selected='',dataset='data-donut-group',ariaLabel='자산군 구성'):string{return `<svg class="donut-svg" viewBox="0 0 100 100" role="img" aria-label="${escapeHtml(ariaLabel)}">${segments.map(x=>{const key=x.key||x.name,is=key===selected;return `<g class="donut-segment ${is?'selected':selected?'dimmed':''}" ${dataset}="${escapeHtml(key)}"><title>${escapeHtml(x.name)} ${x.pct.toFixed(1)}%</title><path d="${escapeHtml(describeArcPath(50,50,38,x.start,x.end))}" fill="none" stroke="${escapeHtml(x.color)}" stroke-width="20" stroke-linecap="butt"/></g>`}).join('')}</svg>`}
function formValidationMarkup(){return'<div class="form-validation-message" data-form-error role="alert" aria-live="polite" hidden></div>'}
function formValidationFieldName(message=''){const text=String(message);if(/날짜|개설일|종료일|만기/.test(text))return'date';if(/수량/.test(text))return'qty';if(/단가|평단/.test(text))return'price';if(/수수료|세금/.test(text))return'fee';if(/원금/.test(text))return'principal';if(/이자/.test(text))return'interest';if(/종목명/.test(text))return'newName';if(/금액|수령액|현금|잔액|납입한도/.test(text))return'amount';return''}
function formClearError(form:HTMLFormElement|null|undefined):false|undefined{if(!form)return;const box=form.querySelector<HTMLElement>('[data-form-error]');if(box){box.textContent='';box.hidden=true}form.classList?.remove('has-validation-error');for(const field of form.querySelectorAll('[aria-invalid="true"]')){field.removeAttribute('aria-invalid');field.closest?.('.field')?.classList.remove('has-error')}return false}
function formShowError(form:HTMLFormElement|null|undefined,message='',fieldName=''):boolean|undefined{if(!form||!message)return formClearError(form);formClearError(form);const box=form.querySelector<HTMLElement>('[data-form-error]');if(box){box.textContent=String(message);box.hidden=false}form.classList?.add('has-validation-error');const name=fieldName||formValidationFieldName(message),field=(name?form.elements.namedItem(name):null)||(name==='date'?form.elements.namedItem('tradeDate'):null);if(field&&'setAttribute' in field){field.setAttribute('aria-invalid','true');field.closest('.field')?.classList.add('has-error')}return true}

function isaContributionRowsForStore(a:VisualAccount,store:VisualStore=integratedStore(),throughDate=localYmd()):VisualTransaction[]{
 const accounts=store?.accounts||[],rows:VisualTransaction[]=[];
 for(const t of store?.ledger||[]){
  if(t.meta?.analysisOnly||isQaIntegratedFixture(t)||!['internalTransfer','externalAssetIn'].includes(t.type)||String(t.date||'')>throughDate)continue;
  if(accounts.find(x=>x.id===t.toAccountId)?.kind!=='isa')continue;
  const dated=state.accounts.filter(x=>isaAccountActiveOnDate(x,t.date)),explicit=String(t.meta?.targetIsaAccountId||''),resolved=explicit&&dated.some(x=>x.id===explicit)?explicit:(dated.length===1?dated[0].id:'');
  if(resolved===a.id)rows.push(t)
 }
 return rows
}
function isaContributionModel(a:VisualAccount,asOf=localYmd(),store:VisualStore=integratedStore()){
 const p=policy('isa',a),annualLimit=Math.max(0,Number(p.annualLimit)||0),totalLimit=Math.max(annualLimit,Number(p.totalContributionLimit)||100000000),opened=String(a?.openedAt||a?.baselineDate||asOf),closed=String(a?.closedAt||''),end=closed&&closed<asOf?closed:asOf,openedYear=Number(opened.slice(0,4)),endYear=Number(end.slice(0,4)),eligibleYears=Number.isFinite(openedYear)&&Number.isFinite(endYear)?Math.max(1,endYear-openedYear+1):1,accruedLimit=Math.min(totalLimit,annualLimit*eligibleYears),baselineDate=String(a?.baselineDate||a?.baseline?.date||opened),baseline=Math.max(0,Number(a?.baselineContribution??a?.baseline?.contribution)||0),rows=isaContributionRowsForStore(a,store,asOf).filter(t=>String(t.date||'')>baselineDate),lifetimePaid=baseline+rows.reduce((sum,t)=>sum+(Number(t.amount)||0),0),year=String(asOf).slice(0,4),currentRows=rows.filter(t=>String(t.date||'').startsWith(year)),knownBaseline=String(a?.contributionBaselineYear||'')===year?Math.max(0,Number(a?.contributionBaseline)||0):0,currentYearPaid=knownBaseline+currentRows.reduce((sum,t)=>sum+(Number(t.amount)||0),0),remaining=Math.max(0,accruedLimit-lifetimePaid);
 return{year,annualLimit,totalLimit,eligibleYears,accruedLimit,baseline,lifetimePaid,currentYearPaid,remaining,overage:Math.max(0,lifetimePaid-accruedLimit),carryoverAvailable:Math.max(0,remaining-Math.max(0,annualLimit-currentYearPaid))}
}
function annualContributionTotal(a:VisualAccount):number{return isPastAccount(a)?Number(a.annualContribution||0):isaContributionModel(a).currentYearPaid}
function addYears(dateString:unknown,years:unknown):string{const value=String(dateString||''),m=value.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return value;const y=Number(m[1])+Math.trunc(Number(years)||0),mi=Number(m[2])-1,day=Math.min(Number(m[3]),new Date(y,mi+1,0).getDate());return `${y}-${String(mi+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`}
