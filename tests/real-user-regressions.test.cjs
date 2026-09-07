'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('selected integrated month controls the new transaction date',()=>{
 const source=read('integrated-forms.js');
 const context={integratedSelectedMonth:()=> '2060-11',localYmd:()=> '2060-12-31',Date};
 vm.runInNewContext(source,context);
 assert.equal(context.integratedEntryDateForMonth(),'2060-11-30');
 assert.equal(context.integratedEntryDateForMonth('2060-02'),'2060-02-29');
});

test('sheet navigation consumes its temporary history entry before rendering',()=>{
 const home=read('home.js'),sheets=read('ui-sheets.js');
 assert.match(home,/const fromSheet=\$\$\('\.sheet\.open'\)\.length>0/);
 assert.match(home,/if\(fromSheet\)\{history\.replaceState\(null,'',next\);render\(\);window\.scrollTo\(0,0\)\}/);
 assert.match(sheets,/function cancelSheetBackForNavigation/);
});

test('long sheets reset reused scroll and keep upward header swipes scrollable',()=>{
 const sheets=read('ui-sheets.js'),css=read('css-core-base.css'),classes=new Set();
 const context={
  console,requestAnimationFrame:fn=>fn(),setTimeout:()=>0,clearTimeout:()=>{},
  innerHeight:800,performance:{now:()=>1},history:{scrollRestoration:'auto',pushState(){},back(){},replaceState(){}},
  location:{href:'https://example.test/'},window:{scrollY:0,scrollTo(){}},
  document:{body:{classList:{contains:x=>classes.has(x),add:x=>classes.add(x),remove:x=>classes.delete(x)},style:{}}},
  $:()=>({style:{},hidden:true}),$$:()=>[]
 };
 vm.runInNewContext(sheets,context);
 const sheet={scrollTop:417,scrollTo:({top})=>{sheet.scrollTop=top}};
 context.resetSheetScroll(sheet);
 assert.equal(sheet.scrollTop,0,'reused detail sheets must open at the top');
 assert.match(sheets,/touchcancel/,'cancelled Galaxy touches must release sheet dragging');
 assert.match(sheets,/if\(active&&move\(e\.touches\[0\]\.clientY\)\)e\.preventDefault\(\)/,'native upward scrolling must not always be prevented');
 assert.match(css,/\.sheet-drag-zone\{[^}]*touch-action:pan-y/,'the sticky sheet header must permit vertical panning');
 assert.match(css,/\.sheet\{[^}]*overflow-anchor:none/,'replacing detail content must not restore the previous scroll anchor');
});

test('long-term UI fallbacks remain usable at the retirement boundary',()=>{
 const pension=read('pension-pages.js'),settings=read('ui-settings.js');
 assert.match(pension,/p\.years>0\?pensionFutureSheetMarkup\(\):pensionReachedPageMarkup\(p\)/);
 assert.match(pension,/은퇴 목표 나이에 도달했습니다/);
 assert.match(settings,/retirementAge<currentAge/);
 assert.doesNotMatch(settings,/retirementAge<=currentAge/);
});

test('financial growth and insurance details expose real interactive and derived values',()=>{
 const growth=read('chart-financial-growth.js'),insurance=read('insurance.js');
 assert.match(growth,/data-growth-track/);
 assert.match(growth,/onpointerdown=pick/);
 assert.match(growth,/ArrowLeft/);
 const context={localYmd:()=> '2060-12-31'};
 vm.runInNewContext(insurance,context);
 assert.deepEqual({...context.insurancePremiumSummary({premium:250000,contractDate:'2026-01-01',paymentEndDate:'2060-12-31'})},{total:105000000,paid:105000000,remaining:0});
});

test('home wording and selected-month summaries cannot regress',()=>{
 const home=read('home.js'),detail=read('chart-financial-growth.js'),pages=read('integrated-pages.js'),render=read('ui-render.js');
 for(const text of ['이번 달 지출·납입','기록','남은 일정'])assert.match(home,new RegExp(text));
 for(const text of ['생활비·고정지출','저축·투자','대출 원금·이자','기타 출금','남은 일정','기록된 금액','남은 예정금액','이번 달 합계'])assert.match(detail,new RegExp(text));
 assert.match(pages,/recent=\[\.\.\.integratedRowsForMonth\(month\)\]/);
 assert.match(render,/setting\(\)\.integratedMonth=localYmd\(\)\.slice\(0,7\)/);
});

test('successful integrated save clears hidden search and filter state',()=>{
 const source=read('integrated-forms.js');
 assert.match(source,/integratedLedgerSearch=''/);
 assert.match(source,/integratedSearchDisplayLimit=50/);
 assert.match(source,/integratedLedgerFilter='all'/);
});

test('the global duplicate-submit guard does not cancel the first ISA save',()=>{
 const boot=read('boot.js'),isa=read('isa-registration.js');
 assert.match(boot,/lastSubmitAt/,'rapid duplicate submits still need a time guard');
 assert.doesNotMatch(boot,/submitters\.forEach\(x=>x\.disabled=true\)/,'capture phase must not disable the first submit before the ISA handler runs');
 assert.match(isa,/if\(submitButton\?\.disabled\)return/,'the ISA form keeps its own in-flight submit guard');
});

test('financial growth drag changes the selected point and visible amount',()=>{
 const nodes={},track={style:{},setPointerCapture(){},releasePointerCapture(){},getBoundingClientRect(){return{left:0,width:100}}};
 nodes['[data-growth-track]']=track;
 for(const id of ['#financialGrowthMarkerLine','#financialGrowthMarkerDot'])nodes[id]={setAttribute(){}};
 nodes['#financialGrowthPointLabel']={textContent:''};nodes['#financialGrowthPointValue']={textContent:''};
 const context=vm.createContext({console,Math,Number,String,Set,Map,$:selector=>nodes[selector]||null,$$:()=>[],won:value=>`${value}원`,pensionCompactWon:String,escapeHtml:String,financialGrowthSeries:()=>[],localYmd:()=> '2026-09-07',openSheet(){},setTimeout(){}});
 vm.runInContext(read('chart-financial-growth.js'),context);
 context.financialGrowthSeries=()=>[{asOf:'2025-09-07',label:'25.09',netAssets:100},{asOf:'2026-09-07',label:'26.09',netAssets:300}];
 vm.runInContext('bindFinancialGrowthAnalysis()',context);
 const event=x=>({clientX:x,pointerId:1,preventDefault(){},stopPropagation(){}});
 track.onpointerdown(event(0));track.onpointermove(event(100));
 assert.equal(nodes['#financialGrowthPointLabel'].textContent,'26.09');
 assert.equal(nodes['#financialGrowthPointValue'].textContent,'300원');
});
