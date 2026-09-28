import {defineConfig} from '@playwright/test';

export default defineConfig({
 testDir:'./tests/e2e',
 timeout:45_000,
 expect:{timeout:7_000},
 fullyParallel:false,
 forbidOnly:!!process.env.CI,
 retries:process.env.CI?1:0,
 reporter:process.env.CI?[['line'],['html',{outputFolder:'test-results/html',open:'never'}]]:'line',
 use:{
  baseURL:'http://127.0.0.1:4173',
  trace:'on-first-retry',
  screenshot:'only-on-failure',
  video:'retain-on-failure',
  serviceWorkers:'allow'
 },
 projects:[
  {name:'chromium-desktop',use:{browserName:'chromium',viewport:{width:1280,height:900}}},
  {name:'galaxy-s25-ultra',use:{browserName:'chromium',viewport:{width:412,height:915},deviceScaleFactor:3,isMobile:true,hasTouch:true}}
 ],
 webServer:{command:'node scripts/serve-static.mjs',url:'http://127.0.0.1:4173/index.html',reuseExistingServer:!process.env.CI,timeout:20_000},
 outputDir:'test-results/artifacts'
});
