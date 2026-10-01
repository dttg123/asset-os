import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const meta=JSON.parse(fs.readFileSync(path.join(root,'release-meta.json'),'utf8'));

function validateMeta(){
 if(!/^\d+\.\d+\.\d+$/.test(meta.version))throw new Error(`invalid release version: ${meta.version}`);
 if(!/^\d{8}-\d+$/.test(meta.build))throw new Error(`invalid release build: ${meta.build}`);
 if(!Number.isInteger(meta.schemaVersion)||meta.schemaVersion<1)throw new Error(`invalid schema version: ${meta.schemaVersion}`);
}

/** @param {string} source @param {RegExp} pattern @param {string} replacement @param {string} label */
function replaceRequired(source,pattern,replacement,label){
 if(!pattern.test(source))throw new Error(`release marker missing: ${label}`);
 pattern.lastIndex=0;
 return source.replace(pattern,replacement);
}

function synchronizedFiles(){
 validateMeta();
 const version=meta.version,display=`v${version}`,query=`v=${version}&build=${meta.build}`;
 const files=new Map();
 /** @param {string} name */
 const read=name=>fs.readFileSync(path.join(root,name),'utf8');

 for(const name of ['package.json','package-lock.json']){
  const data=JSON.parse(read(name));
  data.version=version;
  if(name==='package-lock.json')data.packages[''].version=version;
  files.set(name,`${JSON.stringify(data,null,2)}\n`);
 }

 let core=read('core-config.ts');
 core=replaceRequired(core,/APP_VERSION='v\d+\.\d+\.\d+'/g,`APP_VERSION='${display}'`,'core APP_VERSION');
 core=replaceRequired(core,/SCHEMA_VERSION=\d+/g,`SCHEMA_VERSION=${meta.schemaVersion}`,'core SCHEMA_VERSION');
 files.set('core-config.ts',core);

 let html=read('index.html');
 html=replaceRequired(html,/Asset OS v\d+\.\d+\.\d+/g,`Asset OS ${display}`,'HTML title');
 html=replaceRequired(html,/v\d+\.\d+\.\d+ LIVE/g,`${display} LIVE`,'HTML live version');
 html=replaceRequired(html,/class="appversion">v\d+\.\d+\.\d+</g,`class="appversion">${display}<`,'HTML badge version');
 html=replaceRequired(html,/v=\d+\.\d+\.\d+&build=[\w.-]+/g,query,'HTML asset query');
 files.set('index.html',html);

 let worker=read('service-worker.js');
 worker=replaceRequired(worker,/asset-os-v\d+\.\d+\.\d+-build[\w.-]+/g,`asset-os-${display}-build${meta.build}`,'service worker cache');
 worker=replaceRequired(worker,/v=\d+\.\d+\.\d+&build=[\w.-]+/g,query,'service worker asset query');
 files.set('service-worker.js',worker);

 let pwa=read('pwa.ts');
 pwa=replaceRequired(pwa,/v=\d+\.\d+\.\d+&build=[\w.-]+/g,query,'PWA worker query');
 pwa=replaceRequired(pwa,/asset-os-sw-reload-\d+\.\d+\.\d+-build[\w.-]+/g,`asset-os-sw-reload-${version}-build${meta.build}`,'PWA reload key');
 files.set('pwa.ts',pwa);

 let manual=read('qa-manual.html');
 manual=replaceRequired(manual,/v=\d+\.\d+\.\d+&build=[\w.-]+/g,query,'manual QA asset query');
 files.set('qa-manual.html',manual);
 return files;
}

export function syncReleaseMeta({write=false}={}){
 const mismatches=[];
 for(const [name,expected] of synchronizedFiles()){
  const file=path.join(root,name),actual=fs.readFileSync(file,'utf8');
  if(actual===expected)continue;
  mismatches.push(name);
  if(write)fs.writeFileSync(file,expected,'utf8');
 }
 return mismatches;
}

const invoked=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
 const check=process.argv.includes('--check'),mismatches=syncReleaseMeta({write:!check});
 if(check&&mismatches.length){
  console.error(`release metadata is stale: ${mismatches.join(', ')}`);
  console.error('run npm run sync:release and review the generated changes');
  process.exitCode=1;
 }else console.log(check?'release metadata check: PASS':`release metadata synchronized: ${mismatches.join(', ')||'already current'}`);
}
