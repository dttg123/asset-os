'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const token=(issuer,provider='email')=>{const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');return `${encode({alg:'none'})}.${encode({iss:issuer,app_metadata:{provider}})}.signature`};
const location={hash:'',pathname:'/asset-os/',search:''};
const history={replaceState:(_state,_title,url)=>{location.replacedUrl=url;location.hash=''}};
let persistedSession=null;
const auth={onAuthStateChange:()=>({data:{subscription:{unsubscribe:()=>{}}}}),getSession:async()=>({data:{session:null}}),setSession:async value=>{persistedSession=value;return{data:{session:value}}},signOut:async()=>({})};
const context=vm.createContext({console,Date,Set,JSON,String,Number,RegExp,URL,URLSearchParams,atob:value=>Buffer.from(value,'base64').toString('binary'),window:{supabase:{createClient:()=>({auth})}},location,history});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','broker-kis-client.js'),'utf8'),context,{filename:'broker-kis-client.js'});
vm.runInContext("brokerKisClient.configure({projectUrl:'https://kis-project.supabase.co',publishableKey:'public',redirectUrl:'https://example.com/asset-os/'})",context);

location.hash=`#access_token=${token('https://cloud-project.supabase.co/auth/v1')}&expires_in=3600`;
let result=JSON.parse(vm.runInContext('JSON.stringify(brokerKisClient.consumeRedirect())',context));
assert.equal(result.error,'BROKER_REDIRECT_FOREIGN');
assert.ok(location.hash.includes('access_token='),'foreign callback must remain for the cloud client');
assert.equal(vm.runInContext('brokerKisClient.authState().signedIn',context),false);

location.hash=`#access_token=${token('https://kis-project.supabase.co/auth/v1','google')}&expires_in=3600`;
result=JSON.parse(vm.runInContext('JSON.stringify(brokerKisClient.consumeRedirect())',context));
assert.equal(result.error,'BROKER_REDIRECT_FOREIGN');
assert.ok(location.hash.includes('access_token='),'same-project Google callback must remain for the cloud client');
assert.equal(vm.runInContext('brokerKisClient.authState().signedIn',context),false);

location.hash=`#access_token=${token('https://kis-project.supabase.co/auth/v1')}&refresh_token=refresh-kis&expires_in=3600`;
result=JSON.parse(vm.runInContext('JSON.stringify(brokerKisClient.consumeRedirect())',context));
assert.equal(result.ok,true);
assert.equal(location.hash,'');
assert.equal(vm.runInContext('brokerKisClient.authState().signedIn',context),true);
assert.equal(persistedSession.refresh_token,'refresh-kis');
console.log('auth callback isolation tests: PASS');
