// service-worker.js


// ✅ Install: cache updated app shell
self.addEventListener("install", (event) => {
  self.skipWaiting(); // Activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("✅ Caching app shell");
      return cache.addAll(urlsToCache);
    })
  );
});

// ✅ Activate: delete old caches & force reload
self.addEventListener("activate", (event) => {
  self.clients.claim(); // Take control immediately

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cache) => {
            if (cache !== CACHE_NAME) {
              console.log("🗑️ Deleting old cache:", cache);
              return caches.delete(cache);
            }
          })
        )
      )
      .then(() =>
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => client.navigate(client.url)); // 🔁 Refresh open tabs
        })
      )
  );
});

// ✅ Fetch: serve cache-first, fallback to network
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;

      return fetch(event.request)
        .then((networkResponse) => {
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
       if (
  event.request.url.startsWith("https://cdnjs.cloudflare.com") ||
  (event.request.url.startsWith(self.location.origin) &&
   !event.request.url.endsWith(".html") &&
   !event.request.url === self.location.origin + "/")
) {
  cache.put(event.request, cloned);
}

          });
          return networkResponse;
        })
        .catch(() => {
          if (event.request.destination === "document") {
            return caches.match("/offline.html");
          }
        });
    })
  );
});
