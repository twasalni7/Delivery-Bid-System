/* توصّلني Service Worker — Web Push API */

const CACHE_VERSION = 'twasalni-v6';
const APP_SCOPE = new URL(self.registration.scope).pathname;
const APP_INDEX_URL = new URL('index.html', self.registration.scope).pathname;
const APP_MANIFEST_URL = new URL('manifest.json', self.registration.scope).pathname;

/* ─── Install ─────────────────────────────────────────────────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll([APP_SCOPE, APP_INDEX_URL, APP_MANIFEST_URL]))
      .then(() => self.skipWaiting())
  );
});

/* ─── Activate ────────────────────────────────────────────────────────── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ─── Push ─────────────────────────────────────────────────────────────── */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    console.warn('[SW] Push event data is not valid JSON');
    return;
  }

  const title = data.title || 'توصّلني';
  const options = {
    body: data.body || data.message || '',
    icon: data.icon || '/icons/icon-192.svg',
    badge: data.badge || '/favicon.svg',
    data: { url: data.url || '/' },
    tag: data.tag || data.type || 'default',
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/* ─── Notification Click ──────────────────────────────────────────────── */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  const fullUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // محاولة التركيز على نافذة موجودة
      for (const client of clientList) {
        if (client.url === fullUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // فتح نافذة جديدة
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});

/* ─── Fetch ───────────────────────────────────────────────────────────── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  const isNavigation = request.mode === 'navigate';
  if (url.pathname.startsWith('/api/') || isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isNavigation && response.ok) {
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(async () => {
          if (isNavigation) {
            const cached = await caches.match(APP_INDEX_URL);
            return cached ?? new Response('Offline', { status: 503 });
          }
          return caches.match(request) ?? new Response('Offline', { status: 503 });
        })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(request);
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => null);
      return cached ?? (await networkFetch) ?? new Response('Offline', { status: 503 });
    })
  );
});
