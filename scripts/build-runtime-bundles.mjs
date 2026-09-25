import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'runtime-bundles.json'),'utf8'));
const dist=path.join(root,'dist');
fs.mkdirSync(dist,{recursive:true});

function assemble(files,kind){
 return files.map(name=>{
  const source=fs.readFileSync(path.join(root,name),'utf8').replace(/^\uFEFF/,'').trimEnd();
  return `/* asset-os source: ${name} */\n${source}`;
 }).join(kind==='scripts'?'\n;\n':'\n');
}

for(const kind of ['scripts','styles'])for(const [output,files] of Object.entries(manifest[kind])){
 fs.writeFileSync(path.join(dist,output),`${assemble(files,kind)}\n`,'utf8');
}
