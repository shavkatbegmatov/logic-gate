/// <reference types="vitest/config" />
import preact from '@preact/preset-vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { splitLevels } from './scripts/level-data.mjs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/**
 * Til lug'atlari alohida bo'lakda (src/i18n.ts → i18n-uz.ts, i18n-ru.ts). Ularning manzillari (nomida
 * xesh) index.html dagi theme.js tegiga yoziladi (data-dict-uz, data-dict-ru): public/theme.js kerakli
 * tilni asosiy JS bilan parallel so'rab qo'yadi, scripts/compress.mjs esa uni bosh yuklamaga qo'shib
 * hisoblaydi.
 */
function dictHints(): Plugin {
  const tag = '<script src="/theme.js"';
  return {
    name: 'lg-dict-hints',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html; // dev: lug'atni ilova o'zi yuklaydi.
        const attrs = Object.values(ctx.bundle)
          .flatMap((chunk) => {
            const lang = chunk.type === 'chunk' && chunk.isDynamicEntry && /[\\/]i18n-(\w+)\.ts$/.exec(chunk.facadeModuleId ?? '')?.[1];
            return lang ? [` data-dict-${lang}="/${chunk.fileName}"`] : [];
          })
          .sort();
        if (attrs.length < 2 || !html.includes(tag)) throw new Error(`til lug'atlari bo'laklari topilmadi: ${attrs.join('')}`);
        return html.replace(tag, tag + attrs.join(''));
      },
    },
  };
}

/**
 * Daraja ma'lumotlari ikki bo'lakda (scripts/level-data.mjs): `virtual:levels/meta` — bosh yuklamada,
 * `virtual:levels/detail` — alohida bo'lakda, daraja ochilishidan oldin yuklanadi (src/levels.ts).
 */
function levelData(): Plugin {
  const file = fileURLToPath(new URL('../levels/levels.json', import.meta.url));
  const parts = { 'virtual:levels/meta': 'meta', 'virtual:levels/detail': 'detail' } as const;
  return {
    name: 'lg-level-data',
    resolveId: (id) => (Object.hasOwn(parts, id) ? '\0' + id : undefined),
    load(id) {
      const name = id.slice(1);
      if (!id.startsWith('\0') || !Object.hasOwn(parts, name)) return;
      const part = parts[name as keyof typeof parts];
      this.addWatchFile(file);
      const data = splitLevels(JSON.parse(readFileSync(file, 'utf8')))[part];
      // JSON.parse obyekt literalidan tezroq tahlil qilinadi (katta ma'lumot uchun V8 tavsiyasi).
      return `export default JSON.parse(${JSON.stringify(JSON.stringify(data))});`;
    },
  };
}

export default defineConfig({
  plugins: [preact(), dictHints(), levelData()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    // levels/levels.json web/ papkasidan tashqarida joylashgan.
    fs: { allow: ['..'] },
    proxy: { '/api': 'http://127.0.0.1:8080' },
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    // Til lug'atlari testlarda oldindan yuklanadi (ilovada ular alohida bo'lakda).
    setupFiles: ['src/test-setup.ts'],
    // theme.test.ts barcha uslub fayllarini ?raw bilan o'qiydi — CSS o'chirilgan bo'lsa, matn bo'sh keladi.
    css: { include: [/styles\.css/, /screens[\\/][^\\/]+\.css/] },
    // Har test fayli alohida jarayonda emas (standart «forks»), bitta jarayon ichidagi oqimda ishlaydi.
    // Antivirus har yangi jarayonni tekshiradigan kompyuterda (ishga tushish ~5 s) forks bilan to'plam
    // ~220 s davom etib, testlar 5 s cheklovdan o'tib yiqilardi; threads bilan — ~5 s.
    pool: 'threads',
  },
});
