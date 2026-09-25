'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'runtime-bundles.json'),'utf8'));

function assemble(files,kind){return files.map(name=>`/* asset-os source: ${name} */\n${fs.readFileSync(path.join(root,name),'utf8').replace(/^\uFEFF/,'').trimEnd()}`).join(kind==='scripts'?'\n;\n':'\n')+'\n'}

test('runtime bundles contain every production source exactly once and in declared order',()=>{
 const scriptSources=Object.values(manifest.scripts).flat(),styleSources=Object.values(manifest.styles).flat();
 const rootScripts=fs.readdirSync(root).filter(name=>name.endsWith('.js')&&name!=='service-worker.js').sort();
 const rootStyles=fs.readdirSync(root).filter(name=>name.endsWith('.css')).sort();
 assert.deepEqual([...scriptSources].sort(),rootScripts);
 assert.deepEqual([...styleSources].sort(),rootStyles);
 assert.equal(new Set(scriptSources).size,scriptSources.length);
 assert.equal(new Set(styleSources).size,styleSources.length);
 for(const [output,files] of Object.entries(manifest.scripts))assert.equal(fs.readFileSync(path.join(root,'dist',output),'utf8'),assemble(files,'scripts'),output);
 for(const [output,files] of Object.entries(manifest.styles))assert.equal(fs.readFileSync(path.join(root,'dist',output),'utf8'),assemble(files,'styles'),output);
});

test('production shell loads only the compact runtime bundles',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),worker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
 const internalScripts=[...html.matchAll(/<script src="\.\/([^"?]+)(?:\?[^"#]+)?"><\/script>/g)].map(match=>match[1]);
 const styles=[...html.matchAll(/<link rel="stylesheet" href="\.\/([^"?]+)(?:\?[^"#]+)?">/g)].map(match=>match[1]);
 assert.deepEqual(internalScripts,Object.keys(manifest.scripts).map(name=>`dist/${name}`));
 assert.deepEqual(styles,Object.keys(manifest.styles).map(name=>`dist/${name}`));
 for(const source of [...Object.values(manifest.scripts).flat(),...Object.values(manifest.styles).flat()])assert.doesNotMatch(html,new RegExp(`(?:src|href)="\\./${source.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\?`));
 for(const output of [...Object.keys(manifest.scripts),...Object.keys(manifest.styles)])assert.match(worker,new RegExp(`'dist/${output.replace('.','\\.')}'`));
});
