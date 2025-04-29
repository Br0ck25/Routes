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

// ✅ Install event - cache everything listed
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(err => {
        console.error('❌ Error caching during install:', err);
      })
  );
});

// ✅ Activate event - cleanup old caches if needed
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
});

// ✅ Fetch event - try cache first, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) return response;
      return fetch(event.request).then(networkResponse => {
        // Optionally cache the new response here
        return networkResponse;
      }).catch(err => {
        console.error('❌ Fetch failed:', err);
        return new Response('You are offline.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      });
    })
  );
});
