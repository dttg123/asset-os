const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('v0.6.9 final views and export assets are shipped in the PWA shell',()=>{
 const html=read('index.html'),worker=read('service-worker.js'),release=read('release-v069.js');
 for(const name of ['export-csv.js','release-v069.js','css-release-v069.css']){
  assert.match(html,new RegExp(name.replace('.','\\.')));
  assert.match(worker,new RegExp(`'${name.replace('.','\\.')}'`));
 }
 for(const text of ['이번 달 자금 계획','순금융자산','현금성 자산','투자자산','대출·부채','대출·이자','생활 고정비','가용 현금','월별 납입 내역 정리','분석파일 만들기'])assert.match(release,new RegExp(text));
 assert.match(read('css-release-v069.css'),/pension-future-chart\{height:192px!important\}/);
});

test('insurance schedule linking is idempotent and adopts one matching manual schedule',()=>{
 const state={insurance:{policies:[]},financeSchedules:{items:[]}};
 const context=vm.createContext({state,console,Date,Math,Number,String,Array,Object,RegExp,Set,Map,localYmd:()=> '2026-09-12',financeSchedules:()=>state.financeSchedules.items,normalizeName:value=>String(value||'').replace(/\s/g,'').toLowerCase(),uid:prefix=>`${prefix}-new`,won:value=>`${value}원`,escapeHtml:String});
 vm.runInContext(read('insurance.js'),context);
 const policy={id:'insurance-1',name:'실손보험',company:'A보험',category:'실손',premium:50000,paymentStyle:'monthly',paymentDay:25,contractDate:'2026-01-01',paymentEndDate:'2030-12-31',status:'active',coverages:[]};
 state.insurance.policies.push(policy);
 vm.runInContext("syncInsuranceSchedule(state.insurance.policies[0],true);syncInsuranceSchedule(state.insurance.policies[0],true)",context);
 assert.equal(state.financeSchedules.items.length,1);
 assert.equal(state.financeSchedules.items[0].productId,'insurance-1');
 assert.equal(state.financeSchedules.items[0].day,25);
 state.financeSchedules.items=[{id:'manual-1',name:'건강보험',kind:'insurance',amount:70000,productId:'',day:20,active:true}];
 const policy2={id:'insurance-2',name:'건강보험',company:'B보험',premium:70000,paymentStyle:'monthly',paymentDay:21,status:'active',coverages:[]};
 state.insurance.policies.push(policy2);
 vm.runInContext("syncInsuranceSchedule(state.insurance.policies[1],true)",context);
 assert.equal(state.financeSchedules.items.length,1,'matching manual schedule must be adopted instead of duplicated');
 assert.equal(state.financeSchedules.items[0].id,'manual-1');
 assert.equal(state.financeSchedules.items[0].productId,'insurance-2');
 assert.equal(state.financeSchedules.items[0].day,21);
});

test('Excel CSV output is UTF-8 BOM, quoted safely, and neutralizes formulas',()=>{
 const context=vm.createContext({console,TextEncoder,DataView,Uint8Array,Blob,File:class{},URL:{},document:{},integratedLedger:()=>[],state:{accounts:[]},pensionStore:()=>({transactions:[]}),integratedSummary:()=>({}),integratedSpendingAnalysis:()=>({}),integratedMonthKey:()=>'',integratedTxLabel:()=>'',integratedTxAccountsText:()=>'',txDate:()=>'',typeText:()=>'',holdingName:()=>'',pensionAccount:()=>null,pensionHoldingById:()=>null,localYmd:()=> '2026-09-12',zipDosStamp:()=>({time:0,date:0}),crc32:()=>0});
 vm.runInContext(read('export-csv.js'),context);
 const csv=vm.runInContext("csvTable(['이름','메모'],[['정상','쉼표,포함'],['수식','=HYPERLINK(1)']])",context);
 assert.equal(csv.charCodeAt(0),0xfeff);
 assert.match(csv,/"쉼표,포함"/);
 assert.match(csv,/'=HYPERLINK\(1\)/);
 const entries=vm.runInContext('excelCsvEntries()',context);
 assert.deepEqual(Array.from(entries,x=>x.name),['통합거래.csv','ISA거래.csv','연금거래.csv','월별요약.csv']);
});
