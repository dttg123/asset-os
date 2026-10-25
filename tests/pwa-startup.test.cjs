'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
async function boot(controller,options={}){
 const events={},result={reloads:0,updates:0,busy:false,hidden:false},timers=[];
 const serviceWorker={controller,register:async()=>{if(options.duringRegister){serviceWorker.controller={};events.controllerchange?.()}return{update:async()=>{result.updates++;if(options.duringUpdate){serviceWorker.controller={};events.controllerchange?.()}}}},addEventListener:(event,callback)=>events[event]=callback};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../pwa.js'),'utf8'),{navigator:{serviceWorker},window:{addEventListener:(event,callback)=>events[event]=callback},document:{get visibilityState(){return result.hidden?'hidden':'visible'},querySelector:()=>result.busy?{}:null,addEventListener:(event,callback)=>events[event]=callback},setInterval:fn=>{timers.push(fn);return timers.length},clearInterval:()=>{},location:{reload:()=>result.reloads++}});
 await events.load();return{serviceWorker,events,result,timers};
}
test('first worker claim leaves the fresh app open; a later replacement updates it',async()=>{
 const x=await boot(null);x.serviceWorker.controller={};x.events.controllerchange();x.events.controllerchange();assert.equal(x.result.reloads,0);assert.equal(x.result.updates,1);x.serviceWorker.controller={};x.events.controllerchange();assert.equal(x.result.reloads,1);
});
test('existing controller replacement reloads once and repeated events do not loop',async()=>{
 const x=await boot({});x.serviceWorker.controller={};x.events.controllerchange();x.events.controllerchange();assert.equal(x.result.reloads,1);
});
for(const phase of ['duringRegister','duringUpdate'])test(`worker activation ${phase} cannot outrun the reload listener`,async()=>{const x=await boot({},{[phase]:true});assert.equal(x.result.reloads,1)});
test('open input and background visibility defer an update until interaction is safe',async()=>{
 const x=await boot({});x.result.busy=true;x.serviceWorker.controller={};x.events.controllerchange();assert.equal(x.result.reloads,0);x.result.busy=false;x.result.hidden=true;x.timers[0]();assert.equal(x.result.reloads,0);x.result.hidden=false;x.timers[0]();assert.equal(x.result.reloads,1);
});
test('returning to an existing app checks for a new worker without repeated financial writes',async()=>{
 const x=await boot({});x.events.focus();await new Promise(setImmediate);assert.equal(x.result.updates,2);x.result.hidden=true;x.events.visibilitychange();await new Promise(setImmediate);assert.equal(x.result.updates,2);x.result.hidden=false;x.events.visibilitychange();await new Promise(setImmediate);assert.equal(x.result.updates,3);
});
