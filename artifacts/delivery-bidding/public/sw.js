/* Import OneSignal SDK so this single worker handles both VAPID and OneSignal push.
   Wrapped in try-catch: if the CDN is unreachable the SW must NOT crash — our custom
   VAPID push handler (below) must still run regardless. */
try {
  importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
} catch (e) {
  console.warn('[SW] OneSignal SDK failed to load — VAPID push handling still active:', e);
}

/* توصّلني Service Worker — network-first for HTML/API, cache-first for static assets */

const CACHE_VERSION = 'twasalni-v4';
const APP_SCOPE = new URL(self.registration.scope).pathname;
const APP_INDEX_URL = new URL('index.html', self.registration.scope).pathname;
const APP_MANIFEST_URL = new URL('manifest.json', self.registration.scope).pathname;

function appUrl(path = '') {
  return new URL(path.replace(/^\/+/, ''), self.registration.scope).pathname;
}

/* ─── Install: pre-cache the app shell ─────────────────────────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll([APP_SCOPE, APP_INDEX_URL, APP_MANIFEST_URL]))
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
            const cached = await caches.match(APP_INDEX_URL);
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
  let url = APP_SCOPE;
  // icon and badge intentionally left undefined here.
  // SVG images are NOT supported by the Web Notification API (badge requires
  // monochrome PNG; icon is unreliable with SVG on Android Chrome).
  // The server payload may supply PNG URLs via data.icon / data.badge.
  // When absent, the browser uses the app icon from the installed PWA manifest.
  let icon = undefined;
  let badge = undefined;

  if (event.data) {
    try {
      const data = event.data.json();
      if (data.title) title = data.title;
      if (data.body) body = data.body;
      if (data.url) {
        url = data.url.startsWith('http')
          ? data.url
          : appUrl(data.url.replace(/^\/+/, ''));
      }
      if (data.icon) icon = data.icon;
      if (data.badge) badge = data.badge;
    } catch {
      body = event.data.text() || body;
    }
  }

  const options = {
    body,
    vibrate: [200, 100, 200, 100, 200],
    dir: 'rtl',
    lang: 'ar',
    tag: 'twasalni-notification',
    renotify: true,
    data: { url },
  };
  if (icon) options.icon = icon;
  if (badge) options.badge = badge;

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/* ─── Notification click: navigate to the notification URL ────────────── */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url;
  const targetUrl = rawUrl
    ? (rawUrl.startsWith('http')
        ? rawUrl
        : appUrl(rawUrl.replace(/^\/+/, '')))
    : APP_SCOPE;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If a window is already open on the target URL, focus it
        for (const client of clientList) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        // If any app window is open, navigate it to the target URL
        for (const client of clientList) {
          if (client.url.startsWith(self.registration.scope) && 'navigate' in client) {
            return client.navigate(targetUrl).then((c) => c?.focus());
          }
        }
        // No open window — open a new one
        return self.clients.openWindow(targetUrl);
      })
  );
});
