'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync('supabase/functions/kis-read/index.ts','utf8').replace(/^import .*\n/gm,''));

test('concurrent refresh requests reuse a token completed before the second lock acquisition',async()=>{
 let cache=null,reads=0,claims=0,issued=0,finish;
 const saved=new Promise(resolve=>finish=resolve);
 const db={
  from(){return{
   select(){return this},eq(){return this},
   async maybeSingle(){reads++;return{data:reads<=2?null:cache,error:null}},
   update(){return this},
   async upsert(value){cache=value;finish();return{error:null}},
   then(resolve){resolve({error:null})}
  }},
  async rpc(){claims++;if(claims===2)await saved;return{data:true,error:null}}
 };
 const context=vm.createContext({Date,URL,URLSearchParams,Response,AbortController,DOMException,setTimeout,clearTimeout,console,
  Deno:{env:{get:()=> 'test-placeholder'},serve(){}},createClient:()=>db,
  fetch:async()=>{issued++;return new Response(JSON.stringify({access_token:'test-token',expires_in:86400}),{status:200})}
 });
 vm.runInContext(source+'\nthis.tokens={accessToken,readValidToken};',context);
 const cfg={appkey:'test-key',appsecret:'test-secret',cano:'test-account',productCode:'29'}; // secret-scan:allow-test-placeholder
 const tokens=await Promise.all([context.tokens.accessToken('pension',cfg),context.tokens.accessToken('pension',cfg)]);
 assert.deepEqual(tokens,['test-token','test-token']);
 assert.equal(claims,2);
 assert.equal(issued,1,'같은 인증정보의 겹친 갱신은 실제 발급 요청이 한 번이어야 한다');
});

test('an invalid cached expiration never counts as a valid token',async()=>{
 const db={from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{access_token:'test-token',expires_at:'invalid'},error:null})})};
 const context=vm.createContext({Date,console,Deno:{serve(){}}});
 vm.runInContext(source+'\nthis.readValidToken=readValidToken;',context);
 assert.equal(await context.readValidToken(db,'pension'),null);
});
