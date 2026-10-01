import {test,expect} from '@playwright/test';

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
 }
 await page.reload();
 await expect(page.getByText(/2026-2060 · 7,740건/)).toBeVisible({timeout:15_000});
 expect(appErrors).toEqual([]);
});

test('@release authentication gate exposes only safe conflict actions',async({page})=>{
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
 await form.locator('button[type="submit"]').click();
 await expect(form.locator('[data-form-error]')).toBeVisible();
 expect(await page.evaluate(()=>window.__assetOS.getState().integrated.ledger.length)).toBe(before);
 await form.locator('input[name="amount"]').fill('100000');
 // Respect the application's existing 500 ms duplicate-submit guard.
 await expect.poll(()=>form.evaluate(node=>Date.now()-Number(node.dataset.lastSubmitAt||0))).toBeGreaterThanOrEqual(500);
 await form.locator('button[type="submit"]').click();
 await expect(page.locator('#formSheet')).toHaveAttribute('aria-hidden','true');
 const added=await page.evaluate(count=>window.__assetOS.getState().integrated.ledger.slice(count).map(row=>({type:row.type,amount:row.amount})),before);
 expect(added).toEqual([{type:'externalIncome',amount:100000}]);
 expect(appErrors).toEqual([]);
});
