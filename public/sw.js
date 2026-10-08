// CEOVA Service Worker Self-Destruct Killswitch
// Forces any legacy PWA service worker to unregister, clear caches, and reload clients

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    }).then(() => {
      return self.registration.unregister();
    }).then(() => {
      return self.clients.matchAll({ type: 'window' });
    }).then((clients) => {
      for (const client of clients) {
        client.navigate(client.url);
      }
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Never intercept or cache; pass directly to network
  event.respondWith(fetch(event.request));
});
