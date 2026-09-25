'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const storage=new Map([['asset-os-v1.9.45-live','LIVE-SENTINEL']]);
const localStorage={get length(){return storage.size},key:i=>[...storage.keys()][i]??null,getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(String(k),String(v)),removeItem:k=>storage.delete(String(k))};
const notices=[];
class FormDataStub{constructor(form){this.values=form.values||{}}get(name){return Object.hasOwn(this.values,name)?this.values[name]:null}}
const context=vm.createContext({
 console,Date,Set,Map,URL,Blob,File:global.File,TextEncoder,TextDecoder,Uint8Array,DataView,ArrayBuffer,Intl,Math,JSON,Number,String,Boolean,Object,RegExp,Promise,
 FormData:FormDataStub,localStorage,navigator:{},location:{search:'?qa=1',hash:'#/integrated/ledger',pathname:'/asset-os/'},history:{replaceState(){}},
 document:{querySelector:()=>null,querySelectorAll:()=>[],documentElement:{dataset:{},classList:{add(){},remove(){}},scrollHeight:0},body:{dataset:{}}},
 window:{addEventListener(){},removeEventListener(){},scrollTo(){},isSecureContext:false},requestAnimationFrame:fn=>fn(),setTimeout:()=>0,clearTimeout(){},
 toast:message=>notices.push(String(message)),closeSheets(){},render(){},haptic(){},nav(rootName,tab){context.location.hash=`#/${rootName}/${tab||''}`}
});
vm.runInContext('let integratedAssetsExpanded=false',context);
const files=['core-config.js','broker-kis.js','data-defaults.js','integrated-ledger-engine.js','integrated-schedule-engine.js','integrated-finance-engine.js','store-state.js','core-accessors.js','core-visual-utils.js','pension-contributions.js','pension-ledger.js','pension-assets.js','isa-validation.js','isa-ledger.js','isa-registration.js','integrated-forms.js','integrated-pages.js','home.js'];
for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const run=(source,args=[])=>vm.runInContext(source,Object.assign(context,{__args:args})),plain=value=>JSON.parse(JSON.stringify(value));

