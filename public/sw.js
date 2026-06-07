const CACHE_VERSION = 'v3.4.6';
const CACHE_NAME = `ayam-sd-cache-${CACHE_VERSION}`;
const RUNTIME_CACHE = `ayam-sd-runtime-${CACHE_VERSION}`;
// Keep install light: big quiz/audio files are cached on first use instead of precached.

function scopedUrl(path) {
  return new URL(path.replace(/^\//, ''), self.registration.scope).toString();
}

const PRECACHE_URLS = [
  './',
  './index.html',
  './site.webmanifest',
  './favicon.svg',
  './og-image.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
].map(scopedUrl);

async function precacheBuiltAssets(cache) {
  const indexUrl = scopedUrl('./index.html');
  const response = await fetch(indexUrl, { cache: 'reload' });
  if (!response || !response.ok) return;

  await cache.put(indexUrl, response.clone());
  await cache.put(scopedUrl('./'), response.clone());

  const html = await response.text();
  const assetMatches = [...html.matchAll(/(?:src|href)=\"([^\"]*\/assets\/[^\"]+)\"/g)];
  const assetUrls = assetMatches.map((match) => new URL(match[1], self.registration.scope).toString());
  await Promise.allSettled(assetUrls.map((url) => cache.add(url)));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
    await precacheBuiltAssets(cache).catch(() => {});
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith('ayam-sd-') && key !== CACHE_NAME && key !== RUNTIME_CACHE)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const networkPromise = fetch(request).then(async (response) => {
    if (response && response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  return cached || networkPromise || caches.match(scopedUrl('./index.html'));
}

async function navigationFallback(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(scopedUrl('./index.html'), response.clone());
    }
    return response;
  } catch {
    return caches.match(scopedUrl('./index.html')) || caches.match(scopedUrl('./'));
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationFallback(request));
    return;
  }

  const path = url.pathname;
  if (path.includes('/assets/') || path.endsWith('.js') || path.endsWith('.css')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (path.includes('/audio/') || path.includes('/data/') || path.includes('/icons/') || path.endsWith('.svg') || path.endsWith('.webmanifest')) {
    event.respondWith(cacheFirst(request));
  }
});
