import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const profile=String(process.argv[2]||'').toLowerCase();
const profiles=new Set(['fast','core','full','release']);
if(!profiles.has(profile))throw new Error(`Unknown QA profile: ${profile}`);

/** @param {string} command @param {string[]} args @param {import('node:child_process').SpawnSyncOptions} [extra] */
const run=(command,args,extra={})=>{
 const result=spawnSync(command,args,{cwd:root,stdio:'inherit',shell:false,...extra});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status??1);
};
/** @param {string} name */
const npmScript=name=>run(process.platform==='win32'?'npm.cmd':'npm',['run',name]);

for(const gate of ['check:runtime','check:syntax','check:types','check:secrets','check:generated','build'])npmScript(gate);

const testFiles=readdirSync(resolve(root,'tests')).filter(name=>name.endsWith('.test.cjs')).sort();
const fastFiles=new Set([
 'quality-gates.test.cjs','runtime-bundles.test.cjs','security-rendering.test.cjs',
 'structure-boundaries.test.cjs','cloud-atomic-save.test.cjs','policy-review.test.cjs'
]);
const releaseOnly=new Set(['qa-mode-isolation.test.cjs','real-user-30y-incremental.test.cjs','qa-generator-release.test.cjs']);
const fullOnly=new Set(['qa-property.test.cjs','qa-generator-profiles.test.cjs']);
let selected=testFiles;
if(profile==='fast')selected=testFiles.filter(name=>fastFiles.has(name));
if(profile==='core')selected=testFiles.filter(name=>!releaseOnly.has(name)&&!fullOnly.has(name));
if(profile==='full')selected=testFiles.filter(name=>!releaseOnly.has(name));
run(process.execPath,['--test',...selected.map(name=>`tests/${name}`)]);

if(profile!=='fast'){
 const grep=profile==='core'?'@smoke|@core':profile==='full'?'@smoke|@core':'@smoke|@core|@release';
 run(process.platform==='win32'?'npx.cmd':'npx',['playwright','test','--grep',grep]);
}

console.log(`QA ${profile.toUpperCase()}: PASS`);
