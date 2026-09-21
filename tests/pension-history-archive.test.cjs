'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const records=[
 {id:'p-r-1',kind:'pensionRealized',date:'2025-01-01',label:'연금 손익',amount:120},
 {id:'p-d-1',kind:'pensionDividend',date:'2025-01-01',label:'연금 배당',amount:30},
 {id:'p-r-2',kind:'pensionRealized',date:'2025-02-01',label:'연금 손익',amount:-20},
 {id:'p-d-2',kind:'pensionDividend',date:'2025-02-01',label:'연금 배당',amount:0},
 {id:'i-r-1',kind:'irpRealized',date:'2025-01-01',label:'IRP 손익',amount:80},
 {id:'i-d-1',kind:'irpDividend',date:'2025-01-01',label:'IRP 배당',amount:10},
 {id:'i-r-2',kind:'irpRealized',date:'2025-02-01',label:'IRP 손익',amount:20},
 {id:'i-d-2',kind:'irpDividend',date:'2025-02-01',label:'IRP 배당',amount:5}
];
const state={sourceArchives:{records},pension:{assetSnapshots:[{date:'2026-09-21',pension:{cost:1000,value:1100},irp:{cost:500,value:450}}]}};
const context=vm.createContext({console,Date,Math,Set,Map,String,Number,Array,JSON,state,pensionStore:()=>state.pension,pensionAssetMetrics:scope=>scope==='pension'?{cost:1000,value:1100}:scope==='irp'?{cost:500,value:450}:{cost:1500,value:1550},pensionTightAxisRange:values=>({min:0,max:Math.max(1,...values)*1.1}),pensionCompactWon:value=>String(Math.round(value)),pensionContributionAnalysisMarkup:()=>'',pct:value=>`${value.toFixed(1)}%`,$:()=>null,$$:()=>[],escapeHtml:String,won:value=>`${value}원`,signed:value=>`${value>=0?'+':''}${value}원`,openSheet:()=>{},setTimeout:()=>{}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','source-archive.js'),'utf8'),context,{filename:'source-archive.js'});
const summary=scope=>JSON.parse(vm.runInContext(`JSON.stringify(pensionArchivePerformanceSummary('${scope}'))`,context));

assert.deepEqual({...summary('pension'),rows:undefined},{scope:'pension',rows:undefined,count:4,realized:100,income:30,total:130});
assert.deepEqual({...summary('irp'),rows:undefined},{scope:'irp',rows:undefined,count:4,realized:100,income:15,total:115});
assert.deepEqual({...summary('all'),rows:undefined},{scope:'all',rows:undefined,count:8,realized:200,income:45,total:245});
assert.equal(vm.runInContext("pensionArchiveIncomeRecords('all').length",context),3);
assert.equal(vm.runInContext("pensionArchiveTransactionRows('all').length",context),8);
assert.equal(vm.runInContext("pensionArchiveTransactionRows('pension').length",context),4);
assert.equal(vm.runInContext("pensionArchiveTransactionRows('irp').length",context),4);

vm.runInContext(fs.readFileSync(path.join(__dirname,'..','chart-asset-analysis.js'),'utf8'),context,{filename:'chart-asset-analysis.js'});
assert.equal(vm.runInContext("pensionAnalysisDisplayRows('all','all').length",context),0,'한 점짜리 현재 스냅샷보다 여러 달의 과거 확정자료를 우선해야 한다');
for(const scope of ['all','pension','irp']){
 const markup=vm.runInContext(`pensionAnalysisPeriod='all';pensionAnalysisChartMarkup('${scope}','trend','')`,context);
 assert.match(markup,/확정수익 환산자산/);
 assert.match(markup,/월 단위 · 2개/);
 assert.match(markup,/당시 실제 계좌잔액이 아니라/);
}
state.pension.assetSnapshots.unshift({date:'2026-08-21',pension:{cost:900,value:1000},irp:{cost:400,value:420}});
assert.equal(vm.runInContext("pensionAnalysisDisplayRows('all','all').length",context),2,'실제 평가 스냅샷이 둘 이상이면 실제 자산 추이를 우선해야 한다');
assert.match(vm.runInContext("pensionAnalysisChartMarkup('all','trend','')",context),/평가손익/);

const css=fs.readFileSync(path.join(__dirname,'..','css-release-v069.css'),'utf8');
assert.match(css,/\.pension-kpis\.three\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
assert.match(css,/\.pension-kpis\.three \.pension-kpi:last-child\{grid-column:1\/-1\}/);
assert.doesNotMatch(css,/\.pension-kpis\.three\{grid-template-columns:repeat\(3/);
console.log('pension history archive tests: PASS');
