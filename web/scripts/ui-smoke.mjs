// Tutun testi: build qilingan dist/ ni vaqtinchalik statik serverdan ochib, har bir mavzuda (Plata, Haqiqiy
// plata, Daftar, Chizma), telefon va kompyuter o'lchamida asosiy ekranlar buzilmay ochilishini tekshiradi:
// konsol xatosi va ushlanmagan istisno yo'q, hech narsa gorizontal toshmaydi, mavzu qo'llangan va mavzuga
// xos belgilar joyida. Xato bo'lsa — skrinshot test-results/ui/ da.
//
// Bog'liqliksiz: kompyuterdagi Chrome (bo'lmasa Chromium yoki Edge) DevTools protokoli (CDP) orqali
// boshqariladi — Node 22+ dagi ichki WebSocket yetarli, o'yin bundle'iga ham, package.json ga ham hech narsa
// qo'shilmaydi. API yo'q: /api so'rovlariga 503 qaytadi — o'yin serversiz ham ochilishi kerak.
//
//   pnpm test:ui                                   build + test
//   node scripts/ui-smoke.mjs                      tayyor dist/ ustida
//   node scripts/ui-smoke.mjs --theme=chizma --size=phone --screen=level,settings
//   node scripts/ui-smoke.mjs --lang=uz,ru         ikkala tilda (odatda — faqat o'zbekcha; CI shunday chaqiradi)
//   node scripts/ui-smoke.mjs --shots              har ekrandan skrinshot (mavzularni ko'zdan kechirish uchun)
//   node scripts/ui-smoke.mjs --headed             brauzer oynasi ko'rinib turadi
//   CHROME_PATH=/yo'l/chrome node scripts/ui-smoke.mjs
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { delimiter, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(WEB, 'dist');
const SHOTS = join(WEB, 'test-results', 'ui');

/** src/theme.ts dagi ActiveTheme. «Avto» alohida mavzu emas — qurilmaga qarab Daftar yoki Sanoat PCB. */
const AAA_THEMES = ['pcb', 'bench', 'breadboard', 'scifi'];
const THEMES = [...AAA_THEMES, 'plata', 'haqiqiy', 'daftar', 'chizma'];
/** Odatda faqat birinchisi; ruscha matnlar uzunroq — tor ekranda sig'masligi ko'proq shu tilda chiqadi. */
const LANGS = ['uz', 'ru'];
const SIZES = [
  // Telefon: barmoq bilan bosiladi, aylantirish chizig'i joy olmaydi (mobile).
  { id: 'phone', label: 'telefon', width: 375, height: 812, mobile: true },
  { id: 'desktop', label: 'kompyuter', width: 1280, height: 800, mobile: false },
];
/** ready — ekran chizilganini bildiradigan element (alohida bo'lakda yuklanadigan ekranlar kechroq chiqadi). */
const SCREENS = [
  { id: 'home', path: '', ready: '.screen.home .hero-svg' },
  { id: 'levels', path: 'levels', ready: '.screen.levels-screen .level-tile' },
  { id: 'level', path: 'level/b1', ready: '.screen.play .board svg', act: playLevel },
  { id: 'sandbox', path: 'sandbox', ready: '.screen.sandbox .board svg' },
  { id: 'settings', path: 'settings', ready: '.screen.settings .theme-tile' },
  { id: 'achievements', path: 'achievements', ready: '.achievements .achievement' },
];

const READY_MS = 10_000; // ekran chizilishi
const CHECK_MS = 2_500; // tekshiruvlar shu vaqt ichida o'tishi kerak (animatsiya tugashi, shrift yuklanishi)
const TOTAL_MS = 5 * 60_000; // butun test: osilib qolsa, CI soatlab kutmasin

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Buyruq qatori ────────────────────────────────────────────────────────────────────────────────────
function options() {
  const opt = { headed: false, shots: false };
  for (const arg of process.argv.slice(2)) {
    const [key, value = ''] = arg.replace(/^--/, '').split('=');
    if (key === 'headed') opt.headed = true;
    else if (key === 'shots') opt.shots = true;
    else if (['theme', 'size', 'screen', 'lang'].includes(key) && value) opt[key] = value.split(',');
    else fail(`Noma'lum parametr: ${arg}\nMisol: node scripts/ui-smoke.mjs --theme=chizma --size=phone --screen=level --lang=uz,ru --shots --headed`);
  }
  const pick = (all, ids, name) => {
    if (!ids) return all;
    const known = all.map((x) => x.id ?? x);
    const bad = ids.filter((id) => !known.includes(id));
    if (bad.length) fail(`--${name}: ${bad.join(', ')} yo'q. Borlari: ${known.join(', ')}`);
    return all.filter((x) => ids.includes(x.id ?? x));
  };
  return {
    ...opt,
    themes: pick(THEMES, opt.theme, 'theme'),
    sizes: pick(SIZES, opt.size, 'size'),
    screens: pick(SCREENS, opt.screen, 'screen'),
    langs: opt.lang ? pick(LANGS, opt.lang, 'lang') : LANGS.slice(0, 1),
  };
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

// ── Statik server ────────────────────────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

/**
 * dist/ ni 127.0.0.1 ning bo'sh portida uzatadi. /api — 503 (server ishlamayapti); o'yin o'zi yuboradigan
 * xato xabarlari (POST /api/client-errors, src/errors.ts) reports ga yig'iladi: ekran chizishdagi xatoni
 * ilova ushlab, konsolga chiqarmaydi — u faqat shu yerda ko'rinadi.
 */
async function startServer() {
  const reports = [];
  const server = createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname.startsWith('/api/')) {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        if (pathname === '/api/client-errors') reports.push(Buffer.concat(chunks).toString('utf8'));
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end('{"error":"unavailable"}');
      });
      return;
    }
    let file;
    try {
      file = resolve(DIST, '.' + decodeURIComponent(pathname));
    } catch {
      file = '';
    }
    if (file !== resolve(DIST) && !file.startsWith(resolve(DIST) + sep)) file = '';
    if (file && existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!file || !existsSync(file)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('topilmadi');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(readFileSync(file));
  });
  await new Promise((done, bad) => server.once('error', bad).listen(0, '127.0.0.1', done));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    /** Shu paytgacha kelgan xato xabarlari (har biri bir marta qaytadi). */
    takeReports: () => reports.splice(0),
    close: () => new Promise((done) => (server.closeAllConnections(), server.close(done))),
  };
}

