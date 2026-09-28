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
