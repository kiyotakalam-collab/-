/* Build replaces both placeholders; this file is never registered in dev mode. */
const BUILD = '__BUILD_VERSION__';
const PRECACHE = /* __PRECACHE_URLS__ */ [];
const BASE = new URL('./', self.location.href);
// Multiple project sites can share one github.io origin. Never clear another scope.
const PREFIX = `culture-master-${encodeURIComponent(BASE.pathname)}-`;
const SHELL = `${PREFIX}shell-${BUILD}`;
const IMAGES = `${PREFIX}images-v1`;
const IMAGE_LIMIT = 80;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // A failed shell download prevents activation; the working app stays active.
    await cache.addAll(PRECACHE.map(path => new Request(new URL(path, BASE), { cache: 'reload' })));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(`${PREFIX}shell-`) && key !== SHELL) await caches.delete(key);
    }
    // IndexedDB is deliberately untouched by application updates.
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function imageResponse(request) {
  const shell = await caches.open(SHELL);
  // Only the versioned, public build assets live here. Vary: Origin from a
  // static host must not hide assets fetched without Origin during install.
  const bundled = await shell.match(request, { ignoreVary: true });
  if (bundled) return bundled;
  const cache = await caches.open(IMAGES);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    const bytes = Number(response.headers.get('content-length') || 0);
    if (bytes < 10 * 1024 * 1024) {
      try {
        await cache.put(request, response.clone());
        const keys = await cache.keys();
        await Promise.all(keys.slice(0, Math.max(0, keys.length - IMAGE_LIMIT)).map(key => cache.delete(key)));
      } catch { /* Storage full must not prevent viewing the fetched image. */ }
    }
  }
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const inScope = url.origin === BASE.origin && url.pathname.startsWith(BASE.pathname);
  if (request.mode === 'navigate' && inScope) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      return await cache.match(new URL('index.html', BASE), { ignoreVary: true }) || fetch(request);
    })());
    return;
  }
  // synchronize() uses a fetch request (empty destination) with no-store. A
  // navigation or script reload can also carry no-store and must stay offline.
  if (request.cache === 'no-store' && request.destination === '') return;
  if (request.destination === 'image') {
    event.respondWith(imageResponse(request));
  } else if (inScope && PRECACHE.some(path => new URL(path, BASE).href === url.href)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      return await cache.match(request, { ignoreVary: true }) || fetch(request);
    })());
  }
  // API/Sheets/JSON fetches bypass caches. A failed sync cannot masquerade as new data.
});
