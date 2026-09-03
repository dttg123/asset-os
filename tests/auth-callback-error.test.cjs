'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const location={pathname:'/asset-os/',search:'?error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code%3A+4%2F0A',hash:'#error=server_error&error_code=unexpected_failure'};
const history={replaceState:(_state,_title,url)=>{history.url=url}};
const context=vm.createContext({console,URLSearchParams,decodeURIComponent,String,RegExp,location,history,window:{},setTimeout:()=>0,clearTimeout:()=>{}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','supabase-sync.js'),'utf8'),context,{filename:'supabase-sync.js'});
const run=code=>vm.runInContext(code,context);
assert.match(run('cloudAuthCallbackFailure()'),/OAuth Client Secret/);
assert.equal(history.url,'/asset-os/','콜백 오류 파라미터를 주소에 남기면 안 된다');

location.search='?error=invalid_request&error_code=bad_oauth_state&error_description=OAuth+state+has+expired';location.hash='';
assert.match(run('cloudAuthCallbackFailure()'),/만료/);
location.search='';assert.equal(run('cloudAuthCallbackFailure()'),'');
console.log('auth callback error handling tests: PASS');
