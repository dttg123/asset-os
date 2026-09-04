'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const html=read('index.html');
const pages=read('pension-pages.js');
const sheets=read('ui-sheets.js');
const income=read('chart-income.js');
const dividends=read('chart-dividends.js');
const ai=read('ai-strategy.js');

assert.doesNotMatch(html,/data-profile-action="(?:source-archive|install)"/,'removed profile rows must stay removed');
assert.doesNotMatch(html,/data-profile-action="accounts"/,'ISA account management must stay in policy management, not profile');
assert.doesNotMatch(html,/data-profile-action="ai-strategy"/,'AI strategy must not be placed in profile');
assert.match(pages,/scope==='all'\?'<button class="ai-strategy-entry" data-ai-strategy>/,'AI entry must be rendered only for the all scope');
assert.match(sheets,/previous==='#profileSheet'/,'opening a profile child must retain the profile parent');
assert.match(sheets,/parent\.scrollTop=scrollTop/,'returning to profile must restore its scroll position');
assert.match(income,/variant:'income-analysis'/,'pension income analysis must use the fixed-height sheet');
assert.match(dividends,/variant:'income-analysis'/,'ISA dividend analysis must use the fixed-height sheet');
for(const key of ['additionalInvestmentWon','productCode','assetSnapshots','contributions','brokerOrders','income'])assert.match(ai,new RegExp(`\\b${key}\\b`),`AI export field missing: ${key}`);
assert.doesNotMatch(ai,/\\bisa\\s*:/i,'pension AI export must not serialize ISA data');
for(const secret of ['accountNo','accessToken','appSecret'])assert.doesNotMatch(ai,new RegExp(`\\b${secret}\\s*:`),`AI export must not serialize ${secret}`);

console.log('profile, sheet and AI placement tests: PASS');
