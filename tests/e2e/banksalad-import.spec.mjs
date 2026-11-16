import {test,expect} from '@playwright/test';
import {banksaladWorkbook} from '../support/banksalad-workbook.mjs';

const source=[
 ['2026-11-01','12:00:00','지출','생활','식비','테스트 주문',-10000,'KRW','토스 간편결제',''],
 ['2026-11-01','12:01:00','지출','생활','식비','테스트 주문',2000,'KRW','토스 간편결제',''],
 ['2026-11-02','18:48:55','이체','카드대금','미분류','삼성카드',-7000,'KRW','신한 통장',''],
];
async function ready(page){
 await page.clock.setFixedTime(new Date('2026-11-11T03:00:00Z'));
 await page.goto('/index.html?qa=1#/home');
 await page.waitForFunction(()=>!!window.__assetOS);
 return page.evaluate(async()=>{
  const next=window.__assetOS.getState();
  next.integrated.ledger=[{id:'cash-opening',date:'2026-10-01',type:'openingAsset',amount:50000,toAccountId:'cash-main'}];
  next.integrated.liabilities=[];next.financeSchedules={items:[]};
  await window.__assetOS.replaceState(next);
  const cardId=await saveCardAccount({name:'QA 삼성카드',issuer:'삼성카드',paymentDay:25});
  nav('integrated','summary');
  return cardId;
 });
}
async function open(page,file=banksaladWorkbook(source)){
 await page.locator('.ux42-add').click();
 await page.locator('[data-ux42-choice="banksalad"]').click();
 const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.getByRole('button',{name:'엑셀 파일 선택'}).click()]);
 await chooser.setFiles(file);
 await expect(page.locator('.banksalad-totals')).toContainText('원본 순지출 8,000원');
}
const snapshot=page=>page.evaluate(()=>({
 ledger:structuredClone(integratedStore().ledger),schedules:structuredClone(state.financeSchedules),
 replay:integratedReplay(),revision:assetLocalDatabase.revision,spending:integratedSpendingAnalysis('2026-11').total
}));

test('@core confirmed withdrawal, purchase and cancellation save together and survive reimport and ZIP',async({page},info)=>{
 const cardId=await ready(page),before=await snapshot(page);
 await open(page);
 expect(await snapshot(page)).toEqual(before);
 await page.locator('.banksalad-setup summary').click();
 await page.getByLabel('카드 사용을 기록할 카드').selectOption(cardId);
 await page.getByLabel('일시불 첫 청구일').fill('2026-11-25');
 await page.getByLabel('카드대금 출금계좌').selectOption('cash-main');
 await page.getByRole('checkbox',{name:/계좌에서 출금을 확인/}).check();
 await page.getByRole('checkbox',{name:'일시불 확인 · 선택',exact:true}).check();
 await page.getByRole('checkbox',{name:'취소·환불 확인 · 선택',exact:true}).check();
 const original=page.getByLabel('취소 원거래');
 const originalKey=await original.locator('option').nth(1).getAttribute('value');
 await original.selectOption(originalKey);
 await page.getByLabel('납부한 카드').selectOption(cardId);
 await page.getByRole('checkbox',{name:'카드대금 출금 확인 · 선택',exact:true}).check();
 await expect(page.locator('.banksalad-save-box')).toContainText('3건 선택 · 저장 준비 3건 · 순소비 8,000원 · 출금 7,000원');
 await page.evaluate(()=>{window.qaCommit=assetLocalDatabase.commit;assetLocalDatabase.commit=async()=>{throw new Error('주입한 저장 실패')}});
 await page.getByRole('button',{name:'선택 거래 테스트 저장'}).click();
 await expect(page.locator('.banksalad-save-box')).toContainText('선택 전체를 되돌렸어요');
 expect(await snapshot(page)).toEqual(before);
 await page.evaluate(()=>{assetLocalDatabase.commit=window.qaCommit});
 await page.getByRole('button',{name:'선택 거래 테스트 저장'}).click();
 await expect(page.locator('.banksalad-save-box')).toContainText('3건 저장 · 순소비 8,000원 · 카드대금 출금 7,000원');
 const after=await snapshot(page);
 expect(after.spending).toBe(8000);expect(after.replay.assets['cash-main']).toBe(43000);
 expect(after.replay.totalDebt).toBe(8000);expect(after.revision).toBe(before.revision+1);
 const payment=after.ledger.find(row=>row.meta?.unallocatedCardPayment);
 expect(payment.liabilityId).toBeUndefined();
 expect(await page.evaluate(id=>integratedTxLabel(integratedStore().ledger.find(row=>row.id===id)),payment.id)).toBe('카드대금 출금 · 배분 대기');
 expect(await page.evaluate(()=>JSON.stringify(validateBackupPayload(parseBackupZipBytes(createBackupZipBytes())).integrated.ledger)))
  .toBe(JSON.stringify(after.ledger));
 for(const width of [360,412]){
  await page.setViewportSize({width,height:915});
  for(const theme of ['light','dark']){
   await page.evaluate(theme=>{setting().theme=theme;applyTheme()},theme);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
   await page.screenshot({path:'test-results/banksalad-'+info.project.name+'-'+width+'-'+theme+'.png'});
  }
 }
 await page.reload();await page.waitForFunction(()=>!!window.__assetOS);
 await page.evaluate(()=>nav('integrated','summary'));
 await open(page);
 await page.getByLabel('거래 보기').selectOption('saved');
 await expect(page.locator('.banksalad-row')).toHaveCount(3);
 await expect(page.getByRole('button',{name:'선택 거래 테스트 저장'})).toBeDisabled();
 expect(await snapshot(page)).toEqual(after);
});