test('30 years are entered one user action at a time and every month stays consistent',()=>{
 run(`
  state=normalizeState(seed);lastPersistedState=clone(state);sheetDirty=false;integratedLedgerSearch='';integratedSearchDisplayLimit=50;
  persist=()=>true;nav=(rootName,tab)=>{location.hash='#/'+rootName+'/'+(tab||'')};
  state.accounts=[{id:'isa-30y',name:'장기 ISA',broker:'QA',type:'일반형',status:'active',openedAt:'2031-01-01',maturityAt:'2061-12-31',policyId:'isa-policy-2026-official',policyHistory:[{policyId:'isa-policy-2026-official',effectiveFrom:'2031-01-01',effectiveTo:null}],baselineDate:'2031-01-01',baselineCash:0,cashOpening:0,annualContribution:0,contributionBaseline:0,contributionBaselineYear:'2031',carryoverLimit:0,withdrawnPrincipal:0,taxBreakdown:{gains:0,losses:0,dividends:0,expenses:0},holdings:[{id:'isa-etf',name:'장기지수 ETF',investmentRole:'성장',assetClass:'국내주식 ETF',productType:'ETF',baselineQty:0,baselineAvg:0,qty:0,avgPrice:0,currentPrice:100000}],transactions:[],reconciliations:[],maturity:null}];
  state.pension.accounts=[{id:'ps-30y',kind:'pension',name:'장기 연금저축',status:'active',openedAt:'2031-01-01'},{id:'irp-30y',kind:'irp',name:'장기 IRP',status:'active',openedAt:'2031-01-01'}];
  state.pension.holdings=[{id:'ps-etf',accountId:'ps-30y',name:'연금지수 ETF',investmentRole:'성장',assetClass:'성장',baselineQty:0,baselineAvgPrice:0,qty:0,avgPrice:0,currentPrice:100000},{id:'irp-etf',accountId:'irp-30y',name:'IRP지수 ETF',investmentRole:'성장',assetClass:'성장',baselineQty:0,baselineAvgPrice:0,qty:0,avgPrice:0,currentPrice:150000,risky:true}];
  setting().selectedAccountId='isa-30y';
  globalThis.userSave=(values,dataset={})=>{const before=state.integrated.ledger.length;saveIntegratedTransaction({values,dataset});return state.integrated.ledger.length-before};
  globalThis.isaSave=(candidate)=>{const a=state.accounts[0],date=String(candidate.date),tx={...candidate,id:uid('tx'),tradeDate:date,date,sequence:nextSequence(a,date),createdAt:date+'T12:00:00.000Z'};tx.idempotencyKey=stableTxKey(tx);if(findDuplicateTransaction(a,tx))return{ok:false,error:'duplicate'};const next=[...a.transactions.map(t=>({...t})),tx],result=replay(a,next);if(!result.valid)return{ok:false,error:result.error};a.transactions=next;rebuildLedgerIndexes(a);return{ok:true,tx}};
 `);

 assert.equal(run(`userSave({date:'2031-01-01',amount:'3000000',toAccountId:'cash-main',category:'시작 잔액'},{systemType:'openingAsset'})`),1);
 const months=[];
 for(let year=2031;year<=2060;year++)for(let month=1;month<=12;month++)months.push(`${year}-${String(month).padStart(2,'0')}`);
 assert.equal(months.length,360);

 let saves=1,isaTrades=0,pensionTrades=0,refunds=0,edits=0,rejections=0,views=0;
 for(let index=0;index<months.length;index++){
  const key=months[index],year=Number(key.slice(0,4)),month=Number(key.slice(5,7)),salary=4200000+(year-2031)*30000,living=1350000+(index%7)*45000;
  assert.equal(run(`userSave(__args[0])`,[{date:`${key}-25`,uiType:'externalIncome',amount:String(salary),category:'월급',note:'실사용 월급'}]),1,`${key} 월급 저장`);saves++;
  assert.equal(run(`userSave(__args[0])`,[{date:`${key}-05`,uiType:'lifeExpense',amount:String(living),category:index%3?'생활비':'카드값',note:'실사용 지출'}]),1,`${key} 생활비 저장`);saves++;
  assert.equal(run(`userSave(__args[0])`,[{date:`${key}-26`,uiType:'savingInvestment',amount:'200000',toAccountId:'isa-link',targetIsaAccountId:'isa-30y',category:'ISA 납입'}]),1,`${key} ISA 납입`);saves++;
  assert.equal(run(`userSave(__args[0])`,[{date:`${key}-26`,uiType:'savingInvestment',amount:'300000',toAccountId:'pension-link',targetPensionAccountId:'ps-30y',category:'연금저축 납입'}]),1,`${key} 연금저축 납입`);saves++;
  assert.equal(run(`userSave(__args[0])`,[{date:`${key}-26`,uiType:'savingInvestment',amount:'150000',toAccountId:'irp-link',targetPensionAccountId:'irp-30y',category:'IRP 납입'}]),1,`${key} IRP 납입`);saves++;

  const isa=plain(run(`isaSave(__args[0])`,[{type:'buy',date:`${key}-27`,holdingId:'isa-etf',qty:2,price:100000,fee:0,tax:0,note:'월 적립매수'}]));
  assert.equal(isa.ok,true,`${key} ISA 매수: ${isa.error||''}`);isaTrades++;
  for(const trade of [{accountId:'ps-30y',holdingId:'ps-etf',type:'buy',date:`${key}-27`,qty:3,price:100000,fee:0,tax:0,note:'월 적립매수'},{accountId:'irp-30y',holdingId:'irp-etf',type:'buy',date:`${key}-27`,qty:1,price:150000,fee:0,tax:0,note:'월 적립매수'}]){
   const result=plain(run('pensionTransactionSave(__args[0])',[trade]));assert.equal(result.ok,true,`${key} 연금 매수: ${result.error||''}`);pensionTrades++;
  }

  if(month===6){
   const originalId=run(`state.integrated.ledger.find(t=>t.date===__args[0]&&t.type==='expense').id`,[`${key}-05`]);
   const refund=plain(run(`recordIntegratedRefund(__args[0],__args[1],20000)`,[originalId,`${key}-07`]));assert.equal(refund.ok,true,`${key} 부분환불`);refunds++;
  }
  if(index>0&&index%48===0){
   const id=run(`state.integrated.ledger.find(t=>t.date===__args[0]&&t.type==='expense').id`,[`${key}-05`]);
   assert.equal(run(`userSave(__args[0],__args[1])`,[{date:`${key}-05`,uiType:'lifeExpense',amount:String(living-10000),category:'수정 생활비',note:'영수증 확인 후 수정'},{editId:id}]),0,`${key} 수정은 건수 유지`);edits++;
  }
  if(index%60===0){
   const before=run('state.integrated.ledger.length');
   run(`userSave(__args[0])`,[{date:`${key}-28`,uiType:'lifeExpense',amount:'999999999999',category:'오입력'}]);
   assert.equal(run('state.integrated.ledger.length'),before,`${key} 잔액초과 차단`);assert.match(notices.at(-1),/잔액이 부족/);rejections++;
  }
  const activity=plain(run('homeMonthActivity(__args[0])',[key]));
  assert.equal(activity.total,activity.living+activity.saving+activity.loan+activity.other,`${key} 홈 월합계`);
  for(const tab of ['summary','ledger','spending','schedule']){const html=String(run('integratedPage(__args[0])',[tab]));assert.doesNotMatch(html,/NaN|undefined|Infinity/,`${key} ${tab}`);assert.ok(html.includes(`${year}년 ${month}월`),`${key} ${tab} 기준 월`);views++}
 }

 assert.deepEqual(plain(run('[integratedIssues(),pensionTransactionIssues(),allIsaIssues(),systemIntegrityIssues()]')),[[],[],[],[]]);
 assert.ok(Object.values(plain(run('integratedReplay().minAssets'))).every(value=>value>=0));
 assert.equal(run("state.accounts[0].transactions.filter(t=>t.type==='buy').length"),360);
 assert.equal(run("state.pension.transactions.filter(t=>t.type==='buy').length"),720);
 assert.equal(run("centralIsaContributionRows().reduce((sum,t)=>sum+t.amount,0)"),72000000);
 assert.equal(run("centralPensionContributionRows().filter(t=>t.kind==='pension').reduce((sum,t)=>sum+t.amount,0)"),108000000);
 assert.equal(run("centralPensionContributionRows().filter(t=>t.kind==='irp').reduce((sum,t)=>sum+t.amount,0)"),54000000);
 assert.equal(run("state.accounts[0].transactions.filter(t=>t.type==='buy').every(t=>Number.isInteger(t.qty))"),true);
 assert.equal(storage.get('asset-os-v1.9.45-live'),'LIVE-SENTINEL');
 assert.deepEqual({months:months.length,saves,isaTrades,pensionTrades,refunds,edits,rejections,views},{months:360,saves:1801,isaTrades:360,pensionTrades:720,refunds:30,edits:7,rejections:6,views:1440});
});
