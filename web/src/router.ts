import { signal } from '@preact/signals';

// Hash asosidagi marshrutlash: server sozlamasiz ishlaydi.
export type Route =
  | { name: 'home' }
  | { name: 'levels' }
  | { name: 'level'; id: string }
  | { name: 'sandbox'; formula?: string }
  | { name: 'leaderboard'; tab: 'overall' | 'daily' }
  | { name: 'daily'; day?: number }
  | { name: 'archive' }
  | { name: 'lesson'; id: string }
  | { name: 'class'; code: string }
  | { name: 'teacher'; code?: string }
  | { name: 'news' }
  | { name: 'certificate' }
  | { name: 'achievements' }
  | { name: 'custom'; code: string }
  | { name: 'settings' };

/** Buzilgan %-kodlashda ham yiqilmasin (qo'lda yozilgan havola). */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function parse(hash: string): Route {
  const [name, arg] = hash.replace(/^#\/?/, '').split('/');
  switch (name) {
    case 'daily':
      return arg && /^\d+$/.test(arg) ? { name, day: Number(arg) } : { name };
    case 'sandbox':
      return arg ? { name, formula: safeDecode(arg) } : { name };
    case 'levels':
    case 'archive':
    case 'achievements':
    case 'settings':
    case 'news':
    case 'certificate':
      return { name };
    case 'leaderboard':
      return { name, tab: arg === 'daily' ? 'daily' : 'overall' };
    case 'level':
      return arg ? { name: 'level', id: safeDecode(arg) } : { name: 'levels' };
    case 'lesson':
      return arg ? { name: 'lesson', id: safeDecode(arg) } : { name: 'levels' };
    case 'class':
      return arg ? { name: 'class', code: safeDecode(arg) } : { name: 'settings' };
    case 'teacher':
      return arg ? { name: 'teacher', code: safeDecode(arg) } : { name: 'teacher' };
    case 'p':
      return arg ? { name: 'custom', code: arg } : { name: 'home' };
    default:
      return { name: 'home' };
  }
}

export const route = signal<Route>(parse(location.hash));

addEventListener('hashchange', () => {
  route.value = parse(location.hash);
});

// Telegram'da birinchi ochilishda hashda ishga tushirish parametrlari turadi va Telegram SDK ularni
// yuklanayotganda o'qiydi. SDK yuklanguncha (sekin internet) o'yinchi boshqa ekranga o'tsa, hash
// o'zgarmaydi — ekran faqat ilovada almashadi; SDK yuklangach o'sha ekran hashga yoziladi.
let holding = false;
let heldPath: string | undefined;

export function holdHash() {
  holding = true;
  heldPath = undefined;
}

/** Hashni qo'yib yuboradi: o'yinchi kutish paytida tanlagan ekran, tanlamagan bo'lsa — fallback. */
export function releaseHash(fallback: string) {
  if (!holding) return;
  holding = false;
  const path = heldPath ?? fallback;
  heldPath = undefined;
  replaceRoute(path);
}

export function go(path: string) {
  if (holding) {
    heldPath = path;
    route.value = parse(`#/${path}`);
    return;
  }
  location.hash = path ? `#/${path}` : '#/';
}

/** Joriy hashni tarixga yangi yozuv qo'shmasdan almashtiradi. */
export function replaceRoute(path: string) {
  history.replaceState(null, '', `${location.pathname}${location.search}#/${path}`);
  route.value = parse(location.hash);
}
