'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const storage=new Map();
const localStorage={get length(){return storage.size},key:i=>[...storage.keys()][i]??null,getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(String(k),String(v)),removeItem:k=>storage.delete(String(k))};
const document={querySelector:()=>null,querySelectorAll:()=>[],documentElement:{dataset:{},scrollHeight:0},body:{dataset:{}}};
const window={addEventListener:()=>{},removeEventListener:()=>{},scrollTo:()=>{},isSecureContext:false};
const context=vm.createContext({console,Date,Set,Map,URL,Blob,File:global.File,TextEncoder,TextDecoder,Uint8Array,DataView,ArrayBuffer,Intl,Math,JSON,Number,String,Boolean,Object,RegExp,Promise,encodeURIComponent,decodeURIComponent,localStorage,document,window,navigator:{},location:{hash:''},requestAnimationFrame:fn=>fn(),setTimeout:()=>0,clearTimeout:()=>{}});
const files=['core-config.js','broker-kis.js','data-defaults.js','integrated-ledger-engine.js','integrated-schedule-engine.js','integrated-finance-engine.js','store-migrations.js','store-state.js','core-accessors.js','pension-contributions.js','pension-ledger.js','pension-assets.js','isa-validation.js','isa-ledger.js','isa-registration.js'];
for(const file of files)vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context,{filename:file});
const run=(code,args=[])=>vm.runInContext(code,Object.assign(context,{__args:args}));
const plain=value=>JSON.parse(JSON.stringify(value));
const close=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-8,`${message}: ${actual} !== ${expected}`);

run('state=normalizeState(seed);lastPersistedState=clone(state)');
const account={id:'hard-a',name:'A',status:'active',openedAt:'2026-01-01',baseline:{date:'2026-01-01',cash:10000,contribution:0},baselineDate:'2026-01-01',baselineCash:10000,reconciliationTolerance:10,holdings:[{id:'hard-h',name:'ETF A',baselineQty:0,baselineAvg:0,currentPrice:90}],transactions:[]};
const rows=[
 {id:'t1',type:'buy',holdingId:'hard-h',date:'2026-01-02',tradeDate:'2026-01-02',sequence:1,qty:10.5,price:100,fee:5,tax:0},
 {id:'t2',type:'buy',holdingId:'hard-h',date:'2026-01-03',tradeDate:'2026-01-03',sequence:1,qty:4.5,price:200,fee:5,tax:0},
 {id:'t3',type:'sell',holdingId:'hard-h',date:'2026-01-04',tradeDate:'2026-01-04',sequence:1,qty:5,price:250,fee:2,tax:3},
 {id:'t4',type:'sell',holdingId:'hard-h',date:'2026-01-05',tradeDate:'2026-01-05',sequence:1,qty:10,price:150,fee:1,tax:1},
 {id:'t5',type:'buy',holdingId:'hard-h',date:'2026-01-06',tradeDate:'2026-01-06',sequence:1,qty:2.5,price:80,fee:.5,tax:0},
 {id:'t6',type:'dividend',holdingId:'hard-h',date:'2026-01-07',tradeDate:'2026-01-07',sequence:1,amount:100,fee:1,tax:14}
];
account.transactions=rows;
const result=plain(run('replay(__args[0])',[account]));
assert.equal(result.valid,true);assert.equal(result.holdings[0].qty,2.5);close(result.holdings[0].avgPrice,80.2,'재매수 평균단가');
close(result.realized,783,'부분·전량 매도 실현손익');close(result.income,85,'배당 순수익');close(result.cash,10667.5,'현금 원장');
for(const value of [result.cash,result.realized,result.income,result.holdings[0].qty,result.holdings[0].avgPrice])assert.equal(Number.isFinite(value),true,'NaN/Infinity 금지');

const partial=plain(run('replay(__args[0],__args[1])',[account,rows.slice(0,3)]));
assert.equal(partial.holdings[0].qty,10);close(partial.holdings[0].avgPrice,1960/15,'추가매수 가중평균');close(partial.realized,(250-1960/15)*5-5,'부분매도 손익');
const full=plain(run('replay(__args[0],__args[1])',[account,rows.slice(0,4)]));assert.equal(full.holdings[0].qty,0,'전량 매도 수량');

