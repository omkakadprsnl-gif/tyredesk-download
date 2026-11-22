// App shell cache only. User data lives in IndexedDB and is never touched here.
const CACHE='tyredesk-pwa-web-v1.3.3';
const APP=['./src/tyres.mjs','./src/tyre-ui.mjs','./src/stock-edit.mjs','./src/updates.mjs','./src/cloud.mjs','./src/cloud-store.mjs','./src/cloud-merge.mjs','./vendor/auth.mjs','./terms.html','./privacy.html','./src/legal.mjs','./','./index.html','./styles.css','./manifest.webmanifest','./src/main.mjs','./src/pwa-backup.mjs','./src/db.mjs','./src/logic.mjs','./src/i18n.mjs','./src/invoice.mjs','./src/whatsapp.mjs','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => (key.startsWith('tyredesk-static-') || key.startsWith('tyredesk-v') || key.startsWith('tyredesk-pwa-')) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if(request.method !== 'GET' || new URL(request.url).origin !== self.location.origin || new URL(request.url).pathname.endsWith('/release.json')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Serve one coherent installed app version; installing a new worker refreshes all shell files.
    const shell=APP.some(path=>new URL(path,self.registration.scope).href===request.url);
    if(shell){const cached=await cache.match(request);if(cached)return cached;}
    try {
      const response = await fetch(request);
      if(response.ok) await cache.put(request, response.clone());
      return response;
    } catch(err) {
      const cached = await caches.match(request);
      if(cached) return cached;
      if(request.mode === 'navigate') {
        const index = await caches.match('./index.html');
        if(index) return index;
      }
      throw err;
    }
  })());
});
