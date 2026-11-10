// Testlar oldidan (vite.config.ts → setupFiles): ilovada lug'atlar alohida bo'lakda va birinchi
// chizishdan oldin kutiladi (i18n.ts, main.tsx); testlar esa `t` ni va `setLang` natijasini darhol
// (sinxron) o'qiydi — shuning uchun ikkala lug'at shu yerda oldindan yuklanadi.
import { loadLang, setLang } from './i18n';

await Promise.all([loadLang('uz'), loadLang('ru')]);
await setLang('uz');
