/**
 * Eagle Gym service worker.
 *
 * Strategy summary:
 *   - Static assets (JS/CSS/fonts/images): stale-while-revalidate. Serve
 *     the cached copy fast and refresh in the background, so deploys
 *     propagate on the next visit without blocking the current one.
 *   - API GETs: network-first; on failure, fall back to the last cached
 *     copy so members can still see their previous data when offline.
 *     Capped to MAX_API_ENTRIES so the cache cannot grow unbounded.
 *   - Navigations: network-first, with the cached app shell ("/") as the
 *     offline fallback so the SPA still boots without connectivity.
 *
 * Things deliberately NOT cached:
 *   - Non-GET requests.
 *   - Cross-origin requests we don't control (Google Fonts, YouTube).
 *   - API requests carrying an Authorization header — we don't want
 *     user A's cached profile served to user B after logout.
 *   - Any non-200 / non-basic response.
 *
 * Bump the *_VERSION constants to force-evict old caches on deploy. The
 * activate handler deletes any cache name not in the current allow-list.
 */

const STATIC_VERSION = "v3";
const API_VERSION = "v2";
const CACHE_STATIC = `eagle-gym-static-${STATIC_VERSION}`;
const CACHE_API = `eagle-gym-api-${API_VERSION}`;
const ALLOWED_CACHES = new Set([CACHE_STATIC, CACHE_API]);

const PRECACHE = ["/", "/manifest.json", "/eagle-gym-logo.jpg"];

// Hard cap on the API runtime cache. The previous implementation grew
// without bound, which on a long-lived install eventually meant tens of
// MB of stale JSON sitting in storage.
const MAX_API_ENTRIES = 50;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => cache.addAll(PRECACHE)),
  );
  // Stay deactivated until the page calls postMessage({type:"SKIP_WAITING"}),
  // so users see a "refresh to update" prompt rather than having pages
  // swapped out from under them mid-action.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !ALLOWED_CACHES.has(k)).map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  // Allow the app shell to trigger an update on the user's terms.
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // Skip non-http(s) schemes (chrome-extension://, capacitor://, etc.).
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // Skip cross-origin: Google Fonts, YouTube embeds, etc. Letting those
  // flow normally avoids subtle CORS issues with caching opaque responses.
  if (url.origin !== self.location.origin) return;

  // Don't cache user-authenticated API requests — the cache is shared
  // across logins on the same browser.
  if (req.headers.has("Authorization")) {
    event.respondWith(fetch(req));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(handleApi(req));
    return;
  }

  if (/\.(js|css|woff2?|png|jpg|jpeg|svg|ico|webp|gif|map)$/i.test(url.pathname)) {
    event.respondWith(handleStatic(req));
    return;
  }

  event.respondWith(handleNavigation(req));
});

// Network-first with cached fallback. On success, store a fresh copy and
// trim the cache to MAX_API_ENTRIES (FIFO; sufficient for our usage).
async function handleApi(req) {
  try {
    const fresh = await fetch(req);
    if (fresh.ok && fresh.type === "basic") {
      const clone = fresh.clone();
      const cache = await caches.open(CACHE_API);
      await cache.put(req, clone);
      void trimCache(cache, MAX_API_ENTRIES);
    }
    return fresh;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    // Synthesize a JSON 503 so the app's fetch wrapper sees something
    // shaped like its normal error responses rather than a network error.
    return new Response(
      JSON.stringify({ error: "Offline", message: "تعذّر الاتصال بالخادم" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
}

// Stale-while-revalidate: respond from cache immediately if we have it,
// then refresh in the background so the next load is up to date.
async function handleStatic(req) {
  const cache = await caches.open(CACHE_STATIC);
  const cached = await cache.match(req);
  const refresh = fetch(req)
    .then((res) => {
      if (res.ok && res.type === "basic") cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await refresh) || Response.error();
}

async function handleNavigation(req) {
  try {
    const fresh = await fetch(req);
    if (fresh.ok && fresh.type === "basic") {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await caches.match(req);
    return cached || (await caches.match("/")) || Response.error();
  }
}

async function trimCache(cache, max) {
  const keys = await cache.keys();
  const overflow = keys.length - max;
  if (overflow <= 0) return;
  // Cache.keys() preserves insertion order, so the oldest entries come
  // first. Delete just enough to get back under the cap.
  for (let i = 0; i < overflow; i++) {
    await cache.delete(keys[i]);
  }
}
