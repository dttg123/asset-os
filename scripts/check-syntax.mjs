import {execFileSync} from 'node:child_process';

const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','*.js','*.cjs','*.mjs'],{encoding:'utf8'})
 .split(/\r?\n/).filter(Boolean).filter(file=>!file.startsWith('dist/'));

for(const file of files)execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
console.log(`syntax check: ${files.length} source files PASS`);
