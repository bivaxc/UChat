/* Minimal app-shell fallback. User data and API responses are never cached. */
const CACHE_NAME = 'uchat-shell-v1';
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(['./', './manifest.webmanifest'])));
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
  // Never cache Supabase traffic, messages, or authenticated API data.
  if (new URL(request.url).pathname.includes('/rest/') || new URL(request.url).pathname.includes('/auth/')) return;
  event.respondWith(fetch(request).catch(async () => (await caches.match(request)) || (request.mode === 'navigate' ? caches.match('./') : undefined)));
});
