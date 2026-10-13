import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test.beforeEach(async({page})=>{
 if(process.env.ASSET_OS_QA_SDK_PATH){const body=await readFile(process.env.ASSET_OS_QA_SDK_PATH);await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4',route=>route.fulfill({body,contentType:'text/javascript'}))}
});

const app='/index.html?qa=1#/home';
const appErrors=[];
const preparePage=async page=>{
 appErrors.length=0;
 page.on('pageerror',error=>appErrors.push(String(error)));
 page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('browser metadata'))appErrors.push(message.text())});
};
const expectNoHorizontalOverflow=async page=>{
 const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
 expect(size.scroll).toBeLessThanOrEqual(size.client+1);
};

test('@smoke isolated QA shell opens without production sync',async({page})=>{
 await preparePage(page);
 await page.goto(app);
 await expect(page.getByRole('heading',{name:'홈',exact:true})).toBeVisible();
 await expect(page.getByText('QA 전용 · 운영 데이터 분리')).toBeVisible();
 await page.getByRole('button',{name:'내 Asset OS 열기'}).click();
 await expect(page.getByText('QA 로컬 전용 · 동기화 차단')).toBeVisible();
 await expectNoHorizontalOverflow(page);
 expect(appErrors).toEqual([]);
});

test('@core long data survives reload and every primary route renders',async({page})=>{
 await preparePage(page);
 await page.goto(app);
 await page.getByRole('button',{name:'35년 생성'}).click();
 const dialog=page.getByRole('dialog',{name:'QA 35년 실사용 데이터 생성'});
 await dialog.getByRole('button',{name:'생성'}).click();
 await expect(page.getByText(/2026-2060 · 7,740건/)).toBeVisible({timeout:30_000});
 await expect(page.getByRole('button',{name:/총금융자산/})).toContainText('13억 4,294만원');
 await expect(page.locator('[data-home-growth]')).toBeVisible();await page.locator('[data-home-growth]').click();await expect(page.locator('#financialGrowthChart')).toBeVisible();await page.evaluate(()=>closeSheets({all:true}));await page.waitForFunction(()=>!sheetBackTimer&&!suppressSheetPop);
 const nav=page.getByRole('navigation',{name:'주요 메뉴'});
 for(const route of [
  {name:'ISA',heading:'ISA',hash:'#/isa/summary'},
  {name:'개인연금',heading:'개인연금',hash:'#/pension/summary'},
  {name:'통합',heading:'통합',hash:'#/integrated/summary'},
  {name:'홈',heading:'홈',hash:'#/home'}
 ]){
  await nav.getByRole('button',{name:route.name,exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`${route.hash.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`));
  await expect(page.locator('header h1')).toHaveText(route.heading);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({path:`/tmp/asset-native-populated-${route.name}-${test.info().project.name}.png`});
 }
 await page.reload();
 await expect(page.getByText(/2026-2060 · 7,740건/)).toBeVisible({timeout:15_000});
 expect(appErrors).toEqual([]);
});

test('@core @release authentication gate exposes only safe conflict actions',async({page})=>{
 await page.goto('/index.html');
 await expect(page.getByRole('button',{name:'Google로 로그인'})).toBeVisible();
 const labels=await page.locator('#assetAuthConflict button').allTextContents();
 expect(labels).toEqual(['클라우드 최신본 불러오기','이 기기 백업 후 덮어쓰기']);
 await expect(page.locator('#assetAuthConflict')).toBeHidden();
});

test('@core finance interest and backup health work through their real sheets',async({page})=>{
 await preparePage(page);
 await page.goto(app);
 await page.evaluate(()=>{
  const next=window.__assetOS.getState(),id='e2e-deposit',accountId=`finance-asset-${id}`;
  next.financialProducts=next.financialProducts||{items:[],events:[]};
  next.financialProducts.items=next.financialProducts.items.filter(product=>product.id!==id);
  next.financialProducts.events=next.financialProducts.events.filter(event=>event.productId!==id);
  next.financialProducts.items.push({id,type:'deposit',name:'E2E 정기예금',institution:'테스트은행',status:'active',startDate:'2060-01-01',maturityDate:'2060-12-31',annualRate:3.5,rateType:'fixed',interestMethod:'simple',taxMode:'general',taxRate:15.4,rateHistory:[{effectiveFrom:'2060-01-01',rate:3.5}]});
  next.integrated.accounts=next.integrated.accounts.filter(account=>account.id!==accountId);
  next.integrated.accounts.push({id:accountId,kind:'deposit',name:'E2E 정기예금',productId:id});
  next.integrated.ledger=next.integrated.ledger.filter(row=>row.productId!==id);
  next.integrated.ledger.push({id:'e2e-opening',date:'2060-01-01',type:'openingAsset',amount:1000000,toAccountId:accountId,productId:id});
  next.settings.backupV04={...(next.settings.backupV04||{}),phoneEnabled:true,lastPhoneBackupAt:new Date(Date.now()-10*86400000).toISOString()};
  window.__assetOS.replaceState(next);
 });
 await page.evaluate(()=>openFinancialProductDetail('e2e-deposit'));
 await page.getByRole('button',{name:'이자 입금'}).click();
 await page.locator('#financeInterestCreditForm input[name="date"]').fill('2060-12-30');
 await page.locator('#financeInterestCreditForm input[name="amount"]').fill('1234');
 await page.getByRole('button',{name:'이자 저장'}).click();
 await expect(page.getByText('최근 확인 이자')).toBeVisible();
 const recorded=await page.evaluate(()=>{
  const current=window.__assetOS.getState();
  return{ledger:current.integrated.ledger.some(row=>row.productId==='e2e-deposit'&&row.meta?.financeInterest&&row.amount===1234),event:current.financialProducts.events.some(event=>event.productId==='e2e-deposit'&&event.type==='interestObserved'&&event.amount===1234)};
 });
 expect(recorded).toEqual({ledger:true,event:true});
 await page.evaluate(()=>openBackupHub());
 await expect(page.locator('#sheetBody').getByText('백업 오래됨',{exact:true})).toBeVisible();
 expect(appErrors).toEqual([]);
});

