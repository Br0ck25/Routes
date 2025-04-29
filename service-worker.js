const CACHE_NAME = 'route-app-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/logo.png',
  '/logo-512.png',
  '/manifest.json',
  '/styles.css', // Optional
  '/script.js',  // Optional
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js'
];

// ✅ Install event - cache core assets first, then try CDN separately
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      const coreAssets = urlsToCache.filter(url => !url.startsWith('http'));
      await cache.addAll(coreAssets);

      // Try to cache CDN files separately and safely
      for (const cdnUrl of urlsToCache.filter(url => url.startsWith('http'))) {
        try {
          const response = await fetch(cdnUrl, { mode: 'no-cors' });
          await cache.put(cdnUrl, response);
        } catch (err) {
          console.warn('⚠️ Could not cache CDN asset:', cdnUrl, err);
        }
      }
    })
  );
});

// ✅ Activate event - cleanup old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
});

// ✅ Fetch event - try cache first, then network, then fallback
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
