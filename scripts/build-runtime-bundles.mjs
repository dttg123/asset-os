import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileRuntimeTypeScript,runtimeJavaScriptName} from './runtime-typescript.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'runtime-bundles.json'),'utf8'));
const typedSources=JSON.parse(fs.readFileSync(path.join(root,'typed-sources.json'),'utf8'));
const dist=path.join(root,'dist');
fs.mkdirSync(dist,{recursive:true});

const compiledTypeScript=compileRuntimeTypeScript(root,typedSources);
for(const sourceName of typedSources){
 const outputName=runtimeJavaScriptName(sourceName),outputPath=path.join(root,outputName);
 fs.mkdirSync(path.dirname(outputPath),{recursive:true});
 fs.writeFileSync(outputPath,compiledTypeScript[sourceName],'utf8');
}

/** @param {string[]} files @param {'scripts'|'styles'} kind */
function assemble(files,kind){
 return files.map(name=>{
  const source=fs.readFileSync(path.join(root,name),'utf8').replace(/^\uFEFF/,'').trimEnd();
  return `/* asset-os source: ${name} */\n${source}`;
 }).join(kind==='scripts'?'\n;\n':'\n');
}

for(const kind of /** @type {const} */(['scripts','styles']))for(const [output,files] of Object.entries(/** @type {Record<string,string[]>} */(manifest[kind]))){
 fs.writeFileSync(path.join(dist,output),`${assemble(files,kind)}\n`,'utf8');
}
