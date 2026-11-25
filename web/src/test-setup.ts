// Testlar oldidan (vite.config.ts → setupFiles): ilovada lug'atlar alohida bo'lakda va birinchi
// chizishdan oldin kutiladi (i18n.ts, main.tsx); testlar esa `t` ni va `setLang` natijasini darhol
// (sinxron) o'qiydi — shuning uchun ikkala lug'at shu yerda oldindan yuklanadi.
// Daraja tafsilotlari (jadvallar, vazifa matni) ham ilovada alohida bo'lakda — testlar ularni darhol o'qiydi.
import { loadLang, setLang } from './i18n';
import { loadLevelDetails } from './levels';

await Promise.all([loadLang('uz'), loadLang('ru'), loadLevelDetails()]);
await setLang('uz');
