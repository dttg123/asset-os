import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test.beforeEach(async({page})=>{
 if(process.env.ASSET_OS_QA_SDK_PATH){const body=await readFile(process.env.ASSET_OS_QA_SDK_PATH);await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4',route=>route.fulfill({body,contentType:'text/javascript'}))}
});
test('@core action design keeps historical dates explicit and close preserves unsaved edits',async({page},info)=>{
 await page.goto('/index.html?qa=1#/home');
 await page.evaluate(()=>{
  const next=window.__assetOS.getState();next.settings.integratedMonth='2026-02';
  next.settings.integratedEntryFavorites=[{uiType:'externalIncome',category:'월급',amount:100000,toAccountId:'cash-main',note:'기본급'},{uiType:'externalIncome',category:'월급',amount:200000,toAccountId:'qa-other',note:'상여'}];
  next.integrated.accounts.push({id:'qa-other',kind:'cash',name:'별도 계좌'});window.__assetOS.replaceState(next);nav('integrated','summary');
 });
 const before=await page.evaluate(()=>JSON.stringify(window.__assetOS.getState().integrated.ledger));
 await expect(page.locator('.preset-context').first()).toContainText('기본급');
 await expect(page.locator('.preset-context').nth(1)).toContainText('별도 계좌');
 for(const width of [360,412]){
  await page.setViewportSize({width,height:915});
  const box=await page.getByRole('button',{name:'이전 달',exact:true}).boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({path:`/tmp/asset-action-summary-${info.project.name}-${width}.png`,animations:'disabled'});
  await page.locator('[data-summary-entry]').first().click();
  await expect(page.locator('#entryDate')).toHaveValue(/2026-02-/);
  await expect(page.locator('#entryDateContext')).toContainText('저장 전 날짜를 확인');
  await page.locator('#entryAmount').fill('12345');
  await page.getByRole('button',{name:'입력창 닫기',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'작성 내용을 닫을까요?'});await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:'계속 작성',exact:true}).click();await expect(page.locator('#entryAmount')).toHaveValue('12345');
  await page.locator('#entryDate').fill(await page.evaluate(()=>localYmd()));await page.locator('#entryDate').dispatchEvent('change');
  await expect(page.locator('#entryDateContext')).toContainText('오늘');
  for(const theme of ['light','dark']){
   await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;document.body.dataset.theme=theme},theme);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
   await expect(page.locator('#closeFormSheet')).toHaveCSS('background-color',theme==='dark'?'rgb(33, 44, 58)':'rgb(243, 246, 251)');
   await page.screenshot({path:`/tmp/asset-action-${info.project.name}-${width}-${theme}.png`,animations:'disabled'});
  }
  await page.goBack();await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'변경사항 버리기',exact:true}).click();await expect(page.locator('#formSheet')).not.toHaveClass(/open/);
 }
 expect(await page.evaluate(()=>JSON.stringify(window.__assetOS.getState().integrated.ledger))).toBe(before);
});

test('@core refresh labels distinguish ISA prices from pension balances',async({page})=>{
 await page.goto('/index.html?qa=1#/home');await page.getByRole('button',{name:/검토·중요 알림/}).click();
 await expect(page.locator('.refresh-scope-note')).toContainText('ISA는 시세만');
 await page.locator('.refresh-account-times summary').click();
 await expect(page.locator('.refresh-account-times')).toContainText('ISA 시세');
 await expect(page.locator('.refresh-account-times')).toContainText('연금저축 잔고·내역');
});
