const CACHE_NAME = "route-calculator-cache-v2.1.6"; // bump version to invalidate old cache
const urlsToCache = [
  "/offline.html",
  "/logo.png",
  "/logo-512.png",
  "/main.js",
  "/styles.css",
];

// ✅ Install: Cache app shell (but not index.html)
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("✅ Caching app shell");
      return cache.addAll(urlsToCache);
    })
  );
});

// ✅ Activate: Remove old caches and reload clients
self.addEventListener("activate", (event) => {
  self.clients.claim();
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
    ).then(() =>
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.navigate(client.url));
      })
    )
  );
});

// ✅ Fetch: Cache-first, then network, then fallback — but don't cache .html pages
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request)
        .then((networkResponse) => {
          const cloned = networkResponse.clone();

          const url = new URL(event.request.url);
          const isSameOrigin = url.origin === self.location.origin;
          const isHTML = url.pathname.endsWith(".html") || url.pathname === "/";

          if (
            !isHTML &&
            (url.href.startsWith("https://cdnjs.cloudflare.com") || isSameOrigin)
          ) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          }

          return networkResponse;
        })
        .catch(() => {
          if (event.request.destination === "document") {
            return caches.match("/offline.html");
          }

          return new Response("", {
            status: 200,
            statusText: "Fallback empty response",
            headers: { "Content-Type": "text/plain" },
          });
        });
    })
  );
});
