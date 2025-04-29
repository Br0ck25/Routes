const CACHE_NAME = 'route-app-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/logo.png',
  '/logo-512.png',
  '/manifest.json',
  '/styles.css',
  '/script.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      const localAssets = urlsToCache.filter(url => !url.startsWith('http'));
      for (const url of localAssets) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn(`⚠️ Skipping failed local asset: ${url}`, err);
        }
      }

      const cdnAssets = urlsToCache.filter(url => url.startsWith('http'));
      for (const cdnUrl of cdnAssets) {
        try {
          const response = await fetch(cdnUrl, { mode: 'no-cors' });
          await cache.put(cdnUrl, response);
        } catch (err) {
          console.warn(`⚠️ Skipping failed CDN asset: ${cdnUrl}`, err);
        }
      }
    })()
  );
});


// ✅ Activate - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
});

// ✅ Fetch - cache first, then network, then fallback
self.addEventListener('fetch', event => {
  event.respondWith(
    (async () => {
      try {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        const network = await fetch(event.request);
        return network;
      } catch (err) {
        console.error('❌ Fetch failed:', err);
        return new Response('You are offline.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    })()
  );
});
