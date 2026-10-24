import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test.beforeEach(async({page})=>{
 if(process.env.ASSET_OS_QA_SDK_PATH){const body=await readFile(process.env.ASSET_OS_QA_SDK_PATH);await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4',r=>r.fulfill({body,contentType:'text/javascript'}))}
 await page.goto('/index.html?qa=1#/home');await page.waitForFunction(()=>!!window.__assetOS);
 await page.evaluate(async()=>{const next=window.__assetOS.getState();next.integrated.accounts=[{id:'cash-main',kind:'cash',name:'QA 현금'}];next.integrated.liabilities=[];next.integrated.ledger=[{id:'opening',type:'openingAsset',date:'2025-01-01',amount:10000000,toAccountId:'cash-main'}];next.financialProducts={items:[],events:[]};next.financeSchedules={items:[]};next.insurance={policies:[]};next.settings.cardAccounts=[];next.settings.integratedMonth='2026-10';next.settings.integratedMonthViewedOn=localYmd();next.settings.spendingPeriod='month';next.settings.spendingView='categories';await window.__assetOS.replaceState(next)});
});
async function close(page){await page.evaluate(()=>{sheetDirty=false;closeSheets({all:true});cancelSheetBackForNavigation()});await page.waitForFunction(()=>!sheetBackTimer&&!suppressSheetPop)}

test('@core insurance paths share one monthly payment, block duplicate cash and survive ZIP reload',async({page})=>{
 await page.evaluate(async()=>{state.insurance.policies=[{id:'policy',name:'QA 건강보험',status:'active',paymentStyle:'monthly',premium:1000,paymentDay:5,contractDate:'2026-01-01',paymentEndDate:'2026-12-31',coverages:[]}];syncInsuranceSchedule(insurancePolicies()[0],true);await persist(false);await completeScheduleOccurrence(insuranceSchedule(insurancePolicies()[0]).id,'2026-10-05',1000)});
 await close(page);await page.evaluate(()=>openInsurancePaymentForm('policy'));await page.waitForTimeout(100);await expect(page.locator('#formSheet')).toHaveClass(/open/);await page.locator('#insurancePaymentForm [name="date"]').fill('2026-10-05');await page.locator('#insurancePaymentForm button').click();
 expect(await page.evaluate(()=>({cash:integratedReplay().assets['cash-main'],paid:insurancePremiumSummary(insurancePolicies()[0]).paid}))).toEqual({cash:9999000,paid:1000});await close(page);
 // The reverse entry route also links an early actual date to its monthly occurrence.
 expect(await page.evaluate(async()=>{const result=recordInsurancePayment('policy',{date:'2026-09-04',amount:900,source:'tracked'});await persist(false);const occurrence=scheduleOccurrences('2026-09')[0];const duplicate=await completeScheduleOccurrence(occurrence.schedule.id,occurrence.date,1000);return{ok:result.ok,status:occurrence.status,actual:scheduleOccurrenceDisplayAmount(occurrence),duplicate,cash:integratedReplay().assets['cash-main']}})).toEqual({ok:true,status:'done',actual:900,duplicate:false,cash:9998100});
 await close(page);await page.evaluate(async()=>window.__assetOS.replaceState(validateBackupPayload(parseBackupZipBytes(createBackupZipBytes(backupPayload())))));await page.reload();await page.waitForFunction(()=>!!window.__assetOS);
 expect(await page.evaluate(()=>({cash:integratedReplay().assets['cash-main'],status:scheduleOccurrences('2026-09')[0].status,paid:insurancePremiumSummary(insurancePolicies()[0]).paid}))).toEqual({cash:9998100,status:'done',paid:1900});
});

test('@core category identity scopes totals and edits, renamed search and month filters',async({page})=>{
 await page.evaluate(async()=>{state.integrated.ledger.push({id:'food',date:'2026-10-01',type:'expense',amount:100,fromAccountId:'cash-main',category:'식비',meta:{spendingItem:'같은 이름'}},{id:'shop',date:'2026-10-02',type:'expense',amount:200,fromAccountId:'cash-main',category:'쇼핑',meta:{spendingItem:'같은 이름'}},{id:'nov',date:'2026-09-01',type:'expense',amount:300,fromAccountId:'cash-main',category:'보험'});await persist(false);nav('integrated','spending')});
 const before=await page.evaluate(()=>JSON.stringify(state.integrated));await page.locator('[data-spending-category-filter="식비"]').click();await expect(page.locator('.spending-items')).toContainText('100원');await expect(page.locator('.spending-items')).not.toContainText('300원');await page.locator('[data-spending-item]').click();await page.locator('[data-spending-classify-item]').click();await expect(page.locator('#cardLedgerForm .source-note')).toContainText('구매 1건');await page.locator('[name="item"]').fill('바꾼 이름');await page.locator('#cardLedgerForm button[type="submit"]').click();await close(page);
 expect(await page.evaluate(()=>JSON.stringify(state.integrated))).toBe(before);expect(await page.evaluate(()=>setting().spendingClassifications.shop)).toBeUndefined();await page.evaluate(()=>nav('integrated','ledger'));await page.locator('[data-integrated-search-form] input').fill('바꾼 이름');await page.locator('[data-integrated-search-form] button[type="submit"]').click();await expect(page.locator('.integrated-ledger-row')).toHaveCount(1);await expect(page.locator('.ledger-category-group h3')).toContainText('식비');
 await page.evaluate(()=>{setting().spendingCategoryFilter='쇼핑';nav('integrated','spending')});await page.locator('[data-integrated-month-shift="-1"]').click();await expect(page.locator('.spending-items')).toContainText('300원');expect(await page.evaluate(()=>setting().spendingCategoryFilter)).toBe('');
});

test('@core overview is monthly and analysis periods have one stable chart with reloadable selection',async({page},info)=>{
 await page.evaluate(async()=>{state.integrated.ledger.push({id:'a',date:'2026-08-01',type:'expense',amount:1000,fromAccountId:'cash-main',category:'식비'},{id:'b',date:'2026-10-02',type:'expense',amount:500,fromAccountId:'cash-main',category:'식비'});await persist(false);nav('integrated','summary')});
 await expect(page.locator('.integrated-consumption-preview h2')).toHaveText('2026년 10월 소비');await expect(page.locator('main .spending-chart')).toHaveCount(0);await expect(page.locator('main [data-spending-period]')).toHaveCount(0);
 await page.locator('.integrated-consumption-preview [data-integrated-tab-go]').click();await expect(page.locator('.spending-chart')).toHaveCount(1);await expect(page.locator('[data-spending-select="2026-10-02"]')).toHaveAttribute('aria-pressed','true');
 for(const [mode,count] of [['month',31],['quarter',3],['half',6],['year',12],['years',6]]){await page.locator(`[data-spending-period="${mode}"]`).click();await expect(page.locator('.spending-trend button')).toHaveCount(count)}
 await page.locator('[data-spending-period="half"]').click();const hero=await page.locator('.spending-hero>strong').textContent(),before=await page.locator('.spending-chart-selection').boundingBox(),list=await page.locator('.spending-view').boundingBox();await page.locator('[data-spending-select="2026-08"]').click();await expect(page.locator('[data-spending-selected-amount]')).toHaveText('1,000원');await expect(page.locator('.spending-hero>strong')).toHaveText(hero);expect((await page.locator('.spending-chart-selection').boundingBox()).height).toBe(before.height);expect((await page.locator('.spending-view').boundingBox()).y).toBe(list.y);
 await page.reload();await page.waitForFunction(()=>!!window.__assetOS);await expect(page.locator('[data-spending-select="2026-08"]')).toHaveAttribute('aria-pressed','true');
 for(const width of [320,412,768])for(const theme of ['light','dark']){await page.setViewportSize({width,height:915});await page.evaluate(theme=>{setting().theme=theme;applyTheme()},theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);const ys=await page.locator('[data-spending-period]').evaluateAll(es=>es.map(e=>Math.round(e.getBoundingClientRect().y)));expect(new Set(ys).size).toBe(1)}
 await page.setViewportSize({width:412,height:915});await page.screenshot({path:`/tmp/asset-os-0712-consumption-${info.project.name}.png`});
});

test('@core card monthly totals distinguish bill entry, payment and estimate for each issuer',async({page})=>{
 await page.evaluate(async()=>{const card=await saveCardAccount({name:'QA 국민카드',issuer:'국민카드',paymentDay:14});window.__auditCard=await createCardPurchase({name:'QA TV',cardId:card,purchaseAmount:300000,months:3,purchaseDate:'2026-08-01',firstPaymentDate:'2026-09-14',interestMode:'free',category:'가전·전자'});window.__auditBill=await saveCardBill(window.__auditCard,{issuedDate:'2026-10-01',dueDate:'2026-10-14',principal:100000,interest:3000,principalDiscount:5000});setting().integratedMonth='2026-10';nav('integrated','summary');openCardPlansHub()});
 await expect(page.locator('[data-card-monthly="confirmed"]')).toHaveText('98,000원');await expect(page.locator('[data-card-monthly="paid"]')).toHaveText('0원');await expect(page.locator('[data-card-monthly="unpaid"]')).toHaveText('98,000원');await expect(page.locator('.card-issuer-group h3')).toContainText('QA 국민카드');await page.locator('.card-purchases summary').click();await expect(page.locator('.card-plan-row')).toContainText('확정 청구');await expect(page.locator('.card-plan-row')).toContainText('납부 전');await expect(page.locator('.card-plan-row')).not.toContainText('미입력');await close(page);
 await page.evaluate(async()=>{await recordCardPayment(window.__auditCard,{billId:window.__auditBill,date:'2026-10-10',pointsPrincipal:2000,pointsInterest:0});openCardPlansHub()});await expect(page.locator('[data-card-monthly="paid"]')).toHaveText('98,000원');await expect(page.locator('[data-card-monthly="unpaid"]')).toHaveText('0원');
});

test('@core schedule categories include income without adding income to remaining payments',async({page})=>{
 await page.evaluate(async()=>{state.financeSchedules.items=[{id:'income',name:'QA 월급',kind:'income',amount:5000,day:25,startDate:'2026-01-01',active:true},{id:'insurance',name:'QA 보험',kind:'insurance',amount:1000,day:25,startDate:'2026-01-01',active:true}];await persist(false);nav('integrated','schedule')});
 await expect(page.locator('[data-schedule-category="income"]')).toBeVisible();await expect(page.locator('[data-schedule-category="insurance"]')).toBeVisible();await expect(page.locator('.schedule-head small')).toContainText('1,000원');await expect(page.locator('.schedule-monthbar')).toHaveCount(0);await page.locator('[data-schedule-category="insurance"]').click();await page.locator('[data-fixed-cost-item="insurance"]').click();await expect(page.locator('.schedule-detail-item')).toHaveCount(1);await expect(page.locator('.schedule-detail-item')).toContainText('QA 보험');
});

test('@core insurance rejects reversed coverage dates and item month switch keeps the selected year',async({page})=>{
 await page.evaluate(()=>openInsuranceForm());await page.locator('#insuranceForm [name="name"]').fill('QA 기간');await page.locator('[name="premium"]').fill('1000');await page.locator('[name="contractDate"]').fill('2026-10-01');await page.locator('[name="coverageEndDate"]').fill('2025-01-01');await page.locator('#insuranceForm button').click();expect(await page.evaluate(()=>insurancePolicies().length)).toBe(0);await close(page);
 await page.evaluate(()=>openSpendingItemDetail('QA 항목','2025'));await page.locator('[data-spending-item-period="month"]').click();await expect(page.locator('.spending-item-summary>span')).toHaveText('2025년 10월 소비');
});


test('@core fully paid cards keep issuer monthly totals while completed purchases remain in history',async({page})=>{
 await page.evaluate(async()=>{const card=await saveCardAccount({name:'QA 완납 카드',paymentDay:14});const id=await createCardPurchase({name:'QA 일시불',cardId:card,purchaseAmount:100000,months:1,purchaseDate:'2026-10-01',firstPaymentDate:'2026-10-14',interestMode:'free'});const bill=await saveCardBill(id,{issuedDate:'2026-10-02',dueDate:'2026-10-14',principal:100000});await recordCardPayment(id,{billId:bill,date:'2026-10-14',pointsPrincipal:0,pointsInterest:0});openCardPlansHub()});
 await expect(page.locator('.card-issuer-group h3')).toContainText('QA 완납 카드');await expect(page.locator('[data-card-monthly="confirmed"]')).toHaveText('100,000원');await expect(page.locator('[data-card-monthly="paid"]')).toHaveText('100,000원');await expect(page.locator('[data-card-monthly="unpaid"]')).toHaveText('0원');await expect(page.locator('.card-purchases')).toHaveCount(0);await page.locator('.card-completed summary').click();await expect(page.locator('.card-completed [data-card-plan-open]')).toHaveCount(1);
});

test('@core annual chart accepts native horizontal swipes without changing selection or money',async({page},info)=>{
 test.skip(!info.project.use.hasTouch,'Native touch is checked in the mobile project');
 const cdp=await page.context().newCDPSession(page);
 for(const width of [320,412]){
  await page.setViewportSize({width,height:915});await page.evaluate(()=>{setting().spendingPeriod='year';nav('integrated','spending')});
  const chart=page.locator('main .spending-trend');await chart.scrollIntoViewIfNeeded();
  const before=await page.evaluate(()=>({ledger:JSON.stringify(state.integrated.ledger),revision:assetLocalDatabase.revision,selected:document.querySelector('.spending-trend [aria-pressed="true"]').getAttribute('data-spending-select')}));
  const rect=await chart.boundingBox(),x=rect.x+rect.width-20,y=rect.y+55;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*25,y}]});await page.waitForTimeout(40)}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(200);
  expect(await chart.evaluate(e=>e.scrollLeft)).toBeGreaterThan(20);
  expect(await page.evaluate(()=>({ledger:JSON.stringify(state.integrated.ledger),revision:assetLocalDatabase.revision,selected:document.querySelector('.spending-trend [aria-pressed="true"]').getAttribute('data-spending-select')}))).toEqual(before);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }
});
