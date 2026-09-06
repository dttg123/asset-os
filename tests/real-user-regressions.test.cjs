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
 for(const text of ['이번 달 지출·납입','생활비·저축·투자·대출 합계'])assert.match(home,new RegExp(text));
 for(const text of ['생활비·고정지출','저축·투자','대출 원금·이자','남은 일정','현재까지'])assert.match(detail,new RegExp(text));
 assert.match(pages,/recent=\[\.\.\.integratedRowsForMonth\(month\)\]/);
 assert.match(render,/setting\(\)\.integratedMonth=localYmd\(\)\.slice\(0,7\)/);
});
