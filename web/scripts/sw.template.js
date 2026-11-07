// Logic Gate service worker — o'yin internetsiz ham ochiladi va o'ynaladi.
// Bu shablon: scripts/sw.mjs build vaqtida fayllar ro'yxati va versiyani joylab, dist/sw.js ni yozadi.
//
// Qoidalar:
//  - Sahifa (navigatsiya) — avval tarmoqdan, shunda yangi versiya darhol keladi; tarmoq bo'lmasa
//    yoki juda sekin bo'lsa — keshdagi nusxa.
//  - Ro'yxatdagi fayllar (JS, CSS, ikonka) — keshdan; nomida xesh bor, o'zgarmaydi.
//  - /api va boshqa hamma narsa — to'g'ridan-to'g'ri tarmoqqa (keshlanmaydi).

const VERSION = '__VERSION__';
const FILES = __FILES__;
const CACHE = 'lg-' + VERSION;
// Shundan ko'p kutilsa, keshdagi sahifa ochiladi (sekin mobil internet).
const NAV_TIMEOUT = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const entries = await Promise.all(
        FILES.map(async (path) => {
          const res = await fetch(path, { cache: 'no-cache' });
          if (!res.ok) throw new Error(`${path}: ${res.status}`);
          return [path, res];
        }),
      );
      // Shu paytda yangi versiya joylangan bo'lsa, sahifa boshqa fayllarga ishora qiladi —
      // bunday aralash nusxa saqlanmaydi (keyingi tekshiruvda yangi service worker o'rnatiladi).
      const page = await entries.find(([path]) => path === '/')[1].clone().text();
      for (const [ref] of page.matchAll(/\/assets\/[\w.-]+/g)) {
        if (!FILES.includes(ref)) throw new Error(`boshqa versiyadagi sahifa: ${ref}`);
      }
      await Promise.all(entries.map(([path, res]) => cache.put(path, res)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('lg-') && key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(page(req));
  } else if (FILES.includes(url.pathname)) {
    event.respondWith(file(req, url.pathname));
  }
});

async function file(req, path) {
  const hit = await (await caches.open(CACHE)).match(path);
  return hit || fetch(req);
}

async function page(req) {
  const network = fetch(req);
  try {
    return await Promise.race([
      network,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NAV_TIMEOUT)),
    ]);
  } catch {
    const shell = await (await caches.open(CACHE)).match('/');
    if (shell) {
      network.catch(() => {});
      return shell;
    }
    return network;
  }
}
