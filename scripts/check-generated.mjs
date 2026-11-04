import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileRuntimeTypeScript,runtimeJavaScriptName} from './runtime-typescript.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'runtime-bundles.json'),'utf8'));
const typedSources=JSON.parse(fs.readFileSync(path.join(root,'typed-sources.json'),'utf8'));

/** @param {string[]} files @param {'scripts'|'styles'} kind */
function assemble(files,kind){
 return files.map(name=>{
  const source=fs.readFileSync(path.join(root,name),'utf8').replace(/^\uFEFF/,'').trimEnd();
  return `/* asset-os source: ${name} */\n${source}`;
 }).join(kind==='scripts'?'\n;\n':'\n')+'\n';
}

const mismatches=[];
const compiledTypeScript=compileRuntimeTypeScript(root,typedSources);
for(const sourceName of typedSources){
 const outputName=runtimeJavaScriptName(sourceName),target=path.join(root,outputName);
 const actual=fs.existsSync(target)?fs.readFileSync(target,'utf8'):'';
 if(actual!==compiledTypeScript[sourceName])mismatches.push(outputName);
}
for(const kind of /** @type {const} */(['scripts','styles']))for(const [output,files] of Object.entries(/** @type {Record<string,string[]>} */(manifest[kind]))){
 const target=path.join(root,'dist',output),actual=fs.existsSync(target)?fs.readFileSync(target,'utf8'):'';
 if(actual!==assemble(files,kind))mismatches.push(`dist/${output}`);
}
if(mismatches.length){
 console.error(`generated output is stale: ${mismatches.join(', ')}`);
 console.error('run npm run build and review the generated changes');
 process.exitCode=1;
}else console.log('generated output check: PASS');
