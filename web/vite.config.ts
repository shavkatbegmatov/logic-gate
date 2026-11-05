import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [preact()],
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
    include: ['src/**/*.test.ts'],
  },
});
