import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test.beforeEach(async({page})=>{
 if(process.env.ASSET_OS_QA_SDK_PATH){const body=await readFile(process.env.ASSET_OS_QA_SDK_PATH);await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4',r=>r.fulfill({body,contentType:'text/javascript'}))}
 await page.addInitScript(()=>{window.__edgeErrors=[];addEventListener('error',e=>window.__edgeErrors.push(e.message))});
 await page.goto('/index.html?qa=1#/home');await page.waitForFunction(()=>!!window.__assetOS);
 await page.evaluate(async()=>{const s=window.__assetOS.getState();s.integrated.accounts=[{id:'edge-cash',kind:'cash',name:'QA 현금'}];s.integrated.liabilities=[];s.integrated.ledger=[];s.financialProducts={items:[],events:[]};s.financeSchedules={items:[]};s.insurance={policies:[]};s.settings.cardAccounts=[];s.settings.integratedMonth='2026-10';s.settings.integratedMonthViewedOn=localYmd();s.settings.spendingPeriod='month';await window.__assetOS.replaceState(s)});
});
test.afterEach(async({page})=>{expect(await page.evaluate(()=>window.__edgeErrors)).toEqual([])});
async function close(page){await page.evaluate(()=>{sheetDirty=false;closeSheets({all:true});cancelSheetBackForNavigation()});await page.waitForFunction(()=>!sheetBackTimer&&!suppressSheetPop)}

async function seed(page){await page.evaluate(async()=>{state.integrated.ledger=[{id:'fund',date:'2026-01-01',type:'openingAsset',amount:100000,toAccountId:'cash-main'},{id:'policy',date:'2026-10-01',type:'expense',amount:1000,fromAccountId:'cash-main',category:'보험'},{id:'shop',date:'2026-10-02',type:'expense',amount:1000,fromAccountId:'cash-main',category:'쇼핑'}];await persist(false);nav('integrated','ledger')})}

test('@core saving another category reveals the new transaction instead of retaining a hiding filter',async({page})=>{
 await seed(page);await page.locator('[data-integrated-category="보험"]').click();await page.locator('[data-integrated-new]').click();const form=page.locator('#integratedTxForm');await form.locator('[data-entry-type="lifeExpense"]').click();await form.locator('[name="amount"]').fill('100');await form.locator('[name="date"]').fill('2026-10-25');await form.locator('[name="category"]').fill('식비');await form.locator('.integrated-form-save').click();await expect(page.locator('#formSheet')).not.toHaveClass(/open/);
 const added=await page.evaluate(()=>state.integrated.ledger.find(t=>t.amount===100).id);await expect(page.locator(`[data-integrated-tx="${added}"]`)).toBeVisible();expect(await page.evaluate(()=>setting().integratedLedgerCategory)).toBe('');
});

test('@core a refund entered from spending is visible despite the previous ledger category filter',async({page})=>{
 await seed(page);await page.locator('[data-integrated-category="쇼핑"]').click();await page.evaluate(()=>{nav('integrated','spending');openIntegratedRefundForm('policy')});await page.locator('#refundForm [name="date"]').fill('2026-10-25');await page.locator('#refundForm [name="amount"]').fill('50');await page.locator('#refundForm button').click();await expect(page.locator('#formSheet')).not.toHaveClass(/open/);const refund=await page.evaluate(()=>state.integrated.ledger.find(t=>t.type==='refund').id);await expect(page.locator(`[data-integrated-tx="${refund}"]`)).toBeVisible();expect(await page.evaluate(()=>setting().integratedLedgerCategory)).toBe('');
});

test('@core browser back from a scrolled spending item preserves category position and finance',async({page})=>{
 await page.evaluate(async()=>{for(let i=0;i<50;i++)state.integrated.ledger.push({id:'scroll-'+i,type:'expense',date:'2026-10-01',amount:100+i,fromAccountId:'cash-main',category:'식비',meta:{spendingItem:'항목 '+i}});await persist(false);nav('integrated','spending')});await page.locator('[data-spending-category-filter="식비"]').click();const row=page.locator('[data-spending-item="항목 10"]');await row.scrollIntoViewIfNeeded();const before=await page.evaluate(()=>({y:scrollY,ledger:JSON.stringify(state.integrated),revision:assetLocalDatabase.revision}));await row.click();await expect(page.locator('#detailSheet')).toHaveClass(/open/);await page.goBack();await expect(page.locator('#detailSheet')).not.toHaveClass(/open/);await page.waitForFunction(()=>!sheetBackTimer&&!suppressSheetPop);await expect.poll(()=>page.evaluate(()=>scrollY)).toBeCloseTo(before.y,0);expect(await page.evaluate(()=>setting().spendingCategoryFilter)).toBe('식비');expect(await page.evaluate(()=>({ledger:JSON.stringify(state.integrated),revision:assetLocalDatabase.revision}))).toEqual({ledger:before.ledger,revision:before.revision});
});

test('@core integrated investment detail routes to ISA pension and IRP and returns home without financial commits',async({page})=>{
 await page.evaluate(async()=>{const s=window.__assetOS.getState();s.accounts=[{id:'route-isa',name:'QA ISA',status:'active',openedAt:'2026-01-01',baseline:{date:'2026-01-01',cash:1000,contribution:0},holdings:[],transactions:[],assetSnapshots:[],reconciliations:[]}];s.settings.selectedAccountId='route-isa';s.pension.accounts=[{id:'route-pension',name:'QA 연금',kind:'pension',status:'active',openedAt:'2026-01-01'},{id:'route-irp',name:'QA IRP',kind:'irp',status:'active',openedAt:'2026-01-01'}];s.pension.holdings=[];s.pension.transactions=[];await window.__assetOS.replaceState(s);nav('integrated','summary')});
 const before=await page.evaluate(()=>({finance:JSON.stringify({integrated:state.integrated,accounts:state.accounts,pension:state.pension}),revision:assetLocalDatabase.revision}));
 for(const kind of ['isa','pension','irp']){await page.evaluate(kind=>openIntegratedAsset(kind),kind);await page.locator(`[data-integrated-module-go="${kind}"]`).click();await expect(page.locator('header h1')).toHaveText(kind==='isa'?'ISA':'개인연금');await expect(page.locator('.sheet.open')).toHaveCount(0);if(kind!=='isa')expect(await page.evaluate(()=>setting().pensionAssetScope)).toBe(kind);await page.locator('.nav[data-root="home"]').click();await expect(page.locator('header h1')).toHaveText('홈');await expect(page.locator('.home-account-list')).toBeVisible();await page.locator('.nav[data-root="integrated"]').click();await expect(page.locator('header h1')).toHaveText('통합')}
 expect(await page.evaluate(()=>({finance:JSON.stringify({integrated:state.integrated,accounts:state.accounts,pension:state.pension}),revision:assetLocalDatabase.revision}))).toEqual(before);
});