// ── Brauzer ──────────────────────────────────────────────────────────────────────────────────────────
function findBrowser() {
  const fromEnv = process.env.CHROME_PATH || process.env.CHROME_BIN;
  if (fromEnv) return fromEnv;
  const found = [];
  if (process.platform === 'win32') {
    const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
    // Avval Chrome: tekshiruvlar unda yozilgan; Edge — Chrome o'rnatilmagan kompyuter uchun.
    for (const app of ['Google/Chrome/Application/chrome.exe', 'Microsoft/Edge/Application/msedge.exe']) {
      for (const root of roots) found.push(join(root, app));
    }
  } else if (process.platform === 'darwin') {
    for (const app of ['Google Chrome', 'Chromium', 'Microsoft Edge']) found.push(`/Applications/${app}.app/Contents/MacOS/${app}`);
  } else {
    for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
      for (const dir of (process.env.PATH ?? '').split(delimiter)) if (dir) found.push(join(dir, name));
    }
  }
  return found.find((p) => existsSync(p));
}

/**
 * Brauzerni alohida vaqtinchalik profil bilan ishga tushiradi va CDP manzilini (ws://…) qaytaradi. Manzil
 * profil papkasidagi DevToolsActivePort faylidan olinadi: Edge ishga tushgach o'zini qayta ochadi (birinchi
 * jarayon 0 kodi bilan yopiladi), shuning uchun jarayonning chiqishiga yoki yopilishiga qarab bo'lmaydi.
 */
