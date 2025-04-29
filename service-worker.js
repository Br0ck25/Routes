const CACHE_NAME = 'route-app-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/logo.png',
  '/logo-512.png',
  '/manifest.json',
  '/styles.css', // if you have
  '/script.js',  // if you have
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js'
];

// Install and cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('✅ Caching app shell');
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request);
    }).catch((err) => {
      console.error('Fetch failed; returning fallback.', err);
      return new Response("Offline fallback", { status: 503 });
    })
  );
});

