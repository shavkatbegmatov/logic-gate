import { signal } from '@preact/signals';

// Hash asosidagi marshrutlash: server sozlamasiz ishlaydi.
export type Route =
  | { name: 'home' }
  | { name: 'levels' }
  | { name: 'level'; id: string }
  | { name: 'sandbox' }
  | { name: 'leaderboard' }
  | { name: 'settings' };

function parse(hash: string): Route {
  const [name, arg] = hash.replace(/^#\/?/, '').split('/');
  switch (name) {
    case 'levels':
    case 'sandbox':
    case 'leaderboard':
    case 'settings':
      return { name };
    case 'level':
      return arg ? { name: 'level', id: decodeURIComponent(arg) } : { name: 'levels' };
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