test('@core integrated input rejects unsafe amounts and saves a valid transaction',async({page})=>{
 await preparePage(page);
 await page.goto(app);
 const before=await page.evaluate(()=>window.__assetOS.getState().integrated.ledger.length);
 await page.evaluate(()=>openIntegratedTransactionForm());
 const form=page.locator('#integratedTxForm');
 await expect(form).toBeVisible();
 await form.locator('input[name="amount"]').fill('999999999999999999');
 await form.locator('.integrated-form-save').click();
 await expect(form.locator('[data-form-error]')).toBeVisible();
 expect(await page.evaluate(()=>window.__assetOS.getState().integrated.ledger.length)).toBe(before);
 await form.locator('input[name="amount"]').fill('100000');
 // Respect the application's existing 500 ms duplicate-submit guard.
 await expect.poll(()=>form.evaluate(node=>Date.now()-Number(node.dataset.lastSubmitAt||0))).toBeGreaterThanOrEqual(500);
 await form.locator('.integrated-form-save').click();
 await expect(page.locator('#formSheet')).toHaveAttribute('aria-hidden','true');
 const added=await page.evaluate(count=>window.__assetOS.getState().integrated.ledger.slice(count).map(row=>({type:row.type,amount:row.amount})),before);
 expect(added).toEqual([{type:'externalIncome',amount:100000}]);
 expect(appErrors).toEqual([]);
});

test('@core ISA and pension interest save through typed form controls',async({page})=>{
 await preparePage(page);
 await page.goto(app);
 await page.evaluate(()=>{
  const next=window.__assetOS.getState();
  next.accounts=[{id:'e2e-input-isa',name:'입력 테스트 ISA',status:'active',openedAt:'2026-01-01',baselineDate:'2026-01-01',baselineCash:0,holdings:[],transactions:[],reconciliations:[]}];
  next.settings.selectedAccountId='e2e-input-isa';
  next.pension.accounts=[{id:'e2e-input-pension',name:'입력 테스트 연금',kind:'pension',status:'active',openedAt:'2026-01-01'}];
  next.pension.holdings=[];next.pension.transactions=[];
  window.__assetOS.replaceState(next);
  openTransactionForm('interest');
 });
 const isaForm=page.locator('#txForm');
 await isaForm.locator('[name="tradeDate"]').fill('2026-10-01');
 await isaForm.locator('[name="amount"]').fill('1000');
 await isaForm.locator('button[type="submit"],button:not([type])').first().click();
 await expect(page.locator('#formSheet')).toHaveAttribute('aria-hidden','true');
 expect(await page.evaluate(()=>window.__assetOS.getState().accounts[0].transactions.map(row=>({type:row.type,amount:row.amount})))).toEqual([{type:'interest',amount:1000}]);
 await page.evaluate(()=>openPensionTradeForm('','transactions','e2e-input-pension'));
 const pensionForm=page.locator('#pensionTradeForm');
 await pensionForm.locator('[name="type"]').selectOption('interest');
 await pensionForm.locator('[name="date"]').fill('2026-10-01');
 await pensionForm.locator('[name="amount"]').fill('2000');
 await pensionForm.locator('button:not([type])').click();
 await expect(page.locator('#formSheet')).toHaveAttribute('aria-hidden','true');
 expect(await page.evaluate(()=>window.__assetOS.getState().pension.transactions.map(row=>({type:row.type,amount:row.amount})))).toEqual([{type:'interest',amount:2000}]);
 expect(appErrors).toEqual([]);
});


test('@core AI form presets produce a scoped zero-funding rebalance download',async({page})=>{
 await preparePage(page);
 await page.goto(app);
 await page.evaluate(()=>{
  const next=window.__assetOS.getState();
  next.accounts=[];
  next.settings.aiStrategy={purpose:'buy',fundingSource:'new_money',amount:0,includedScopes:['isa']};
  window.__assetOS.replaceState(next);
  openAiStrategy();
 });
 const form=page.locator('#aiStrategyForm');
 await form.locator('[data-ai-amount="1000000"]').click();
 await expect(form.locator('[name="amount"]')).toHaveValue('1000000');
 await form.locator('[data-ai-purpose="rebalance"]').click();
 await expect(form.locator('[name="amount"]')).toHaveAttribute('placeholder','0원도 가능');
 await form.locator('[name="amount"]').fill('0');
 await form.getByRole('button',{name:'분석파일 만들기'}).click();
 await expect(page.locator('.ai-review-summary')).toContainText('리밸런싱');
 const pendingDownload=page.waitForEvent('download');
 await page.locator('[data-ai-download]').click();
 const download=await pendingDownload;
 expect(download.suggestedFilename()).toBe('투자분석.txt');
 const exported=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(exported.request.purpose).toBe('리밸런싱');
 expect(exported.request.additionalInvestmentWon).toBe(0);
 expect(exported.request.includedScopes).toEqual(['isa']);
 expect(exported.dataQuality).toEqual({ready:true,blockers:[]});
 expect(appErrors).toEqual([]);
});

