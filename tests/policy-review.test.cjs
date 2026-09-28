'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const context=vm.createContext({Date,Number,String,Math});
vm.runInContext(fs.readFileSync(path.join(root,'policy-review.js'),'utf8'),context,{filename:'policy-review.js'});
const state=(policy,date)=>JSON.parse(JSON.stringify(vm.runInContext(`policyReviewState(${JSON.stringify(policy)},'${date}')`,context)));

test('180-day policy review boundary is exact',()=>{
 const policy={verifiedAt:'2026-01-01'};
 assert.notEqual(state(policy,'2026-06-29').code,'needs-review','179일에는 아직 만료가 아니다');
 assert.equal(state(policy,'2026-06-30').code,'needs-review','180일째부터 재확인이 필요하다');
 assert.equal(state(policy,'2026-07-01').code,'needs-review','181일에도 재확인이 필요하다');
});

test('calendar-year change requires review without changing values',()=>{
 const policy={verifiedAt:'2026-12-31',annualLimit:20000000,taxRate:.099};
 assert.notEqual(state(policy,'2026-12-31').code,'needs-review');
 assert.equal(state(policy,'2027-01-01').code,'needs-review');
 assert.equal(policy.annualLimit,20000000);
 assert.equal(policy.taxRate,.099);
});

test('review-soon state appears during the final 30 days',()=>{
 const review=state({verifiedAt:'2026-01-01'},'2026-06-01');
 assert.equal(review.code,'review-soon');
 assert.equal(review.label,'재검토 예정');
});

test('official policies carry version, effective date, review date and source URL',()=>{
 const data=fs.readFileSync(path.join(root,'data-defaults.js'),'utf8');
 for(const field of ['version','effectiveFrom','verifiedAt','reviewAfter','sourceLabel','sourceUrl'])assert.match(data,new RegExp(`${field}:`));
 assert.match(data,/https:\/\/www\.law\.go\.kr\/법령\/조세특례제한법/);
});
