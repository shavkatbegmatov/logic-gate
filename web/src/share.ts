// Natijani ulashish: matn va havolalar. Sof funksiyalar — testlanadi.
import { t } from './i18n';

export interface LevelResult {
  number: number;
  title: string;
  stars: number;
  gates: number;
  goal: number;
}

export function levelShareText(r: LevelResult): string {
  const stars = '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars);
  return t.share.level(r.number, r.title, stars, r.gates, r.goal);
}

/** Telegram'ning ulashish oynasi: foydalanuvchi suhbatni tanlaydi, xabar tayyor bo'ladi. */
export function telegramShareUrl(url: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

/** Telegram Mini App havolasi (t.me/bot/app), web/.env dagi VITE_TG_APP_URL; sozlanmagan bo'lsa — bo'sh. */
export const TG_APP_URL = ((import.meta.env.VITE_TG_APP_URL as string | undefined) ?? '').replace(/\/+$/, '');

/**
 * O'yindagi sahifa (#/daily, #/p/<kod>) uchun Mini App havolasi: startapp parametri Telegram ichida
 * ochilganda shu sahifaga olib boradi (telegram-app.ts → startRoute). Faqat A-Z a-z 0-9 _ - va ≤ 512.
 */
export function tgAppLink(path: string, base = TG_APP_URL): string {
  if (!base) return '';
  const param =
    path === '#/daily' ? 'daily' : path.startsWith('#/p/') ? `p_${path.slice(4)}` : path.startsWith('#/class/') ? `c_${path.slice(8)}` : '';
  return param && /^[\w-]{1,512}$/.test(param) ? `${base}?startapp=${param}` : base;
}

/** Nusxalash uchun to'liq matn (havola bilan). */
export function fullShareText(url: string, text: string): string {
  return `${text}\n${url}`;
}