const invalid={...account,transactions:[{id:'bad',type:'buy',holdingId:'hard-h',date:'2026-01-02',tradeDate:'2026-01-02',sequence:1,qty:1,price:0,fee:0,tax:0}]};
const rejected=plain(run('replay(__args[0])',[invalid]));assert.equal(rejected.valid,false);assert.match(rejected.error,/단가|가격/);
const closedInvalid={...invalid,status:'closed',closedAt:'2026-12-31',cashSnapshot:0,maturity:{actualSettlement:0,actualReceived:0,actualTax:0}};
const closedIssues=plain(run('consistencyIssues(__args[0])',[closedInvalid]));assert.ok(closedIssues.some(x=>x.severity==='high'),'종료 ISA도 스냅샷만 읽고 원장 오류를 숨기면 안 된다');
const reconcileAccount={...account,holdings:[],transactions:[],reconciliations:[],baseline:{date:'2026-01-01',cash:100,contribution:0},baselineCash:100};
const reconcileBefore=plain(reconcileAccount),reconcileResult=plain(run('applyReconcileSnapshot(__args[0],__args[1])',[reconcileAccount,{asOf:'2026-01-10',mode:'cash',holdings:[{name:'신규 A',qty:1,avg:10,price:10},{name:'신규 B',qty:10,avg:100,price:100}]}]));
assert.equal(reconcileResult.ok,false);assert.deepEqual(reconcileAccount,reconcileBefore,'잔고 대조 중 한 항목이 실패하면 앞선 항목도 원본에 남으면 안 된다');

const other={...account,id:'hard-b',baseline:{...account.baseline,cash:5000},baselineCash:5000,holdings:[{...account.holdings[0],id:'hard-h-b',name:'ETF B'}],transactions:[{id:'b1',type:'buy',holdingId:'hard-h-b',date:'2026-01-02',tradeDate:'2026-01-02',sequence:1,qty:1,price:1000,fee:0,tax:0}]};
const otherResult=plain(run('replay(__args[0])',[other]));assert.equal(otherResult.cash,4000);assert.equal(otherResult.holdings[0].qty,1);assert.equal(result.holdings[0].qty,2.5,'계좌 A가 B 계산으로 변하면 안 된다');

const bondAccount={id:'bond-a',name:'나무 ISA',status:'active',openedAt:'2025-09-29',baseline:{date:'2026-09-04',cash:26817,contribution:4548701},baselineDate:'2026-09-04',baselineCash:26817,holdings:[{id:'bond-h',name:'신한금융조건부(상)15',baselineQty:980000,baselineAvg:1026661/980000*10000,currentPrice:1001825/980000*10000,priceScale:10000,quantityUnit:'face'}],transactions:[]};
const bondMetrics=plain(run('accountMetrics(__args[0])',[bondAccount]));close(bondMetrics.holdingsValue,1001825,'채권 평가금액 단위');close(bondMetrics.cost,1026661,'채권 투자원금 단위');close(bondMetrics.value,1028642,'채권과 현금 합계');assert.equal(run('holdingQuantityText(__args[0])',[bondMetrics.holdings[0]]),'980,000원 액면');

const pensionHolding={id:'ph-a',accountId:'ps-a',name:'연금 ETF',baselineQty:0,baselineAvgPrice:0};
const pensionRows=[{id:'p1',holdingId:'ph-a',type:'buy',date:'2026-01-01',createdAt:'1',qty:3.5,price:100,fee:1,tax:0},{id:'p2',holdingId:'ph-a',type:'buy',date:'2026-01-02',createdAt:'2',qty:1.5,price:200,fee:1,tax:0},{id:'p3',holdingId:'ph-a',type:'sell',date:'2026-01-03',createdAt:'3',qty:5,price:250,fee:0,tax:0},{id:'p4',holdingId:'ph-a',type:'buy',date:'2026-01-04',createdAt:'4',qty:2.5,price:80,fee:.5,tax:0},{id:'other',holdingId:'ph-b',type:'buy',date:'2026-01-01',createdAt:'1',qty:999,price:1,fee:0,tax:0}];
const pensionPos=plain(run('pensionPositionFromLedger(__args[0],__args[1])',[pensionHolding,pensionRows]));assert.equal(pensionPos.qty,2.5);close(pensionPos.avg,80.2,'연금 전량매도 후 재매수 평균단가');
run(`state.pension.accounts=[{id:'ps-delete',kind:'pension',name:'삭제검증',status:'active',openedAt:'2026-01-01'}];state.pension.holdings=[{id:'ph-delete',accountId:'ps-delete',name:'ETF',baselineQty:0,baselineAvgPrice:0}];state.pension.contributions=[{id:'pc-delete',accountId:'ps-delete',date:'2026-01-01',amount:1000,type:'contribution'}];state.pension.transactions=[{id:'buy-delete',accountId:'ps-delete',holdingId:'ph-delete',type:'buy',date:'2026-01-02',createdAt:'1',qty:5,price:100,fee:0,tax:0},{id:'sell-delete',accountId:'ps-delete',holdingId:'ph-delete',type:'sell',date:'2026-01-03',createdAt:'2',qty:5,price:100,fee:0,tax:0}]`);
assert.equal(run("pensionTransactionDelete('buy-delete')"),false);assert.equal(run("state.pension.transactions.some(x=>x.id==='buy-delete')"),true,'앞 거래 삭제로 초과매도가 생기면 삭제 자체를 취소해야 한다');

console.log('ledger hard QA: PASS');
