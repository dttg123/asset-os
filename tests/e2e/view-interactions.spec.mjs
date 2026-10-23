import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const close=page=>page.evaluate(()=>{sheetDirty=false;closeSheets({all:true});cancelSheetBackForNavigation()});
test.beforeEach(async({page})=>{
 if(process.env.ASSET_OS_QA_SDK_PATH){const body=await readFile(process.env.ASSET_OS_QA_SDK_PATH);await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4',route=>route.fulfill({body,contentType:'text/javascript'}))}
 await page.addInitScript(()=>localStorage.setItem('asset-os-v1.9.45-live','view-qa-operating-guard'));
 await page.goto('/index.html?qa=1#/home');await page.waitForFunction(()=>!!window.__assetOS);
 await page.evaluate(async()=>{
  const next=window.__assetOS.getState();
  next.accounts=[{id:'view-isa',name:'조회 QA ISA',status:'active',openedAt:'2026-01-01',baseline:{date:'2026-01-01',cash:500000,contribution:0},holdings:[{id:'view-growth',name:'가상 성장',investmentRole:'성장',baselineQty:10,baselineAvg:10000,currentPrice:12000}],transactions:[],assetSnapshots:[],reconciliations:[]}];
  next.settings.selectedAccountId='view-isa';next.settings.integratedMonth='2026-10';next.settings.integratedMonthViewedOn=localYmd();
  next.pension.accounts=[{id:'view-pension',name:'조회 QA 연금',kind:'pension',status:'active',openedAt:'2026-01-01'}];
  next.pension.holdings=[{id:'view-ph',accountId:'view-pension',name:'가상 성장 연금',investmentRole:'성장',baselineQty:10,baselineAvgPrice:10000,qty:10,avgPrice:10000,currentPrice:12000}];next.pension.transactions=[];
  next.integrated.accounts=[{id:'view-cash',name:'가상 현금',kind:'cash'}];next.integrated.ledger=[{id:'view-spending',type:'expense',date:'2026-10-01',amount:12345,fromAccountId:'view-cash',category:'식비'}];
  await window.__assetOS.replaceState(next);
  window.__viewBaseline=JSON.stringify({accounts:state.accounts,pension:state.pension,integrated:state.integrated,financeSchedules:state.financeSchedules,financialProducts:state.financialProducts,policies:state.policies,brokerKis:state.brokerKis});
  window.__viewRevision=assetLocalDatabase.revision;window.__viewCommits=0;window.__viewBusy=0;
  const commit=assetLocalDatabase.commit;assetLocalDatabase.commit=async(...args)=>{window.__viewCommits++;return commit(...args)};
  new MutationObserver(()=>{if(document.documentElement.dataset.storageSaving)window.__viewBusy++}).observe(document.documentElement,{attributes:true,attributeFilter:['data-storage-saving']});
 });
});

test('@core view-only clicks never commit the financial ledger or lock the screen',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.locator('.nav[data-root="isa"]').click();
 await page.locator('[data-inline-group],[data-inline-donut]').first().click();
 await page.evaluate(()=>openDividendAnalysis());await page.locator('[data-dividend-period="year"]').click();await close(page);
 await page.locator('.nav[data-root="pension"]').click();await page.locator('main').locator('[data-pension-tab="assets"]:visible').click();
 await page.locator('main').locator('[data-pension-scope="pension"]').click();
 await page.locator('main').locator('[data-pension-group]').first().click();
 await page.locator('main').locator('[data-pension-asset-analysis]').click();await close(page);
 await page.locator('.nav[data-root="integrated"]').click();
 await page.locator('main').locator('[data-integrated-tab="spending"]').click();
 await page.locator('main').locator('[data-spending-period="year"]').click();
 await page.locator('main').locator('.spending-view [data-spending-view="items"]').click();
 await page.locator('main').locator('.spending-view [data-spending-view="categories"]').click();
 await page.evaluate(()=>openPolicyHub('pension'));await close(page);
 await page.evaluate(()=>openFinancialProductHub('all'));await close(page);
 const result=await page.evaluate(()=>({commits:window.__viewCommits,busy:window.__viewBusy,sameRevision:assetLocalDatabase.revision===window.__viewRevision,sameFinance:JSON.stringify({accounts:state.accounts,pension:state.pension,integrated:state.integrated,financeSchedules:state.financeSchedules,financialProducts:state.financialProducts,policies:state.policies,brokerKis:state.brokerKis})===window.__viewBaseline,guard:localStorage.getItem('asset-os-v1.9.45-live')}));
 expect(result).toEqual({commits:0,busy:0,sameRevision:true,sameFinance:true,guard:'view-qa-operating-guard'});expect(errors).toEqual([]);
 await page.reload();await page.waitForFunction(()=>!!window.__assetOS);expect(await page.evaluate(()=>({scope:setting().pensionAssetScope,period:setting().spendingPeriod,view:setting().spendingView}))).toEqual({scope:'pension',period:'year',view:'categories'});
});