test('@core secure mobile backup downloads a restorable ZIP when file pickers are unavailable',async({page})=>{
 await preparePage(page);
 await page.goto(app);
 await page.evaluate(()=>{
  Object.defineProperty(window,'showSaveFilePicker',{configurable:true,value:undefined});
  Object.defineProperty(window,'showDirectoryPicker',{configurable:true,value:undefined});
  const next=window.__assetOS.getState();
  next.settings.haptics=false;
  window.__assetOS.replaceState(next);
  openBackupHub();
 });
 expect(await page.evaluate(()=>window.isSecureContext)).toBe(true);
 await expect(page.locator('[data-backup-zip]')).toContainText('ZIP 백업 · 다운로드');
 const pending=page.waitForEvent('download');
 await page.locator('[data-backup-zip]').click();
 const download=await pending;
 expect(download.suggestedFilename()).toMatch(/^AssetOS_QA_.*\.zip$/);
 await expect(page.getByText('ZIP 다운로드를 시작했습니다.',{exact:true})).toBeVisible();
 await expect(page.getByText(/이 브라우저는 저장 위치 선택을 지원하지 않아/)).toBeVisible();
 const bytes=Array.from(await readFile(await download.path()));
 const restored=await page.evaluate(bytes=>{
  const payload=parseBackupZipBytes(new Uint8Array(bytes));
  return{format:payload.format,schema:payload.schemaVersion,environment:payload.environment,haptics:payload.data.settings.haptics};
 },bytes);
 expect(restored).toEqual({format:'asset-os-backup-v1',schema:21,environment:'qa',haptics:false});
 expect(appErrors).toEqual([]);
});

test('@core Drive backup shares TXT, respects cancellation, and downloads ZIP after permission denial',async({page})=>{
 await preparePage(page);
 await page.goto(app);
 let downloads=0;
 page.on('download',()=>downloads++);
 for(const outcome of ['success','AbortError','NotAllowedError']){
  await page.evaluate(outcome=>{
   Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
   Object.defineProperty(navigator,'share',{configurable:true,value:async({files})=>{
    if(outcome!=='success')throw new DOMException('QA simulated browser response',outcome);
    window.__qaSharedBackup={name:files[0].name,type:files[0].type,payload:JSON.parse(await files[0].text())};
   }});
   openBackupHub();
  },outcome);
  await page.getByText('고급 백업 설정',{exact:true}).click();
  if(outcome==='NotAllowedError'){
   const pending=page.waitForEvent('download');
   await page.locator('[data-backup-drive]').click();
   const download=await pending;
   expect(download.suggestedFilename()).toMatch(/\.zip$/);
   await expect(page.getByText('공유 대신 ZIP을 저장했습니다.',{exact:true})).toBeVisible();
  }else{
   await page.locator('[data-backup-drive]').click();
   if(outcome==='success'){
    await expect(page.getByText('공유창으로 백업을 보냈습니다.',{exact:true})).toBeVisible();
    const shared=await page.evaluate(()=>window.__qaSharedBackup);
    expect(shared.name).toMatch(/^AssetOS_QA_.*\.txt$/);
    expect(shared.type).toBe('text/plain');
    expect(shared.payload.format).toBe('asset-os-backup-v1');
    expect(shared.payload.environment).toBe('qa');
   }else{
    expect(await page.locator('[role="dialog"]:visible').count()).toBe(0);
   }
   expect(downloads).toBe(0);
  }
 }
 expect(downloads).toBe(1);
 expect(appErrors).toEqual([]);
});

test('@core haptic settings control vibration and unsupported browsers remain usable',async({page})=>{
 await preparePage(page);
 await page.goto(app);
 const calls=await page.evaluate(()=>{
  const patterns=[];
  Object.defineProperty(navigator,'vibrate',{configurable:true,value:pattern=>{patterns.push(pattern);return true}});
  setting().haptics=false;
  haptic('success');
  setting().haptics=true;
  haptic();haptic('success');haptic('warning');
  Object.defineProperty(navigator,'vibrate',{configurable:true,value:()=>{throw new DOMException('QA denied','NotAllowedError')}});
  haptic('success');
  Object.defineProperty(navigator,'vibrate',{configurable:true,value:undefined});
  haptic('warning');
  return patterns;
 });
 expect(calls).toEqual([[8],[10,25,14],[18,40,18]]);
 await expect(page.getByRole('heading',{name:'홈',exact:true})).toBeVisible();
 expect(appErrors).toEqual([]);
});

test('@core AI sharing uses pension cash after a balance discrepancy without blocking a funded request',async({page})=>{
 await preparePage(page);
 await page.goto(app);
 await page.evaluate(()=>{
  const next=window.__assetOS.getState();
  next.accounts=[];
  next.pension.accounts=[{id:'e2e-ai-pension',name:'QA 연금',kind:'pension',status:'active',openedAt:'2026-01-01'}];
  next.pension.holdings=[];next.pension.transactions=[];
  next.brokerKis={};
  next.settings.aiStrategy={purpose:'buy',fundingSource:'account_cash',amount:100000,includedScopes:['pension']};
  window.__assetOS.replaceState(next);
  const result=window.__assetOS.brokerKis.importBalance({cash:1000000,cashDetail:{depositCash:1000000,settledCash:1000000,availableCash:1000000},securitiesValue:2000000,totalValue:2690284,holdings:[{productCode:'005930',productName:'QA 종목',quantity:100,avgPrice:20000,currentPrice:20000,marketValue:2000000}]},'pension','e2e-ai-pension',new Date().toISOString());
  if(!result.ok)throw new Error(JSON.stringify(result));
  Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
  Object.defineProperty(navigator,'share',{configurable:true,value:async({files})=>{window.__qaAiShare=JSON.parse(await files[0].text())}});
  openAiStrategy();
 });
 await page.locator('#aiStrategyForm').getByRole('button',{name:'분석파일 만들기'}).click();
 await page.locator('[data-ai-share]').click();
 await expect(page.getByText('투자분석 자료를 공유했습니다.',{exact:true})).toBeVisible();
 const exported=await page.evaluate(()=>window.__qaAiShare);
 const summary=exported.pensionSavings.accounts[0].summary;
 expect(summary.componentDelta).toBe(-309716);
 expect(summary.reportedAvailableCash).toBe(1000000);
 expect(summary.availableCash).toBe(690284);
 expect(exported.dataQuality).toEqual({ready:true,blockers:[]});
 await expect(page.locator('#confirmDialog')).toBeHidden();
 expect(appErrors).toEqual([]);
});

