import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{
 await page.goto('/index.html?qa=1#/home');
 await page.waitForFunction(()=>!!window.__assetOS);
 await page.evaluate(async()=>{
  localYmd=()=> '2026-10-26';
  const s=window.__assetOS.getState();
  s.integrated.accounts=[{id:'cash-main',kind:'cash',name:'QA 현금'}];
  s.integrated.liabilities=[];
  s.integrated.ledger=[
   {id:'opening',type:'openingAsset',date:'2025-01-01',amount:2000000,toAccountId:'cash-main'},
   {id:'life-one',type:'expense',date:'2026-10-10',amount:25000,fromAccountId:'cash-main',category:'생활',meta:{spendingItem:'공통 이름'}},
   {id:'game-one',type:'expense',date:'2026-10-12',amount:10000,fromAccountId:'cash-main',category:'게임·취미',meta:{spendingItem:'공통 이름'}},
   {id:'food-one',type:'expense',date:'2026-01-15',amount:15000,fromAccountId:'cash-main',category:'식비',meta:{spendingItem:'점심'}},
   {id:'food-two',type:'expense',date:'2026-10-14',amount:12000,fromAccountId:'cash-main',category:'식비',meta:{spendingItem:'점심'}}
  ];
  s.financeSchedules={items:[]};s.financialProducts={items:[],events:[]};s.insurance={policies:[]};
  s.settings.cardAccounts=[{id:'qa-card',name:'QA 국민카드',issuer:'KB',paymentDay:25,lastFour:'0000',archived:false}];
  s.settings.integratedMonth='2026-10';s.settings.integratedMonthViewedOn=localYmd();
  s.settings.spendingPeriod='month';s.settings.spendingView='categories';s.settings.spendingCategoryFilter='';
  await window.__assetOS.replaceState(s);
  nav('integrated','spending');
 });
});
test('@core category selection shows only its own records inline and retains focus after detail close',async({page})=>{
 const baseline=await page.evaluate(()=>JSON.stringify(state.integrated));
 await page.locator('[data-ux42-category="생활"]').click();
 await expect(page.locator('[data-ux42-category-panel] [data-ux42-tx]')).toHaveCount(1);
 await expect(page.locator('[data-ux42-category-panel] [data-ux42-tx="life-one"]')).toBeVisible();
 await expect(page.locator('[data-ux42-category-panel] [data-ux42-tx="game-one"]')).toHaveCount(0);
 await page.locator('[data-ux42-category-panel] [data-ux42-tx="life-one"]').click();
 await expect(page.locator('#detailSheet.open')).toBeVisible();
 await page.evaluate(()=>{sheetDirty=false;closeSheets({all:true});cancelSheetBackForNavigation()});
 await expect(page.locator('[data-ux42-category="생활"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('[data-ux42-category-panel] [data-ux42-tx="life-one"]')).toBeVisible();
 await page.locator('[data-ux42-category="게임·취미"]').click();
 await expect(page.locator('[data-ux42-category-panel] [data-ux42-tx="game-one"]')).toBeVisible();
 await expect(page.locator('[data-ux42-category-panel] [data-ux42-tx="life-one"]')).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.stringify(state.integrated))).toEqual(baseline);
});
test('@core month daily quarter 1-4 and annual per-year chart keep original unchanged',async({page})=>{
 const baseline=await page.evaluate(()=>JSON.stringify(state.integrated));
 await expect(page.locator('.ux42-periods button')).toHaveCount(3);
 await expect(page.locator('.spending-trend [data-spending-select]')).toHaveCount(31);
 await page.locator('[data-spending-select="2026-10-10"]').click();
 await expect(page.locator('[data-ux42-chart-panel] [data-ux42-tx="life-one"]')).toBeVisible();
 await expect(page.locator('[data-ux42-chart-panel] [data-ux42-tx="game-one"]')).toHaveCount(0);
 await page.locator('.ux42-periods [data-spending-period="quarter"]').click();
 await expect(page.locator('.spending-trend [data-spending-select]')).toHaveCount(4);
 await page.locator('[data-spending-select="2026-Q1"]').click();
 await expect(page.locator('[data-ux42-chart-panel] [data-ux42-tx="food-one"]')).toBeVisible();
 await page.locator('.ux42-periods [data-spending-period="years"]').click();
 await expect(page.locator('.spending-trend [data-spending-select]')).toHaveCount(6);
 await expect(page.locator('.ux42-periods [data-spending-period="half"]')).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.stringify(state.integrated))).toEqual(baseline);
});
test('@core unified input keeps card purchase route, one-off default and partial interest rounds',async({page})=>{
 await page.locator('.ux42-add').click();
 await expect(page.locator('#integratedTxForm')).toBeVisible();
 await page.locator('#integratedTxForm .ux42-back').click();
 await expect(page.locator('#detailSheet.open [data-ux42-choice]')).toHaveCount(5);
 await page.locator('[data-ux42-choice="card"]').click();
 await expect(page.locator('#formSheet.open .card-purchase-form')).toBeVisible();
 await expect(page.locator('#formSheet .ux42-back')).toBeVisible();
 await expect(page.locator('#formSheet [name="months"]')).toHaveValue('1');
 await page.locator('#formSheet [name="months"]').selectOption('3');
 await page.locator('#formSheet [name="interestMode"]').selectOption('partial');
 await expect(page.locator('#formSheet .ux42-round-picker')).toBeVisible();
 await page.locator('#formSheet .ux42-round-picker button').first().click();
 await expect(page.locator('#formSheet [name="paidRounds"]')).toHaveValue('2,3');
});
test('@core all integrated tabs retain one consistent entry action',async({page})=>{
 for(const tab of ['summary','ledger','spending','schedule']){
  await page.evaluate(tab=>nav('integrated',tab),tab);
  await expect(page.locator('.ux42-common-action .ux42-add')).toHaveCount(1);
  await expect(page.locator('.cardv2-entry')).toHaveCount(0);
 }
});