async function launchBrowser(path, headed) {
  const profile = mkdtempSync(join(tmpdir(), 'lg-ui-'));
  const args = [
    `--user-data-dir=${profile}`,
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-sync',
    '--disable-features=Translate,MediaRouter',
    '--mute-audio',
    // Edge: o'zini qayta ochmasin — jarayon bitta bo'lsa, kutilmagan to'xtashda ham yopib bo'ladi (Chrome e'tibor bermaydi).
    '--edge-skip-compat-layer-relaunch',
  ];
  if (!headed) args.push('--headless=new');
  // CI va konteynerda (root) Chrome'ning sandbox'i ko'pincha ishlamaydi; ochiladigan sahifa — o'zimizning build.
  if (process.env.CI || process.getuid?.() === 0) args.push('--no-sandbox');
  args.push('about:blank');

  const child = spawn(path, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  // Test qanday tugamasin (Ctrl+C, kutilmagan xato) — brauzer ochiq qolmasin.
  process.once('exit', () => child.exitCode === null && child.kill());
  process.once('SIGINT', () => process.exit(130));
  let log = '';
  let spawnError = null;
  child.stderr.on('data', (chunk) => (log = (log + chunk).slice(-2000)));
  child.once('error', (e) => (spawnError = e));

  const cleanup = () => {
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch {
      // Profil papkasi vaqtinchalik papkada qoladi — tizim o'zi tozalaydi.
    }
  };
  const portFile = join(profile, 'DevToolsActivePort');
  const end = Date.now() + 30_000;
  let ws = '';
  while (!ws) {
    if (existsSync(portFile)) {
      const [port, target] = readFileSync(portFile, 'utf8').trim().split('\n');
      if (port && target) ws = `ws://127.0.0.1:${port}${target}`;
    }
    if (ws) break;
    const crashed = spawnError || (child.exitCode !== null && child.exitCode !== 0);
    if (crashed || Date.now() > end) {
      if (child.exitCode === null) child.kill();
      cleanup();
      const why = spawnError ? spawnError.message : crashed ? `kod ${child.exitCode} bilan yopildi` : "30 soniyada tayyor bo'lmadi";
      throw new Error(`Brauzer ishga tushmadi (${path}): ${why}${log ? `\n${log.slice(-800)}` : ''}`);
    }
    await sleep(50);
  }
  return {
    ws,
    /** Brauzer CDP orqali yopiladi (jarayon o'zgargan bo'lishi mumkin); yopilmasa — jarayon to'xtatiladi. */
    async close(cdp) {
      const exited = child.exitCode !== null ? Promise.resolve() : new Promise((done) => child.once('exit', done));
      await Promise.race([cdp?.send('Browser.close').catch(() => {}), sleep(3000)]);
      cdp?.close();
      await Promise.race([exited, sleep(3000)]);
      if (child.exitCode === null) child.kill();
      cleanup();
    },
  };
}

/** CDP: bitta WebSocket, har sahifa — alohida sessiya (flatten). */
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((done, bad) => {
    ws.addEventListener('open', done, { once: true });
    ws.addEventListener('error', () => bad(new Error("Brauzerga ulanib bo'lmadi (CDP)")), { once: true });
  });
  let seq = 0;
  const pending = new Map();
  const sessions = new Map();
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id) {
      const call = pending.get(msg.id);
      pending.delete(msg.id);
      if (!call) return;
      clearTimeout(call.timer);
      if (msg.error) call.bad(new Error(`${call.method}: ${msg.error.message}`));
      else call.done(msg.result);
    } else if (msg.sessionId) {
      sessions.get(msg.sessionId)?.(msg.method, msg.params);
    }
  });
  ws.addEventListener('close', () => {
    for (const call of pending.values()) call.bad(new Error(`${call.method}: brauzer bilan aloqa uzildi`));
    pending.clear();
  });
  return {
    send(method, params = {}, sessionId) {
      return new Promise((done, bad) => {
        const id = ++seq;
        const timer = setTimeout(() => {
          pending.delete(id);
          bad(new Error(`${method}: brauzer 30 soniyada javob bermadi`));
        }, 30_000);
        pending.set(id, { method, done, bad, timer });
        ws.send(JSON.stringify({ id, method, params, sessionId }));
      });
    },
    listen: (sessionId, handler) => sessions.set(sessionId, handler),
    close: () => ws.close(),
  };
}

