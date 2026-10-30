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
