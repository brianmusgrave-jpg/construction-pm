// Construction PM — Service Worker
// Cache-first strategy for static assets, network-first for API/pages
// Offline mutation support via client messaging

const CACHE_VERSION = "v2";
const STATIC_CACHE = "static-" + CACHE_VERSION;
const DATA_CACHE = "data-" + CACHE_VERSION;

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  "/",
  "/dashboard",
  "/contractor",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

// Install — pre-cache shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  const allowedCaches = [STATIC_CACHE, DATA_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !allowedCaches.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Listen for messages from the client
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Fetch strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip browser extension and chrome-extension requests
  if (!url.protocol.startsWith("http")) return;

  // Handle non-GET requests (mutations) — notify client when offline
  if (request.method !== "GET") {
    if (!self.navigator || self.navigator.onLine === false) {
      // We're offline — respond with a special status so the client can queue it
      event.respondWith(
        new Response(
          JSON.stringify({
            offline: true,
            message: "Request queued for offline sync",
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }
        )
      );
    }
    // If online, let the request pass through normally
    return;
  }

  // Skip Next.js API routes and server actions — always network
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/data/")) {
    return;
  }

  // Static assets (_next/static, images, fonts) — cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|ico|woff2?|ttf|css|js)$/)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // HTML pages — network-first with cache fallback (stale-while-revalidate)
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // RSC payloads and other data — network-first
  event.respondWith(networkFirst(request, DATA_CACHE));
});

// Cache-first: return cached if available, else fetch & cache
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
  }
}

// Network-first: try network, fall back to cache
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Return offline page for navigation requests
    if (request.mode === "navigate") {
      return new Response(offlineHTML(), {
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
  }
}

function offlineHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline — Construction PM</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb; color: #374151; }
    .container { text-align: center; padding: 2rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #6b7280; margin-bottom: 1.5rem; }
    button { background: #4F6DF5; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 500; cursor: pointer; }
    button:hover { opacity: 0.9; }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🚧</div>
    <h1>You're offline</h1>
    <p>Check your connection and try again. Your pending changes will sync when you reconnect.</p>
    <button onclick="window.location.reload()">Retry</button>
  </div>
</body>
</html>`;
}
