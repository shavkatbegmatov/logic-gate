import { describe, expect, it } from 'vitest';
import { fromOldHost, hasProgress, importData, merge, moveUrl, onOldHost } from './migrate';

/** localStorage o'rnida oddiy xotira. */
function memStore(init: Record<string, unknown> = {}) {
  const m = new Map(Object.entries(init).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    dump: () => Object.fromEntries([...m].map(([k, v]) => [k, JSON.parse(v)])),
  };
}

const level = (gates: number) => ({ stars: 3, gates, circuit: { gates: [], wires: [] }, at: 1, synced: true });

describe("eski manzildan ko'chish", () => {
  it('qaysi manzil eski hisoblanadi', () => {
    // .env da VITE_SITE_URL — asosiy manzil; lokal ishlab chiqish hech qachon eski emas.
    const site = new URL(import.meta.env.VITE_SITE_URL as string).host;
    expect(onOldHost(site)).toBe(false);
    expect(onOldHost('127.0.0.1:8080')).toBe(false);
    expect(onOldHost('localhost:5173')).toBe(false);
    expect(onOldHost('boshqa.example.uz')).toBe(true);
  });

  it("natija bor-yo'qligi", () => {
    expect(hasProgress(memStore())).toBe(false);
    expect(hasProgress(memStore({ 'lg.settings.v1': { sound: false }, 'lg.intro.v1': ['NOT'] }))).toBe(false);
    expect(hasProgress(memStore({ 'lg.progress.v1': { b1: level(1) } }))).toBe(true);
    expect(hasProgress(memStore({ 'lg.profile.v1': { id: 'x', nickname: 'A', code: 'C' } }))).toBe(true);
    expect(hasProgress(memStore({ 'lg.custom.v1': { solved: {}, created: 1 } }))).toBe(true);
  });

  it("havola orqali to'liq ko'chirish: bo'sh yangi manzilga", () => {
    const old = memStore({
      'lg.progress.v1': { b1: level(1), b2: level(2) },
      'lg.profile.v1': { id: 'p1', nickname: "Bo'ri", code: 'ABCD-EFGH-JKMN-PQRS' },
      'lg.settings.v1': { sound: true, lang: 'ru' },
      'lg.dailyPuzzle.v1': { day: 1 },
      'boshqa.kalit': 1,
    });
    const url = moveUrl(old);
    expect(url).toMatch(/\/#\/import\/[A-Za-z0-9_-]+$/);
    const fresh = memStore();
    expect(importData(url.split('#/import/')[1], fresh)).toBe(3);
    expect(fresh.dump()).toEqual({
      'lg.progress.v1': { b1: level(1), b2: level(2) },
      'lg.profile.v1': { id: 'p1', nickname: "Bo'ri", code: 'ABCD-EFGH-JKMN-PQRS' },
      'lg.settings.v1': { sound: true, lang: 'ru' },
    });
  });

  it('yangi manzilda ham natija bo\'lsa — har biridan yaxshirog\'i', () => {
    expect(merge('lg.progress.v1', { b1: level(3), b2: level(2) }, { b1: level(1), b3: level(4) })).toEqual({
      b1: level(1),
      b2: level(2),
      b3: level(4),
    });
    expect(merge('lg.profile.v1', { id: 'yangi' }, { id: 'eski' })).toEqual({ id: 'yangi' });
    expect(merge('lg.intro.v1', ['NOT'], ['NOT', 'AND'])).toEqual(['NOT', 'AND']);
    expect(merge('lg.hints.v1', { b1: 1 }, { b1: 3, b2: 1 })).toEqual({ b1: 3, b2: 1 });
    expect(merge('lg.custom.v1', { solved: { a: { gates: 5 } }, created: 1 }, { solved: { a: { gates: 3 } }, created: 2 })).toEqual({
      solved: { a: { gates: 3 } },
      created: 2,
    });
    expect(merge('lg.achievements.v1', { first: 2 }, { first: 1, creator: 1 })).toEqual({ first: 2, creator: 1 });
    // Yangi manzil birinchi ochilishda sozlamalarni tilsiz saqlaydi — eski manzildagi til yo'qolmasin.
    expect(merge('lg.settings.v1', { sound: true }, { sound: false, lang: 'ru' })).toEqual({ sound: true, lang: 'ru' });
  });

  it("yangi manzilda boshqa profil bo'lsa — eski natijalar unga qayta yuboriladi", () => {
    const old = memStore({
      'lg.progress.v1': { b1: level(1), b2: level(5) },
      'lg.profile.v1': { id: 'eski', nickname: 'TEST_USER', code: 'AAAA-AAAA-AAAA-AAAA' },
    });
    const code = moveUrl(old).split('#/import/')[1];
    const fresh = memStore({
      'lg.progress.v1': { b2: level(3) },
      'lg.profile.v1': { id: 'yangi', nickname: 'TEST_USER', code: 'BBBB-BBBB-BBBB-BBBB' },
    });
    importData(code, fresh);
    const d = fresh.dump();
    expect(d['lg.profile.v1'].id).toBe('yangi');
    // b1 — eski manzildan, joriy profil uni bilmaydi; b2 — yangi manzildagisi yaxshiroq, o'zgarmaydi.
    expect(d['lg.progress.v1']).toEqual({ b1: { ...level(1), synced: false }, b2: level(3) });

    // Profil bir xil bo'lsa — belgilar o'zgarmaydi.
    const same = memStore({ 'lg.profile.v1': { id: 'eski', nickname: 'TEST_USER', code: 'AAAA-AAAA-AAAA-AAAA' } });
    importData(code, same);
    expect(same.dump()['lg.progress.v1']).toEqual({ b1: level(1), b2: level(5) });
  });

  it("ko'chirish havolasi faqat eski manzildan kelganda qabul qilinadi", () => {
    expect(fromOldHost('http://logic-gate.170.168.6.82.sslip.io/')).toBe(true);
    expect(fromOldHost('https://boshqa.example.uz/')).toBe(false);
    expect(fromOldHost('https://t.me/')).toBe(false);
    expect(fromOldHost('')).toBe(false);
  });

  it("natija bo'lmagan yozuvlar (null, son) ko'chirilmaydi — ilova ochilishida to'xtamasin", () => {
    const code = btoa(JSON.stringify({ 'lg.progress.v1': { b1: level(1), b2: null, b3: 5, __proto__x: 'x' } }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const fresh = memStore();
    importData(code, fresh);
    expect(fresh.dump()['lg.progress.v1']).toEqual({ b1: level(1) });
    const mine = memStore({ 'lg.progress.v1': { b1: level(2) } });
    importData(code, mine);
    expect(mine.dump()['lg.progress.v1']).toEqual({ b1: level(1) });
  });

  it('buzilgan kod hech narsani buzmaydi', () => {
    const store = memStore({ 'lg.progress.v1': { b1: level(1) } });
    expect(importData('!!!', store)).toBe(0);
    expect(importData('aGVsbG8', store)).toBe(0);
    expect(store.dump()).toEqual({ 'lg.progress.v1': { b1: level(1) } });
  });
});
