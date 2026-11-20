// Build natijasini oldindan gzip qiladi: Nginx `gzip_static on` bilan tayyor .gz faylni uzatadi,
// har bir so'rovda CPU sarflamaydi.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = new URL('../dist/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const exts = /\.(js|css|html|svg|json|txt|webmanifest)$/;
let raw = 0;
let packed = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (exts.test(name)) {
      const data = readFileSync(path);
      const gz = gzipSync(data, { level: 9 });
      raw += data.length;
      packed += gz.length;
      if (gz.length < data.length) writeFileSync(path + '.gz', gz);
    }
  }
}

walk(dist);
console.log(`gzip: ${(raw / 1024).toFixed(1)} KB → ${(packed / 1024).toFixed(1)} KB`);

// Byudjet: o'yin ochilishida yuklanadigan JS + CSS + bitta til lug'ati — gzip'da 125 KB gacha.
// Og'ir 2D Real va 3D WebGL rendererlar hamda kam ochiladigan ekranlar alohida bo'laklarda yuklanadi.
// Til lug'ati ham ochilishda kerak, lekin faqat bittasi (src/i18n.ts): eng kattasi qo'shib hisoblanadi.
// Lug'atlar manzili — index.html dagi theme.js tegida (vite.config.ts).
const BUDGET = 125 * 1024;
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const gz = (p) => gzipSync(readFileSync(join(dist, p)), { level: 9 }).length;
const initial = [...html.matchAll(/(?:src|href)="\/(assets\/[\w.-]+\.(?:js|css))"/g)].map((m) => m[1]);
const dicts = [...html.matchAll(/data-dict-(\w+)="\/(assets\/[\w.-]+\.js)"/g)].map((m) => ({ lang: m[1], path: m[2], size: gz(m[2]) }));
const dict = dicts.reduce((max, d) => (d.size > max.size ? d : max), { size: 0 });
const size = initial.reduce((sum, p) => sum + gz(p), 0) + dict.size;
console.log(
  `bosh yuklama: ${(size / 1024).toFixed(1)} KB (byudjet ${BUDGET / 1024} KB): ${initial.join(', ')}` +
    ` + lug'at (${dicts.map((d) => `${d.lang} ${(d.size / 1024).toFixed(1)} KB`).join(', ')} — eng kattasi hisobda)`,
);
if (!initial.length || dicts.length < 2 || size > BUDGET) {
  console.error('Bosh bundle byudjetdan oshdi — yangi og\'ir ekranni lazy() bilan alohida yuklang.');
  process.exit(1);
}
