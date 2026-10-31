import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
  await page.goto('/index.html?qa=1#/home');
  await page.waitForFunction(()=>!!window.__assetOS);
  await page.evaluate(async()=>{
    const data=window.__assetOS.getState();
    data.integrated.accounts=[{id:'cash-main',name:'QA 생활현금',kind:'cash'}];
    data.integrated.liabilities=[];
    data.integrated.ledger=[{id:'qa-opening',date:'2026-01-01',type:'openingAsset',toAccountId:'cash-main',amount:1000000}];
    data.financeSchedules={items:[
      {id:'qa-insurance',name:'QA 보험',kind:'insurance',amount:5300,day:25,startDate:'2026-01-01',active:true},
      {id:'qa-expense',name:'QA 변동 비용',kind:'expense',amount:26000,amountMode:'estimate',day:25,startDate:'2026-01-01',active:true}
    ]};
    await window.__assetOS.replaceState(data);
    nav('integrated','schedule');
  });
});

test('@core completing one selected schedule preserves the filtered sheet and browser history',async({page})=>{
  await page.evaluate(()=>openScheduleDay('2026-10-25','qa-insurance'));
  await expect(page.locator('#detailSheet.open .schedule-detail-item')).toHaveCount(1);
  const before=await page.evaluate(()=>({history:history.length,sheetToken:sheetInteractionToken()}));
  await page.locator('[data-schedule-complete="qa-insurance"]').click();
  await expect(page.locator('#detailSheet.open [data-schedule-record]')).toHaveCount(1);
  await expect(page.locator('#detailSheet.open .schedule-detail-item')).toHaveCount(1);
  await expect(page.locator('#detailSheet.open .schedule-detail-list')).toHaveAttribute('data-schedule-filter','qa-insurance');
  await expect(page.locator('[data-schedule-complete="qa-insurance"]')).toHaveCount(0);
  const after=await page.evaluate(()=>({history:history.length,sheetToken:sheetInteractionToken(),completed:state.integrated.ledger.filter(x=>x.meta?.scheduleId==='qa-insurance').length}));
  expect(after).toEqual({...before,completed:1});
});

test('@core completing a date with multiple schedules retains unsaved input values and other items',async({page})=>{
  await page.evaluate(()=>openScheduleDay('2026-10-25'));
  await expect(page.locator('#detailSheet.open .schedule-detail-item')).toHaveCount(2);
  await page.locator('[data-schedule-amount="qa-expense"]').fill('27000');
  const before=await page.evaluate(()=>({history:history.length,scroll:document.querySelector('#detailSheet').scrollTop}));
  await page.locator('[data-schedule-complete="qa-insurance"]').click();
  await expect(page.locator('#detailSheet.open .schedule-detail-item')).toHaveCount(2);
  await expect(page.locator('#detailSheet.open [data-schedule-record]')).toHaveCount(1);
  await expect(page.locator('[data-schedule-amount="qa-expense"]')).toHaveValue('27000');
  const after=await page.evaluate(()=>({history:history.length,scroll:document.querySelector('#detailSheet').scrollTop}));
  expect(after).toEqual(before);
  await page.locator('[data-schedule-complete="qa-expense"]').click();
  await expect(page.locator('#detailSheet.open [data-schedule-record]')).toHaveCount(2);
  expect(await page.evaluate(()=>state.integrated.ledger.find(x=>x.meta?.scheduleId==='qa-expense')?.amount)).toBe(27000);
});

test('@core completed payment shows actual variance and preserves completed label',async({page})=>{
  await page.evaluate(()=>openScheduleDay('2026-10-25','qa-expense'));
  await page.locator('[data-schedule-amount="qa-expense"]').fill('27000');
  await page.locator('[data-schedule-complete="qa-expense"]').click();
  await expect(page.locator('#detailSheet.open .schedule-status')).toHaveText('완료');
  await expect(page.locator('.schedule-primary-amount')).toContainText('실제 납부액');
  await expect(page.locator('.schedule-payment-variance')).toContainText('예정금액 26,000원');
  await expect(page.locator('.schedule-payment-variance')).toContainText('차이 +1,000원');
  await expect(page.locator('.schedule-item-tools')).not.toHaveAttribute('open','');
  await page.locator('.schedule-item-tools summary').click();
  await expect(page.locator('[data-schedule-actual-edit]')).toBeVisible();
  await expect(page.locator('[data-schedule-plan-edit]')).toBeVisible();
  await page.setViewportSize({width:320,height:780});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
});

test('@core schedule month distinguishes completion, savings and income from spending',async({page})=>{
  await page.evaluate(async()=>{
    const s=window.__assetOS.getState();
    s.financeSchedules.items.push({id:'qa-income',name:'QA 급여',kind:'income',amount:300000,day:25,startDate:'2026-01-01',active:true});
    await window.__assetOS.replaceState(s);
    setting().integratedMonth='2026-10';nav('integrated','schedule');
  });
  await expect(page.locator('.schedule-month-snapshot')).toContainText('31,300원');
  await expect(page.locator('.schedule-month-snapshot')).toContainText('0원');
  await expect(page.locator('.schedule-month-snapshot')).toContainText('2건');
  await expect(page.locator('.schedule-money-note')).toContainText('수입 예정 300,000원');
  await page.evaluate(()=>openScheduleDay('2026-10-25','qa-insurance'));
  await page.locator('[data-schedule-complete="qa-insurance"]').click();
  await page.evaluate(()=>{sheetDirty=false;closeSheets({all:true});cancelSheetBackForNavigation();nav('integrated','schedule')});
  await expect(page.locator('.schedule-month-snapshot')).toContainText('26,000원');
  await expect(page.locator('.schedule-month-snapshot')).toContainText('5,300원');
  expect(await page.evaluate(()=>integratedSpendingAnalysis('2026-10').total)).toBe(5300);
});