test('@core spending has one list browser and direct expense entry preserves a cancelled draft',async({page})=>{
 await expect(page.locator('.ux42-deep-analysis,.ux42-items-fold,.spending-view,.spending-card')).toHaveCount(0);
 await expect(page.locator('.ux42-category-list')).toBeVisible();
 await page.locator('[data-ux42-view="items"]').click();
 await expect(page.locator('.ux42-category-list')).not.toBeVisible();
 await expect(page.locator('.ux42-item-list')).toBeVisible();
 await page.locator('[data-ux42-item="공통 이름"][data-ux42-item-category="생활"]').click();
 await expect(page.locator('[data-ux42-category-panel] [data-ux42-tx]')).toHaveCount(1);
 await page.locator('.ux42-item-detail').click();
 await expect(page.locator('#sheetTitle')).toHaveText('공통 이름');
 await expect(page.locator('[data-spending-classify-item]')).toBeVisible();
 await page.evaluate(()=>{sheetDirty=false;closeSheets({all:true});cancelSheetBackForNavigation()});
 await page.waitForFunction(()=>!sheetBackTimer&&!suppressSheetPop);
 await page.locator('.ux42-add').click();
 await expect(page.locator('#integratedTxForm')).toBeVisible();
 await page.locator('#entryAmount').fill('12345');
 await page.locator('#entrySpendingItem').fill('입력 중인 지출');
 await page.locator('#integratedTxForm .ux42-back').click();
 await page.getByRole('button',{name:'계속 입력',exact:true}).click();
 await expect(page.locator('#entryAmount')).toHaveValue('12345');
 await expect(page.locator('#entrySpendingItem')).toHaveValue('입력 중인 지출');
});

test('@core direct expense save and continue records each amount once through the normal form',async({page})=>{
 const before=await page.evaluate(()=>state.integrated.ledger.length);
 await page.locator('[data-spending-selected-detail]').click();
 await expect(page.locator('[data-ux42-chart-panel]')).toBeVisible();
 await expect(page.locator('#detailSheet')).not.toHaveClass(/open/);
 await page.locator('.ux42-add').click();
 await page.locator('#entryAmount').fill('12345');
 await page.locator('#entryDate').fill('2026-10-26');
 await page.locator('#entrySpendingItem').fill('연속 입력 첫 번째');
 await page.locator('#entryCategory').fill('식비');
 await page.locator('[data-entry-continue]').click();
 await expect(page.locator('#integratedTxForm')).toBeVisible();
 await expect(page.locator('#entryAmount')).toHaveValue('');
 await expect(page.locator('#entryDate')).toHaveValue('2026-10-26');
 await expect(page.locator('#integratedTxForm .ux42-back')).toBeVisible();
 await page.locator('#entryAmount').fill('6789');
 await page.locator('#entrySpendingItem').fill('연속 입력 두 번째');
 await page.locator('#integratedTxForm .integrated-form-save').click();
 await expect(page.locator('#formSheet')).not.toHaveClass(/open/);
 expect(await page.evaluate(()=>({count:state.integrated.ledger.length,amounts:state.integrated.ledger.filter(t=>t.date==='2026-10-26').map(t=>t.amount)}))).toEqual({count:before+2,amounts:[12345,6789]});
});
