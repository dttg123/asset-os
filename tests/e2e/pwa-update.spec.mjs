import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';

test('@core an existing installed worker updates on return and preserves open input until closed',async({page})=>{
 let version=1;const script=await readFile(new URL('../../pwa.js',import.meta.url),'utf8');
 const server=createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.url.startsWith('/service-worker.js')){res.setHeader('Content-Type','application/javascript');res.end(`// version ${version}\nself.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));`);return}
  res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html><body><div class="sheet open"><form><input value="" aria-label="draft"></form><button id="close" onclick="this.parentElement.classList.remove('open')">close</button></div><script>window.loadedVersion=${version};sessionStorage.loads=Number(sessionStorage.loads||0)+1;</script><script>${script}</script></body></html>`)
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
 try{
  await page.goto(url);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);expect(await page.evaluate(()=>Number(sessionStorage.loads))).toBe(1);
  await page.waitForTimeout(500);await page.getByRole('textbox',{name:'draft'}).fill('작성 중인 입력');version=2;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(1500);await expect(page.getByRole('textbox',{name:'draft'})).toHaveValue('작성 중인 입력');expect(await page.evaluate(()=>Number(sessionStorage.loads))).toBe(1);
  await page.locator('#close').click();await page.waitForFunction(()=>window.loadedVersion===2);expect(await page.evaluate(()=>Number(sessionStorage.loads))).toBe(2);await page.waitForTimeout(1200);expect(await page.evaluate(()=>Number(sessionStorage.loads))).toBe(2);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
