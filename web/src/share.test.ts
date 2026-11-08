import { describe, expect, it } from 'vitest';
import { fullShareText, levelShareText, telegramShareUrl, tgAppLink } from './share';
import { startRoute } from './telegram';

describe('ulashish', () => {
  const text = levelShareText({ number: 15, title: 'Multipleksor', stars: 2, gates: 5, goal: 4 });

  it('daraja natijasi matni', () => {
    expect(text).toBe("Logic Gate · 15-daraja «Multipleksor»\n★★☆ — 5 ta element (maqsad: 4)\nSen ham yechib ko'r!");
  });

  it('Telegram havolasi matn va manzilni to\'g\'ri kodlaydi', () => {
    const url = telegramShareUrl('http://example.uz/', text);
    expect(url.startsWith('https://t.me/share/url?url=http%3A%2F%2Fexample.uz%2F&text=')).toBe(true);
    const parsed = new URL(url);
    expect(parsed.searchParams.get('url')).toBe('http://example.uz/');
    expect(parsed.searchParams.get('text')).toBe(text);
  });

  it('nusxalash matni havola bilan tugaydi', () => {
    expect(fullShareText('http://example.uz/', 'salom')).toBe('salom\nhttp://example.uz/');
  });
});

describe('Telegram Mini App havolalari', () => {
  const app = 'https://t.me/LogicGateBot/play';

  it('sahifa startapp parametriga aylanadi va Telegram ichida shu sahifa ochiladi', () => {
    expect(tgAppLink('', app)).toBe(app);
    expect(tgAppLink('#/daily', app)).toBe(`${app}?startapp=daily`);
    const code = 'eyJ0IjoiWE9SIn0_-Ab';
    expect(tgAppLink(`#/p/${code}`, app)).toBe(`${app}?startapp=p_${code}`);
    expect(startRoute('daily')).toBe('daily');
    expect(startRoute(`p_${code}`)).toBe(`p/${code}`);
    expect(tgAppLink('#/class/AB12CD', app)).toBe(`${app}?startapp=c_AB12CD`);
    expect(startRoute('c_AB12CD')).toBe('class/AB12CD');
    expect(startRoute('c_AB12')).toBe('');
    expect(startRoute('nomalum')).toBe('');
    expect(startRoute(null)).toBe('');
  });

  it("Telegram ruxsat bermaydigan parametr — oddiy ilova havolasi; sozlanmagan — bo'sh", () => {
    expect(tgAppLink(`#/p/${'a'.repeat(600)}`, app)).toBe(app);
    expect(tgAppLink('#/daily', '')).toBe('');
  });
});
