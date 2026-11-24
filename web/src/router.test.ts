import { beforeAll, describe, expect, it, vi } from 'vitest';

// Router brauzer manzilini o'qiydi — Node'da kichik o'rinbosar.
const loc = { hash: '#tgWebAppData=x&tgWebAppPlatform=ios', pathname: '/', search: '' };
const replaced: string[] = [];
let router: typeof import('./router');

beforeAll(async () => {
  vi.stubGlobal('location', loc);
  vi.stubGlobal('history', {
    replaceState: (_s: unknown, _t: string, url: string) => {
      replaced.push(url);
      loc.hash = url.slice(url.indexOf('#'));
    },
  });
  vi.stubGlobal('addEventListener', () => {});
  router = await import('./router');
});

describe('Telegram SDK yuklanguncha hash', () => {
  it("o'zgarmaydi; o'yinchi tanlagan ekran keyin yoziladi", () => {
    const { go, holdHash, releaseHash, route } = router;
    holdHash();
    go('levels');
    expect(route.value).toEqual({ name: 'levels' });
    // SDK hali parametrlarni hashdan o'qimagan — ular joyida.
    expect(loc.hash).toBe('#tgWebAppData=x&tgWebAppPlatform=ios');
    // Deep link (sinf havolasi) o'yinchi tanlagan ekranni bosib ketmaydi.
    releaseHash('class/ABCDEF');
    expect(loc.hash).toBe('#/levels');
    expect(route.value).toEqual({ name: 'levels' });
  });

  it("o'yinchi hech qayerga o'tmagan bo'lsa — deep link", () => {
    const { holdHash, releaseHash, route } = router;
    holdHash();
    releaseHash('class/ABCDEF');
    expect(route.value).toEqual({ name: 'class', code: 'ABCDEF' });
    // Ikkinchi marta qo'yib yuborish hech narsa qilmaydi.
    const n = replaced.length;
    releaseHash('daily');
    expect(replaced.length).toBe(n);
  });

  it("bosh sahifaga qaytish ham tanlov hisoblanadi", () => {
    const { go, holdHash, releaseHash, route } = router;
    holdHash();
    go('levels');
    go('');
    releaseHash('daily');
    expect(route.value).toEqual({ name: 'home' });
  });
});

describe('marshrutlar', () => {
  it("o'qituvchi tarqatmasi — sinf hisobotidan alohida ekran", () => {
    const { go, holdHash, releaseHash, route } = router;
    holdHash();
    go('teacher/C7FD68/handout');
    expect(route.value).toEqual({ name: 'handout', code: 'C7FD68' });
    go('teacher/C7FD68');
    expect(route.value).toEqual({ name: 'teacher', code: 'C7FD68' });
    go('teacher');
    expect(route.value).toEqual({ name: 'teacher' });
    releaseHash('');
  });
});
