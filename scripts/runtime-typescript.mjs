import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

/** @param {string} sourceName */
export function runtimeJavaScriptName(sourceName){
 if(!sourceName.endsWith('.ts'))throw new Error(`runtime TypeScript source must end in .ts: ${sourceName}`);
 return `${sourceName.slice(0,-3)}.js`;
}

/** @param {string} root @param {string[]} sourceNames */
export function compileRuntimeTypeScript(root,sourceNames){
 const outputRoot=fs.mkdtempSync(path.join(os.tmpdir(),'asset-os-runtime-ts-'));
 try{
  /** @type {Record<string,string>} */
  const compiled={};
  for(const [index,sourceName] of sourceNames.entries()){
   const sourceOutputRoot=path.join(outputRoot,String(index));
   execFileSync(path.join(root,'node_modules','.bin','tsc'),['--ignoreConfig','--target','ES2024','--module','preserve','--strict','--skipLibCheck','--outDir',sourceOutputRoot,sourceName],{cwd:root,stdio:'pipe'});
   compiled[sourceName]=fs.readFileSync(path.join(sourceOutputRoot,path.basename(runtimeJavaScriptName(sourceName))),'utf8');
  }
  return compiled;
 }finally{fs.rmSync(outputRoot,{recursive:true,force:true})}
}
