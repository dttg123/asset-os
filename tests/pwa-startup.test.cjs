'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
async function boot(controller){
 const events={},cache=new Map(),result={reloads:0,updates:0};
 const serviceWorker={controller,register:async()=>({update:async()=>{result.updates++}}),addEventListener:(event,callback)=>events[event]=callback};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../pwa.js'),'utf8'),{navigator:{serviceWorker},window:{addEventListener:(event,callback)=>events[event]=callback},sessionStorage:{getItem:key=>cache.get(key),setItem:(key,value)=>cache.set(key,value)},location:{reload:()=>result.reloads++}});
 await events.load();return{serviceWorker,events,result};
}
test('first service-worker claim keeps the fresh app and active user interaction open',async()=>{
 const x=await boot(null);x.serviceWorker.controller={};x.events.controllerchange();x.events.controllerchange();assert.equal(x.result.reloads,0);assert.equal(x.result.updates,1);
});
test('an existing controller changing for an update reloads at most once',async()=>{
 const x=await boot({});x.serviceWorker.controller={};x.events.controllerchange();x.events.controllerchange();assert.equal(x.result.reloads,1);assert.equal(x.result.updates,1);
});
