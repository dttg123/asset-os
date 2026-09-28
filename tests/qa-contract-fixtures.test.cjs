'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const replayContext=vm.createContext({Date,Math,Number,String,Object,Array,Map,JSON});
vm.runInContext(fs.readFileSync(path.join(root,'src/domain/integrated-replay.js'),'utf8'),replayContext,{filename:'integrated-replay.js'});
const run=(source,values={})=>vm.runInContext(source,Object.assign(replayContext,values));
const plain=value=>JSON.parse(JSON.stringify(value));

test('independently checked golden ledger cases remain unchanged',()=>{
 const fixture=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/golden/integrated-replay.json'),'utf8'));
 assert.equal(fixture.cases.length,15);
 for(const entry of fixture.cases){
  const result=plain(run('calculateIntegratedReplay(__store,__rows)',{__store:fixture.store,__rows:entry.rows}));
  const actual={cash:result.assets.cash,savings:result.assets.savings,loan:result.liabilities.loan,totalAssets:result.totalAssets,totalDebt:result.totalDebt,netAssets:result.netAssets};
  if(Object.hasOwn(entry.expected,'minCash'))actual.minCash=result.minAssets.cash;
  assert.deepEqual(actual,entry.expected,entry.name);
 }
});

test('legacy and KIS fixtures are stable, redacted and include required failures',()=>{
 const legacyPath=path.join(root,'tests/fixtures/legacy/schema-v4.json');
 const legacy=JSON.parse(fs.readFileSync(legacyPath,'utf8'));
 assert.equal(legacy.schemaVersion,4);
 assert.equal(legacy.data.accounts[0].transactions[0].amount,1000000);
 assert.throws(()=>JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/legacy/truncated-backup.json'),'utf8')),SyntaxError);
 const kis=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/api/kis-responses.json'),'utf8'));
 assert.deepEqual(['empty','invalid','partial','rateLimited','serverError','success','unauthorized'],Object.keys(kis).sort());
 const serialized=JSON.stringify({legacy,kis});
 assert.doesNotMatch(serialized,/\b\d{8}-\d{2}\b/,'full account numbers must not enter fixtures');
 assert.doesNotMatch(serialized,/(?:app|access|refresh)[_-]?(?:key|secret|token)/i,'secrets and tokens must not enter fixtures');
});
