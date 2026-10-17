'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {financialRuntime}=require('./support/financial-runtime.cjs');
async function setup(){
 const e=financialRuntime({qa:false});const fixed=Date.parse('2026-10-14T12:00:00Z');e.context.Date=class extends Date{constructor(...args){super(...(args.length?args:[fixed]))}static now(){return fixed}};
 (await e.run(`state.accounts=[];state.pension.accounts=[{id:'p',kind:'pension',status:'active',openedAt:'2025-01-01'}];state.pension.assetSnapshots=[{date:'2026-09-28',pension:{cost:80000,value:100000},meta:{autoSnapshot:true,source:{pension:'kis'}}},{date:'2026-10-13',pension:{cost:90000,value:135398,cash:51361},meta:{autoSnapshot:true,source:{pension:'kis'}}}];state.integrated.accounts=[{id:'cash',kind:'cash'}];state.integrated.liabilities=[];state.integrated.ledger=[{id:'old',date:'2018-01-01',type:'openingAsset',amount:50000,toAccountId:'cash',meta:{}}];state.brokerKis.balanceSnapshots=[{date:'2026-10-13',accountKind:'pension',accountId:'p',authoritative:true,totalValue:100000,securitiesValue:84037,cash:51361,cashDetail:{settledCash:15963},fetchedAt:'2026-10-13T01:00:00Z'}]`));
 return e;
}
test('history: incomplete requested baseline advances to evidence and avoids invented gains',async ()=>{
 const e=(await setup()),b=e.plain((await e.run(`financialGrowthBreakdown('2026-04-14','2026-10-14')`)));
 assert.equal(b.start.asOf,'2026-09-28');assert.equal(b.start.coverage.complete,true);assert.equal(b.comparable,true);assert.equal(b.netChange,0);assert.equal(b.residual,0);
 const rows=e.plain((await e.run(`financialGrowthSeries('6m')`)));assert.equal(rows[0].asOf,b.start.asOf);assert.equal(rows.at(-1).netAssets,b.end.netAssets);assert.ok(rows.every(x=>x.coverage.complete));
});
test('history: same-day original broker total resolves old automatic history without rewriting sources',async ()=>{
 const e=(await setup()),before=JSON.stringify(e.plain((await e.run('state'))));
 assert.equal((await e.run(`historicalFinancialModel('2026-10-13').pension`)),100000);assert.equal((await e.run(`financialHistoryPensionRow(state.pension.assetSnapshots[1],'pension').cost`)),54602);assert.equal((await e.run(`financialHistoryPensionRow(state.pension.assetSnapshots[1],'pension').cash`)),15963);
 assert.equal(JSON.stringify(e.plain((await e.run('state')))),before);
});
test('history: manual values, wrong-date evidence and incomplete multi-account sources stay untouched',async ()=>{
 for(const change of [`state.pension.assetSnapshots[1].meta.autoSnapshot=false`,`state.brokerKis.balanceSnapshots[0].date='2026-10-12'`,`state.pension.accounts.push({id:'p2',kind:'pension',status:'active',openedAt:'2025-01-01'})`,`state.pension.assetSnapshots[1].pension.value=140000`]){
  const e=(await setup());(await e.run(change));const original=(await e.run('state.pension.assetSnapshots[1].pension.value'));assert.equal((await e.run(`historicalFinancialModel('2026-10-13').pension`)),original,change);
 }
});
test('history: missing comparative evidence is explicit instead of a false zero return',async ()=>{
 const e=(await setup());(await e.run('state.pension.assetSnapshots=[];state.brokerKis.balanceSnapshots=[]'));
 const b=e.plain((await e.run(`financialGrowthBreakdown('2026-04-14','2026-10-14')`)));assert.equal(b.comparable,false);assert.equal(b.rate,null);
});
test('history: known adjustment labels remain separate from external cash, with no event double count',async ()=>{
 const e=(await setup());(await e.run(`state.integrated.ledger.push({id:'support',date:'2026-10-01',type:'adjustment',accountId:'cash',delta:273000,amount:0,category:'정부기여금 누계 반영',meta:{analysisOnly:true}},{id:'interest',date:'2026-10-01',type:'adjustment',accountId:'cash',delta:4230,amount:0,category:'누적 이자 반영',meta:{analysisOnly:true}})`));
 const b=e.plain((await e.run(`financialGrowthBreakdown('2026-09-28','2026-10-14')`)));assert.equal(b.adjustment,277230);assert.equal(b.externalNet,0);assert.equal(b.residual,0);assert.equal(b.netChange,277230);assert.deepEqual(b.adjustmentDetails,[{label:'정부기여금 누계 반영',amount:273000},{label:'누적 이자 반영',amount:4230}]);
});
test('history: a reversed comparison never reads beyond its ending date',async ()=>{
 const e=(await setup()),b=e.plain((await e.run(`financialGrowthBreakdown('2027-01-01','2026-10-14')`)));assert.equal(b.start.asOf,'2026-10-14');assert.equal(b.comparable,false);
});

test('history: an early complete period cannot bridge a later account with missing balances',async ()=>{
 const e=(await setup()),b=e.plain((await e.run(`financialGrowthBreakdown('2018-01-01','2026-10-14')`)));assert.equal(b.start.asOf,'2026-09-28');assert.equal(b.netChange,0);
});

test('history: annual aggregation preserves the exact comparative starting point',async ()=>{
 const e=(await setup());(await e.run('state.pension.accounts=[];state.pension.assetSnapshots=[]'));const rows=e.plain((await e.run(`financialGrowthSeries('all')`))),b=e.plain((await e.run(`financialGrowthBreakdown('2018-01-01','2026-10-14')`)));assert.equal(rows[0].asOf,b.start.asOf);assert.equal(rows.at(-1).asOf,b.end.asOf);assert.equal(new Set(rows.map(x=>x.asOf)).size,rows.length);
});
