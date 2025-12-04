self.addEventListener("install", event => {
  event.waitUntil(
    caches.open("first-aid-cache").then(cache => {
      return cache.addAll([
        "/",
        "/index.html",
        "/report.html",
        "/inventory.html",
        "/addStock.html",
        "/transfer.html",
        "/inventoryLogs.html",
        "/css/styles.css",
        "/js/app.js"
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
