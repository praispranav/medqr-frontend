// The service worker that shows queue alerts ("You're next", "It's your turn") when the patient's
// screen is locked or the tab is closed. Served at /firebase-messaging-sw.js (scope "/"). It doesn't
// load the Firebase SDK: Firebase Cloud Messaging delivers a standard Web Push whose JSON carries
// `notification` + `data.url` (backend PushService), so plain push / notificationclick handlers do.

const SW = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let p = {};
  try { p = event.data ? event.data.json() : {}; } catch (e) { p = {}; }
  const n = p.notification || {};
  const data = p.data || {};
  const url = data.url || (p.fcmOptions && p.fcmOptions.link) || '/';
  event.waitUntil(
    self.registration.showNotification(n.title || 'MedQR', {
      body: n.body || '',
      tag: data.tag || n.tag || 'medqr',
      renotify: true,
      requireInteraction: true,
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url === url && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
`;

export function GET() {
  return new Response(SW, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Service-Worker-Allowed': '/',
    },
  });
}