test('@core quick entry saves continuously, remembers fields, copies safely and persists favorites',async({page})=>{
 await preparePage(page);await page.goto(app);
 await page.evaluate(()=>openIntegratedTransactionForm());
 let form=page.locator('#integratedTxForm');
 await form.locator('[name="amount"]').fill('250000');
 await form.locator('[name="category"]').fill('입력 QA 급여');
 await form.locator('.entry-extra summary').click();await form.locator('[name="note"]').fill('즐겨찾기 메모');await form.locator('[name="saveFavorite"]').check();
 await form.getByRole('button',{name:'저장하고 계속',exact:true}).click();
 await expect(form).toBeVisible();await expect(form.locator('[name="amount"]')).toHaveValue('');
 await expect(form.locator('[name="category"]')).toHaveValue('입력 QA 급여');
 await expect(form.locator('[name="note"]')).toHaveValue('');
 await form.locator('.entry-library summary').click();await expect(form.locator('[data-entry-preset="favorite:0"]')).toBeVisible();
 await form.locator('[name="amount"]').fill('75000');await form.locator('.integrated-form-save').click();
 await expect(page.locator('#formSheet')).toHaveAttribute('aria-hidden','true');
 const first=await page.evaluate(()=>window.__assetOS.getState().integrated.ledger.find(row=>row.category==='입력 QA 급여'));
 await page.evaluate(id=>openIntegratedTransactionDetail(id),first.id);await page.getByRole('button',{name:'이 기록 복사',exact:true}).click();
 await expect(form.locator('[name="amount"]')).toHaveValue('250000');expect(await form.getAttribute('data-edit-id')).toBe('');
 await form.locator('[name="amount"]').fill('2000');await form.locator('.integrated-form-save').click();
 const rows=await page.evaluate(()=>window.__assetOS.getState().integrated.ledger.filter(row=>row.category==='입력 QA 급여'));
 expect(rows.map(row=>row.amount)).toEqual([250000,75000,2000]);expect(new Set(rows.map(row=>row.id)).size).toBe(3);
 await page.reload();await page.evaluate(()=>openIntegratedTransactionForm());
 await form.locator('.entry-library summary').click();await expect(form.locator('[data-entry-preset="favorite:0"]')).toBeVisible();await form.locator('[data-entry-preset="favorite:0"]').click();
 await expect(form.locator('[name="amount"]')).toHaveValue('250000');await expect(form.locator('[name="note"]')).toHaveValue('즐겨찾기 메모');
 await expectNoHorizontalOverflow(page);
 await page.screenshot({path:`/tmp/asset-input-${test.info().project.name}.png`});
 expect(await page.evaluate(()=>document.fonts.check('16px Pretendard'))).toBe(true);
 expect(appErrors).toEqual([]);
});

test('@core native integrated summary opens presets and card installments without silent writes',async({page})=>{
 await preparePage(page);await page.goto(app);
 await page.evaluate(()=>{
  const next=window.__assetOS.getState();next.financialProducts={items:[],events:[]};next.financeSchedules={items:[]};next.integrated.liabilities=[];
  next.integrated.ledger=[{id:'native-cash',date:'2026-01-01',type:'openingAsset',toAccountId:'cash-main',amount:10000000}];
  next.settings.integratedMonth='2026-02';next.settings.integratedEntryFavorites=[{uiType:'lifeExpense',category:'식비',amount:25000}];
  window.__assetOS.replaceState(next);createCardInstallment({name:'TV · 국민카드',purchaseAmount:3100000,months:24,purchaseDate:'2026-01-10',firstPaymentDate:'2026-02-25',interestMode:'free'});
  financeSchedules().push({id:'native-income',name:'예정 급여',kind:'income',amount:3000000,day:15,startDate:'2026-01-01',active:true});nav('integrated','summary');
 });
 await expect(page.locator('.nav.active')).toHaveText('통합');
 await expect(page.locator('.fixed-cost-head-right b')).toHaveText('129,166원');
 await expect(page.locator('.fixed-cost-preview')).toContainText('TV · 국민카드');
 await page.screenshot({path:`/tmp/asset-native-summary-${test.info().project.name}.png`});
 const before=await page.evaluate(()=>window.__assetOS.getState().integrated.ledger.length);
 await page.locator('[data-summary-entry]').first().click();
 const form=page.locator('#integratedTxForm');await expect(form.locator('[name="amount"]')).toHaveValue('25000');
 expect(await page.evaluate(()=>window.__assetOS.getState().integrated.ledger.length)).toBe(before);
 await form.locator('[data-entry-category="교통"]').click();await expect(form.locator('[name="category"]')).toHaveValue('교통');
 await page.screenshot({path:`/tmp/asset-native-input-${test.info().project.name}.png`});
 await form.locator('.integrated-form-save').click();
 expect(await page.evaluate(()=>window.__assetOS.getState().integrated.ledger.length)).toBe(before+1);
 await page.reload();await expect(page.locator('.nav.active')).toHaveText('통합');await page.locator('[data-integrated-tab="summary"]').click();
 await page.locator('[data-card-hub]').click();await page.locator('[data-card-plan-open]').click();
 await expect(page.locator('.card-detail-summary')).toContainText('3,100,000원');
 await expect(page.locator('.card-detail-list')).toContainText('24회 보기');
 await page.screenshot({path:`/tmp/asset-native-card-${test.info().project.name}.png`});
 await page.locator('.card-payment-primary').click();await expect(page.locator('.schedule-detail-list')).toContainText('TV · 국민카드');
 await page.evaluate(()=>closeSheets({all:true}));
 for(const root of ['home','isa','pension']){await page.evaluate(root=>nav(root,'summary'),root);await expectNoHorizontalOverflow(page);await page.screenshot({path:`/tmp/asset-native-${root}-${test.info().project.name}.png`})}
 await page.setViewportSize({width:320,height:800});await page.evaluate(()=>nav('integrated','summary'));await expectNoHorizontalOverflow(page);
 await page.evaluate(()=>{setting().theme='dark';applyTheme()});await expectNoHorizontalOverflow(page);
 const colors=await page.locator('.integrated-overview-head').evaluate(el=>({foreground:getComputedStyle(el).color,background:getComputedStyle(el.closest('.integrated-overview-hero')).backgroundColor}));expect(colors.foreground).not.toBe(colors.background);
 await page.screenshot({path:`/tmp/asset-native-dark-${test.info().project.name}.png`});
 await page.evaluate(()=>document.fonts.ready);expect(await page.evaluate(()=>document.fonts.check('16px Pretendard'))).toBe(true);
 expect(appErrors).toEqual([]);
});