test('@core navigation and analysis keep stable content and accessible focus without repeated fades',async({page})=>{
 for(const root of ['isa','pension','integrated','home','isa']){await page.locator(`.nav[data-root="${root}"]`).click();await expect(page.locator('header h1')).toHaveText({isa:'ISA',pension:'개인연금',integrated:'통합',home:'홈'}[root]);expect(await page.locator('#main').evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.animationName==='pageReveal').length)).toBe(0)}
 await page.locator('main').locator('[data-isa-asset-analysis]').click();await expect(page.locator('#detailSheet')).toHaveClass(/open/);await expect(page.locator('#scrim')).toBeVisible();
 expect(await page.locator('#scrim').evaluate(e=>getComputedStyle(e).backdropFilter)).toBe('none');
 await page.keyboard.press('Escape');await expect(page.locator('#detailSheet')).not.toHaveClass(/open/);
 await page.waitForFunction(()=>!sheetBackTimer&&!suppressSheetPop);
 const donut=page.locator('[data-inline-donut]').first();expect(await donut.evaluate(e=>getComputedStyle(e).webkitTapHighlightColor)).toBe('rgba(0, 0, 0, 0)');
 const legend=page.locator('[data-inline-group]').first();await legend.focus();expect(await legend.evaluate(e=>getComputedStyle(e).outlineStyle)).not.toBe('none');
});

test('@core repeated chart touches and sheet back preserve the ledger in both themes',async({page},info)=>{
 await page.locator('.nav[data-root="isa"]').click();
 // Let the app's hashchange render finish before the test injects a theme render.
 await expect(page.locator('header h1')).toHaveText('ISA');
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>{setting().theme=theme;setting().compositionFocus='';applyTheme();render()},theme);
  for(let i=0;i<6;i++){
   const chart=page.locator('main .donut-svg').first();await chart.scrollIntoViewIfNeeded();const box=await chart.boundingBox(),x=box.x+box.width*.88,y=box.y+box.height*.5;
   if(info.project.name==='galaxy-s25-ultra')await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
   expect(await page.evaluate(()=>!!setting().compositionFocus)).toBe(i%2===0);
  }
  await page.locator('main [data-isa-asset-analysis]').click();await expect(page.locator('#detailSheet')).toHaveClass(/open/);await page.goBack();await expect(page.locator('#detailSheet')).not.toHaveClass(/open/);await page.waitForFunction(()=>!sheetBackTimer&&!suppressSheetPop);
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('main [data-isa-asset-analysis]').click();expect(await page.locator('#scrim').evaluate(e=>getComputedStyle(e).animationName)).toBe('none');await close(page);
 expect(await page.evaluate(()=>({commits:window.__viewCommits,busy:window.__viewBusy,sameRevision:assetLocalDatabase.revision===window.__viewRevision}))).toEqual({commits:0,busy:0,sameRevision:true});
});
