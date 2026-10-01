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
 assert.match(common,/setAttribute(?:\?\.)?\('aria-invalid','true'\)/);
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

const vm=require('node:vm');
function validationHarness(field){
 const box={textContent:'',hidden:true},classes=new Set(),form={querySelector:()=>box,querySelectorAll:()=>[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)},elements:{namedItem:()=>field}};
 const ctx=vm.createContext({form});vm.runInContext(read('core-visual-utils.js'),ctx);return{ctx,box,classes};
}
test('validation feedback remains visible for a same-name radio group',()=>{
 const {ctx,box,classes}=validationHarness({length:2,0:{},1:{},value:'choice'});
 assert.equal(vm.runInContext("formShowError(form,'금액을 확인해 주세요.','amount')",ctx),true);
 assert.equal(box.hidden,false);assert.equal(box.textContent,'금액을 확인해 주세요.');assert.ok(classes.has('has-validation-error'));
});
test('single input validation marks the field and clearing removes feedback',()=>{
 const attrs={},rowClasses=new Set(),field={setAttribute:(k,v)=>attrs[k]=v,closest:()=>({classList:{add:x=>rowClasses.add(x)}})};
 const {ctx,box,classes}=validationHarness(field);
 vm.runInContext("formShowError(form,'금액을 확인해 주세요.','amount')",ctx);
 assert.equal(attrs['aria-invalid'],'true');assert.ok(rowClasses.has('has-error'));
 vm.runInContext('formClearError(form)',ctx);assert.equal(box.hidden,true);assert.equal(box.textContent,'');assert.equal(classes.size,0);
});
test('integrated form ignores non-control event targets and validates a real amount input',()=>{
 class Input{constructor(name){this.name=name;this.dataset={}}}class Select extends Input{}class TextArea extends Input{}
 const handlers={},form={elements:{},addEventListener:(name,fn)=>handlers[name]=fn},nodes={};
 const ctx=vm.createContext({HTMLInputElement:Input,HTMLSelectElement:Select,HTMLTextAreaElement:TextArea,$:s=>s==='#integratedTxForm'?form:(nodes[s]??={}),integratedStore:()=>({ledger:[]}),localYmd:()=> '2026-10-02',integratedSelectedMonth:()=> '2026-10',integratedFormMarkup:()=>'',openSheet:()=>{},syncIntegratedFormFields:()=>{},formClearError:()=>{},sheetDirty:false,validationCalls:0});
 vm.runInContext(read('integrated-forms.js'),ctx);
 vm.runInContext("integratedFormLiveError=()=>{validationCalls++;return ''};openIntegratedTransactionForm()",ctx);
 assert.doesNotThrow(()=>handlers.input({target:{}}));assert.equal(ctx.validationCalls,0);
 handlers.input({target:new Input('amount')});assert.equal(ctx.validationCalls,1);assert.equal(ctx.sheetDirty,true);
});
