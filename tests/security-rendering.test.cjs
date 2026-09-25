'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const files=fs.readdirSync(root).filter(name=>name.endsWith('.js'));
for(const name of files){
  const source=fs.readFileSync(path.join(root,name),'utf8');
  for(const match of source.matchAll(/[A-Za-z_:][-A-Za-z0-9_:]*="\$\{([^}\n]+)\}"/g)){
    assert.match(match[1],/^escapeHtml\(/,`${name} has an unescaped dynamic attribute: ${match[0]}`);
  }
  assert.doesNotMatch(source,/(?:querySelector|\$)\(`[^`]*\$\{[^}]+\}[^`]*`\)/,`${name} interpolates an unsafe selector`);
}

const context=vm.createContext({
  console,Intl,Date,Math,JSON,setTimeout,clearTimeout,
  location:{search:''},innerHeight:800,
  requestAnimationFrame:fn=>fn(),
  window:{addEventListener(){},removeEventListener(){},scrollTo(){},scrollY:0},
  document:{querySelector(){return null},querySelectorAll(){return[]},documentElement:{scrollHeight:0}},
});
vm.runInContext(fs.readFileSync(path.join(root,'core-config.js'),'utf8'),context);
context.attack='x" autofocus onfocus="window.__xss=1';
assert.equal(vm.runInContext('escapeHtml(attack)',context),'x&quot; autofocus onfocus=&quot;window.__xss=1');
context.attackElement={getAttribute:()=>context.attack};
context.root={querySelectorAll:()=>[
  context.attackElement,
  {getAttribute:()=> 'safe'},
]};
context.wanted=context.attack;
assert.equal(vm.runInContext('findDataElement(root,"data-id",wanted)===attackElement',context),true);
assert.equal(vm.runInContext('findDataElement(root,"data-id] bad",wanted)',context),null);
console.log('security rendering tests: PASS');
