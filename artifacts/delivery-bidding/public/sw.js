/* توصّلني Service Worker — network-first for HTML/API, cache-first for static assets */

const CACHE_VERSION = 'twasalni-v3';

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

  // Network-first for API calls and HTML navigation (always need fresh data)
  // This prevents old cached HTML from breaking the app after a new deployment.
  const isNavigation = request.mode === 'navigate';
  if (url.pathname.startsWith('/api/') || isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache a successful HTML response so the app works offline too
          if (isNavigation && response.ok) {
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(async () => {
          if (isNavigation) {
            const cached = await caches.match('/index.html');
            return cached ?? new Response('Offline', { status: 503 });
          }
          return caches.match(request) ?? new Response('Offline', { status: 503 });
        })
    );
    return;
  }

  // Cache-first with network fallback for static assets (JS, CSS, images…)
  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(request);

      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      return cached ?? (await networkFetch) ?? new Response('Offline', { status: 503 });
    })
  );
});

/* ─── Push Notifications ───────────────────────────────────────────────── */
self.addEventListener('push', (event) => {
  let title = 'توصّلني';
  let body = 'لديك إشعار جديد';
  let url = '/';

  if (event.data) {
    try {
      const data = event.data.json();
      if (data.title) title = data.title;
      if (data.body) body = data.body;
      if (data.url) url = data.url;
    } catch {
      body = event.data.text() || body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
      vibrate: [200, 100, 200, 100, 200],
      dir: 'rtl',
      lang: 'ar',
      tag: 'twasalni-notification',
      renotify: true,
      data: { url },
    })
  );
});

/* ─── Notification click: focus or open the app ───────────────────────── */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.registration.scope) && 'focus' in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
