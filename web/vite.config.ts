/// <reference types="vitest/config" />
import preact from '@preact/preset-vite';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

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

export default defineConfig({
  plugins: [preact(), dictHints()],
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
  },
});