test('@core @release schedule and card sheets connect purchase, payment correction and recurrence scope',async({page})=>{
 await preparePage(page);await page.goto(app);
 await page.evaluate(()=>{const next=window.__assetOS.getState();next.financialProducts={items:[],events:[]};next.financeSchedules={items:[]};next.integrated.liabilities=[];next.integrated.ledger=[{id:'card-cash',date:'2026-01-01',type:'openingAsset',toAccountId:'cash-main',amount:10000000}];next.settings.integratedMonth='2026-02';window.__assetOS.replaceState(next);nav('integrated','schedule')});
 await page.getByRole('button',{name:'＋ 구매 기록',exact:true}).click();
 const card=page.locator('#cardInstallmentForm');await card.locator('[name="name"]').fill('TV · 국민카드');await card.locator('[name="purchaseAmount"]').fill('1200000');await card.locator('[name="purchaseDate"]').fill('2026-01-10');await card.locator('[name="firstPaymentDate"]').fill('2026-02-25');await card.locator('[name="months"]').selectOption('12');await card.locator('[name="interestMode"]').selectOption('paid');await card.locator('[name="annualRate"]').fill('12');await card.getByRole('button',{name:'구매 기록 저장'}).click();
 await expect(page.locator('.card-plan-values')).toContainText('1,200,000원');await expect(page.locator('.card-plan-values')).toContainText('112,000원');
 const id=await page.evaluate(()=>window.__assetOS.getState().financeSchedules.items.find(s=>s.cardPlan).id);
 await page.locator(`.schedule-list [data-fixed-cost-item="${id}"]`).click();await page.locator('[data-schedule-loan-principal]').fill('100000');await page.locator('[data-schedule-loan-interest]').fill('12345');await page.locator('[data-schedule-complete]').click();
 await expect(page.locator('[data-schedule-actual-edit]')).toBeVisible();await page.getByRole('button',{name:'실제 납부 수정',exact:true}).click();
 let form=page.locator('#scheduleAmountForm');await form.locator('[name="interest"]').fill('13000');await form.getByRole('button',{name:'수정 저장'}).click();await expect(page.locator('.schedule-primary-amount')).toContainText('113,000원');
 await page.getByRole('button',{name:'예정금액 수정',exact:true}).click();form=page.locator('#scheduleAmountForm');await form.locator('[name="amount"]').fill('125000');await form.locator('[name="scope"]').selectOption('once');await form.getByRole('button',{name:'수정 저장'}).click();
 expect(await page.evaluate(id=>schedulePlannedAmount(financeSchedules().find(s=>s.id===id),'2026-03-25'),id)).toBe(111000);
 await page.getByRole('button',{name:'예정금액 수정',exact:true}).click();await form.locator('[name="amount"]').fill('126000');await form.locator('[name="scope"]').selectOption('future');await form.getByRole('button',{name:'수정 저장'}).click();
 expect(await page.evaluate(id=>schedulePlannedAmount(financeSchedules().find(s=>s.id===id),'2026-03-25'),id)).toBe(126000);
 await page.evaluate(()=>closeSheets({all:true}));await page.waitForFunction(()=>!sheetBackTimer&&!suppressSheetPop);await page.reload();await page.evaluate(()=>nav('integrated','schedule'));await expect(page.locator('.card-plan-values')).toContainText('1,100,000원');await expect(page.locator('.card-plan-row')).toContainText('113,000원');
 expect(await page.evaluate(()=>integratedSpendingAnalysis('2026-01').total)).toBe(1200000);expect(await page.evaluate(()=>integratedSpendingAnalysis('2026-02').total)).toBe(0);
 await expectNoHorizontalOverflow(page);expect(appErrors).toEqual([]);
});