/** Bitta sahifa alohida brauzer kontekstida: localStorage va service worker boshqa sahifalar bilan aralashmaydi. */
async function openPage(cdp, size, apiOrigin) {
  const { browserContextId } = await cdp.send('Target.createBrowserContext');
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => cdp.send(method, params, sessionId);

  const errors = [];
  const loading = new Map();
  let lastNetwork = Date.now();
  const clip = (text) => String(text).split('\n').slice(0, 4).join('\n      ').slice(0, 700);
  cdp.listen(sessionId, (method, p) => {
    if (method === 'Runtime.exceptionThrown') {
      const d = p.exceptionDetails;
      errors.push(`ushlanmagan istisno: ${clip(d.exception?.description ?? d.text)}`);
    } else if (method === 'Runtime.consoleAPICalled') {
      if (p.type !== 'error' && p.type !== 'assert') return;
      errors.push(`konsol xatosi: ${clip(p.args.map((a) => (a.value !== undefined ? a.value : (a.description ?? a.type))).join(' '))}`);
    } else if (method === 'Log.entryAdded') {
      // Brauzerning o'z xabarlari: yuklanmagan fayl, CSP buzilishi va h.k. API yo'qligi — kutilgan holat.
      const { level, source, text, url = '' } = p.entry;
      if (level !== 'error' || (source === 'network' && url.startsWith(`${apiOrigin}/api/`))) return;
      errors.push(`brauzer xatosi: ${clip(text)}${url ? ` (${url})` : ''}`);
    } else if (method === 'Network.requestWillBeSent') {
      // «Other» — brauzerning o'z so'rovi (favicon): sahifaga kerak emas va tugagani har doim ham xabar qilinmaydi.
      if (p.type === 'Other') return;
      loading.set(p.requestId, p.request.url);
      lastNetwork = Date.now();
    } else if (method === 'Network.loadingFinished' || method === 'Network.loadingFailed') {
      loading.delete(p.requestId);
      lastNetwork = Date.now();
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: size.width,
    height: size.height,
    deviceScaleFactor: size.mobile ? 2 : 1,
    mobile: size.mobile,
  });
  if (size.mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  // Kompyuter sozlamasidan qat'i nazar bir xil: animatsiyalar yoqilgan (ko'pchilik o'yinchilardagi kabi).
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

  /** fn sahifada bajariladi (matnga aylantirib yuboriladi — tashqi o'zgaruvchilarni ko'rmaydi). */
  async function evaluate(fn, ...args) {
    const { result, exceptionDetails } = await send('Runtime.evaluate', {
      expression: `(${fn})(${args.map((a) => JSON.stringify(a)).join(',')})`,
      returnByValue: true,
      awaitPromise: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  }

  /** fn rost qiymat qaytarguncha kutadi; vaqt tugasa — null. */
  async function waitFor(fn, args = [], timeout = READY_MS) {
    const end = Date.now() + timeout;
    for (;;) {
      // Sahifa almashayotgan paytda evaluate xato berishi mumkin — keyingi urinishda o'tadi.
      const value = await evaluate(fn, ...args).catch(() => null);
      if (value) return value;
      if (Date.now() >= end) return null;
      await sleep(50);
    }
  }

  return {
    evaluate,
    waitFor,
    /** To'liq (sovuq) yuklash: faqat hash o'zgarsa sahifa qayta yuklanmaydi, shuning uchun bo'sh sahifa orqali. */
    async open(url) {
      await send('Page.navigate', { url: 'about:blank' });
      loading.clear(); // oldingi sahifaning uzilgan so'rovlari kutilmaydi
      const { errorText } = await send('Page.navigate', { url });
      if (errorText) throw new Error(`${url}: ${errorText}`);
    },
    /**
     * So'rovlar tugab, shriftlar yuklanguncha kutadi (ko'pi bilan 5 soniya). Kutib bo'lmasa, test yiqilmaydi
     * (sekin CI'da yolg'on xato bo'lmasin) — faqat ogohlantirish chiqadi.
     */
    async settle(where) {
      const end = Date.now() + 5000;
      while (Date.now() < end) {
        if (!loading.size && Date.now() - lastNetwork >= 120 && (await evaluate(() => document.fonts.status === 'loaded').catch(() => false))) return;
        await sleep(40);
      }
      console.warn(`  ! ${where}: sahifa 5 soniyada tinchimadi${loading.size ? ` (tugamagan so'rovlar: ${[...loading.values()].join(', ')})` : ''}`);
    },
    /** Elementni haqiqiy kiritish hodisalari bilan bosadi: telefonda barmoq, kompyuterda sichqoncha. */
    async tap(selector) {
      const center = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        // Oyna ochilish animatsiyasi (pop — kattalashib, biroz oshib qaytadi) tugaguncha bosilmaydi: eng
        // yuqori nuqtasida tugma ikki o'lchovda bir joyda turib qolishi va bosish bo'shliqqa ketishi mumkin.
        // Cheksiz animatsiyalar (tugma pulsi, chiroq miltillashi) kutilmaydi.
        const moving = document.getAnimations().some((a) => {
          const target = a.effect?.target;
          return a.playState === 'running' && a.effect.getComputedTiming().endTime !== Infinity && target?.contains?.(el);
        });
        if (moving) return null;
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        const r = el.getBoundingClientRect();
        return r.width && r.height ? { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } : null;
      };
      // Element ikki o'lchovda bir joyda turguncha kutiladi: oyna ochilish animatsiyasi paytida bosilsa, tegmay
      // qolishi mumkin. Topilmasa yoki to'xtamasa, hech narsa bosilmaydi — chaqiruvchi natijani o'zi tekshiradi.
      let prev = '';
      for (const end = Date.now() + 3000; Date.now() < end; await sleep(80)) {
        const at = await evaluate(center, selector).catch(() => null);
        const key = at ? `${at.x},${at.y}` : '';
        if (!at || key !== prev) {
          prev = key;
          continue;
        }
        if (size.mobile) {
          await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
          await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } else {
          const mouse = { ...at, button: 'left', clickCount: 1 };
          await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...at });
          await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...mouse });
          await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...mouse });
        }
        return;
      }
    },
    /** Shu paytgacha yig'ilgan konsol xatolari va istisnolar (har biri bir marta qaytadi). */
    takeErrors: () => errors.splice(0),
    async screenshot(file) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(file, Buffer.from(data, 'base64'));
    },
    close: () => cdp.send('Target.disposeBrowserContext', { browserContextId }).catch(() => {}),
  };
}

// ── Ekrandagi amallar va tekshiruvlar ────────────────────────────────────────────────────────────────

/**
 * Birinchi daraja: tanishtiruv oynasi yopiladi, palitradan bitta element qo'shiladi, keyin «Tozalash» —
 * brauzerniki emas, o'yinning tasdiqlash oynasi (components/Dialogs.tsx). «Bekor qilish» elementni saqlaydi;
 * qayta ochilgan oyna tekshiruvga ochiq qoladi (inspect): u ham har mavzu, til va o'lchamda ekranga sig'sin.
 */
