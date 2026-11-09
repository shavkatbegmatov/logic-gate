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

// Byudjet (PLAN.md): o'yin ochilishida yuklanadigan JS + CSS — gzip'da 100 KB gacha. Kam ochiladigan
// ekranlar alohida bo'lakda (src/components/lazy.tsx); bosh bundle o'sib ketsa, build to'xtaydi.
const BUDGET = 100 * 1024;
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const initial = [...html.matchAll(/(?:src|href)="\/(assets\/[\w.-]+\.(?:js|css))"/g)].map((m) => m[1]);
const size = initial.reduce((sum, p) => sum + gzipSync(readFileSync(join(dist, p)), { level: 9 }).length, 0);
console.log(`bosh yuklama: ${(size / 1024).toFixed(1)} KB (byudjet ${BUDGET / 1024} KB): ${initial.join(', ')}`);
if (!initial.length || size > BUDGET) {
  console.error('Bosh bundle byudjetdan oshdi — yangi og\'ir ekranni lazy() bilan alohida yuklang.');
  process.exit(1);
}
