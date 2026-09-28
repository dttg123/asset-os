import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const manifest=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
const lock=JSON.parse(readFileSync(resolve(root,'package-lock.json'),'utf8'));
const major=Number(process.versions.node.split('.')[0]);
if(major!==24)throw new Error(`Node 24 required, received ${process.versions.node}`);
if(lock.lockfileVersion!==3)throw new Error(`package-lock v3 required, received ${lock.lockfileVersion}`);
if(lock.packages?.['']?.version!==manifest.version)throw new Error('package.json and package-lock root versions differ');
for(const [name,version] of Object.entries(manifest.devDependencies||{})){
 const locked=lock.packages?.[`node_modules/${name}`]?.version;
 if(!locked)throw new Error(`${name} is missing from package-lock.json`);
 if(!String(version).includes(locked)&&String(version)!=='latest')throw new Error(`${name} lock mismatch: ${version} / ${locked}`);
}
console.log(`runtime check: Node ${process.versions.node}, lockfile v${lock.lockfileVersion} PASS`);
