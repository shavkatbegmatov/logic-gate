// Kutilmagan xatolar haqida serverga xabar (POST /api/client-errors): server ularni log'ga yozadi,
// bot admin'ga ogohlantiradi. Faqat o'yinning o'z kodidagi (/assets/…) xatolar — brauzer kengaytmalari
// va Telegram skripti xatolari yuborilmaydi. Shaxsiy ma'lumot yo'q: ekran nomi (marshrutning birinchi
// qismi, kodlarsiz), versiya, xabar, stek va brauzer. Bir sahifada ko'pi bilan 5 ta, har biri bir marta.
import { inTelegram } from './telegram';
import { APP_VERSION } from './version';

const MAX_PER_PAGE = 5;
const sent = new Set<string>();

/**
 * Bizning bundle'dagi xatomi va shovqin emasmi. Manzil saytning o'zi bilan: kengaytmalar ham
 * chrome-extension://…/assets/x.js kabi yo'l ishlatadi.
 */
export function shouldReport(msg: string, stack: string, file = '', origin = typeof location !== 'undefined' ? location.origin : ''): boolean {
  if (!msg || !origin || /ResizeObserver loop|^Script error\.?$|Load failed|Failed to fetch|NetworkError|AbortError/i.test(msg)) return false;
  const ours = `${origin}/assets/`;
  return stack.includes(ours) || file.startsWith(ours);
}

/** Ekran nomi: "#/class/ABC123" → "class" (kod va boshqa qiymatlarsiz). */
export function routeName(hash: string): string {
  return (hash.replace(/^#\/?/, '').split('/')[0] || 'home').replace(/[^a-z]/g, '').slice(0, 20);
}

function report(err: unknown, file?: string) {
  const e = err as { message?: unknown; stack?: unknown } | null;
  const msg = String(e?.message ?? err ?? '').slice(0, 300);
  const stack = String(e?.stack ?? '').slice(0, 1500);
  if (!shouldReport(msg, stack, file) || sent.size >= MAX_PER_PAGE || sent.has(msg)) return;
  sent.add(msg);
  const body = JSON.stringify({
    msg,
    stack,
    route: routeName(location.hash),
    version: APP_VERSION,
    ua: navigator.userAgent.slice(0, 200),
    tg: inTelegram,
  });
  try {
    if (navigator.sendBeacon?.('/api/client-errors', new Blob([body], { type: 'application/json' }))) return;
  } catch {
    // quyidagi usul
  }
  fetch('/api/client-errors', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
}

export function installErrorReporting() {
  addEventListener('error', (e) => report(e.error ?? e.message, e.filename));
  addEventListener('unhandledrejection', (e) => report(e.reason));
}
