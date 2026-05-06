const CACHE_STATIC = "eagle-gym-static-v2";
const CACHE_API = "eagle-gym-api-v1";
const PRECACHE = ["/", "/manifest.json", "/eagle-gym-logo.jpg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_STATIC).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_STATIC && k !== CACHE_API)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // API requests: network-first, cache as fallback for offline
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_API).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Static assets (JS/CSS/images): cache-first
  if (url.pathname.match(/\.(js|css|woff2?|png|jpg|jpeg|svg|ico|webp)$/)) {
    e.respondWith(
      caches.match(e.request).then(
        (cached) => cached || fetch(e.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_STATIC).then((c) => c.put(e.request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Navigation: network-first, offline fallback to cached shell
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_STATIC).then((c) => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("/")))
  );
});
