import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test.beforeEach(async({page})=>{
 if(process.env.ASSET_OS_QA_SDK_PATH){const body=await readFile(process.env.ASSET_OS_QA_SDK_PATH);await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4',route=>route.fulfill({body,contentType:'text/javascript'}))}
});
test('@core action design keeps historical dates explicit and close preserves unsaved edits',async({page},info)=>{
 await page.goto('/index.html?qa=1#/home');
 await page.evaluate(async ()=>{
  const next=window.__assetOS.getState();next.settings.integratedMonth='2026-02';
  next.settings.integratedEntryFavorites=[{uiType:'externalIncome',category:'월급',amount:100000,toAccountId:'cash-main',note:'기본급'},{uiType:'externalIncome',category:'월급',amount:200000,toAccountId:'qa-other',note:'상여'}];
  next.integrated.accounts.push({id:'qa-other',kind:'cash',name:'별도 계좌'});(await window.__assetOS.replaceState(next));nav('integrated','summary');
 });
 const before=await page.evaluate(()=>JSON.stringify(window.__assetOS.getState().integrated.ledger));
 await expect(page.locator('.preset-context').first()).toContainText('기본급');
 await expect(page.locator('.preset-context').nth(1)).toContainText('별도 계좌');
 for(const width of [360,412]){
  await page.setViewportSize({width,height:915});
  const box=await page.getByRole('button',{name:'이전 달',exact:true}).boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({path:`/tmp/asset-action-summary-${info.project.name}-${width}.png`,animations:'disabled'});
  await page.locator('[data-summary-entry]').first().click();
  await expect(page.locator('#entryDate')).toHaveValue(await page.evaluate(()=>localYmd()));
  await expect(page.locator('#entryDateContext')).toContainText('오늘');
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

test('@core visual polish preserves navigation and money with motion enabled or reduced',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('/index.html?qa=1#/home');
 await page.getByRole('button',{name:'35년 생성',exact:true}).click();
 await page.getByRole('dialog',{name:'QA 35년 실사용 데이터 생성'}).getByRole('button',{name:'생성',exact:true}).click();
 await expect(page.getByText(/2026-2060 · 7,740건/)).toBeVisible({timeout:30_000});
 const before=await page.evaluate(()=>({ledger:JSON.stringify(state.integrated.ledger),net:integratedFinancialModel().netAssets}));
 for(const width of [360,412])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:915});
  await page.evaluate(theme=>{state.settings.theme=theme;render()},theme);
  for(const root of ['홈','ISA','개인연금','통합']){
   await page.getByRole('navigation',{name:'주요 메뉴'}).getByRole('button',{name:root,exact:true}).click();
   await expect(page.locator('header h1')).toHaveText(root);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
   const amounts=await page.locator('#main .heroamount,#main .isa-value,#main .pension-asset-value,#main .integrated-overview-value').evaluateAll(nodes=>nodes.map(n=>({width:n.clientWidth,scroll:n.scrollWidth,text:n.textContent})));
   for(const amount of amounts){expect(amount.text).not.toMatch(/NaN|Infinity/);expect(amount.scroll).toBeLessThanOrEqual(amount.width+1)}
   if(info.project.name==='galaxy-s25-ultra')await page.screenshot({path:`/tmp/asset-polish-${width}-${theme}-${root}.png`,animations:'disabled'});
  }
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.getByRole('navigation',{name:'주요 메뉴'}).getByRole('button',{name:'홈',exact:true}).click();
 await expect(page.locator('#main>.stack')).toHaveCSS('animation-name','none');
 await expect(page.locator('.hero')).not.toHaveCSS('background-image','none');
 await page.locator('.hero').hover();await page.mouse.down();
 await expect(page.locator('.hero')).toHaveCSS('transform','none');await page.mouse.up();
 await expect(page.locator('#detailSheet')).toHaveClass(/open/);
 expect(await page.locator('#detailSheet').evaluate(n=>parseFloat(getComputedStyle(n).transitionDuration))).toBeLessThan(.002);
 await page.goBack();await expect(page.locator('#detailSheet')).not.toHaveClass(/open/);
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.getByRole('navigation',{name:'주요 메뉴'}).getByRole('button',{name:'ISA',exact:true}).click();
 await expect(page.locator('header h1')).toHaveText('ISA');
 await expect(page.locator('#main>.stack,#main>.module-page-shell').first()).toHaveCSS('animation-name','pageReveal');
 expect(await page.evaluate(()=>({ledger:JSON.stringify(state.integrated.ledger),net:integratedFinancialModel().netAssets}))).toEqual(before);
 expect(errors).toEqual([]);
});