test('@core duplicated source rows, changed baselines and overlapping manual payments are held',async({page})=>{
 const cardId=await ready(page);
 const result=await page.evaluate(async({source,cardId})=>{
  const asRow=([date,time,sourceType,group,category,name,amount,currency,method,memo])=>({date,time,sourceType,group,category,name,amount,method,memo});
  const payment=asRow(source[2]),purchase=asRow(source[0]),key=banksaladSourceKey(payment);
  const before=JSON.stringify(integratedStore());
  let duplicates=false,balance=false,issuer=false;
  try{await saveBanksaladBatch([payment,payment],new Map([[key,{kind:'payment',cardId,accountId:'cash-main',balanceConfirmed:true}]]))}catch{duplicates=true}
  try{await saveBanksaladBatch([payment],new Map([[key,{kind:'payment',cardId,accountId:'cash-main',balanceConfirmed:false}]]))}catch{balance=true}
  const kb=await saveCardAccount({name:'QA 국민카드',issuer:'국민카드',paymentDay:25});
  try{await saveBanksaladBatch([payment],new Map([[key,{kind:'payment',cardId:kb,accountId:'cash-main',balanceConfirmed:true}]]))}catch{issuer=true}
  const unchanged=JSON.stringify(integratedStore())===before;
  const plan=await createCardPurchase({name:'앞선 구매',cardId,purchaseAmount:7000,purchaseDate:'2026-10-15',firstPaymentDate:'2026-11-02',months:1});
  const bill=await saveCardBill(plan,{principal:7000,interest:0,dueDate:'2026-11-02',issuedDate:'2026-10-20'});
  const draft=new Map([[key,{kind:'payment',cardId,accountId:'cash-main',balanceConfirmed:true}]]);
  const raced=await Promise.all([saveBanksaladBatch([payment],draft),saveBanksaladBatch([payment],draft)]);
  const manualAfter=await recordCardPayment(plan,{billId:bill,date:'2026-11-02'});
  const cash=integratedReplay().assets['cash-main'];
  const old=asRow(['2026-09-01','12:00:00','이체','카드대금','','삼성카드',-1000,'KRW','신한 통장','']);
  const baseline=banksaladPaymentIssue(old,{kind:'payment',cardId,accountId:'cash-main',balanceConfirmed:true});
  return {duplicates,balance,issuer,unchanged,raced,manualAfter,cash,baseline,purchase};
 },{source,cardId});
 expect(result).toMatchObject({duplicates:true,balance:true,issuer:true,unchanged:true,manualAfter:'',cash:43000});
 expect(result.raced.map(row=>row.count)).toEqual([1,0]);
 expect(result.baseline).toContain('출금일 이후에 확인한 잔액');
});

test('@core a manual bill payment and file import share one cash outflow under concurrent submission',async({page})=>{
 const cardId=await ready(page);
 const outcome=await page.evaluate(async({source,cardId})=>{
  const plan=await createCardPurchase({name:'동시 저장 검증',cardId,purchaseAmount:7000,purchaseDate:'2026-10-15',firstPaymentDate:'2026-11-02',months:1});
  const bill=await saveCardBill(plan,{principal:7000,interest:0,dueDate:'2026-11-02',issuedDate:'2026-10-20'});
  const [date,time,sourceType,group,category,name,amount,currency,method,memo]=source[2];
  const row={date,time,sourceType,group,category,name,amount,method,memo};
  const drafts=new Map([[banksaladSourceKey(row),{kind:'payment',cardId,accountId:'cash-main',balanceConfirmed:true}]]);
  const results=await Promise.allSettled([
   recordCardPayment(plan,{billId:bill,date:row.date}),
   saveBanksaladBatch([row],drafts)
  ]);
  return {manual:results[0].status==='fulfilled'&&!!results[0].value,
   importHeld:results[1].status==='rejected',
   cash:integratedReplay().assets['cash-main'],debt:integratedReplay().totalDebt};
 },{source,cardId});
 expect(outcome).toEqual({manual:true,importHeld:true,cash:43000,debt:0});
});