async function playLevel(page) {
  const gotIt = '.modal-back .modal-actions .btn.primary';
  if (!(await page.waitFor((sel) => !!document.querySelector(sel), [gotIt], 5000))) return ['tanishtiruv oynasi chiqmadi'];
  await page.tap(gotIt);
  if (!(await page.waitFor(() => !document.querySelector('.modal-back'), [], 3000))) return ['tanishtiruv oynasi yopilmadi'];
  await page.tap('.palette .palette-item');
  const gate = '.board [data-kind="gate"]';
  const oneGate = (sel) => document.querySelectorAll(sel).length === 1;
  if (!(await page.waitFor(oneGate, [gate], 3000))) return ["palitradan bosilganda maydonga element qo'shilmadi"];

  // Til va tugmalar tartibidan qat'i nazar: savat belgili tugma.
  const trash = '.topbar-actions .icon-btn:has(path[d^="M4 7h16"])';
  const dialog = '.modal.confirm';
  const opened = () => page.waitFor((sel) => !!document.querySelector(sel), [dialog], 3000);
  await page.tap(trash);
  if (!(await opened())) return ['«Tozalash» bosilganda tasdiqlash oynasi chiqmadi'];
  await page.tap(`${dialog} .confirm-actions .btn:not(.solid)`);
  const kept = await page.waitFor((sel) => !document.querySelector('.modal-back') && document.querySelectorAll(sel).length === 1, [gate], 3000);
  if (!kept) return ["tasdiqlash oynasida «Bekor qilish» bosilganda oyna yopilmadi yoki element o'chdi"];
  await page.tap(trash);
  return (await opened()) ? [] : ['tasdiqlash oynasi qayta ochilmadi'];
}

/**
 * Sahifada bajariladi: topilgan kamchiliklar ro'yxati (bo'sh — hammasi joyida).
 * Toshish ikki joyda: sahifaning o'zi va ichki aylantirish joylari (.scroll, .home-scroll, oyna) — body
 * `overflow: hidden`, ro'yxatlar ichki konteynerda aylanadi, shuning uchun keng element ko'pincha aynan
 * o'sha konteynerni toshiradi. Uslubda ataylab gorizontal aylanadigan qilingan joylar (overflow-x: auto —
 * palitra, haqiqat jadvali) hisobga olinmaydi.
 */
