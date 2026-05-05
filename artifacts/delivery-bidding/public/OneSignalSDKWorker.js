/* OneSignalSDKWorker.js
 *
 * OneSignal looks for this filename as a fallback worker path. If the browser
 * previously registered this file as the active service worker, it must contain
 * the complete push handling logic — otherwise VAPID push notifications are
 * silently dropped because there is no 'push' event listener.
 *
 * This file intentionally mirrors sw.js so that push notifications work
 * regardless of which SW file the browser has currently registered.
 */

/* Import OneSignal SDK. Wrapped in try-catch: CDN failures must NOT prevent
   our custom VAPID push handler from running. */
try {
  importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
} catch (e) {
  console.warn('[SW/OneSignal] OneSignal SDK failed to load — VAPID push handling still active:', e);
}

/* ─── Push Notifications ───────────────────────────────────────────────── */
self.addEventListener('push', (event) => {
  let title = 'توصّلني';
  let body = 'لديك إشعار جديد';
  let url = new URL('./', self.registration.scope).pathname;
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
          : new URL(data.url.replace(/^\/+/, ''), self.registration.scope).pathname;
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
        : new URL(rawUrl.replace(/^\/+/, ''), self.registration.scope).pathname)
    : new URL('./', self.registration.scope).pathname;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        for (const client of clientList) {
          if (client.url.startsWith(self.registration.scope) && 'navigate' in client) {
            return client.navigate(targetUrl).then((c) => c?.focus());
          }
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
