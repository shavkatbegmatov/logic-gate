// Interfeys tilini tanlash: o'yinchi hali tanlamagan bo'lsa — qayerdan kelganiga va qurilma tiliga qarab.
import type { Lang } from './i18n';

/** Til kodlari ro'yxatidan birinchi tanish til ('ru-RU' → ru, 'uz-Cyrl' → uz); topilmasa — null. */
export function pickLang(codes: readonly (string | null | undefined)[]): Lang | null {
  for (const code of codes) {
    const base = code?.toLowerCase().split(/[-_]/)[0];
    if (base === 'uz' || base === 'ru') return base;
  }
  return null;
}

/**
 * Havoladagi ?lang= (qo'llanma sahifalaridan: ruscha sahifadagi «Играть» o'yinni ruscha ochadi).
 * O'qiladi va manzildan olib tashlanadi — ulashilgan havolada qolmasin.
 */
export function takeUrlLang(): Lang | null {
  if (typeof location === 'undefined') return null;
  try {
    const params = new URLSearchParams(location.search);
    if (!params.has('lang')) return null;
    const lang = pickLang([params.get('lang')]);
    params.delete('lang');
    const query = params.toString();
    history.replaceState(history.state, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
    return lang;
  } catch {
    return null;
  }
}

/**
 * Qurilma tillari: Telegram ilovasining tili (bo'lsa) birinchi, keyin brauzer tillari. Faqat brauzerda:
 * Node'da ham navigator bor (tizim tili), testlar esa kompyuter tiliga bog'liq bo'lmasin.
 */
export function deviceLang(telegram: string | null): Lang | null {
  if (typeof document === 'undefined') return null;
  const browser = navigator.languages?.length ? navigator.languages : [navigator.language];
  return pickLang([telegram, ...browser]);
}
