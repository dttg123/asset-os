import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
 await page.goto('/index.html?qa=1#/home');await page.waitForFunction(()=>!!window.__assetOS);
});

test('@core neutral browser theme survives resume and is independent of accent colors',async({page})=>{
 const before=await page.evaluate(()=>JSON.stringify(state.integrated));
 for(const theme of ['light','dark'])for(const accent of ['blue','mint','purple','orange']){
  await page.evaluate(({theme,accent})=>{setting().theme=theme;setting().accent=accent;applyTheme()},{theme,accent});
  const expected=await page.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--bg').trim());
  expect(expected.toLowerCase()).not.toBe('#2f6fed');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content',expected);
  for(const event of ['focus','pageshow','visibilitychange']){
   await page.evaluate(event=>{document.querySelector('meta[name="theme-color"]').content='#2f6fed';(event==='visibilitychange'?document:window).dispatchEvent(new Event(event))},event);
   await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content',expected);
  }
 }
 expect(await page.evaluate(()=>JSON.stringify(state.integrated))).toBe(before);
});

test('@core closed sheets never paint shadows over the bottom menu before or after input',async({page},info)=>{
 await page.setViewportSize({width:412,height:915});
 const before=await page.evaluate(()=>JSON.stringify(state.integrated));
 await expect(page.locator('.sheet.open')).toHaveCount(0);
 expect(await page.locator('.sheet').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).visibility==='hidden'))).toBe(true);
 await page.evaluate(()=>openIntegratedTransactionForm('',{uiType:'lifeExpense'}));
 await expect(page.locator('#formSheet')).toBeVisible();
 await page.getByRole('button',{name:'입력창 닫기',exact:true}).click();
 await expect(page.locator('#formSheet')).toBeHidden();
 expect(await page.locator('.sheet').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).visibility==='hidden'))).toBe(true);
 expect(await page.evaluate(()=>{const nav=document.querySelector('.bottomnav'),b=nav.getBoundingClientRect(),el=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return !!el?.closest('.bottomnav')})).toBe(true);
 await page.locator('.bottomnav').screenshot({path:`test-results/monthly-clarity-system-bar-${info.project.name}.png`});
 expect(await page.evaluate(()=>JSON.stringify(state.integrated))).toBe(before);
});
