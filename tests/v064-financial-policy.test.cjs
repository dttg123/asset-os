'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const source=name=>fs.readFileSync(path.join(root,name),'utf8');

test('ISA unused annual room accrues and lifetime payments reduce the cumulative room',()=>{
 const account={id:'isa-1',status:'active',openedAt:'2025-09-29',baselineDate:'2026-09-04',baselineContribution:4548701,contributionBaseline:0,contributionBaselineYear:'2026'};
 const store={accounts:[{id:'isa-link',kind:'isa'}],ledger:[{id:'pay',date:'2026-09-23',type:'internalTransfer',amount:1000000,toAccountId:'isa-link',meta:{targetIsaAccountId:'isa-1'}}]};
 const context=vm.createContext({console,state:{accounts:[account]},localYmd:()=> '2026-09-24',integratedStore:()=>store,policy:()=>({annualLimit:20000000,totalContributionLimit:100000000}),isQaIntegratedFixture:()=>false,isaAccountActiveOnDate:()=>true,isPastAccount:()=>false});
 vm.runInContext(source('core-visual-utils.js'),context);
 const model=vm.runInContext('isaContributionModel(state.accounts[0],"2026-09-24",integratedStore())',context);
 assert.equal(model.eligibleYears,2);
 assert.equal(model.accruedLimit,40000000);
 assert.equal(model.lifetimePaid,5548701);
 assert.equal(model.remaining,34451299);
 assert.equal(model.carryoverAvailable,15451299);
 const capped=vm.runInContext('isaContributionModel({...state.accounts[0],openedAt:"2020-01-01",baselineContribution:0},"2026-09-24",{accounts:[],ledger:[]})',context);
 assert.equal(capped.accruedLimit,100000000);
});

test('ISA tax estimate excludes domestic equity gains and keeps taxable ETF gains',()=>{
 const facts=new Map([['domestic',{realized:500000}],['overseas',{realized:300000}],['dividend',{grossAmount:100000}]]);
 const account={openedAt:'2025-01-01',baselineDate:'2025-01-01',taxBreakdown:{},holdings:[{id:'d',assetClass:'국내주식 ETF'},{id:'o',assetClass:'해외주식 ETF'}],transactions:[{id:'domestic',holdingId:'d',type:'sell',date:'2026-01-01'},{id:'overseas',holdingId:'o',type:'sell',date:'2026-01-02'},{id:'dividend',type:'distribution',date:'2026-01-03',amount:100000,fee:1000,tax:15400}]};
 const context=vm.createContext({console,isPastAccount:()=>false,isaTransactionDateError:()=>'',transactionNumericError:()=>'',sortTxs:x=>x,txDate:x=>x.date});
 vm.runInContext(source('isa-ledger.js'),context);
 context.replay=()=>({facts});
 const result=vm.runInContext(`taxableBreakdown(${JSON.stringify(account)})`,context);
 assert.equal(result.excludedGains,500000);
 assert.equal(result.gains,300000);
 assert.equal(result.dividends,100000);
 assert.equal(result.expenses,-1000);
 assert.equal(result.unclassified,0);
});

test('pension tax credit rate follows the configured income threshold',()=>{
 const settings={pensionTaxProfile:{'2026':{grossSalary:55000000}}};
 const context=vm.createContext({console,state:{pension:{}},setting:()=>settings,policyForYear:()=>({taxCreditRate:.132,lowIncomeTaxCreditRate:.165}),localYmd:()=> '2026-09-24'});
 vm.runInContext(source('pension-contributions.js'),context);
 assert.equal(vm.runInContext('pensionTaxCreditProfile("2026").rate',context),.165);
 settings.pensionTaxProfile['2026'].grossSalary=55000001;
 assert.equal(vm.runInContext('pensionTaxCreditProfile("2026").rate',context),.132);
 delete settings.pensionTaxProfile['2026'];
 assert.equal(vm.runInContext('pensionTaxCreditProfile("2026").configured',context),false);
});

test('ordinary pension contributions stop at 18 million while ISA transfers stay outside it',()=>{
 const context=vm.createContext({console,state:{accounts:[]},integratedStore:()=>({}),isCurrentAccount:()=>false,isQaIntegratedFixture:()=>false,policyForYear:()=>({annualContributionLimit:18000000}),won:n=>`${n}원`});
 vm.runInContext(source('integrated-forms.js'),context);
 const store={accounts:[{id:'pension-link',kind:'pension'}],ledger:[{date:'2026-01-01',type:'externalAssetIn',amount:18000000,toAccountId:'pension-link'},{date:'2026-02-01',type:'externalAssetIn',amount:30000000,toAccountId:'pension-link',meta:{isaTransfer:true}}]};
 context.store=store;
 assert.deepEqual([...vm.runInContext('integratedPolicyLimitIssues(store)',context)],[]);
 store.ledger.push({date:'2026-03-01',type:'externalAssetIn',amount:1,toAccountId:'pension-link'});
 assert.match(vm.runInContext('integratedPolicyLimitIssues(store)[0]',context),/1원 초과/);
});

test('ISA transfer window, unified refresh and shared KIS token cache are wired',()=>{
 const maturity=source('isa-maturity-policy.js'),release=source('release-v069.js'),edge=source('supabase/functions/kis-read/index.ts');
 assert.match(maturity,/transferWindowDays/);
 assert.match(maturity,/isaDateAddDays\(terminationDate/);
 assert.match(release,/data-investment-refresh-all/);
 assert.match(edge,/KIS_APP_KEY/);
 assert.match(edge,/tokenCacheKind/);
 assert.match(edge,/cacheKind/);
});
