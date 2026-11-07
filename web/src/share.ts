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

/** Nusxalash uchun to'liq matn (havola bilan). */
export function fullShareText(url: string, text: string): string {
  return `${text}\n${url}`;
}
