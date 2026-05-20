// Vibecode PWA service worker.
// Bump CACHE_VERSION to force users onto a fresh cache after a deploy.
const CACHE_VERSION = "vibecode-v3";

// Take control as soon as a new service worker is installed.
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION));
  self.skipWaiting();
});

// Clean up old caches and claim open tabs.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Network-first for HTML/API (fresh content), cache-first only for hashed static assets.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isApi = url.pathname.startsWith("/api/");
  const isHtml =
    request.mode === "navigate" ||
    request.destination === "document" ||
    url.pathname === "/" ||
    url.pathname.endsWith(".html");

  // Network-first for API and HTML (so new deploys are picked up immediately).
  if (isApi || isHtml) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for hashed JS/CSS/images (filenames change on each deploy).
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, copy));
          return res;
        })
    )
  );
});
