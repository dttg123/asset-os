'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const adopted=[];
const context=vm.createContext({
 console,URL,URLSearchParams,String,Number,Date,Promise,setTimeout,clearTimeout,
 brokerKisClient:{adoptSession:session=>{adopted.push(session);return{ok:!!session?.access_token}}}
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','supabase-sync.js'),'utf8'),context,{filename:'supabase-sync.js'});

assert.equal(vm.runInContext('syncBrokerKisSessionFromCloud(null)',context),false);
context.__session={access_token:'GOOGLE_SUPABASE_USER_TOKEN',expires_in:3600,user:{id:'owner'}};
assert.equal(vm.runInContext('syncBrokerKisSessionFromCloud(__session)',context),true);
assert.equal(adopted.length,1);
assert.equal(adopted[0].user.id,'owner');
console.log('KIS cloud session bridge tests: PASS');
