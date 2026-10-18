import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test.beforeEach(async({page})=>{if(process.env.ASSET_OS_QA_SDK_PATH){const body=await readFile(process.env.ASSET_OS_QA_SDK_PATH);await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4',route=>route.fulfill({body,contentType:'text/javascript'}))}});
test('@core selected months and insurance payment status stay explicit without changing money',async({page},info)=>{
 await page.goto('/index.html?qa=1#/home');await page.waitForFunction(()=>!!window.__assetOS);
 await page.evaluate(async ()=>{
  const next=window.__assetOS.getState();next.settings.integratedMonth='2026-02';
  next.insurance={policies:[
   {id:'paid',name:'납입을 마친 긴 이름의 테스트 보험 계약',company:'테스트',status:'active',paymentStyle:'monthly',premium:13124,contractDate:'2025-01-01',paymentEndDate:'2025-12-31',coverages:[]},
   {id:'paying',name:'현재 월납 보험',status:'active',paymentStyle:'monthly',premium:10000,contractDate:'2025-01-01',paymentEndDate:'2099-12-31',coverages:[]},
   {id:'lump',name:'일시납 보험',status:'active',paymentStyle:'lump',premium:50000,contractDate:'2025-01-01',paymentEndDate:'2025-01-01',coverages:[]}
  ]};(await window.__assetOS.replaceState(next));nav('integrated','summary');
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

test('@core today defaults ignore stale months and thirty schedules stay compact with direct card access',async({page},info)=>{
 await page.clock.setFixedTime(new Date('2026-10-17T03:00:00Z'));
 await page.goto('/index.html?qa=1#/home');await page.waitForFunction(()=>!!window.__assetOS);
 await page.evaluate(async ()=>{
  localYmd=(d)=>{const value=d||new Date();return value.getFullYear()+'-'+String(value.getMonth()+1).padStart(2,'0')+'-'+String(value.getDate()).padStart(2,'0')};
  const next=window.__assetOS.getState();next.settings.integratedMonth='2026-09';next.settings.integratedMonthViewedOn='2026-10-16';
  next.integrated.ledger=[{id:'cash',date:'2026-01-01',type:'openingAsset',amount:10000000,toAccountId:'cash-main'}];
  next.financeSchedules={items:Array.from({length:30},(_,i)=>({id:'many-'+i,name:'테스트 납부 일정 '+(i+1),kind:'expense',amount:1000,day:25,startDate:'2026-01-01',active:true}))};
  for(let i=0;i<10;i++)next.integrated.ledger.push({id:'paid-'+i,date:'2026-09-25',type:'expense',amount:1000,fromAccountId:'cash-main',category:'테스트 납부 일정 '+(i+1),meta:{scheduleId:'many-'+i,scheduleDate:'2026-09-25'}});
  (await window.__assetOS.replaceState(next));nav('integrated','summary');
 });
 await expect(page.locator('[data-integrated-month-select]')).toHaveValue('2026-10');
 await page.locator('[data-integrated-month-select]').fill('2026-09');await page.locator('[data-integrated-month-select]').dispatchEvent('change');
 await page.locator('[data-summary-entry]').first().click();await expect(page.locator('#entryDate')).toHaveValue('2026-10-17');
 await page.getByRole('button',{name:'입력창 닫기',exact:true}).click();
 await page.getByRole('main').getByRole('button',{name:'일정',exact:true}).click();
 await expect(page.locator('.schedule-pending-list .schedule-row')).toHaveCount(5);
 await expect(page.locator('.schedule-card .schedule-list .schedule-row:visible')).toHaveCount(5);
 await expect(page.locator('.schedule-pending-more summary')).toHaveText('미완료 15건 더 보기');
 await expect(page.locator('.schedule-completed summary')).toHaveText('완료 10건 보기');
 const ledger=await page.evaluate(()=>JSON.stringify(state.integrated.ledger));
 for(const width of [360,412])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:915});await page.evaluate(theme=>{setting().theme=theme;applyTheme()},theme);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
  await page.screenshot({path:`/tmp/asset-schedule-${info.project.name}-${width}-${theme}.png`,animations:'disabled'});
 }
 await page.locator('.schedule-pending-more summary').click();await expect(page.locator('.schedule-card .schedule-list .schedule-row:visible')).toHaveCount(20);
 await page.locator('.schedule-completed summary').click();await expect(page.locator('.schedule-card .schedule-list .schedule-row:visible')).toHaveCount(30);
 await page.locator('[data-card-hub]').click();await expect(page.locator('#detailSheet.open #integratedCardPlans')).toBeVisible();await expect(page.locator('#detailSheet.open [data-card-plan-new]')).toBeVisible();
 await page.goBack();await expect(page.locator('#detailSheet')).not.toHaveClass(/open/);
 await page.getByRole('button',{name:'이번 달로',exact:true}).click();await expect(page.locator('[data-integrated-month-select]')).toHaveValue('2026-10');
 expect(await page.evaluate(()=>JSON.stringify(state.integrated.ledger))).toBe(ledger);
 await page.clock.setFixedTime(new Date('2026-11-01T03:00:00Z'));await page.reload();
 await page.evaluate(()=>{localYmd=(d)=>{const v=d||new Date();return v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0')};render()});
 await expect(page.locator('[data-integrated-month-select]')).toHaveValue('2026-11');
});

test('@core final card installment remains saved and completed history survives reload',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-17T03:00:00Z'));await page.goto('/index.html?qa=1#/home');await page.waitForFunction(()=>!!window.__assetOS);
 const id=await page.evaluate(async ()=>{
  const next=window.__assetOS.getState();next.financialProducts={items:[],events:[]};next.financeSchedules={items:[]};next.integrated.liabilities=[];
  next.integrated.ledger=[{id:'cash',date:'2026-01-01',type:'openingAsset',amount:10000000,toAccountId:'cash-main'}];(await window.__assetOS.replaceState(next));
  const id=(await createCardInstallment({name:'완료 검증 TV',purchaseAmount:10001,months:2,purchaseDate:'2026-08-01',firstPaymentDate:'2026-08-31',interestMode:'free'}));
  const finish=renderScheduleCompletion;renderScheduleCompletion=()=>{};(await completeScheduleOccurrence(id,'2026-08-31',0,'','',5000,0));renderScheduleCompletion=finish;closeSheets({all:true});setting().integratedMonth='2026-09';(await persist(false));nav('integrated','schedule');return id;
 });
 await page.locator(`.schedule-list [data-fixed-cost-item="${id}"]`).click();
 await page.locator('[data-schedule-loan-principal]').fill('5001');await page.locator('[data-schedule-loan-interest]').fill('0');await page.locator('[data-schedule-complete]').click();
 await expect(page.locator('[data-schedule-actual-edit]')).toBeVisible();
 await page.evaluate(()=>closeSheets({all:true}));await page.waitForFunction(()=>!sheetBackTimer&&!suppressSheetPop);await page.reload();
 await page.locator('[data-card-hub]').click();
 await expect(page.locator('.card-completed summary')).toHaveText('납부 완료 1건 · 기록 보기');
 await page.locator('.card-completed summary').click();await page.locator(`[data-card-plan-open="${id}"]`).click();
 await expect(page.locator('.card-payment-complete')).toContainText('모든 회차 납부 완료');
 expect(await page.evaluate(()=>integratedReplay().totalDebt)).toBe(0);
 expect(await page.evaluate(()=>scheduleOccurrences('2026-10').filter(o=>o.schedule.cardPlan).length)).toBe(0);
 expect(await page.evaluate(()=>state.integrated.ledger.filter(t=>t.meta?.cardPurchase).length)).toBe(1);
});

test('@core card entry is centralized and partial interest persists with one full backup action',async({page},info)=>{
 await page.goto('/index.html?qa=1#/home');await page.waitForFunction(()=>!!window.__assetOS);
 await page.evaluate(async()=>{const next=window.__assetOS.getState();next.financeSchedules={items:[]};next.financialProducts={items:[],events:[]};next.integrated.liabilities=[];next.integrated.ledger=[];await window.__assetOS.replaceState(next);nav('integrated','schedule')});
 await expect(page.locator('main #integratedCardPlans')).toHaveCount(0);
 await expect(page.locator('[data-card-hub]')).toHaveCount(1);
 await page.locator('[data-card-hub]').click();await page.locator('[data-card-plan-new]').click();
 await page.locator('#cardInstallmentForm [name="name"]').fill('처음 3회 무이자');
 await page.locator('#cardInstallmentForm [name="purchaseAmount"]').fill('370000');
 await page.locator('#cardInstallmentForm [name="purchaseDate"]').fill('2026-01-01');
 await page.locator('#cardInstallmentForm [name="firstPaymentDate"]').fill('2026-01-31');
 await page.locator('#cardInstallmentForm [name="months"]').selectOption('6');
 await expect(page.locator('[data-card-rate]')).toBeHidden();await expect(page.locator('[data-card-free-months]')).toBeHidden();
 await page.locator('#cardInstallmentForm [name="interestMode"]').selectOption('paid');
 await expect(page.locator('[data-card-rate]')).toBeVisible();await expect(page.locator('[data-card-free-months]')).toBeHidden();
 await page.locator('#cardInstallmentForm [name="interestMode"]').selectOption('partial');
 await expect(page.locator('[data-card-free-months]')).toBeVisible();
 await page.locator('#cardInstallmentForm [name="annualRate"]').fill('12');
 await page.screenshot({path:`/tmp/asset-partial-form-${info.project.name}.png`,animations:'disabled'});
 await page.locator('#cardInstallmentForm [name="interestFreeMonths"]').fill('6');
 await page.locator('#cardInstallmentForm button[type="submit"]').click();
 expect(await page.evaluate(()=>financeSchedules().length)).toBe(0);
 await page.locator('#cardInstallmentForm [name="interestFreeMonths"]').fill('3');
 await page.evaluate(()=>{const commit=assetLocalDatabase.commit;assetLocalDatabase.commit=async(...args)=>{await new Promise(resolve=>{window.__releaseCardCommit=resolve});return commit(...args)}});
 await page.locator('#cardInstallmentForm button[type="submit"]').click();
 await page.waitForFunction(()=>typeof window.__releaseCardCommit==='function');
 await expect(page.locator('#formSheet')).toHaveClass(/open/);
 await expect(page.getByText('구매와 할부 일정을 저장했어요.',{exact:true})).toBeHidden();
 await page.evaluate(()=>window.__releaseCardCommit());
 await expect(page.getByText('구매와 할부 일정을 저장했어요.',{exact:true})).toBeVisible();
 await expect(page.locator('#formSheet')).not.toHaveClass(/open/);
 await page.reload();await page.waitForFunction(()=>!!window.__assetOS);
 const result=await page.evaluate(()=>{const s=financeSchedules().find(s=>s.cardPlan);return{count:financeSchedules().length,plan:s.cardPlan,free:cardInstallmentTerms(s,'2026-03-31').interest,paid:cardInstallmentTerms(s,'2026-04-30').interest}});
 expect(result.count).toBe(1);expect(result.plan.interestFreeMonths).toBe(3);expect(result.free).toBe(0);expect(result.paid).toBe(1850);
 await page.locator('[data-card-hub]').click();await page.locator('[data-card-plan-open]').click();
 await expect(page.locator('.card-detail-summary')).toContainText('처음 3회 무이자 · 이후 이자');
 await page.evaluate(()=>closeSheets({all:true}));await page.waitForFunction(()=>!sheetBackTimer&&!suppressSheetPop);
 await page.evaluate(()=>openBackupHub());
 await expect(page.locator('#sheetBody > .backup-grid > button')).toHaveCount(2);
 await expect(page.locator('[data-backup-zip]')).toBeVisible();await expect(page.locator('[data-backup-restore]')).toBeVisible();
 await expect(page.locator('[data-backup-csv]')).toBeHidden();await expect(page.locator('[data-initial-import]')).toBeHidden();
 await page.screenshot({path:`/tmp/asset-simple-backup-${info.project.name}.png`,animations:'disabled'});
 await page.getByText('고급 백업 설정',{exact:true}).click();await expect(page.locator('[data-backup-csv]')).toBeVisible();await expect(page.locator('[data-initial-import]')).toBeVisible();
});
