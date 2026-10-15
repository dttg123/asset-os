'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function edge(){const c=vm.createContext({Date,Number,String,Math,RegExp,Array,Object,Error});vm.runInContext(fs.readFileSync('supabase/functions/kis-read/core.js','utf8').replaceAll('export function ','function ')+';this.api={normalizeBalance,normalizeOrders,normalizeRights}',c);return c.api}
test('upstream missing or invalid balance amounts are not authoritative zero balances',()=>{
 const api=edge();for(const summary of [{},{dnca_tot_amt:'0'},{dnca_tot_amt:'bad',tot_evlu_amt:'100'},{dnca_tot_amt:'0',tot_evlu_amt:'bad'},{dnca_tot_amt:'-1',tot_evlu_amt:'0'}])assert.throws(()=>api.normalizeBalance({output1:[],output2:[summary]}),/KIS_BALANCE_INVALID/);
 const zero=api.normalizeBalance({output1:[],output2:[{dnca_tot_amt:'0',tot_evlu_amt:'0',scts_evlu_amt:'0'}]});assert.equal(zero.totalValue,0);
});
test('upstream explicit zero total is retained even when components disagree',()=>{
 const v=edge().normalizeBalance({output1:[],output2:[{dnca_tot_amt:'100',tot_evlu_amt:'0',scts_evlu_amt:'0'}]});assert.equal(v.totalValue,0);assert.equal(v.cash,100);
});
test('malformed holdings and collection entries reject the entire upstream result',()=>{
 const api=edge(),summary={dnca_tot_amt:'100',tot_evlu_amt:'200'};
 for(const output1 of [undefined,{},[null],[[]],[{pdno:'QA',hldg_qty:'1'}],[{pdno:'QA',hldg_qty:'bad',evlu_amt:'100'}]])assert.throws(()=>api.normalizeBalance({output1,output2:[summary]}),/KIS_(?:BALANCE|RESULT)_INVALID/);
 for(const value of [undefined,null,'',[null],[[]]]){assert.throws(()=>api.normalizeOrders(value),/KIS_RESULT_INVALID/);assert.throws(()=>api.normalizeRights(value),/KIS_RESULT_INVALID/)}
});
test('upstream malformed dividend amount cannot become a replacement zero payment',()=>{
 const base={rght_type_cd:'32',bass_dt:'20261001',cash_dfrm_dt:'20261015',pdno:'QA'};
 for(const value of [undefined,'','invalid',-1,true])assert.throws(()=>edge().normalizeRights([{...base,last_alct_amt:value}]),/KIS_RIGHTS_INVALID/);
 assert.equal(edge().normalizeRights([{...base,last_alct_amt:'0'}])[0].amount,0);
});
test('upstream missing fill quantity or invalid fill amount cannot erase a confirmed order',()=>{
 const base={ord_dt:'20261015',odno:'1',pdno:'QA',sll_buy_dvsn_cd:'02',ord_qty:'10',tot_ccld_qty:'5',tot_ccld_amt:'500'};
 for(const patch of [{tot_ccld_qty:undefined},{tot_ccld_qty:'bad'},{tot_ccld_amt:'bad'},{tot_ccld_qty:-1}])assert.throws(()=>edge().normalizeOrders([{...base,...patch}]),/KIS_ORDERS_INVALID/);
 assert.equal(edge().normalizeOrders([{...base,tot_ccld_qty:'0',tot_ccld_amt:'0'}])[0].filledQty,0);
});
test('client rejects missing result collections before invoking persistence',async()=>{
 const imported=[];let payload;
 const c=vm.createContext({console,Date,Set,JSON,String,Number,RegExp,URLSearchParams,AbortController,setTimeout,clearTimeout,window:{__assetOS:{brokerKis:{importOrders:()=>{imported.push('orders');return{ok:true}},importRights:()=>{imported.push('rights');return{ok:true}}}}},fetch:async()=>({ok:true,status:200,text:async()=>JSON.stringify(payload)})});
 vm.runInContext(fs.readFileSync('broker-kis-client.js','utf8')+';this.client=brokerKisClient',c);c.client.configure({projectUrl:'https://project.supabase.co',publishableKey:'PUBLIC_QA'});c.client.adoptSession({access_token:'QA_MEMORY',expires_in:3600});
 for(const action of ['orders','rights'])for(const value of [undefined,null,{},'']){payload={ok:true,action,accountKind:'pension',fetchedAt:'2026-10-15T01:00:00Z',[action]:value};const result=await c.client.sync(action,'pension','qa');assert.equal(result.ok,false);}
 assert.deepEqual(imported,[]);
 for(const action of ['orders','rights']){payload={ok:true,action,accountKind:'pension',fetchedAt:'2026-10-15T01:00:00Z',[action]:[]};assert.equal((await c.client.sync(action,'pension','qa')).ok,true)}assert.deepEqual(imported,['orders','rights']);
});
