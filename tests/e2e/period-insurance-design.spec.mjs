import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test.beforeEach(async({page})=>{if(process.env.ASSET_OS_QA_SDK_PATH){const body=await readFile(process.env.ASSET_OS_QA_SDK_PATH);await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4',route=>route.fulfill({body,contentType:'text/javascript'}))}});
test('@core selected months and insurance payment status stay explicit without changing money',async({page},info)=>{
 await page.goto('/index.html?qa=1#/home');
 await page.evaluate(()=>{
  const next=window.__assetOS.getState();next.settings.integratedMonth='2026-02';
  next.insurance={policies:[
   {id:'paid',name:'납입을 마친 긴 이름의 테스트 보험 계약',company:'테스트',status:'active',paymentStyle:'monthly',premium:13124,contractDate:'2025-01-01',paymentEndDate:'2025-12-31',coverages:[]},
   {id:'paying',name:'현재 월납 보험',status:'active',paymentStyle:'monthly',premium:10000,contractDate:'2025-01-01',paymentEndDate:'2099-12-31',coverages:[]},
   {id:'lump',name:'일시납 보험',status:'active',paymentStyle:'lump',premium:50000,contractDate:'2025-01-01',paymentEndDate:'2025-01-01',coverages:[]}
  ]};window.__assetOS.replaceState(next);nav('integrated','summary');
 });
 const before=await page.evaluate(()=>({ledger:JSON.stringify(state.integrated.ledger),insurance:JSON.stringify(state.insurance),net:integratedFinancialModel().netAssets}));
 await expect(page.getByRole('heading',{name:'2026년 2월 소비',exact:true})).toBeVisible();
 await page.getByRole('main').getByRole('button',{name:'일정',exact:true}).click();await expect(page.getByRole('heading',{name:'2026년 2월 남은 납부액',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'다음 달',exact:true}).click();await expect(page.getByRole('heading',{name:'2026년 3월 남은 납부액',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'내 Asset OS 열기',exact:true}).click();await page.locator('[data-profile-action="insurance"]').click();
 const card=page.locator('[data-insurance-id="paid"]');await expect(card).toContainText('계약 유지');await expect(card).toContainText('납입 종료');await expect(card).toContainText('현재 월 보험료에서 제외');await expect(card).not.toContainText('일정 연결 안 됨');
 await expect(page.locator('#sheetBody .sheetrow.total strong')).toHaveText('10,000원');await expect(page.locator('[data-insurance-id="lump"]')).toContainText('일시납');
 for(const width of [360,412])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:915});await page.evaluate(theme=>{document.documentElement.dataset.theme=theme},theme);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
  await page.screenshot({path:`/tmp/asset-compare-${info.project.name}-${width}-${theme}.png`,animations:'disabled'});
 }
 await card.click();await expect(page.locator('#sheetBody')).toContainText('2025-12-31');await page.goBack();
 expect(await page.evaluate(()=>({ledger:JSON.stringify(state.integrated.ledger),insurance:JSON.stringify(state.insurance),net:integratedFinancialModel().netAssets}))).toEqual(before);
});
