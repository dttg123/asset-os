'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const context=vm.createContext({console,Date,Math,Number,String,Object,Array,Map,Set,JSON});
for(const file of ['src/domain/integrated-replay.js','src/domain/integrated-ledger-core.js','src/domain/integrated-ledger.js','src/domain/integrated-ledger-validation.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
Object.assign(context,{postedDateError:date=>/^\d{4}-\d{2}-\d{2}$/.test(String(date||''))?'':'날짜 오류',isaAccountsForDate:()=>context.__isaAccounts||[],pensionAccountsForKind:()=>context.__pensionAccounts||[],financialProducts:()=>context.__products||[],financeProductAccountId:id=>`finance-asset-${id}`,financeProductLiabilityId:id=>`finance-debt-${id}`,won:value=>`${value}원`});
const run=(source,values={})=>vm.runInContext(source,Object.assign(context,values));
const plain=value=>JSON.parse(JSON.stringify(value));

test('valid integrated ledger has no validation issues',()=>{
 const store={accounts:[{id:'cash-main',kind:'cash'}],liabilities:[],ledger:[{id:'open',type:'openingAsset',date:'2026-01-01',amount:100,toAccountId:'cash-main'}]};
 assert.deepEqual(plain(run('integratedIssues(__store)',{__store:store})),[]);
});

test('structural, reference and negative-balance errors are all reported',()=>{
 const store={accounts:[{id:'cash-main',kind:'cash'},{id:'cash-main',kind:'cash'}],liabilities:[{id:'loan'},{id:'loan'}],ledger:[{id:'bad',type:'unknown',date:'bad',amount:0,fromAccountId:'missing'},{id:'same',type:'internalTransfer',date:'2026-01-01',amount:10,fromAccountId:'cash-main',toAccountId:'cash-main'},{id:'negative',type:'expense',date:'2026-01-02',amount:20,fromAccountId:'cash-main'}]};
 const issues=plain(run('integratedIssues(__store)',{__store:store}));
 for(const expected of ['자산 계좌 ID 중복','부채 ID 중복','날짜 오류','거래유형 오류','금액 오류','출금계좌 없음','동일계좌 이체','자산 잔액 음수'])assert.ok(issues.some(issue=>issue.includes(expected)),expected);
});

test('ambiguous targets, invalid refunds and ended balances remain guarded',()=>{
 const store={accounts:[{id:'cash-main',kind:'cash'},{id:'isa-link',kind:'isa'},{id:'pension-link',kind:'pension'},{id:'finance-asset-ended',kind:'deposit'}],liabilities:[],ledger:[{id:'cash',type:'openingAsset',date:'2026-01-01',amount:1000,toAccountId:'cash-main'},{id:'ended',type:'openingAsset',date:'2026-01-01',amount:50,toAccountId:'finance-asset-ended'},{id:'isa',type:'internalTransfer',date:'2026-02-01',amount:100,fromAccountId:'cash-main',toAccountId:'isa-link'},{id:'pension',type:'externalAssetIn',date:'2026-02-01',amount:100,toAccountId:'pension-link',meta:{targetPensionAccountId:'wrong'}},{id:'purchase',type:'expense',date:'2026-02-02',amount:100,fromAccountId:'cash-main'},{id:'refund-a',type:'refund',date:'2026-02-03',amount:70,toAccountId:'cash-main',meta:{refundOf:'purchase'}},{id:'refund-b',type:'refund',date:'2026-02-04',amount:40,toAccountId:'cash-main',meta:{refundOf:'purchase'}},{id:'refund-missing',type:'refund',date:'2026-02-05',amount:1,toAccountId:'cash-main',meta:{refundOf:'none'}}]};
 context.__isaAccounts=[{id:'isa-a'},{id:'isa-b'}];context.__pensionAccounts=[{id:'pension-a'}];context.__products=[{id:'ended',name:'종료예금',type:'deposit',status:'ended'}];
 const issues=plain(run('integratedIssues(__store)',{__store:store}));
 for(const expected of ['ISA 납입 대상 미지정','연금 납입 대상 날짜 불일치','환불 누계가 원거래 금액을 초과','환불 원거래 또는 날짜 오류','종료상품 잔액 잔존'])assert.ok(issues.some(issue=>issue.includes(expected)),expected);
});
