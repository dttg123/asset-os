import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test('@core ledger groups complete brand totals and expands daily payments without changing records',async({page})=>{
 if(process.env.ASSET_OS_QA_SDK_PATH){const body=await readFile(process.env.ASSET_OS_QA_SDK_PATH);await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4',r=>r.fulfill({body,contentType:'text/javascript'}))}
 await page.goto('/index.html?qa=1#/home');await page.waitForFunction(()=>!!window.__assetOS);
 const before=await page.evaluate(async()=>{
  const s=window.__assetOS.getState();s.integrated.accounts=[{id:'cash-main',kind:'cash',name:'현금'}];s.integrated.liabilities=[];s.financialProducts={items:[],events:[]};s.financeSchedules={items:[]};s.insurance={policies:[]};s.settings.cardAccounts=[];s.settings.merchantNameCleanup=true;s.settings.integratedMonth='2026-05';s.settings.integratedMonthViewedOn=localYmd();s.settings.integratedLedgerFilter='all';s.settings.integratedLedgerCategory='';
  s.integrated.ledger=Array.from({length:65},(_,i)=>({id:'coffee-'+i,date:i<2?'2026-05-25':'2026-05-24',type:'externalExpense',category:'식비',amount:1800,meta:{merchant:'컴포즈커피 '+i+'점'}}));s.integrated.ledger.push({id:'refund',date:'2026-05-26',type:'refund',amount:1800,meta:{refundOf:'coffee-0'}});await window.__assetOS.replaceState(s);nav('integrated','ledger');return JSON.stringify(state.integrated.ledger);
 });
 const summary=page.locator('[data-ledger-merchant="컴포즈커피"]');await expect(summary).toHaveCount(1);await expect(summary).toContainText('66건');await expect(summary).toContainText('115,200원');await expect(page.locator('[data-integrated-search-more]')).toHaveCount(0);await expect(page.locator('[data-integrated-tx="coffee-0"]')).not.toBeVisible();
 await summary.click();await expect(page.locator('[data-integrated-tx="coffee-0"]')).toBeVisible();await expect(page.locator('[data-integrated-tx="coffee-1"]')).toBeVisible();await expect(page.locator('.ledger-merchant-dates h4')).toHaveCount(3);await expect(page.locator('.ledger-merchant-dates [data-integrated-tx]')).toHaveCount(66);
 await page.locator('[data-integrated-tx="coffee-0"]').click();await expect(page.locator('#sheetTitle')).toHaveText('컴포즈커피');expect(await page.evaluate(()=>JSON.stringify(state.integrated.ledger))).toBe(before);
});
