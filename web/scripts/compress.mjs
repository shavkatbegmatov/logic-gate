// Build natijasini oldindan gzip qiladi: Nginx `gzip_static on` bilan tayyor .gz faylni uzatadi,
// har bir so'rovda CPU sarflamaydi.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = new URL('../dist/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const exts = /\.(js|css|html|svg|json|txt)$/;
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
