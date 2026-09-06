'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');

test('long-term transaction search is available without changing stored ledgers',()=>{
 const integrated=fs.readFileSync(path.join(root,'integrated-pages.js'),'utf8');
 const pension=fs.readFileSync(path.join(root,'pension-forms.js'),'utf8');
 const ui=fs.readFileSync(path.join(root,'ui-render.js'),'utf8');
 const store=fs.readFileSync(path.join(root,'store-state.js'),'utf8');
 assert.match(integrated,/전체 기간 날짜·금액·분류·메모 검색/);
 assert.match(integrated,/searching\?integratedLedger\(\):integratedRowsForMonth\(month\)/);
 assert.match(integrated,/integratedTransactionSearchText\(t\)\.includes\(needle\)/);
 assert.match(pension,/종목·날짜·금액·계좌·메모 검색/);
 assert.match(pension,/allRows\.filter\(t=>pensionTransactionSearchText\(t\)\.includes\(needle\)\)/);
 assert.match(ui,/data-integrated-search-form/);
 assert.match(ui,/data-pension-search-form/);
 assert.doesNotMatch(store,/settings.*TransactionSearch/i);
 const context={pensionStore:()=>({holdings:[]}),pensionHoldingById:()=>null,pensionAccount:()=>null,pensionTradeLabel:type=>type==='buy'?'매수':type};
 vm.runInNewContext(integrated,context);
 vm.runInNewContext(pension,context);
 assert.equal(context.transactionSearchKey(['2060-12-27','324,000원']),'2060-12-27324000원');
 assert.match(context.integratedTransactionSearchText({date:'2060-12-27',type:'expense',category:'생활용품',note:'QA 메모',amount:324000}),/생활용품.*qa메모.*324000/);
 assert.match(context.pensionTransactionSearchText({date:'2060-12-25',type:'buy',productName:'미국 S&P500 ETF',amount:1233300}),/2060-12-25.*매수.*미국s&p500etf.*1233300/);
 assert.match(context.pensionTransactionSearchText({date:'2060-12-25',type:'buy',accountKind:'pension',productName:'미국지수'}),/연금저축/);
});
