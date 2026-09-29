'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const releaseMeta = JSON.parse(fs.readFileSync(path.join(root, 'release-meta.json'), 'utf8'));
const releaseQuery = `v=${releaseMeta.version}&build=${releaseMeta.build}`;
const releaseCache = `asset-os-v${releaseMeta.version}-build${releaseMeta.build}`;
const workerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

function workerEnvironment() {
  const listeners = new Map();
  const stores = new Map();
  const deleted = [];
  const opened = [];
  let claimed = false;
  let skipped = false;
  let fetchImpl = async request => new Response(`network:${new URL(request.url).pathname}`, { status: 200 });

  const cacheFor = name => {
    if (!stores.has(name)) stores.set(name, new Map());
    const entries = stores.get(name);
    return {
      async addAll(urls) {
        for (const url of urls) entries.set(new URL(url, 'https://example.test/app/').href, new Response(`precache:${url}`));
      },
      async put(request, response) {
        entries.set(typeof request === 'string' ? new URL(request, 'https://example.test/app/').href : request.url, response);
      },
      async match(request) {
        return entries.get(typeof request === 'string' ? new URL(request, 'https://example.test/app/').href : request.url);
      },
    };
  };

  const caches = {
    async open(name) { opened.push(name); return cacheFor(name); },
    async keys() { return [...stores.keys()]; },
    async delete(name) { deleted.push(name); return stores.delete(name); },
    async match(request) {
      for (const entries of stores.values()) {
        const key = typeof request === 'string' ? new URL(request, 'https://example.test/app/').href : request.url;
        if (entries.has(key)) return entries.get(key);
      }
      return undefined;
    },
  };

  const self = {
    registration: { scope: 'https://example.test/app/' },
    location: { origin: 'https://example.test' },
    clients: { async claim() { claimed = true; } },
    async skipWaiting() { skipped = true; },
    addEventListener(type, listener) { listeners.set(type, listener); },
  };
  const context = vm.createContext({
    URL, Request, Response, Promise, Set, Error,
    self, caches,
    fetch: request => fetchImpl(request),
  });
  vm.runInContext(workerSource, context, { filename: 'service-worker.js' });

  const dispatch = async (type, request) => {
    let completion;
    let response;
    const event = {
      request,
      waitUntil(promise) { completion = promise; },
      respondWith(promise) { response = promise; },
    };
    listeners.get(type)(event);
    if (completion) await completion;
    return response ? response : undefined;
  };

  return {
    stores, deleted, opened, dispatch,
    setFetch(fn) { fetchImpl = fn; },
    flags() { return { claimed, skipped }; },
  };
}

test('service worker precaches the shell and removes only stale Asset OS caches', async () => {
  const env = workerEnvironment();
  env.stores.set('asset-os-v0.6.6-old', new Map());
  env.stores.set('unrelated-cache', new Map());

  await env.dispatch('install');
  assert.equal(env.flags().skipped, true);
  const current = env.stores.get(releaseCache);
  assert.ok(current.has('https://example.test/app/index.html'));
  assert.ok(current.has(`https://example.test/app/dist/asset-runtime.js?${releaseQuery}`));

  await env.dispatch('activate');
  assert.equal(env.flags().claimed, true);
  assert.deepEqual(env.deleted, ['asset-os-v0.6.6-old']);
  assert.equal(env.stores.has('unrelated-cache'), true);
});

test('service worker serves the offline shell and cached static files without caching unknown responses', async () => {
  const env = workerEnvironment();
  await env.dispatch('install');
  env.setFetch(async () => { throw new Error('offline'); });

  const navigation = new Request('https://example.test/app/report?oauth=callback');
  Object.defineProperty(navigation, 'mode', { value: 'navigate' });
  const navigationResponse = await env.dispatch('fetch', navigation);
  assert.equal(await navigationResponse.text(), 'precache:./index.html');

  const staticRequest = new Request(`https://example.test/app/dist/asset-ui.js?${releaseQuery}`);
  const staticResponse = await env.dispatch('fetch', staticRequest);
  assert.equal(await staticResponse.text(), `precache:./dist/asset-ui.js?${releaseQuery}`);

  const before = [...env.stores.values()].reduce((sum, entries) => sum + entries.size, 0);
  const unknown = new Request('https://example.test/app/private-api');
  assert.equal(await env.dispatch('fetch', unknown), undefined);
  const after = [...env.stores.values()].reduce((sum, entries) => sum + entries.size, 0);
  assert.equal(after, before);
});

test('service worker refreshes an allowlisted static response from the network', async () => {
  const env = workerEnvironment();
  await env.dispatch('install');
  env.setFetch(async () => new Response('fresh-runtime', { status: 200 }));
  const request = new Request(`https://example.test/app/dist/asset-runtime.js?${releaseQuery}`);
  const response = await env.dispatch('fetch', request);
  assert.equal(await response.text(), 'fresh-runtime');
  await new Promise(resolve => setImmediate(resolve));
  const cached = env.stores.get(releaseCache).get(request.url);
  assert.equal(await cached.text(), 'fresh-runtime');
});
