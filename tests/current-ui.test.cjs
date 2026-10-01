'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('future pension chart drives the two headline amounts from one selected age',()=>{
 const source=read('chart-pension-future.ts');
 for(const id of ['pensionFutureHeadlineAge','pensionFutureHeadlineValue','pensionFutureHeadlineMonthlyAge','pensionFutureHeadlineMonthly'])assert.match(source,new RegExp(id));
 assert.match(source,/updatePensionFuturePoint[\s\S]*pt\.value[\s\S]*pt\.monthlyPension/);
});

test('future pension keeps only compact principal and folded calculation assumptions below the chart',()=>{
 const source=read('chart-pension-future.ts');
 assert.match(source,/class="pension-future-principal"/);
 assert.match(source,/<details class="pension-future-details"><summary>ⓘ 계산 기준<\/summary>/);
 assert.doesNotMatch(source,/future-focus/);
});

test('integrated summary uses one blue asset and debt accordion without the old title',()=>{
 const source=read('integrated-pages.ts');
 assert.match(source,/integrated-overview-hero inline-accordion/);
 assert.match(source,/integrated-overview-assets inline-accordion-body/);
 assert.doesNotMatch(source,/통합 · 전체 재무/);
});

test('integrated summary consolidates every unfinished monthly schedule into one card',()=>{
 const source=read('integrated-pages.ts');
 assert.match(source,/function remainingScheduleCard/);
 assert.match(source,/scheduleOccurrences\(month\)\.filter\(o=>o\.status!==['"]done['"]\)/);
 assert.doesNotMatch(source,/function nextFinanceOccurrences|function fixedCostCard/);
});

test('integrated tabs and month selector are owned only by the page shell',()=>{
 const source=read('integrated-pages.ts');
 for(const child of ['integratedLedgerPage','integratedSpendingPage','integratedSchedulePage']){
  const start=source.indexOf(`function ${child}`),end=source.indexOf('\nfunction ',start+10),body=source.slice(start,end<0?source.length:end);
  assert.doesNotMatch(body,/integratedTabs\(|integratedMonthBar\(/,`${child} must not duplicate shell controls`);
 }
 assert.match(source,/function integratedPage[\s\S]*tabs=integratedTabs\(safe\)[\s\S]*month=integratedMonthBar\(\)/);
});

test('spending adds one quick expense action and one optional monthly living budget',()=>{
 const pages=read('integrated-pages.ts'),render=read('ui-render.ts'),defaults=read('data-defaults.ts'),store=read('store-state.ts');
 assert.match(pages,/data-spending-new>＋ 지출/);
 assert.match(pages,/data-spending-budget/);
 assert.match(render,/openIntegratedTransactionForm\('',\{uiType:'lifeExpense'\}\)/);
 assert.match(defaults,/monthlyLivingBudget:0/);
 assert.match(store,/monthlyLivingBudget\s*=\s*Math\.max\(\s*0\s*,\s*Math\.round/);
});

test('household summary exposes quick income, expense and non-destructive balance reconciliation',()=>{
 const pages=read('integrated-pages.ts'),forms=read('integrated-forms.ts'),render=read('ui-render.ts'),css=read('css-integrated.css');
 for(const marker of ['data-household-income','data-household-expense','data-cash-reconcile'])assert.match(pages,new RegExp(marker));
 assert.match(forms,/function openCashReconcileForm/);
 assert.match(forms,/type:'adjustment'/);
 assert.match(forms,/meta:\{reconciliation:true,previousBalance:current,recordedBalance:actual\}/);
 assert.match(render,/openCashReconcileForm/);
 assert.match(css,/\.household-quick/);
});

test('AI export includes six-month cash flow and names stale accounts by Korean trading-day time',()=>{
 const source=read('ai-strategy.ts');
 assert.match(source,/function aiIntegratedCashFlowExport/);
 assert.match(source,/for\(let offset=-5;offset<=0;offset\+\+\)/);
 assert.match(source,/cashFlow:aiIntegratedCashFlowExport\(\)/);
 assert.match(source,/aiTradingDaysSince\(a\.sync\?\.lastCompleteAt\)>1/);
 assert.match(source,/a\.label[\s\S]*aiKoreaTimestamp/);
 assert.match(source,/주말·시장 휴장일은 제외했습니다/);
});

test('freshly rendered detail buttons bind immediately without zero-delay wrappers',()=>{
 for(const name of ['integrated-pages.ts','integrated-forms.js','integrated-finance-ui.ts','chart-financial-growth.ts','ui-settings.ts','isa-maturity-policy.ts','chart-dividends.ts','pension-forms.ts','isa-registration.ts'])assert.doesNotMatch(read(name),/setTimeout\(\(\)=>\{/);
});
