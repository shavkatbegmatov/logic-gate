// Logic Gate service worker — o'yin internetsiz ham ochiladi va o'ynaladi.
// Bu shablon: scripts/sw.mjs build vaqtida fayllar ro'yxati va versiyani joylab, dist/sw.js ni yozadi.
//
// Qoidalar:
//  - Sahifa (navigatsiya) — avval tarmoqdan, shunda yangi versiya darhol keladi; tarmoq bo'lmasa,
//    juda sekin bo'lsa yoki server xato (5xx) qaytarsa — keshdagi nusxa.
//  - Ro'yxatdagi fayllar (JS, CSS, ikonka) — keshdan; nomida xesh bor, o'zgarmaydi.
//  - Shriftlar (.woff2) — birinchi yuklanganda keshga, keyin keshdan. Ular alohida keshda: yangi
//    versiyada o'chirilmaydi (nomida xesh bor — o'zgarsa, yangi nom bilan keladi).
//  - Qo'llanma sahifalari (o'yin emas) va ularning skriptlari — avval tarmoqdan; ochilgan sahifa
//    keshga yoziladi va internetsiz ham ochiladi. Hali ochilmagan sahifa o'rniga — qisqa oflayn xabar.
//  - /api va boshqa hamma narsa — to'g'ridan-to'g'ri tarmoqqa (keshlanmaydi).

const VERSION = '__VERSION__';
const FILES = __FILES__;
const CACHE = 'lg-' + VERSION;
const FONTS = 'lg-fonts';
const PAGES = 'lg-pages';
// Shundan ko'p kutilsa, keshdagi sahifa ochiladi (sekin mobil internet).
const NAV_TIMEOUT = 4000;
// O'yinning o'zi: shu manzillarda — o'yin sahifasi (qolgan sahifalar — qo'llanmalar).
const GAME_PAGES = ['/', '/index.html'];

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
        if (!key.startsWith('lg-') || key === CACHE || key === FONTS || key === PAGES) continue;
        // Eski versiyalar shriftlarni o'z keshida saqlardi — ular qayta yuklanmasligi uchun ko'chiriladi.
        const old = await caches.open(key);
        const fonts = await caches.open(FONTS);
        for (const req of await old.keys()) {
          if (!new URL(req.url).pathname.endsWith('.woff2')) continue;
          const res = await old.match(req);
          if (res) await fonts.put(new URL(req.url).pathname, res);
        }
        await caches.delete(key);
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
    event.respondWith(GAME_PAGES.includes(url.pathname) ? page(req) : guide(req, url.pathname));
  } else if (FILES.includes(url.pathname)) {
    event.respondWith(file(req, url.pathname));
  } else if (/^\/assets\/[\w.-]+\.woff2$/.test(url.pathname)) {
    event.respondWith(font(req, url.pathname));
  } else if (/^\/guide-[\w-]+\.js$/.test(url.pathname)) {
    event.respondWith(guide(req, url.pathname));
  }
});

async function file(req, path) {
  const hit = await (await caches.open(CACHE)).match(path);
  return hit || fetch(req);
}

// Shrift: nomida xesh bor — birinchi yuklanganda keshga, keyin oflayn ham keshdan.
async function font(req, path) {
  const cache = await caches.open(FONTS);
  const hit = await cache.match(path);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(path, res.clone()).catch(() => {});
  return res;
}

// Qo'llanma sahifasi yoki uning skripti: avval tarmoqdan (yangi matn darhol keladi), nusxasi keshga;
// tarmoq bo'lmasa, juda sekin bo'lsa yoki server xato qaytarsa — keshdagi nusxa; u ham bo'lmasa —
// oflayn xabar (o'yin ochilib qolmasin).
async function guide(req, path) {
  const cache = await caches.open(PAGES);
  const network = fetch(req).then((res) => {
    if (res.status === 200 && !res.redirected) cache.put(path, res.clone()).catch(() => {});
    if (res.status >= 500) throw new Error(`server ${res.status}`);
    return res;
  });
  try {
    return await Promise.race([
      network,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NAV_TIMEOUT)),
    ]);
  } catch {
    const hit = await cache.match(path);
    if (hit) {
      network.catch(() => {});
      return hit;
    }
    return network.catch(() =>
      req.mode === 'navigate'
        ? new Response(OFFLINE_PAGE, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
        : Response.error(),
    );
  }
}

const OFFLINE_PAGE = `<!doctype html>
<html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Logic Gate</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 system-ui,sans-serif;background:#0b1712;color:#e6efe9;text-align:center;padding:24px;box-sizing:border-box}a{display:inline-block;margin-top:12px;padding:10px 18px;border-radius:10px;background:#d08a3c;color:#0b1712;font-weight:600;text-decoration:none}p{margin:6px 0}</style>
</head><body><main>
<p>Bu sahifa hali internetsiz ochilmaydi — internet bo'lganda bir marta oching.</p>
<p lang="ru">Эта страница пока не сохранена для работы без интернета — откройте её один раз, когда появится связь.</p>
<a href="/">Logic Gate</a>
</main></body></html>`;

async function page(req) {
  const network = fetch(req);
  try {
    return await Promise.race([
      // Server xatosi (masalan, deploy paytida proksi 502 qaytaradi) — xato sahifasi o'rniga keshdagi o'yin.
      network.then((res) => {
        if (res.status >= 500) throw new Error(`server ${res.status}`);
        return res;
      }),
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