test('@core unified app keeps alerts behind the header bell and preserves account detail actions',async({page})=>{
 await preparePage(page);await page.goto(app);
 await page.evaluate(()=>{
  const next=window.__assetOS.getState();next.accounts=[];next.pension.accounts=[];next.pension.holdings=[];next.pension.transactions=[];next.pension.contributions=[];
  next.financialProducts={items:[],events:[]};next.financeSchedules={items:[]};next.integrated.ledger=[];next.integrated.liabilities=[];next.brokerKis={connections:{}};next.settings.backupV04={...(next.settings.backupV04||{}),phoneEnabled:false};
  window.__assetOS.replaceState(next);nav('home');
 });
 await expect(page.locator('#alertBell')).toBeVisible();await expect(page.locator('#alertBadge')).toBeHidden();await expect(page.locator('#main .alerts')).toHaveCount(0);
 await page.locator('#alertBell').click();await expect(page.locator('#sheetBody')).toContainText('지금 처리할 중요 알림이 없습니다.');await expect(page.locator('#sheetBody [data-investment-refresh-all]')).toBeVisible();
 await page.evaluate(()=>closeSheets({all:true}));await page.waitForFunction(()=>!sheetBackTimer&&!suppressSheetPop);
 await page.evaluate(()=>{const today=localYmd();financeSchedules().push({id:'bell-schedule',name:'알림 연결 확인',kind:'expense',amount:123456,day:Number(today.slice(-2)),startDate:today,active:true});persist(false);render()});
 await expect(page.locator('#alertBadge')).toHaveText('1');await page.locator('#alertBell').click();await page.locator('#sheetBody [data-home-schedule]').click();await expect(page.locator('.schedule-detail-list')).toContainText('알림 연결 확인');
 expect(await page.evaluate(()=>integratedLedger().length)).toBe(0);
 await page.evaluate(()=>closeSheets({all:true}));await page.waitForFunction(()=>!sheetBackTimer&&!suppressSheetPop);
 await page.evaluate(()=>{financeSchedules().splice(0);setting().backupV04={...(setting().backupV04||{}),phoneEnabled:true,lastPhoneBackupAt:new Date(Date.now()-10*86400000).toISOString()};persist(false);render()});
 await expect(page.locator('#alertBadge')).toHaveText('1');await page.locator('#alertBell').click();await page.locator('#sheetBody [data-backup-alert]').click();await expect(page.locator('#sheetBody')).toContainText('백업');
 await page.evaluate(()=>closeSheets({all:true}));await page.waitForFunction(()=>!sheetBackTimer&&!suppressSheetPop);
 await page.evaluate(()=>{setting().backupV04.phoneEnabled=false;state.brokerKis.connections.pension.lastError='QA_SYNC_FAILED';render()});await expect(page.locator('#alertBadge')).toHaveText('1');await page.locator('#alertBell').click();await expect(page.locator('#sheetBody [data-investment-refresh-failed]')).toBeVisible();
 await page.evaluate(()=>closeSheets({all:true}));await page.waitForFunction(()=>!sheetBackTimer&&!suppressSheetPop);
 await page.evaluate(()=>{const next=window.__assetOS.getState();next.accounts=[{id:'bell-isa',name:'알림 QA ISA',status:'active',openedAt:'2026-01-01',maturityAt:'2029-01-01',baselineDate:'2026-01-01',baselineCash:3189892,holdings:[],transactions:[],reconciliations:[]}];next.settings.selectedAccountId='bell-isa';window.__assetOS.replaceState(next);nav('home')});
 await page.locator('.home-account-list [data-route="isa"]').click();await expect(page.locator('.isa-summary-facts')).toContainText('평가손익');await expect(page.locator('.isa-summary-facts')).toContainText('계좌 현금');await page.locator('.native-isa-entry [data-new-tx]').click();await expect(page.locator('#actionSheet')).toHaveAttribute('aria-hidden','false');await page.locator('#actionGrid [data-t="interest"]').click();await expect(page.locator('#formSheet')).toHaveAttribute('aria-hidden','false');await page.evaluate(()=>closeSheets({all:true}));await page.waitForFunction(()=>!sheetBackTimer&&!suppressSheetPop);await page.locator('.isa-account-tools > summary').click();await page.locator('.isa-account-tools [data-register]').click();await expect(page.locator('#registerSheet')).toHaveAttribute('aria-hidden','false');await page.evaluate(()=>closeSheets({all:true}));await page.waitForFunction(()=>!sheetBackTimer&&!suppressSheetPop);await page.locator('[data-isa-asset-analysis]').click();await expect(page.locator('#detailSheet')).toHaveClass(/open/);
 await page.evaluate(()=>closeSheets({all:true}));await page.waitForFunction(()=>!sheetBackTimer&&!suppressSheetPop);
 await page.evaluate(()=>nav('pension','contribution'));await expect(page.locator('.pension-goal .pension-credit-facts')).toContainText('예상 세액공제');await expect(page.locator('.stack > .pension-credit-facts')).toHaveCount(0);await page.locator('.pension-credit-estimate').click();await expect(page.locator('#pensionTaxProfileForm')).toBeVisible();await page.evaluate(()=>closeSheets({all:true}));await page.waitForFunction(()=>!sheetBackTimer&&!suppressSheetPop);await page.locator('[data-pension-goal-toggle]').click();await expect(page.locator('.pension-goal-detail')).toBeVisible();await page.locator('[data-pension-contribution-batch]').click();await expect(page.locator('#formSheet')).toHaveAttribute('aria-hidden','false');await page.evaluate(()=>closeSheets({all:true}));await page.waitForFunction(()=>!sheetBackTimer&&!suppressSheetPop);
 await page.setViewportSize({width:320,height:800});
 for(const theme of ['light','dark'])for(const accent of ['blue','mint','purple','orange'])for(const root of ['home','isa','pension','integrated']){await page.evaluate(({theme,accent,root})=>{setting().theme=theme;setting().accent=accent;nav(root,'summary')},{theme,accent,root});await expect(page.locator('header h1')).toHaveText(({home:'홈',isa:'ISA',pension:'개인연금',integrated:'통합'})[root]);await expectNoHorizontalOverflow(page)}
 await page.reload();await expect(page.locator('#alertBell')).toBeVisible();expect(appErrors).toEqual([]);
});

