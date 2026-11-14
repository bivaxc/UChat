/* Tech Store app-shell cache. Customer, order and payment data are never cached. */
const CACHE_NAME = 'tech-store-shell-v1';
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(['./', './manifest.webmanifest', './tech-store-icon.svg'])));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (new URL(request.url).pathname.includes('/rest/') || new URL(request.url).pathname.includes('/auth/')) return;
  event.respondWith(fetch(request).catch(async () => (await caches.match(request)) || (request.mode === 'navigate' ? caches.match('./') : undefined)));
});