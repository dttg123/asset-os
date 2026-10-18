import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test.beforeEach(async({page})=>{if(process.env.ASSET_OS_QA_SDK_PATH){const body=await readFile(process.env.ASSET_OS_QA_SDK_PATH);await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4',route=>route.fulfill({body,contentType:'text/javascript'}))}});
const ready=page=>page.waitForFunction(()=>!!window.__assetOS);

test('@core local database copies legacy records, preserves source and verifies reload',async({page})=>{
 await page.addInitScript(()=>{if(!sessionStorage.getItem('legacy-prepared')){const original={schemaVersion:21,appVersion:'v0.6.23',environment:'qa',savedAt:'2026-10-01T00:00:00Z',data:{accounts:[],integrated:{ledger:[{id:'legacy-cash',type:'openingAsset',date:'2026-01-01',toAccountId:'cash-main',amount:20000000,note:'원본 유지',meta:{futureTag:'keep'}}]},futureSection:{nested:[{id:'future-1',date:'2026-02-01',amount:'123',extra:[1,null,'원본']}]}}};localStorage.setItem('asset-os-qa-v0.5',JSON.stringify(original));sessionStorage.setItem('legacy-source',JSON.stringify(original));sessionStorage.setItem('legacy-prepared','1')}});
 await page.goto('/index.html?qa=1#/home');await ready(page);
 const first=await page.evaluate(()=>({rows:state.integrated.ledger,future:state.futureSection,net:integratedFinancialModel().netAssets,source:localStorage.getItem(KEY),original:sessionStorage.getItem('legacy-source'),revision:assetLocalDatabase.revision}));
 expect(first.source).toBe(first.original);expect(first.rows).toHaveLength(1);expect(first.rows[0].meta.futureTag).toBe('keep');expect(first.future.nested[0].extra).toEqual([1,null,'원본']);expect(first.net).toBe(20000000);expect(first.revision).toBe(1);
 await page.reload();await ready(page);expect(await page.evaluate(()=>({rows:state.integrated.ledger,future:state.futureSection,net:integratedFinancialModel().netAssets}))).toEqual({rows:first.rows,future:first.future,net:first.net});
});

test('@core real database saves a large ledger, ZIP restores it and cloud codec validates every chunk',async({page})=>{
 test.setTimeout(120000);await page.goto('/index.html?qa=1#/home');await ready(page);
 const before=await page.evaluate(async()=>{
  const next=window.__assetOS.getState();next.integrated.ledger=[{id:'large-opening',type:'openingAsset',date:'2026-01-01',toAccountId:'cash-main',amount:1000000}];
  for(let i=0;i<12000;i++)next.integrated.ledger.push({id:'large-'+i,type:'externalIncome',date:`${2026+Math.floor(i/360)}-${String(1+Math.floor(i%360/30)).padStart(2,'0')}-${String(1+i%28).padStart(2,'0')}`,toAccountId:'cash-main',amount:i+1,note:Array.from({length:24},()=>crypto.randomUUID()).join(''),meta:{ordinal:i}});
  await window.__assetOS.replaceState(next);const envelope=assetLocalDatabase.envelope,raw=JSON.stringify(envelope),zip=createBackupZipBytes(),restored=validateBackupPayload(parseBackupZipBytes(zip));
  globalThis.__largeRestoreFile=new File([zip],'AssetOS_large.zip',{type:'application/zip'});
  const chunks=new Map();const client={rpc:async(name,args)=>{if(name==='stage_asset_os_state_chunk'){chunks.set(args.p_index,args.p_contents);return{data:true,error:null}}if(name==='read_asset_os_state_chunks')return{data:[...chunks].filter(([i])=>i>args.p_after_index).sort(([a],[b])=>a-b).slice(0,args.p_limit).map(([chunk_index,contents])=>({chunk_index,contents})),error:null};throw Error(name)}};
  const wire=await cloudEncodeEnvelope(client,envelope,crypto.randomUUID()),decoded=await cloudDecodeEnvelope(client,wire);let corruptRejected=false;chunks.set(0,'!'+chunks.get(0).slice(1));try{await cloudDecodeEnvelope(client,wire)}catch{corruptRejected=true}
  return{rows:state.integrated.ledger.length,sum:state.integrated.ledger.reduce((n,r)=>n+r.amount,0),bytes:new TextEncoder().encode(raw).length,zipBytes:zip.length,zipExact:JSON.stringify(restored.integrated.ledger)===JSON.stringify(state.integrated.ledger),codecExact:JSON.stringify(decoded)===raw,chunkCount:wire.chunkCount,corruptRejected,checksum:await localDbChecksum(JSON.stringify(state.integrated.ledger)),saveError:state.system.saveError};
 });
 expect(before.saveError).toBe('');expect(before.rows).toBe(12001);expect(before.bytes).toBeGreaterThan(8*1024*1024);expect(before.zipBytes).toBeGreaterThan(8*1024*1024);expect(before.zipExact).toBe(true);expect(before.codecExact).toBe(true);expect(before.chunkCount).toBeGreaterThan(1);expect(before.corruptRejected).toBe(true);
 await page.evaluate(async()=>{const next=window.__assetOS.getState();next.integrated.ledger=[];await window.__assetOS.replaceState(next);await restoreBackupFile(globalThis.__largeRestoreFile)});
 await page.locator('#confirmOk').click();await page.waitForFunction(()=>state.integrated.ledger.length===12001&&!storageSavePending);
 await page.reload();await ready(page);expect(await page.evaluate(async()=>({rows:state.integrated.ledger.length,sum:state.integrated.ledger.reduce((n,r)=>n+r.amount,0),checksum:await localDbChecksum(JSON.stringify(state.integrated.ledger))}))).toEqual({rows:before.rows,sum:before.sum,checksum:before.checksum});
});

test('@core a request that succeeds then aborts never becomes a completed app save',async({page})=>{
 await page.goto('/index.html?qa=1#/home');await ready(page);
 const result=await page.evaluate(async()=>{
  const next=window.__assetOS.getState();next.integrated.ledger=[{id:'kept',type:'openingAsset',date:'2026-01-01',toAccountId:'cash-main',amount:1000000}];await window.__assetOS.replaceState(next);
  const before=JSON.stringify(state.integrated.ledger),revision=assetLocalDatabase.revision,original=IDBObjectStore.prototype.put;let requestSucceeded=false;
  IDBObjectStore.prototype.put=function(value,...args){const request=original.call(this,value,...args);if(this.name==='records'&&value?.value?.id==='abort-me'){const transaction=this.transaction;request.addEventListener('success',()=>{requestSucceeded=true;transaction.abort()})}return request};
  state.integrated.ledger.push({id:'abort-me',type:'externalIncome',date:'2026-01-02',toAccountId:'cash-main',amount:777});let saved;try{saved=await persist(false)}finally{IDBObjectStore.prototype.put=original}
  return{saved,requestSucceeded,unchanged:JSON.stringify(state.integrated.ledger)===before,revisionUnchanged:assetLocalDatabase.revision===revision,error:state.system.saveError};
 });
 expect(result.saved).toBe(false);expect(result.requestSucceeded).toBe(true);expect(result.unchanged).toBe(true);expect(result.revisionUnchanged).toBe(true);expect(result.error).toContain('저장 실패');await page.reload();await ready(page);expect(await page.evaluate(()=>state.integrated.ledger.map(r=>r.id))).toEqual(['kept']);
});

test('@core stale tabs cannot overwrite committed money and dirty input stays visible',async({page,context})=>{
 await page.goto('/index.html?qa=1#/home');await ready(page);const second=await context.newPage();await second.goto('/index.html?qa=1#/home');await ready(second);
 await second.evaluate(()=>{sheetMode='input';sheetDirty=true});
 await page.evaluate(async()=>{state.integrated.ledger.push({id:'other-tab',type:'externalIncome',date:'2026-01-01',toAccountId:'cash-main',amount:11111});await persist(false)});
 const outcome=await second.evaluate(async()=>{state.integrated.ledger.push({id:'stale-write',type:'externalIncome',date:'2026-01-02',toAccountId:'cash-main',amount:22222});const saved=await persist(false);return{saved,dirty:sheetDirty,error:state.system.saveError}});
 expect(outcome.saved).toBe(false);expect(outcome.dirty).toBe(true);expect(outcome.error).toContain('다른 화면');await page.reload();await ready(page);expect(await page.evaluate(()=>state.integrated.ledger.some(r=>r.id==='other-tab'))).toBe(true);expect(await page.evaluate(()=>state.integrated.ledger.some(r=>r.id==='stale-write'))).toBe(false);await second.close();
});


test('@core a busy month shows fifty ledger rows and expands without dropping records',async({page})=>{
 await page.goto('/index.html?qa=1#/integrated/ledger');await ready(page);
 await page.evaluate(async()=>{const next=window.__assetOS.getState();next.integrated.ledger=Array.from({length:125},(_,i)=>({id:'month-'+i,type:'externalIncome',date:localYmd(),toAccountId:'cash-main',amount:100+i,category:'검사 수입'}));await window.__assetOS.replaceState(next);render()});
 await expect(page.locator('[data-integrated-tx]')).toHaveCount(50);
 await page.locator('[data-integrated-search-more]').click();await expect(page.locator('[data-integrated-tx]')).toHaveCount(100);
 await page.locator('[data-integrated-search-more]').click();await expect(page.locator('[data-integrated-tx]')).toHaveCount(125);
 await expect(page.locator('[data-integrated-search-more]')).toHaveCount(0);expect(await page.evaluate(()=>state.integrated.ledger.length)).toBe(125);
});

test('@core damaged startup preserves originals and recovers a verified backup after a failed repair',async({page})=>{
 test.setTimeout(90000);const errors=[];page.on('pageerror',error=>errors.push(String(error)));
 await page.goto('/index.html?qa=1#/home');await ready(page);
 const saved=await page.evaluate(async()=>{const next=window.__assetOS.getState();next.integrated.ledger=[{id:'repair-original',type:'openingAsset',date:'2026-01-01',toAccountId:'cash-main',amount:3456789,meta:{evidence:'preserve'}}];await window.__assetOS.replaceState(next);const payload=backupPayload(),revision=assetLocalDatabase.revision;const tx=localDatabase.transaction(['meta'],'readwrite'),done=localDbDone(tx),store=tx.objectStore('meta'),head=await localDbRequest(store.get('head'));head.checksum='0'.repeat(64);store.put(head,'head');await done;return{payload,revision}});
 await page.reload();await expect(page.locator('#storageRecovery')).toBeVisible();await page.screenshot({path:`/tmp/asset-recovery-${test.info().project.name}.png`});expect(await page.evaluate(()=>!!window.__assetOS)).toBe(false);
 const pending=page.waitForEvent('download');await page.locator('#recoveryDownload').click();const download=await pending;const raw=JSON.parse(await readFile(await download.path(),'utf8'));expect(raw.format).toBe('asset-os-recovery-v1');expect(raw.head.checksum).toBe('0'.repeat(64));expect(raw.rows.some(row=>row.value?.id==='repair-original')).toBe(true);
 await page.locator('#recoveryFile').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"wrong":true}')});await expect(page.locator('#assetAuthStatus')).toContainText('복구하지 않았습니다');
 const file={name:'verified.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved.payload))};
 await page.locator('#recoveryFile').setInputFiles(file);await expect(page.locator('#recoveryPreview')).toContainText('verified.json');await page.locator('#recoveryCancel').click();expect(await page.evaluate(async()=>(await assetLocalDatabase.rescue('')).head.revision)).toBe(saved.revision);
 await page.locator('#recoveryFile').setInputFiles(file);
 await page.locator('#recoveryFile').setInputFiles({name:'bad-after-good.json',mimeType:'application/json',buffer:Buffer.from('{}')});await expect(page.locator('#recoveryConfirm')).toBeHidden();
 await page.locator('#recoveryFile').setInputFiles(file);
 await page.evaluate(()=>{globalThis.__originalRecoveryPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){if(this.name==='recovery'&&value?.key==='before-repair')throw new DOMException('repair quota test','QuotaExceededError');return globalThis.__originalRecoveryPut.call(this,value,...args)}});
 await page.locator('#recoveryConfirm').click();await expect(page.locator('#assetAuthStatus')).toContainText('복구 실패');
 expect(await page.evaluate(async()=>{const current=await assetLocalDatabase.rescue('');return{revision:current.head.revision,checksum:current.head.checksum,hasOriginal:current.rows.some(row=>row.value?.id==='repair-original'),hasRecovery:current.copies.some(copy=>copy.key==='before-repair')}})).toEqual({revision:saved.revision,checksum:'0'.repeat(64),hasOriginal:true,hasRecovery:false});
 await page.evaluate(()=>{IDBObjectStore.prototype.put=globalThis.__originalRecoveryPut});await page.locator('#recoveryConfirm').click();await ready(page);
 expect(await page.evaluate(async()=>({amount:state.integrated.ledger[0].amount,meta:state.integrated.ledger[0].meta.evidence,old:JSON.parse((await assetLocalDatabase.rescue('')).copies.find(copy=>copy.key==='before-repair').raw).head.checksum}))).toEqual({amount:3456789,meta:'preserve',old:'0'.repeat(64)});
 await page.reload();await ready(page);expect(await page.evaluate(()=>state.integrated.ledger[0].amount)).toBe(3456789);expect(errors).toEqual([]);
});

test('@core recovery cannot replace a future-version database or another owners ledger',async({page})=>{
 await page.goto('/index.html');await page.waitForFunction(()=>localDatabaseReady);await expect(page.locator('#assetAuthButton')).toHaveText('Google로 로그인');
 const result=await page.evaluate(async()=>{const revision=assetLocalDatabase.revision;await assetLocalDatabase.saveSync({userId:'original-owner',baseRevision:1,baseFingerprint:'kept'});let readBlocked=false,writeBlocked=false,futureBlocked=false;try{await assetLocalDatabase.rescue('other-owner')}catch{readBlocked=true}try{await assetLocalDatabase.repair(assetLocalDatabase.envelope,'other-owner',revision)}catch{writeBlocked=true}
 const tx=localDatabase.transaction(['meta'],'readwrite'),done=localDbDone(tx),store=tx.objectStore('meta'),head=await localDbRequest(store.get('head'));head.envelope.schemaVersion=SCHEMA_VERSION+1;store.put(head,'head');await done;try{await assetLocalDatabase.repair(assetLocalDatabase.envelope,'original-owner',revision)}catch{futureBlocked=true}const source=await assetLocalDatabase.rescue('original-owner');return{readBlocked,writeBlocked,futureBlocked,revision:source.head.revision,expected:revision,schema:source.head.envelope.schemaVersion,expectedSchema:SCHEMA_VERSION+1}});
 expect(result.readBlocked).toBe(true);expect(result.writeBlocked).toBe(true);expect(result.futureBlocked).toBe(true);expect(result.revision).toBe(result.expected);expect(result.schema).toBe(result.expectedSchema);
 await page.evaluate(async()=>{globalThis.__switchEvents=[];assetSupabaseSession={user:{id:'other-owner'}};assetSupabaseClient={auth:{signOut:async()=>{globalThis.__switchEvents.push('signed-out');return{error:null}},signInWithOAuth:async options=>{globalThis.__switchOptions=options;return{error:null}}}};brokerKisClient.signOut=()=>({ok:true});await startAssetAuthenticatedApp()});
 await expect(page.locator('#assetAuthStatus')).toContainText('다른 로그인 계정');await expect(page.locator('#assetAuthSwitch')).toBeVisible();await page.locator('#assetAuthSwitch').click();
 await page.waitForFunction(()=>!!globalThis.__switchOptions);expect(await page.evaluate(()=>({events:globalThis.__switchEvents,provider:globalThis.__switchOptions.provider,prompt:globalThis.__switchOptions.options.queryParams.prompt,owner:assetLocalDatabase.sync.userId}))).toEqual({events:['signed-out'],provider:'google',prompt:'select_account',owner:'original-owner'});
});