function inspect({ theme, lang, screen, ready }) {
  const out = [];
  const root = document.documentElement;
  const visible = (el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return (
      cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0 &&
      r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight
    );
  };
  const shown = (sel) => [...document.querySelectorAll(sel)].filter(visible).length;
  const name = (el) => el.tagName.toLowerCase() + [...el.classList].map((c) => `.${c}`).join('');

  // Ilova ochilmadi (public/theme.js) yoki ekran chizishda xato chiqdi (app.tsx dagi «xato» ekrani).
  if (!window.__lgReady) out.push('ilova ishga tushmadi');
  if (document.querySelector('.screen.crash')) out.push("ekran chizishda xato: o'yin «xato» ekranini ko'rsatdi");
  if (document.querySelector('.lazy-failed')) out.push("ekranning kod bo'lagi yuklanmadi");
  // Ekran chizilmagan: qolgan tekshiruvlar ma'nosiz (sababi yuqorida yoki chaqiruvchida).
  if (!ready) return out;

  const isAaa = ['pcb', 'bench', 'breadboard', 'scifi'].includes(theme);

  // Mavzu: Sanoat PCB (pcb) — atributsiz; boardMode — AAA da real2d, klassikda schematic.
  const want = theme === 'pcb' ? null : theme;
  const got = root.getAttribute('data-theme');
  if (got !== want) out.push(`<html data-theme>: ${got ?? "yo'q"}, kutilgan — ${want ?? "yo'q"}`);
  const wantBoard = isAaa ? 'real2d' : 'schematic';
  const gotBoard = root.getAttribute('data-board');
  if (gotBoard !== wantBoard) out.push(`<html data-board>: ${gotBoard ?? "yo'q"}, kutilgan — ${wantBoard}`);
  // Til: i18n.ts <html lang> ni qo'yadi — aks holda ruscha o'tish sezdirmay o'zbekcha matnni tekshirib qo'yardi.
  if (root.lang !== lang) out.push(`<html lang>: ${root.lang || "yo'q"}, kutilgan — ${lang}`);

  // Gorizontal toshish (1 px — kasr o'lchamlarni yaxlitlash).
  if (root.scrollWidth > root.clientWidth + 1) out.push(`sahifa gorizontal toshdi: ${root.scrollWidth} px > ${root.clientWidth} px`);
  const sideways = [];
  (function collect(rules) {
    for (const rule of rules) {
      const x = rule.style?.overflowX;
      if ((x === 'auto' || x === 'scroll') && rule.selectorText) sideways.push(rule.selectorText);
      if (rule.cssRules?.length) collect(rule.cssRules);
    }
  })([...document.styleSheets].flatMap((sheet) => [...sheet.cssRules]));
  for (const el of document.querySelectorAll('body *')) {
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    const x = getComputedStyle(el).overflowX;
    if ((x !== 'auto' && x !== 'scroll') || sideways.some((sel) => el.matches(sel))) continue;
    out.push(`${name(el)} ichida gorizontal toshdi: ${el.scrollWidth} px > ${el.clientWidth} px`);
  }

  // Mavzuga xos belgilar: AAA va «Haqiqiy plata» da mikrosxema, «Chizma» da chiroq — doira ichida xoch.
  const marks = (where) => {
    const chips = shown(`${where} .chip-body`);
    if (isAaa || theme === 'haqiqiy' ? !chips : chips) out.push(`${where} .chip-body: ${chips} ta ko'rinadi (faqat AAA va «haqiqiy» da bo'lishi kerak)`);
    const crosses = shown(`${where} .lamp-x`);
    if (theme === 'chizma' ? !crosses : crosses) out.push(`${where} .lamp-x: ${crosses} ta ko'rinadi (faqat «chizma» da bo'lishi kerak)`);
  };
  if (screen === 'home') {
    marks('.hero');
    const slab = shown('.hero .real-slab');
    if (isAaa ? !slab : slab) out.push(`.hero .real-slab: ${slab} ta ko'rinadi (faqat AAA uslublarida bo'lishi kerak)`);
  }
  if (screen === 'level') {
    if (isAaa) {
      if (!shown('.board.board-real .real-slab')) out.push("2D Real plata asosi (.board-real .real-slab) ko'rinmaydi");
      if (!shown('.board [data-kind="gate"] .real-ic-body')) out.push("2D Real mikrosxema korpusi (.real-ic-body) ko'rinmaydi");
      if (shown('.board .lamp-x')) out.push("2D Real maydonida .lamp-x ko'rinmasligi kerak");
    } else {
      marks('.board');
      if (theme !== 'haqiqiy' && !shown('.board [data-kind="gate"] .gate-body')) out.push("maydondagi element belgisi (.gate-body) ko'rinmaydi");
    }
    // «Tozalash» oynasi (playLevel uni ochiq qoldiradi): ochilish animatsiyasi tugagach butunligicha ekranda,
    // ikkala tugmasi ko'rinadi. Animatsiya paytida o'lchami kichik — tekshiruv uni kutadi.
    const dialog = document.querySelector('.modal.confirm');
    if (!dialog) out.push('«Tozalash» tasdiqlash oynasi ochiq emas');
    else if (dialog.getAnimations().some((a) => a.playState === 'running')) out.push('tasdiqlash oynasi hali ochilmoqda');
    else {
      const r = dialog.getBoundingClientRect();
      if (r.left < 0 || r.top < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) {
        out.push(`tasdiqlash oynasi ekrandan chiqdi: ${Math.round(r.left)},${Math.round(r.top)}–${Math.round(r.right)},${Math.round(r.bottom)} (ekran ${innerWidth}×${innerHeight})`);
      }
      const buttons = shown('.modal.confirm .confirm-actions .btn');
      if (buttons !== 2) out.push(`tasdiqlash oynasida ${buttons} ta tugma ko'rinadi, kutilgan — 2`);
    }
  }
  if (screen === 'level' || screen === 'sandbox') {
    const stage = document.querySelector('.stage');
    const vt = document.querySelector('.view-tools');
    const zt = document.querySelector('.zoom-tools');
    if (stage && vt && zt) {
      const sr = stage.getBoundingClientRect();
      const vr = vt.getBoundingClientRect();
      const zr = zt.getBoundingClientRect();
      if (vr.height > 96) out.push(`.view-tools balandligi katta (${Math.round(vr.height)}px): maydon o'rtasiga cho'zilgan`);
      if (vr.bottom > sr.bottom + 2 || sr.bottom - vr.bottom > 76) {
        out.push(`.view-tools pastga yopishmagan: bottom=${Math.round(vr.bottom)}, stageBottom=${Math.round(sr.bottom)}`);
      }
      const overlapX = Math.min(vr.right, zr.right) - Math.max(vr.left, zr.left);
      const overlapY = Math.min(vr.bottom, zr.bottom) - Math.max(vr.top, zr.top);
      if (overlapX > 0 && overlapY > 0) {
        out.push(`.view-tools va .zoom-tools ustma-ust tushdi (${Math.round(overlapX)}×${Math.round(overlapY)}px)`);
      }
    }
    if (shown('.view-tools .style-dot') < 1) out.push(".view-tools ichidagi uslub nuqtasi (.style-dot) ko'rinmaydi");
  }
  if (screen === 'settings') {
    const modes = document.querySelectorAll('.mode-tile').length;
    if (modes !== 3) out.push(`.mode-tile: ${modes} ta, kutilgan — 3`);
    const tiles = document.querySelectorAll('.theme-tile').length;
    if (tiles !== 9) out.push(`.theme-tile: ${tiles} ta, kutilgan — 9`);
    const on = [...document.querySelectorAll('.theme-tile.on [data-theme]')].map((el) => el.getAttribute('data-theme'));
    if (on.join() !== theme) out.push(`tanlangan mavzu kartasi: ${on.join('+') || "yo'q"}, kutilgan — ${theme}`);
  }
  return out;
}