test('@core settings preserve preferences and haptic opt-out across reload',async({page})=>{
 await preparePage(page);
 await page.addInitScript(()=>{window.__qaVibrations=[];Object.defineProperty(navigator,'vibrate',{configurable:true,value:pattern=>{window.__qaVibrations.push(pattern);return true}})});
 await page.goto(app);
 await page.getByRole('button',{name:'내 Asset OS 열기'}).click();
 await page.locator('[data-profile-action="appearance"]').click();
 await expect(page.locator('#appearanceSheet')).toHaveAttribute('aria-hidden','false');
 await page.getByRole('checkbox',{name:'터치 진동',exact:true}).check();
 await page.waitForTimeout(100);
 await page.evaluate(()=>{window.__qaVibrations=[]});
 await page.getByRole('button',{name:'민트',exact:true}).click();
 expect(await page.evaluate(()=>window.__qaVibrations.length)).toBe(1);
 await page.getByRole('checkbox',{name:'터치 진동',exact:true}).uncheck();
 await page.waitForTimeout(100);
 await page.evaluate(()=>{window.__qaVibrations=[]});
 await page.getByRole('button',{name:'퍼플',exact:true}).click();
 expect(await page.evaluate(()=>window.__qaVibrations)).toEqual([]);
 await page.getByRole('checkbox',{name:'다크모드',exact:true}).check();
 await page.reload();
 await page.getByRole('button',{name:'내 Asset OS 열기'}).click();
 await page.locator('[data-profile-action="appearance"]').click();
 await expect(page.getByRole('checkbox',{name:'터치 진동',exact:true})).not.toBeChecked();
 await expect(page.getByRole('checkbox',{name:'다크모드',exact:true})).toBeChecked();
 await expect(page.getByRole('button',{name:'퍼플',exact:true})).toHaveClass(/active/);
 await page.setViewportSize({width:320,height:740});
 await expectNoHorizontalOverflow(page);
 await expect(page.locator('#toast')).toHaveAttribute('role','status');
 expect(appErrors).toEqual([]);
});

test('@core pension plan stays open when saving fails',async({page})=>{
 await preparePage(page);
 await page.goto(app);
 await page.evaluate(()=>openPensionSettings());
 const sheet=page.locator('#detailSheet');
 await expect(sheet).toHaveAttribute('aria-hidden','false');
 await sheet.locator('[name="birthYear"]').fill('1990');
 await sheet.locator('[name="retirementAge"]').fill('90');
 await sheet.locator('[name="monthlyContribution"]').fill('100000');
 await page.evaluate(()=>{window.__qaOriginalPersist=persist;persist=()=>false});
 await sheet.getByRole('button',{name:'기준 저장',exact:true}).click();
 await expect(sheet).toHaveAttribute('aria-hidden','false');
 await expect(page).toHaveURL(/#\/home$/);
 await page.waitForTimeout(550);
 await page.evaluate(()=>{persist=window.__qaOriginalPersist});
 await sheet.getByRole('button',{name:'기준 저장',exact:true}).click();
 await expect(sheet).toHaveAttribute('aria-hidden','true');
 await expect(page).toHaveURL(/#\/pension\/future$/);
 expect(appErrors).toEqual([]);
});

test('@core refresh result updates in the open alerts sheet and survives reload',async({page})=>{
 await preparePage(page);await page.goto(app);
 await page.evaluate(()=>{
  state.accounts=[];state.brokerKis.connections.pension.lastCompleteSyncAt='2026-10-13T03:00:00Z';state.brokerKis.connections.irp.lastCompleteSyncAt='2026-09-04T01:17:00Z';
  kisConnectedAccount=()=>({id:'refresh-test'});
  window.__qaRefreshCalls=[];
  refreshBrokerKisManually=async kinds=>{const kind=kinds[0];window.__qaRefreshCalls.push(kind);if(kind==='irp'&&window.__qaRefreshCalls.length<=2)return{ok:false,error:'QA_FAILED'};state.brokerKis.connections[kind].lastCompleteSyncAt=new Date().toISOString();state.brokerKis.connections[kind].lastError='';return{ok:true}};
  persist(false);render();openAlertsCenter();
 });
 await expect(page.locator('[data-refresh-result]')).toContainText('2026. 10. 13.');
 await page.locator('[data-investment-refresh-all]').click();
 await expect(page.locator('[data-refresh-result]')).toContainText('일부 실패');
 await expect(page.locator('[data-investment-refresh-failed]')).toBeEnabled();
 await expect(page.locator('#sheetBody')).not.toContainText('한곳에 모았습니다');
 await page.locator('[data-investment-refresh-failed]').click();
 await expect(page.locator('[data-refresh-result]')).toContainText('갱신 완료');
 expect(await page.evaluate(()=>window.__qaRefreshCalls)).toEqual(['pension','irp','irp']);
 await page.reload();await page.locator('#alertBell').click();
 await expect(page.locator('[data-refresh-result]')).toContainText('갱신 완료');
 await page.locator('.refresh-account-times summary').click();
 await expect(page.locator('.refresh-account-times')).toContainText('연금저축');
 await expectNoHorizontalOverflow(page);expect(appErrors).toEqual([]);
});

test('@core asset charts select recorded dates at the edges and through native date controls',async({page})=>{
 await preparePage(page);await page.goto(app);
 await page.evaluate(()=>{
  state.pension.assetSnapshots=[{date:'2060-09-04',pension:{cost:39000000,value:40000000},irp:{cost:0,value:0}},{date:'2060-10-13',pension:{cost:39338332,value:43434207},irp:{cost:0,value:0}}];
  setting().pensionAssetScope='all';openPensionAssetAnalysis();
 });
 const chart=page.locator('#sheetBody #pensionAnalysisChart');
 await chart.click({position:{x:3,y:4}});
 await expect(page.locator('#pensionAnalysisPointLabel')).toHaveText('2060-09-04 평가자산');
 await expect(page.locator('#pensionAnalysisValue')).toHaveText('40,000,000원');
 const seek=page.locator('[data-analysis-seek="pension"]');await seek.focus();await seek.press('End');
 await expect(page.locator('#pensionAnalysisPointLabel')).toHaveText('2060-10-13 평가자산');
 await page.locator('[data-pension-analysis-period="6m"]').click();
 await expect(page.locator('.pension-analysis-period-meta')).toContainText('2060-09-04 ~ 2060-10-13');
 const rect=await chart.boundingBox();const client=await page.context().newCDPSession(page);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width-3,y:rect.y+4}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:rect.x+3,y:rect.y+4}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect(page.locator('#pensionAnalysisPointLabel')).toHaveText('2060-09-04 평가자산');
 await page.evaluate(()=>{closeSheets({all:true});state.accounts=[{id:'chart-isa',name:'QA ISA',status:'active',openedAt:'2026-01-01',maturityAt:'2062-12-31',holdings:[],transactions:[],assetSnapshots:[{date:'2060-09-04',cost:1000000,value:900000},{date:'2060-10-13',cost:1000000,value:1100000}]}];setting().selectedAccountId='chart-isa';openIsaAssetAnalysis()});
 await page.locator('#isaAnalysisChart').click({position:{x:3,y:4}});
 await expect(page.locator('#isaAnalysisPointLabel')).toHaveText('2060-09-04 보유종목');
 await expect(page.locator('#isaAnalysisValue')).toHaveText('900,000원');
 await page.setViewportSize({width:320,height:800});await expectNoHorizontalOverflow(page);expect(appErrors).toEqual([]);
});

