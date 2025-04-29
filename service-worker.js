// service-worker.js

const CACHE_NAME = 'route-calculator-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/logo.png',
  '/logo-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js',
];

// Install: cache essential files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('✅ Caching app shell');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate: remove old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      )
    )
  );
});

// Fetch: serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Only GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Serve cached file if available
        if (response) {
          return response;
        }
        // Otherwise try fetching from network
        return fetch(event.request)
          .catch(() => {
            // If network fails (completely offline)
            if (event.request.destination === 'document') {
              return caches.match('/index.html'); // fallback to home page
            }
          });
      })
  );
});