/**
 * Ekran chizilishini kutadi: 'ready' — chizildi; 'broken' — ilova ochilmadi (public/theme.js oynasi), ekran
 * chizishda xato chiqdi yoki kod bo'lagi yuklanmadi (kutish darhol to'xtaydi); null — vaqt tugadi.
 */
function waitScreen(page, selector) {
  return page.waitFor(
    (sel) => {
      if (document.querySelector('.screen.crash, .lazy-failed')) return 'broken';
      if (!window.__lgReady) return document.querySelector('#app [role="alert"]') ? 'broken' : null;
      if (document.documentElement.dataset.board === 'real2d' && sel.includes('.board svg')) {
        return document.querySelector(sel.replace('.board svg', '.board.board-real svg')) ? 'ready' : null;
      }
      return document.querySelector(sel) ? 'ready' : null;
    },
    [selector],
  );
}

/** Bitta ekran: ochish → amallar → tekshiruvlar. Kamchiliklar ro'yxatini qaytaradi. */
async function checkScreen(page, server, lang, theme, screen) {
  const problems = [];
  const title = `${lang} ${theme} ${screen.id}`;
  await page.open(`${server.url}/#/${screen.path}`);
  const state = await waitScreen(page, screen.ready);
  const ready = state === 'ready';
  if (ready && screen.act) problems.push(...(await screen.act(page)));
  await page.settle(title);

  // Animatsiya tugashi yoki kech chizilgan qism uchun bir oz kutiladi: oxirgi holat hisobga olinadi.
  const ctx = { theme, lang, screen: screen.id, ready };
  const end = Date.now() + (ready && !problems.length ? CHECK_MS : 0);
  let found = await page.evaluate(inspect, ctx);
  while (found.length && Date.now() < end) {
    await sleep(100);
    found = await page.evaluate(inspect, ctx);
  }
  if (!state && !found.length) found.push(`ekran ochilmadi: ${screen.ready} ${READY_MS / 1000} soniyada chiqmadi`);
  problems.push(...found, ...page.takeErrors());
  problems.push(...reportLines(server, problems));
  return [...new Set(problems)];
}

/** O'yin serverga yuborgan xato xabarlari (src/errors.ts); known da allaqachon bor xato takrorlanmaydi. */
function reportLines(server, known = []) {
  const lines = [];
  for (const raw of server.takeReports()) {
    let report = {};
    try {
      report = JSON.parse(raw);
    } catch {
      // pastda xom matn
    }
    const msg = String(report.msg ?? raw.slice(0, 300));
    if (known.some((p) => p.includes(msg))) continue;
    const where = String(report.stack ?? '').split('\n').find((line) => line.includes('/assets/'))?.trim();
    lines.push(`o'yin xato haqida xabar yubordi: ${msg}${where ? ` — ${where}` : ''}`);
  }
  return lines;
}

