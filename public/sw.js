/* Minimal SW for Moura LWS (no workbox) */
const VERSION = 'lws-sw-v1';
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const PRECACHE_URLS = [
  '/',                 // App shell (melhor esforço)
  '/manifest.json',

  // ícones (ajuste se seus paths forem outros)
  '/brand/icon/lws-app-icon-1024.png',
  '/brand/favicon/lws-64.png',
  '/brand/favicon/lws-48.png',
  '/brand/favicon/lws-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k.startsWith('lws-sw-') && k !== STATIC_CACHE && k !== RUNTIME_CACHE) ? caches.delete(k) : null));
      await self.clients.claim();
    })()
  );
});

/**
 * Estratégia:
 * - Navegação (HTML): network-first com fallback para cache (melhora “rede ruim”)
 * - Assets (script/style/font/image): cache-first (abre mais rápido)
 */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // só trata mesma origem
  if (url.origin !== self.location.origin) return;

  // Ignora coisas não-GET
  if (req.method !== 'GET') return;

  const isNav = req.mode === 'navigate';
  const dest = req.destination;

  if (isNav) {
    event.respondWith(networkFirst(req));
    return;
  }

  if (dest === 'script' || dest === 'style' || dest === 'font' || dest === 'image') {
    event.respondWith(cacheFirst(req));
    return;
  }
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;

  const res = await fetch(req);
  const cache = await caches.open(RUNTIME_CACHE);
  cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(req, res.clone());
    return res;
  } catch (e) {
    const cached = await caches.match(req);
    if (cached) return cached;

    // fallback final: raiz (caso seu shell seja bem estável)
    const root = await caches.match('/');
    if (root) return root;

    throw e;
  }
}
