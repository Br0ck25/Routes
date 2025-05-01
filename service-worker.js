// service-worker.js

const CACHE_NAME = "route-calculator-cache-v2";
const urlsToCache = [
  "/",
  "/index.html",
  "/logo.png",
  "/logo-512.png",
  // ⚠️ Do NOT hardcode CDN URLs — they'll be handled dynamically below
];

// Install: cache essential files
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("✅ Caching app shell");
      return cache.addAll(urlsToCache);
    })
  );
});

// Activate: remove old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("🗑️ Deleting old cache:", cache);
            return caches.delete(cache);
          }
        })
      )
    )
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;

      return fetch(event.request)
        .then((networkResponse) => {
          // Cache third-party files (e.g., CDN) dynamically if successful
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            // Only cache CDN/static files (optional: add whitelist logic)
            if (
              event.request.url.startsWith("https://cdnjs.cloudflare.com") ||
              event.request.url.startsWith(self.origin)
            ) {
              cache.put(event.request, cloned);
            }
          });
          return networkResponse;
        })
        .catch(() => {
          if (event.request.destination === "document") {
            return caches.match("/index.html");
          }
        });
    })
  );
});
