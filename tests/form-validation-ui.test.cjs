'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('financial forms expose accessible inline validation feedback',()=>{
 const common=read('core-visual-utils.ts'),css=read('css-isa.css'),integrated=read('ui-render.ts');
 assert.match(common,/data-form-error role="alert" aria-live="polite"/);
 assert.match(common,/setAttribute\?\.\('aria-invalid','true'\)/);
 assert.match(common,/removeAttribute\('aria-invalid'\)/);
 assert.match(css,/\.form-validation-message/);
 assert.match(css,/\.field\.has-error/);
 assert.match(integrated,/formValidationMarkup\(\)/);
});

test('integrated, ISA and pension transaction forms validate before saving',()=>{
 const integrated=read('integrated-forms.ts'),isa=read('isa-registration.ts'),pension=read('pension-forms.ts');
 assert.match(integrated,/function integratedFormLiveError/);
 assert.match(integrated,/formShowError\(form,error\)/);
 assert.match(isa,/function isaTradeFormError/);
 assert.match(isa,/insertAdjacentHTML\('beforebegin',formValidationMarkup\(\)\)/);
 assert.match(isa,/formShowError\(form,error\)/);
 assert.match(pension,/function pensionTradeFormError/);
 assert.match(pension,/insertAdjacentHTML\('beforebegin',formValidationMarkup\(\)\)/);
 assert.match(pension,/formShowError\(form,error\)/);
});
