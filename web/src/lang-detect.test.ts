import { describe, expect, it } from 'vitest';
import themeJs from '../public/theme.js?raw';
import { deviceLang, pickLang, takeUrlLang } from './lang-detect';

describe('interfeys tili', () => {
  it('birinchi tanish til: uz yoki ru', () => {
    expect(pickLang(['ru-RU'])).toBe('ru');
    expect(pickLang(['uz-Cyrl-UZ'])).toBe('uz');
    expect(pickLang(['en-US', 'ru'])).toBe('ru');
    expect(pickLang(['RU_ru'])).toBe('ru');
    expect(pickLang([null, undefined, 'uz'])).toBe('uz');
    expect(pickLang(['en', 'de'])).toBeNull();
    expect(pickLang([])).toBeNull();
    // "rus" yoki "uzbek" — kod emas.
    expect(pickLang(['rus', 'uzbek'])).toBeNull();
  });

  it("brauzerdan tashqarida (Node) qurilma tili olinmaydi — testlar kompyuter tiliga bog'liq emas", () => {
    expect(deviceLang('ru')).toBeNull();
    expect(takeUrlLang()).toBeNull();
  });
});

/**
 * public/theme.js ni soxta brauzerda bajaradi: u ochilish tilini state.ts (initialSettings) bilan bir xil
 * tartibda taxmin qilib, shu til lug'atini oldindan so'rab qo'yadi. Natija — <html lang> va so'ralgan fayllar.
 */
function boot(env: { search?: string; hash?: string; stored?: Record<string, unknown>; languages?: string[]; hints?: boolean }) {
  const html = { lang: 'uz', setAttribute() {}, getAttribute: () => null };
  const stored = env.stored ?? {};
  const hints: Record<string, string> = env.hints === false ? {} : { 'data-dict-uz': '/assets/i18n-uz-1.js', 'data-dict-ru': '/assets/i18n-ru-1.js' };
  const links: { rel?: string; href?: string }[] = [];
  const document = {
    documentElement: html,
    currentScript: { getAttribute: (name: string) => hints[name] ?? null },
    createElement: () => ({}),
    head: { appendChild: (link: { rel?: string; href?: string }) => links.push(link) },
  };
  const location = { search: env.search ?? '', hash: env.hash ?? '', pathname: '/' };
  const localStorage = { getItem: (key: string) => (key in stored ? JSON.stringify(stored[key]) : null) };
  const languages = env.languages ?? ['en-US'];
  const navigator = { languages, language: languages[0] };
  new Function('window', 'document', 'location', 'localStorage', 'navigator', 'addEventListener', themeJs)(
    {},
    document,
    location,
    localStorage,
    navigator,
    () => {},
  );
  return { lang: html.lang, preload: links.map((l) => `${l.rel} ${l.href}`) };
}

describe("theme.js: ochilish tili lug'atini oldindan so'rash", () => {
  const uz = { lang: 'uz', preload: ['modulepreload /assets/i18n-uz-1.js'] };
  const ru = { lang: 'ru', preload: ['modulepreload /assets/i18n-ru-1.js'] };
  const tgHash = (code: string) =>
    `#tgWebAppData=${encodeURIComponent(`user=${encodeURIComponent(JSON.stringify({ id: 1, language_code: code }))}&auth_date=1`)}&tgWebAppPlatform=ios`;

  it("havoladagi ?lang= — saqlangan tildan ham ustun; noma'lum qiymat hisobga olinmaydi", () => {
    expect(boot({ search: '?lang=ru', stored: { 'lg.settings.v1': { lang: 'uz' } } })).toEqual(ru);
    expect(boot({ search: '?x=1&lang=uz', stored: { 'lg.settings.v1': { lang: 'ru' } } })).toEqual(uz);
    expect(boot({ search: '?lang=en', stored: { 'lg.settings.v1': { lang: 'ru' } } })).toEqual(ru);
  });

  it('saqlangan til — qurilma tilidan ustun', () => {
    expect(boot({ stored: { 'lg.settings.v1': { lang: 'ru' }, 'lg.progress.v1': {} }, languages: ['uz'] })).toEqual(ru);
    expect(boot({ stored: { 'lg.settings.v1': { lang: 'uz' } }, languages: ['ru-RU'] })).toEqual(uz);
  });

  it('birinchi ochilish: Telegram tili, keyin brauzer tillari; tanish til topilmasa — o\'zbekcha', () => {
    expect(boot({ languages: ['en-US', 'ru-RU'] })).toEqual(ru);
    expect(boot({ hash: tgHash('ru'), languages: ['uz'] })).toEqual(ru);
    expect(boot({ hash: tgHash('en'), languages: ['uz-Cyrl'] })).toEqual(uz);
    expect(boot({ languages: ['en-US', 'de'] })).toEqual(uz);
  });

  it("qaytgan o'yinchi (natija yoki profil bor, til saqlanmagan) — qurilma tiliga qaralmaydi", () => {
    expect(boot({ stored: { 'lg.progress.v1': {} }, languages: ['ru'] })).toEqual(uz);
    expect(boot({ stored: { 'lg.profile.v1': { id: 'a' }, 'lg.settings.v1': { sound: false } }, languages: ['ru'] })).toEqual(uz);
  });

  it("fayl manzillari yo'q (dev rejimi) — hech narsa so'ralmaydi, lug'atni ilova o'zi yuklaydi", () => {
    expect(boot({ languages: ['ru'], hints: false })).toEqual({ lang: 'ru', preload: [] });
  });
});
