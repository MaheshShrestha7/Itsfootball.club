// Service worker for the installable site. Pages are always fetched from the network first; the last
// copy of each club page a visitor opened is kept so it still opens offline (the member pass reads its
// data from the club state lib/club-context.tsx keeps in localStorage). Registered by
// components/ServiceWorkerRegister.tsx. Bump VERSION to drop every cached copy on the next visit.

const VERSION = 'v1';
const PAGE_CACHE = `pages-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;
const MAX_PAGES = 40;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keep = [PAGE_CACHE, ASSET_CACHE];
      const names = await caches.keys();
      await Promise.all(names.filter(name => !keep.includes(name)).map(name => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

/** Pages worth opening offline: not the API, sign-in links or admin screens */
function isCacheablePage(url) {
  const path = url.pathname;
  return !path.startsWith('/api/') && !path.startsWith('/auth/') && !path.split('/').includes('admin');
}

async function trimPages() {
  const cache = await caches.open(PAGE_CACHE);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_PAGES)).map(key => cache.delete(key)));
}

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>You're offline</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#070A0F;color:#E6EBF2;
font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:1.5rem}p{color:#8190A5}</style></head>
<body><main><h1>You're offline</h1><p>This page hasn't been opened on this device yet.<br>
Reconnect and try again. Pages you've already visited, like your member pass, still open offline.</p></main></body></html>`;

async function handleNavigation(event) {
  const { request } = event;
  const url = new URL(request.url);
  try {
    const response = await fetch(request);
    if (response.ok && !response.redirected && isCacheablePage(url)) {
      const copy = response.clone();
      event.waitUntil(
        caches.open(PAGE_CACHE).then(cache => cache.put(request, copy)).then(trimPages)
      );
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request, { cacheName: PAGE_CACHE });
    if (cached) return cached;
    return new Response(OFFLINE_HTML, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

// Build output under /_next/static is content-hashed, so a cached copy never goes stale
async function handleStaticAsset(request) {
  const cached = await caches.match(request, { cacheName: ASSET_CACHE });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const copy = response.clone();
    caches.open(ASSET_CACHE).then(cache => cache.put(request, copy));
  }
  return response;
}

// The first visit loads before this worker is in control, so the page asks it to keep what it already loaded
self.addEventListener('message', event => {
  const data = event.data;
  if (!data || data.type !== 'cache-current-page' || event.origin !== self.location.origin) return;
  event.waitUntil(
    (async () => {
      const assets = (Array.isArray(data.assets) ? data.assets : []).filter(
        href => typeof href === 'string' && new URL(href, self.location.origin).pathname.startsWith('/_next/static/')
      );
      const assetCache = await caches.open(ASSET_CACHE);
      await Promise.all(assets.map(href => assetCache.add(href).catch(() => {})));

      const page = typeof data.url === 'string' ? new URL(data.url, self.location.origin) : null;
      if (page && page.origin === self.location.origin && isCacheablePage(page)) {
        const response = await fetch(page.href, { credentials: 'same-origin' }).catch(() => null);
        if (response && response.ok && !response.redirected) {
          await (await caches.open(PAGE_CACHE)).put(page.href, response);
          await trimPages();
        }
      }
    })()
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(handleStaticAsset(request));
  }
});
