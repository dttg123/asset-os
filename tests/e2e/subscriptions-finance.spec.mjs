import {test,expect} from '@playwright/test';
test('@core subscriptions live in financial settings without an oversized home card',async({page})=>{
 await page.goto('/index.html?qa=1#/home');await page.waitForFunction(()=>!!window.__assetOS);
 await page.evaluate(async()=>{const s=window.__assetOS.getState();s.settings.subscriptionRegistry={version:1,items:[{id:'monthly',name:'월간 서비스',amount:5900,cycle:'monthly',status:'active'},{id:'ended',name:'종료 서비스',amount:3900,cycle:'monthly',status:'ended'}],rules:[],notices:[],ignored:[]};await window.__assetOS.replaceState(s);});
 await expect(page.locator('.subscription-home')).toHaveCount(0);
 await page.locator('#profile').click();await page.locator('[data-settings-group="finance"]').click();await page.locator('[data-profile-action="subscriptions"]').click();
 await expect(page.locator('#sheetTitle')).toHaveText('구독·이용권');await expect(page.locator('#detailSheet [data-subscription-detail="monthly"]')).toBeVisible();
 await page.locator('#detailSheet [data-subscription-filter="ended"]').click();await expect(page.locator('#detailSheet [data-subscription-detail="ended"]')).toBeVisible();await expect(page.locator('#detailSheet [data-subscription-detail="monthly"]')).toHaveCount(0);
 await page.locator('[data-subscription-back]').click();await expect(page.locator('#sheetTitle')).toHaveText('금융 관리');
});
