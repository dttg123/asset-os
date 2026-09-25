'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const requests=[];
let forcedAccountKind='';
const fakeFetch=async(url,options={})=>{
 requests.push({url,options});
 const body=JSON.parse(options.body||'{}');
 if(url.includes('/auth/v1/otp'))return{ok:true,status:200,text:async()=>JSON.stringify({})};
 return{ok:true,status:200,text:async()=>JSON.stringify(body.action==='quote'?{ok:true,action:'quote',fetchedAt:'2026-09-02T00:00:00Z',quotes:[{type:'stock',code:'035720',price:40000}]}:{ok:true,action:body.action,accountKind:forcedAccountKind||body.accountKind,fetchedAt:'2026-09-02T00:00:00Z',balance:{totalValue:123},orders:[],rights:[]})}
};
const imports=[];
const window={__assetOS:{brokerKis:{importBalance:(input,kind,id,at)=>{imports.push({input,kind,id,at});return{ok:true}},importOrders:()=>({ok:true}),importRights:()=>({ok:true})}}};
const location={hash:'',pathname:'/asset-os/',search:''};
const history={replaceState:(_state,_title,url)=>{location.replacedUrl=url}};
const context=vm.createContext({console,Date,Set,JSON,String,Number,RegExp,URLSearchParams,AbortController,DOMException,setTimeout,clearTimeout,queueMicrotask,fetch:fakeFetch,window,location,history});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','broker-kis-client.js'),'utf8'),context,{filename:'broker-kis-client.js'});
const run=(code,args=[])=>vm.runInContext(code,Object.assign(context,{__args:args}));
const plain=value=>JSON.parse(JSON.stringify(value));

assert.deepEqual(plain(run('brokerKisClient.configure(__args[0])',[{projectUrl:'https://project.supabase.co',publishableKey:'PUBLIC_KEY',redirectUrl:'https://example.com/asset-os/'}])),{ok:true});
assert.deepEqual(plain(run('brokerKisClient.authState()')),{configured:true,signedIn:false,expiresAt:0});
(async()=>{
 assert.deepEqual(plain(await run('brokerKisClient.requestOtp("owner@example.com")')),{ok:true});
 assert.match(requests.at(-1).url,/redirect_to=https%3A%2F%2Fexample.com%2Fasset-os/);
 assert.equal(plain(run('brokerKisClient.adoptSession(__args[0])',[{access_token:'USER_JWT_MEMORY_ONLY',expires_in:3600}])).ok,true);
 assert.equal(run('brokerKisClient.authState().signedIn'),true);
 const synced=plain(await run('brokerKisClient.sync("balance","pension","ps-main")'));assert.equal(synced.ok,true);assert.equal(imports.length,1);assert.equal(imports[0].input.totalValue,123);
 forcedAccountKind='irp';const mismatched=plain(await run('brokerKisClient.sync("balance","pension","ps-main")'));assert.deepEqual(mismatched,{ok:false,error:'BROKER_RESPONSE_CONTRACT_INVALID'});assert.equal(imports.length,1,'다른 계좌 종류 응답은 저장하면 안 된다');forcedAccountKind='';
 const invokeRequest=requests.at(-1);assert.equal(invokeRequest.options.headers.authorization,'Bearer USER_JWT_MEMORY_ONLY');assert.equal(JSON.parse(invokeRequest.options.body).accountNumber,undefined,'계좌번호를 브라우저에서 보내면 안 된다');
 const quoted=plain(await run('brokerKisClient.quotes([{type:"stock",code:"035720"}])'));assert.equal(quoted.ok,true);assert.equal(quoted.data.quotes[0].price,40000);const quoteBody=JSON.parse(requests.at(-1).options.body);assert.deepEqual(quoteBody,{action:'quote',quotes:[{type:'stock',code:'035720'}]});assert.equal(quoteBody.accountKind,undefined,'quote must not transmit an account kind or account number');
 const originalFetch=context.fetch,originalSetTimeout=context.setTimeout,originalClearTimeout=context.clearTimeout;context.fetch=(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError'))));context.setTimeout=fn=>{queueMicrotask(fn);return 1};context.clearTimeout=()=>{};
 const timedOut=plain(await run('brokerKisClient.invoke("balance",{accountKind:"pension"})'));assert.deepEqual(timedOut,{ok:false,error:'BROKER_REQUEST_TIMEOUT'});context.fetch=originalFetch;context.setTimeout=originalSetTimeout;context.clearTimeout=originalClearTimeout;
 const all=JSON.stringify({requests,window});assert.equal(all.includes('refresh_token'),false,'refresh token을 앱 상태나 요청 기록에 보관하면 안 된다');
 const source=fs.readFileSync(path.join(__dirname,'..','broker-kis-client.js'),'utf8');assert.match(source,/AbortController/);assert.match(source,/BROKER_REQUEST_TIMEOUT/);
 run('brokerKisClient.signOut()');assert.equal(run('brokerKisClient.authState().signedIn'),false);
 console.log('broker-kis client tests: PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
