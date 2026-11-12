'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {financialRuntime}=require('./support/financial-runtime.cjs');
const root=path.resolve(__dirname,'..');

function setup(){
 const runtime=financialRuntime();
 runtime.context.structuredClone=structuredClone;
 for(const file of ['integrated-forms.js','banksalad-import.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),runtime.context,{filename:file});
 runtime.run("toast=()=>{};state.integrated.ledger=[{id:'opening',date:'2026-10-01',type:'openingAsset',amount:50000,toAccountId:'cash-main'}];state.integrated.liabilities=[];state.financeSchedules={items:[]};state.settings.cardAccounts=[{id:'samsung',name:'QA 삼성',issuer:'삼성카드',paymentDay:25}];lastPersistedState=clone(state)");
 return runtime;
}
const screenshot={date:'2026-11-07',time:'22:32:00',sourceType:'지출',group:'미분류',category:'미분류',name:'간편결제 이름',amount:-16583,method:'카드 이용내역',memo:'',origin:'screenshot'};
const purchaseDraft={kind:'purchase',cardId:'samsung',firstPaymentDate:'2026-11-25'};

test('a screenshot supplement survives ZIP and holds the same approval later exported under another merchant name',async()=>{
 const r=setup();
 await r.run('saveBanksaladBatch(__args[0],new Map([[banksaladSourceKey(__args[0][0]),__args[1]]]))',[[screenshot],purchaseDraft]);
 r.run('state=normalizeState(validateBackupPayload(parseBackupZipBytes(createBackupZipBytes())))');
 const before=r.run('JSON.stringify(integratedStore())');
 const excel={...screenshot,time:'22:32:47',name:'나중에 확인한 실제 가맹점',method:'카드 이름'};
 delete excel.origin;
 const review=r.plain(r.run('banksaladReview(__args[0])',[[excel]]));
 assert.equal(review[0].saved,false);
 assert.deepEqual(review[0].issues,['기존 원장과 중복 후보']);
 await assert.rejects(()=>r.run('saveBanksaladBatch(__args[0],new Map([[banksaladSourceKey(__args[0][0]),__args[1]]]))',[[excel],purchaseDraft]),/중복 후보/);
 assert.equal(r.run('JSON.stringify(integratedStore())'),before);
 const duplicate=r.plain(await r.run('saveBanksaladBatch(__args[0],new Map([[banksaladSourceKey(__args[0][0]),__args[1]]]))',[[screenshot],purchaseDraft]));
 assert.equal(duplicate.count,0);
 assert.equal(r.run("integratedSpendingAnalysis('2026-11').total"),16583);
});

test('minute-level screenshot matching works in either import order and preserves different approvals',async()=>{
 const r=setup(),excel={...screenshot,time:'22:32:14',name:'실제 가맹점',method:'카드 이름'};
 delete excel.origin;
 await r.run('saveBanksaladBatch(__args[0],new Map([[banksaladSourceKey(__args[0][0]),__args[1]]]))',[[excel],purchaseDraft]);
 const review=r.plain(r.run('banksaladReview(__args[0])',[[screenshot,{...screenshot,time:'22:33:00'},{...screenshot,amount:-30500}]]));
 assert.deepEqual(review.map(row=>row.issues.length),[1,0,0]);
});