/** Bitta til, mavzu va o'lcham: yangi «qurilma», til va mavzu localStorage orqali, keyin barcha ekranlar. */
async function run(cdp, server, opt, lang, theme, size) {
  const failures = [];
  const page = await openPage(cdp, size, server.url);
  const report = async (screenId, hash, problems) => {
    if (!problems.length && !opt.shots) return;
    const file = join(SHOTS, `${theme}-${size.id}-${screenId}${lang === LANGS[0] ? '' : `-${lang}`}.png`);
    mkdirSync(SHOTS, { recursive: true });
    const shot = await page.screenshot(file).then(() => relative(WEB, file).replaceAll(sep, '/'), (e) => `olinmadi (${e.message})`);
    if (problems.length) failures.push({ title: `${lang} · ${theme} · ${size.label} ${size.width}×${size.height} · ${screenId} (${hash})`, problems, shot });
  };
  try {
    // Birinchi ochilish (yangi o'yinchi, asosiy mavzu): shundan keyin sozlama yoziladi va sahifa qayta yuklanadi.
    await page.open(`${server.url}/`);
    const booted = (await waitScreen(page, '.screen')) === 'ready';
    const first = booted ? [] : ['ilova ishga tushmadi'];
    await page.settle(`${lang} ${theme} birinchi ochilish`);
    first.push(...page.takeErrors());
    first.push(...reportLines(server, first));
    await report('first-open', '#/', [...new Set(first)]);
    // Ilova umuman ochilmasa, qolgan ekranlar ham xuddi shunday yiqiladi — vaqt ketkazilmaydi.
    if (!booted) return { failures, bg: null, checked: 0 };
    // Shakli — src/state.ts dagi cleanSettings qabul qiladigan.
    await page.evaluate((s) => localStorage.setItem('lg.settings.v1', JSON.stringify(s)), {
      theme,
      lang,
      boardMode: AAA_THEMES.includes(theme) ? 'real2d' : 'schematic',
    });

    for (const screen of opt.screens) {
      await report(screen.id, `#/${screen.path}`, await checkScreen(page, server, lang, theme, screen));
    }
    // Mavzu ranglari haqiqatan almashganini solishtirish uchun (pastda: to'rt mavzu — to'rt xil fon).
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor).catch(() => '');
    return { failures, bg, checked: opt.screens.length };
  } finally {
    await page.close();
  }
}

// ── Ishga tushirish ──────────────────────────────────────────────────────────────────────────────────
async function main() {
  const opt = options();
  if (!existsSync(join(DIST, 'index.html'))) fail("dist/ yo'q — avval build qiling: pnpm build (yoki birdaniga: pnpm test:ui)");
  if (typeof WebSocket !== 'function') fail(`Node.js 22 yoki yangirog'i kerak (hozir ${process.version}).`);
  const browserPath = findBrowser();
  if (!browserPath) fail("Chrome topilmadi. O'rnating yoki yo'lini ko'rsating: CHROME_PATH=/yo'l/chrome pnpm test:ui");

  rmSync(SHOTS, { recursive: true, force: true });
  const started = Date.now();
  const server = await startServer();
  const failures = [];
  let checks = 0;
  let browser;
  let cdp;
  let watchdog;
  try {
    browser = await launchBrowser(browserPath, opt.headed);
    cdp = await connect(browser.ws);
    const { product } = await cdp.send('Browser.getVersion');
    console.log(`Tutun testi: ${product}, ${server.url}, til — ${opt.langs.join(', ')}`);
    const all = async () => {
      for (const lang of opt.langs) {
        for (const size of opt.sizes) {
          const backgrounds = new Map();
          for (const theme of opt.themes) {
            const t0 = Date.now();
            const result = await run(cdp, server, opt, lang, theme, size);
            checks += result.checked;
            failures.push(...result.failures);
            if (result.bg !== null) backgrounds.set(theme, result.bg);
            const mark = result.failures.length ? '✗' : '✓';
            console.log(`${mark} ${lang}  ${theme.padEnd(8)} ${size.label.padEnd(10)} ${result.checked} ekran  ${((Date.now() - t0) / 1000).toFixed(1)} s`);
          }
          // Atribut qo'yilgani yetarli emas: ranglar ham almashgan bo'lishi kerak (styles.css dagi mavzu bloklari).
          const distinct = new Set(backgrounds.values());
          if (distinct.size !== backgrounds.size || distinct.has('')) {
            failures.push({
              title: `${lang} · ${size.label} · mavzu ranglari`,
              problems: [`mavzular foni bir xil chiqdi: ${[...backgrounds].map(([k, v]) => `${k} — ${v || "o'qilmadi"}`).join(', ')}`],
            });
          }
        }
      }
    };
    // Osilib qolsa, CI soatlab kutmasin: vaqt tugasa, brauzer yopiladi va test xato bilan tugaydi.
    const deadline = new Promise((_, bad) => {
      watchdog = setTimeout(() => bad(new Error(`Test ${TOTAL_MS / 60_000} daqiqada tugamadi — to'xtatildi.`)), TOTAL_MS);
    });
    await Promise.race([all(), deadline]);
  } finally {
    clearTimeout(watchdog);
    await browser?.close(cdp);
    await server.close();
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (!failures.length) {
    console.log(`\n${checks} ta ekran tekshirildi, hammasi joyida (${seconds} s).`);
    return;
  }
  console.error(`\n${failures.length} ta joyda kamchilik (${checks} ta ekrandan, ${seconds} s):`);
  for (const f of failures) {
    console.error(`\n✗ ${f.title}`);
    for (const p of f.problems) console.error(`    – ${p}`);
    if (f.shot) console.error(`    skrinshot: ${f.shot}`);
  }
  process.exitCode = 1;
}

main().catch((e) => {
  console.error(`Tutun testi ishlamadi: ${e.stack ?? e}`);
  process.exit(1);
});
