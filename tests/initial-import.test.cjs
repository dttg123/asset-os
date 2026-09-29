'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','initial-import.js'),'utf8');
const clone=value=>structuredClone(value);

function fixtureState(){
 return{
  financialProducts:{items:[{id:'keep',name:'기존 상품'},{id:'replace',name:'변경 전'}],events:[]},
  financeSchedules:{items:[]},integrated:{accounts:[],liabilities:[],ledger:[]},insurance:{policies:[]},sourceArchives:{records:[]},
  pension:{accounts:[{id:'pension-main',kind:'pension',status:'active',openedAt:'2030-01-01'}],projection:{}},system:{saveError:''}
 };
}

function environment(integrityIssues=[]){
 const context=vm.createContext({
  console,Date,Map,Set,JSON,Promise,structuredClone,
  state:fixtureState(),seed:{pension:{accounts:[],projection:{}}},KEY:'asset-os',clone,
  buildIntegratedSeed:()=>({accounts:[],liabilities:[],ledger:[]}),normalizeState:value=>value,
  systemIntegrityIssues:()=>integrityIssues,assertImportFileSize(){},showNotice(){},showDialog(){},storeRecoveryCopy(){return true},
  stateEnvelopeJson:JSON.stringify,persist:()=>true,closeSheets(){},render(){},toast(){}
 });
 vm.runInContext(`${source}\nthis.api={mergeRowsById,resolveInitialImportPlaceholders,buildInitialImportCandidate};`,context);
 return context;
}

test('initial import preserves unrelated rows and replaces only matching ids',()=>{
 const context=environment(),before=clone(context.state);
 const next=context.api.buildInitialImportCandidate({format:'asset-os-merge-v1',data:{financialProducts:{items:[{id:'replace',name:'변경 후'},{id:'new',name:'새 상품'}]}}});
 assert.equal(next.financialProducts.items.find(row=>row.id==='keep').name,'기존 상품');
 assert.equal(next.financialProducts.items.find(row=>row.id==='replace').name,'변경 후');
 assert.equal(next.financialProducts.items.find(row=>row.id==='new').name,'새 상품');
 assert.deepEqual(context.state,before,'validation must restore the live state after checking the candidate');
});

test('initial import resolves one pension placeholder and moves its opening date back',()=>{
 const context=environment();
 const next=context.api.buildInitialImportCandidate({format:'asset-os-merge-v1',data:{integrated:{ledger:[{id:'deposit-1',date:'2028-05-01',type:'internalTransfer',meta:{targetPensionKind:'pension'}}]}}});
 const transaction=next.integrated.ledger.find(row=>row.id==='deposit-1');
 assert.equal(transaction.meta.targetPensionAccountId,'pension-main');
 assert.equal('targetPensionKind' in transaction.meta,false);
 assert.equal(next.pension.accounts[0].openedAt,'2028-05-01');
});

test('initial import rejects ambiguous placeholders and integrity failures without replacing live state',()=>{
 const ambiguous=environment();
 ambiguous.state.pension.accounts.push({id:'pension-second',kind:'pension',status:'active'});
 assert.throws(()=>ambiguous.api.buildInitialImportCandidate({format:'asset-os-merge-v1',data:{integrated:{ledger:[{id:'deposit-2',date:'2029-01-01',meta:{targetPensionKind:'pension'}}]}}}),/자동 연결할 수 없습니다/);
 const invalid=environment(['원장 불일치']),before=clone(invalid.state);
 assert.throws(()=>invalid.api.buildInitialImportCandidate({format:'asset-os-merge-v1',data:{}}),/무결성 검사 실패/);
 assert.deepEqual(invalid.state,before);
});
