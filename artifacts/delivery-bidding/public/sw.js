/* توصّلني Service Worker — cache-first for assets, network-first for API */

const CACHE_VERSION = 'twasalni-v1';

/* ─── Install: pre-cache the app shell ─────────────────────────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(['/', '/index.html', '/manifest.json']))
      .then(() => self.skipWaiting())
  );
});

/* ─── Activate: remove stale caches ─────────────────────────────────────── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ─── Fetch strategy ────────────────────────────────────────────────────── */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests from our own origin
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // Network-first for API calls (always need fresh data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Cache successful API responses briefly (optional)
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first with network fallback for everything else (JS, CSS, images…)
  // Hashed asset filenames (Vite output) are immutable, so cache-first is safe.
  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(request);

      // Start a background network fetch to keep cache fresh
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      // Return cached immediately if available; otherwise wait for network
      return cached ?? (await networkFetch) ?? new Response('Offline', { status: 503 });
    })
  );
});
