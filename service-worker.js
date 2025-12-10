// --------------------------------------------------------
// FIRST AID PWA — OFFLINE LOGIN + SECURE PAGE ACCESS
// --------------------------------------------------------

const CACHE_NAME = "first-aid-cache-v7";

const ASSETS = [
  "/", "/index.html", "/login.html",
  "/report.html", "/inventory.html", "/addStock.html",
  "/transfer.html", "/inventoryLogs.html", "/admin.html",

  // CSS
  "/css/dashboard.css",
  "/css/login.css",
  "/css/admin.css",

  // JS
  "/js/app.js",
  "/js/login.js",
  "/js/dashboard.js",
  "/js/admin.js",
  "/js/session-check.js",
  "/js/permissions-check.js",

  "/manifest.json",
  "/favicon.ico"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// Secure pages list
const SECURE_PAGES = [
  "index.html", "report.html", "inventory.html",
  "admin.html", "addStock.html", "transfer.html", "inventoryLogs.html"
];

// LOGIN CHECK FUNCTION
async function validateLogin(request) {
  const clients = await self.clients.matchAll();

  if (clients.length === 0) return Response.redirect("/login.html");

  const client = clients[0];

  // Ask the page for login status
  const loggedIn = await new Promise(resolve => {
    const mc = new MessageChannel();
    mc.port1.onmessage = e => resolve(e.data.loggedIn);
    client.postMessage({ cmd: "CHECK_LOGIN" }, [mc.port2]);
  });

  if (!loggedIn) return Response.redirect("/login.html");

  return caches.match(request).then(c => c || fetch(request));
}

self.addEventListener("fetch", event => {
  const url = event.request.url;

  const isSecure = SECURE_PAGES.some(page => url.includes(page));

  if (isSecure) {
    return event.respondWith(validateLogin(event.request));
  }

  // Default: cache-first strategy
  event.respondWith(
    caches.match(event.request).then(cacheRes => {
      return (
        cacheRes ||
        fetch(event.request).then(fetchRes => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, fetchRes.clone());
            return fetchRes;
          });
        })
      );
    })
  );
});
