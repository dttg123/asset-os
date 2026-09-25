'use strict';
const CACHE='asset-os-v0.6.6-build20260926-2';
const ASSETS=['dist/asset-core.js','dist/asset-ledgers.js','dist/asset-ui.js','dist/asset-runtime.js','dist/asset-os.css','service-worker.js'];
const SHELL=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png',...ASSETS.map(name=>`./${name}?v=0.6.6&build=20260926-2`)];
const STATIC_PATHS=new Set([...ASSETS,'manifest.webmanifest','icon-192.png','icon-512.png'].map(name=>new URL(name,self.registration.scope).pathname));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE&&key.startsWith('asset-os-')).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin)return;if(request.mode==='navigate'){event.respondWith(fetch(request).catch(()=>caches.match('./index.html')));return}if(!STATIC_PATHS.has(url.pathname))return;event.respondWith(fetch(request).then(response=>{if(response?.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy))}return response}).catch(()=>caches.match(request).then(cached=>cached||Promise.reject(new Error('offline resource unavailable')))))});
