import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const binaryExtensions=new Set(['.png','.jpg','.jpeg','.gif','.webp','.ico','.zip','.pdf']);
/** @type {Array<[string, RegExp]>} */
const patterns=[
 ['private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
 ['AWS access key',/\bAKIA[0-9A-Z]{16}\b/g],
 ['GitHub token',/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/g],
 ['OpenAI key',/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g],
 ['Slack token',/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g],
 ['assigned secret',/\b(?:KIS_[A-Z0-9_]*SECRET|APP_SECRET|CLIENT_SECRET|PRIVATE_KEY|PASSWORD)\b\s*[:=]\s*['"`][^'"`\n]{12,}['"`]/gi]
];
const explicit=process.argv.slice(2),files=explicit.length?explicit:execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{encoding:'utf8'}).split(/\r?\n/).filter(Boolean);
const findings=[];
for(const file of files){
 if(!fs.existsSync(file)||!fs.statSync(file).isFile())continue;
 const dot=file.lastIndexOf('.'),extension=dot>=0?file.slice(dot).toLowerCase():'';
 if(binaryExtensions.has(extension))continue;
 const text=fs.readFileSync(file,'utf8');
 for(const [label,pattern] of patterns){
  pattern.lastIndex=0;
  for(const match of text.matchAll(pattern)){
   const line=text.slice(0,match.index).split('\n').length;
   const lineText=text.split(/\r?\n/)[line-1]||'';
   if(lineText.includes('secret-scan:allow-test-placeholder'))continue;
   findings.push(`${file}:${line} ${label}`);
  }
 }
}
if(findings.length){
 console.error(`secret scan blocked ${findings.length} finding(s):\n${findings.join('\n')}`);
 process.exitCode=1;
}else console.log(`secret scan: ${files.length} files PASS`);
