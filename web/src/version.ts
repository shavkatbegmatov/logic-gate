// O'yin versiyasi (web/package.json) va "nimalar yangi" xabari: yangi versiyadan keyin qaytgan
// o'yinchiga bosh sahifada bir marta ko'rsatiladi; birinchi marta kirgan o'yinchiga — yo'q.
import { computed, signal } from '@preact/signals';
import { load, save } from './storage';

declare const __APP_VERSION__: string;

export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

const KEY = 'lg.seenVersion.v1';

/** O'yinchi oxirgi marta yangiliklarini ko'rgan versiya (null — hali hech qachon). */
export const seenVersion = signal<string | null>(load(KEY, null, (v) => (typeof v === 'string' ? v : null)));

export function markNewsSeen() {
  if (seenVersion.value === APP_VERSION) return;
  seenVersion.value = APP_VERSION;
  save(KEY, APP_VERSION);
}

export const hasNews = computed(() => seenVersion.value !== APP_VERSION);

/**
 * Bosh sahifa ochilganda: yangi o'yinchi uchun yangiliklar "ko'rilgan" bo'ladi (unga hammasi yangi);
 * avval o'ynagan, lekin yangiliklarni ko'rmaganga xabar chiqadi.
 */
export function newsFor(returning: boolean): boolean {
  if (!hasNews.value) return false;
  if (!returning && seenVersion.value === null) {
    markNewsSeen();
    return false;
  }
  return true;
}
