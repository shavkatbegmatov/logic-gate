import { signal } from '@preact/signals';

// Hash asosidagi marshrutlash: server sozlamasiz ishlaydi.
export type Route =
  | { name: 'home' }
  | { name: 'levels' }
  | { name: 'level'; id: string }
  | { name: 'sandbox' }
  | { name: 'leaderboard'; tab: 'overall' | 'daily' }
  | { name: 'daily'; day?: number }
  | { name: 'archive' }
  | { name: 'lesson'; id: string }
  | { name: 'class'; code: string }
  | { name: 'teacher'; code?: string }
  | { name: 'news' }
  | { name: 'achievements' }
  | { name: 'custom'; code: string }
  | { name: 'settings' };

function parse(hash: string): Route {
  const [name, arg] = hash.replace(/^#\/?/, '').split('/');
  switch (name) {
    case 'daily':
      return arg && /^\d+$/.test(arg) ? { name, day: Number(arg) } : { name };
    case 'levels':
    case 'sandbox':
    case 'archive':
    case 'achievements':
    case 'settings':
    case 'news':
      return { name };
    case 'leaderboard':
      return { name, tab: arg === 'daily' ? 'daily' : 'overall' };
    case 'level':
      return arg ? { name: 'level', id: decodeURIComponent(arg) } : { name: 'levels' };
    case 'lesson':
      return arg ? { name: 'lesson', id: decodeURIComponent(arg) } : { name: 'levels' };
    case 'class':
      return arg ? { name: 'class', code: decodeURIComponent(arg) } : { name: 'settings' };
    case 'teacher':
      return arg ? { name: 'teacher', code: decodeURIComponent(arg) } : { name: 'teacher' };
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

export function go(path: string) {
  location.hash = path ? `#/${path}` : '#/';
}

/** Joriy hashni tarixga yangi yozuv qo'shmasdan almashtiradi. */
export function replaceRoute(path: string) {
  history.replaceState(null, '', `${location.pathname}${location.search}#/${path}`);
  route.value = parse(location.hash);
}
