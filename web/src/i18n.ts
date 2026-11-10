// Interfeys matnlari. Har til lug'ati o'z faylida (i18n-uz.ts, i18n-ru.ts) va alohida bo'lakda: o'yin
// ochilishida faqat kerakli til yuklanadi, ikkinchisi — o'yinchi tilni almashtirganda. Yangi til —
// `Dict` tuzilmasidagi obyekt va LOADERS dagi yozuv.
import { signal } from '@preact/signals';
import type { uz } from './i18n-uz';

/** Lug'at tuzilmasi — o'zbekcha lug'atdan. */
export type Dict = typeof uz;

const LOADERS = {
  uz: () => import('./i18n-uz').then((m) => m.uz),
  ru: () => import('./i18n-ru').then((m): Dict => m.ru),
};
export type Lang = keyof typeof LOADERS;
export const LANGS: { id: Lang; name: string }[] = [
  { id: 'uz', name: "O'zbekcha" },
  { id: 'ru', name: 'Русский' },
];

const dicts: Partial<Record<Lang, Dict>> = {};
const loading: Partial<Record<Lang, Promise<Dict>>> = {};

/** Til lug'atini yuklaydi (bir marta). Yuklanmasa — xato; keyingi chaqiruv qayta urinadi. */
export function loadLang(l: Lang): Promise<Dict> {
  const ready = dicts[l];
  if (ready) return Promise.resolve(ready);
  return (loading[l] ??= LOADERS[l]().then(
    (d) => (dicts[l] = d),
    (e) => {
      delete loading[l];
      throw e;
    },
  ));
}

/**
 * Joriy til lug'ati. `export let` — import qilgan modullar har doim joriy qiymatni ko'radi. Birinchi
 * lug'at yuklanguncha bo'sh: ilova undan keyingina chiziladi (main.tsx), shuning uchun modul
 * yuklanayotganda (funksiyadan tashqarida) `t` dan o'qimang.
 */
export let t = undefined as unknown as Dict;
export const lang = signal<Lang>('uz');

/** Oxirgi so'ralgan til: sekin yuklangan lug'at keyinroq tanlangan tilning ustidan yozmasin. */
let wanted: Lang = 'uz';

function apply(l: Lang, dict: Dict) {
  t = dict;
  try {
    document.documentElement.lang = l;
  } catch {
    // Testlarda document yo'q.
  }
  lang.value = l;
}

/**
 * Tilni almashtiradi: lug'ati yuklangan bo'lsa — darhol (sinxron), aks holda yuklangach. Yuklanmasa
 * (oflayn, keshda yo'q) eski til qoladi va natija — false.
 */
export function setLang(l: Lang): Promise<boolean> {
  // `in` emas: meros kalitlar ("constructor") ham o'tib, matnlar o'rniga Object qolardi.
  const next: Lang = Object.prototype.hasOwnProperty.call(LOADERS, l) ? l : 'uz';
  wanted = next;
  const ready = dicts[next];
  if (ready) {
    apply(next, ready);
    return Promise.resolve(true);
  }
  return loadLang(next).then(
    (d) => {
      // Kutish paytida boshqa til so'ralgan bo'lsa — o'sha qoladi. Hali hech bir til qo'yilmagan bo'lsa,
      // kelgani qo'yiladi: natija true bo'lgach `t` har doim tayyor (ilova shunga tayanib chiziladi).
      if (wanted === next || !t) apply(next, d);
      return true;
    },
    () => false,
  );
}
