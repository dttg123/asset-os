'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../..');
function financialRuntime({qa=true}={}){
 const storage=new Map();
 const localStorage={get length(){return storage.size},key:i=>[...storage.keys()][i]??null,getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(String(k),String(v)),removeItem:k=>storage.delete(String(k))};
 const document={querySelector:()=>null,querySelectorAll:()=>[],documentElement:{dataset:{},scrollHeight:0},body:{dataset:{}}};
 const window={addEventListener(){},removeEventListener(){},scrollTo(){},isSecureContext:false};
 const context=vm.createContext({console,Date,Set,Map,URL,Blob,File:global.File,TextEncoder,TextDecoder,Uint8Array,DataView,ArrayBuffer,Intl,Math,JSON,Number,String,Boolean,Object,RegExp,Promise,encodeURIComponent,decodeURIComponent,localStorage,document,window,navigator:{},location:{hash:'',search:qa?'?qa=1':''},requestAnimationFrame:fn=>fn(),setTimeout:()=>0,clearTimeout(){}});
 const files=['core-config.js','src/integrations/kis-normalization.js','broker-kis.js','data-defaults.js','src/domain/integrated-replay.js','src/domain/integrated-ledger-core.js','src/domain/integrated-ledger.js','src/domain/integrated-ledger-validation.js','src/domain/financial-current.js','src/domain/financial-history.js','src/domain/integrated-spending.js','integrated-schedule-engine.js','integrated-finance-engine.js','src/storage/state-migrations.js','src/storage/snapshot-retention.js','store-state.js','backup.js','core-accessors.js','src/domain/investment-position.js','pension-contributions.js','pension-ledger.js','pension-assets.js','isa-validation.js','isa-ledger.js','isa-registration.js'];
 for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
 const run=(code,args=[])=>vm.runInContext(code,Object.assign(context,{__args:args}));
 run('state=normalizeState(seed);lastPersistedState=clone(state)');
 return{context,storage,run,plain:value=>JSON.parse(JSON.stringify(value))};
}
module.exports={financialRuntime};
