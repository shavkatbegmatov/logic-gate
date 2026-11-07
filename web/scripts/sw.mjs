// dist/sw.js ni yozadi: sw.template.js ga oflayn kerak bo'ladigan fayllar ro'yxati va versiya joylanadi.
// Versiya — fayllar mazmunining xeshi: biror fayl o'zgarsa, brauzer yangi service worker'ni o'rnatadi.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const here = (p) => new URL(p, import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const dist = here('../dist/');

// Sahifa ishlashi uchun kerak bo'ladiganlar. Ilova ikonkalari va og.png ni brauzer/Telegram o'zi oladi.
const keep = (path) => path === '/index.html' || path === '/favicon.svg' || path === '/manifest.webmanifest' || /^\/assets\/[^/]+\.(js|css)$/.test(path);

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else {
      const path = '/' + relative(dist, full).replace(/\\/g, '/');
      if (keep(path)) files.push(path);
    }
  }
})(dist);

if (!files.includes('/index.html') || !files.some((p) => p.endsWith('.js'))) {
  throw new Error(`dist to'liq emas: ${files.join(', ')}`);
}

const hash = createHash('sha256');
for (const path of files) hash.update(path).update(readFileSync(join(dist, path)));
const version = hash.digest('hex').slice(0, 12);
// Sahifa "/" manzilida keshlanadi: navigatsiya javobi va oflayn zaxira bitta.
const list = files.map((p) => (p === '/index.html' ? '/' : p));

const sw = readFileSync(here('./sw.template.js'), 'utf8')
  .replace("'__VERSION__'", JSON.stringify(version))
  .replace('__FILES__', JSON.stringify(list));
writeFileSync(join(dist, 'sw.js'), sw);
console.log(`sw.js: ${version}, ${list.length} fayl`);
