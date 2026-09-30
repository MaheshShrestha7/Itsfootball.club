// Service worker: an offline page when a navigation fails, and push notifications from followed clubs
// (sent by lib/push.ts). Nothing else is cached - pages always come fresh from the network.
const OFFLINE_URL = '/offline.html';
const CACHE = 'offline-v1';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Starts the page request while the worker boots, so pages don't wait on it
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith((async () => {
    try {
      return (await event.preloadResponse) || (await fetch(event.request));
    } catch {
      return (await caches.match(OFFLINE_URL)) || Response.error();
    }
  })());
});

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // not JSON: show the generic notification
  }
  event.waitUntil(self.registration.showNotification(data.title || 'itsfootball.club', {
    body: data.body || '',
    icon: '/icon.png',
    badge: '/logo-96.png',
    tag: data.tag,
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  // Same-origin paths only, whatever the message says
  const target = new URL(event.notification.data?.url || '/', self.location.origin);
  const url = target.origin === self.location.origin ? target.href : self.location.origin + '/';
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const tab = open.find(c => c.url === url) || open[0];
    if (tab) {
      await tab.focus();
      if (tab.url !== url && 'navigate' in tab) await tab.navigate(url);
      return;
    }
    await self.clients.openWindow(url);
  })());
});
