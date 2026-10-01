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
   const source=fs.readFileSync(path.join(root,sourceName),'utf8');
   if(/^\s*\/\/\s*@ts-(?:nocheck|ignore)\b/m.test(source))throw new Error(`runtime type-check suppression is forbidden: ${sourceName}`);
   const jsonBoundary=sourceName.startsWith('src/')||['backup.ts','initial-import.ts','supabase-sync.ts','ui-sheets.ts','initial-import-ui.ts','export-csv.ts','source-archive.ts','core-visual-utils.ts','chart-pension-future.ts','ui-render.ts','chart-income.ts','chart-dividends.ts','chart-asset-analysis.ts','chart-financial-growth.ts','integrated-forms.ts'].includes(sourceName);
   if(jsonBoundary&&/\bany\b/.test(source))throw new Error(`untyped data is forbidden at a JSON/domain boundary: ${sourceName}`);
   const sourceOutputRoot=path.join(outputRoot,String(index));
   execFileSync(path.join(root,'node_modules','.bin','tsc'),['--ignoreConfig','--target','ES2024','--module','preserve','--strict','--skipLibCheck','--outDir',sourceOutputRoot,sourceName],{cwd:root,stdio:'pipe'});
   compiled[sourceName]=fs.readFileSync(path.join(sourceOutputRoot,path.basename(runtimeJavaScriptName(sourceName))),'utf8');
  }
  return compiled;
 }finally{fs.rmSync(outputRoot,{recursive:true,force:true})}
}