test('@core imported balance totals stay authoritative and unexplained differences open a comparison',async({page})=>{
 await preparePage(page);await page.goto(app);
 await page.evaluate(()=>{
  const next=window.__assetOS.getState();next.accounts=[];next.pension.accounts=[{id:'balance-ui',kind:'pension',name:'QA 연금저축',status:'active',openedAt:'2026-01-01'}];next.pension.holdings=[];next.pension.transactions=[];next.brokerKis={};next.settings.pensionAssetScope='pension';next.settings.backupV04={phoneEnabled:false};window.__assetOS.replaceState(next);
  window.__qaBalanceAt=new Date().toISOString();window.__assetOS.brokerKis.importBalance({cash:100000,cashDetail:{depositCash:100000,settledCash:100000,nextDayCash:100000,availableCash:100000},securitiesValue:200000,totalValue:264602,holdings:[{productCode:'CHECK',productName:'QA ETF',quantity:20,avgPrice:9000,currentPrice:10000,marketValue:200000}]},'pension','balance-ui',window.__qaBalanceAt);
  window.__qaRawBalance=JSON.stringify(state.brokerKis.balanceSnapshots);nav('pension','assets');
 });
 await expect(page.locator('.pension-asset-value')).toHaveText('264,602원');
 await page.locator('#alertBell').click();await page.locator('[data-pension-balance-check="balance-ui"]').click();
 await expect(page.locator('.balance-comparison')).toBeVisible();
 await expect(page.locator('.balance-comparison .sheetrow').filter({hasText:'조회 총액'}).first()).toContainText('264,602원');
 await expect(page.locator('.balance-comparison .sheetrow').filter({hasText:'구성 합계와 조회 총액 차이'})).toContainText('-35,398원');
 expect(await page.evaluate(()=>JSON.stringify(state.brokerKis.balanceSnapshots)===window.__qaRawBalance)).toBe(true);
 await page.evaluate(()=>closeSheets({all:true}));await page.waitForFunction(()=>!sheetBackTimer&&!suppressSheetPop);
 await page.evaluate(()=>{window.__assetOS.brokerKis.importBalance({cash:100000,cashDetail:{depositCash:100000,settledCash:64602,nextDayCash:64602,availableCash:64602},securitiesValue:200000,totalValue:264602,holdings:[{productCode:'CHECK',productName:'QA ETF',quantity:20,avgPrice:9000,currentPrice:10000,marketValue:200000}]},'pension','balance-ui',new Date(Date.parse(window.__qaBalanceAt)+1000).toISOString());render();openAlertsCenter()});
 await expect(page.locator('[data-pension-balance-check="balance-ui"]')).toHaveCount(0);
 expect(await page.evaluate(()=>pensionAccountView(pensionAccount('balance-ui')).cash)).toBe(64602);
 expect(await page.evaluate(()=>pensionAccountView(pensionAccount('balance-ui')).reportedCash)).toBe(100000);
 await expectNoHorizontalOverflow(page);expect(appErrors).toEqual([]);
});
