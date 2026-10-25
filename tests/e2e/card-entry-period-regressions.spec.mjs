import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
 await page.goto('/index.html?qa=1#/home');await page.waitForFunction(()=>!!window.__assetOS);
 await page.evaluate(async()=>{const s=window.__assetOS.getState();s.integrated.accounts=[{id:'cash-main',kind:'cash',name:'QA 현금'}];s.integrated.liabilities=[];s.integrated.ledger=[['2060-10-01',100],['2060-11-01',200],['2060-12-01',300]].map(([date,amount])=>({id:date,date,amount,type:'externalExpense',category:'식비'}));s.financeSchedules={items:[]};s.financialProducts={items:[],events:[]};s.insurance={policies:[]};s.settings.cardAccounts=[];s.settings.integratedMonth='2060-12';s.settings.integratedMonthViewedOn=localYmd();s.settings.spendingPeriod='month';await window.__assetOS.replaceState(s)});
});
const snapshot=page=>page.evaluate(()=>({finance:JSON.stringify({integrated:state.integrated,schedules:state.financeSchedules}),revision:assetLocalDatabase.revision}));
async function close(page){await page.evaluate(()=>{sheetDirty=false;closeSheets({all:true});cancelSheetBackForNavigation()});await page.waitForFunction(()=>!sheetBackTimer&&!suppressSheetPop)}

test('@core spending never exposes duplicate card entry in past present future or aggregate periods',async({page})=>{
 const before=await snapshot(page);
 for(const width of [320,412,768]){await page.setViewportSize({width,height:915});for(const anchor of ['2059-12','2060-12','2061-01'])for(const mode of ['month','quarter','half','year','years']){
  await page.evaluate(({anchor,mode})=>{setting().integratedMonth=anchor;setting().spendingPeriod=mode;nav('integrated','spending')},{anchor,mode});await expect(page.locator('main [data-card-hub],main [data-card-plan-new],main [data-card-action="purchase-new"]')).toHaveCount(0);await expect(page.locator('[data-spending-new]')).toHaveCount(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }}expect(await snapshot(page)).toEqual(before);
});

test('@core current period shortcut compares the displayed scope rather than its anchor month',async({page})=>{
 const before=await snapshot(page);
 for(const [mode,anchor] of [['quarter','2060-10'],['half','2060-07'],['year','2060-01'],['years','2060-01']]){await page.evaluate(({mode,anchor})=>{setting().integratedMonth=anchor;setting().spendingPeriod=mode;nav('integrated','spending')},{mode,anchor});await expect(page.locator('[data-integrated-current-month]')).toBeHidden()}
 for(const [mode,anchor,label] of [['month','2060-11','이번 달로'],['quarter','2060-07','이번 분기로'],['half','2060-01','이번 반기로'],['year','2059-01','올해로']]){
  await page.evaluate(({mode,anchor})=>{setting().integratedMonth=anchor;setting().spendingPeriod=mode;setting().spendingCategoryFilter='식비';nav('integrated','spending')},{mode,anchor});await expect(page.locator('[data-integrated-current-month]')).toHaveText(label);await page.locator('[data-integrated-current-month]').click();await expect(page.locator('[data-integrated-current-month]')).toBeHidden();expect(await page.evaluate(()=>({month:integratedSelectedMonth(),filter:setting().spendingCategoryFilter}))).toEqual({month:'2060-12',filter:''});
 }expect(await snapshot(page)).toEqual(before);
});

test('@core native month selection clears stale category and chart context before rendering',async({page})=>{
 const before=await snapshot(page);await page.evaluate(()=>{setting().spendingView='items';setting().spendingCategoryFilter='식비';setting().spendingChartContext='2060-12:month';setting().spendingChartPeriod='2060-12-01';nav('integrated','spending')});
 await page.locator('[data-integrated-month-select]').fill('2060-11');await expect(page.locator('.spending-hero>strong')).toHaveText('200원');await expect(page.locator('[data-spending-selected-label]')).toHaveText('2060년 11월 1일');await expect(page.locator('.cardv2-filters button').first()).toHaveClass(/active/);expect(await page.evaluate(()=>({filter:setting().spendingCategoryFilter,context:setting().spendingChartContext}))).toEqual({filter:'',context:undefined});expect(await snapshot(page)).toEqual(before);
});

test('@core card hubs remain readable and purchase entry exists once in overview only',async({page})=>{
 const before=await snapshot(page);
 for(const month of ['2059-12','2060-12'])for(const tab of ['summary','ledger','schedule']){
  await page.evaluate(({month,tab})=>{setting().integratedMonth=month;nav('integrated',tab)},{month,tab});await expect(page.locator('main [data-card-action="purchase-new"]')).toHaveCount(tab==='summary'?1:0);await page.locator('[data-card-hub]').click();await expect(page.locator('#integratedCardPlans')).toBeVisible();await expect(page.locator('#sheetBody [data-card-plan-new],#sheetBody [data-card-action="purchase-new"]')).toHaveCount(0);await expect(page.locator('#integratedCardPlans h2')).toHaveText(month==='2059-12'?'2059년 12월 카드값':'2060년 12월 카드값');await close(page);
 }expect(await snapshot(page)).toEqual(before);await page.evaluate(()=>nav('integrated','summary'));await page.locator('main [data-card-action="purchase-new"]').click();await expect(page.locator('#sheetTitle')).toHaveText('카드 구매 기록');await expect(page.locator('#sheetBody')).toContainText('카드를 먼저 등록');
});
