'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.join(__dirname,'..');

test('secret gate blocks a fake KIS secret',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'asset-os-secret-'));
 const unsafe=path.join(directory,'unsafe.js');
 fs.writeFileSync(unsafe,"const KIS_APP_SECRET='fake-secret-must-never-be-committed';\n"); // secret-scan:allow-test-placeholder
 const result=spawnSync(process.execPath,['scripts/scan-secrets.mjs',unsafe],{cwd:root,encoding:'utf8'});
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/assigned secret/);
 fs.rmSync(directory,{recursive:true,force:true});
});

test('generated-output gate detects a changed source without editing dist',()=>{
 const script=fs.readFileSync(path.join(root,'scripts/check-generated.mjs'),'utf8');
 assert.match(script,/actual!==compiledTypeScript\[sourceName\]/);
 assert.match(script,/actual!==assemble/);
 assert.doesNotMatch(script,/writeFileSync/);
});

test('release metadata gate keeps package, UI, runtime and PWA cache aligned',()=>{
 const script=fs.readFileSync(path.join(root,'scripts/sync-release-meta.mjs'),'utf8');
 assert.match(script,/release-meta\.json/);
 assert.match(script,/package-lock\.json/);
 assert.match(script,/core-config\.ts/);
 assert.match(script,/service-worker\.js/);
 assert.match(script,/manual QA title/);
 assert.match(script,/manual QA live version/);
 assert.match(script,/manual QA badge version/);
 const result=spawnSync(process.execPath,['scripts/sync-release-meta.mjs','--check'],{cwd:root,encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
});

test('strict TypeScript gate rejects an invalid financial amount type',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'asset-os-types-')),source=path.join(directory,'invalid.ts');
 fs.writeFileSync(source,"const financialAmount: number = '1000';\n");
 const result=spawnSync(path.join(root,'node_modules','.bin','tsc'),['--ignoreConfig','--strict','--noEmit',source],{cwd:root,encoding:'utf8'});
 assert.notEqual(result.status,0);
 assert.match(result.stdout+result.stderr,/not assignable to type 'number'/);
 fs.rmSync(directory,{recursive:true,force:true});
});
