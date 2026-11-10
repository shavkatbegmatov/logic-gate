import { afterEach, describe, expect, it, vi } from 'vitest';
import { hintSteps } from './hints';
import { lang, setLang, t } from './i18n';
import { ru } from './i18n-ru';
import { uz } from './i18n-uz';
import { chapters, levelById } from './levels';

// Lug'atlar test-setup.ts da oldindan yuklangan: bu yerda setLang darhol (sinxron) almashtiradi.
afterEach(() => setLang('uz'));

/** Lug'atdagi barcha kalitlar yo'li (funksiya va massivlar — barg). */
function keys(o: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('tillar', () => {
  it("ruscha lug'atda o'zbekchadagi barcha kalitlar bor", () => {
    expect(keys(ru).sort()).toEqual(keys(uz).sort());
    expect(ru.tutorial).toHaveLength(uz.tutorial.length);
    expect(ru.daily.tiers).toHaveLength(uz.daily.tiers.length);
  });

  it("ruscha ko'plik shakllari", () => {
    expect([1, 2, 5, 11, 12, 21, 22, 25, 111].map((n) => ru.daily.streak(n))).toEqual([
      '1 день подряд',
      '2 дня подряд',
      '5 дней подряд',
      '11 дней подряд',
      '12 дней подряд',
      '21 день подряд',
      '22 дня подряд',
      '25 дней подряд',
      '111 дней подряд',
    ]);
    expect(ru.wrongRows(1)).toMatch(/^Неверно в 1 строке\./);
    expect(ru.wrongRows(3)).toMatch(/^Неверно в 3 строках\./);
  });

  it('setLang: lug\'at, daraja va bo\'lim matnlari almashadi va qaytadi', () => {
    const b1 = levelById('b1')!;
    expect([t.home.play, b1.title, chapters[0].title]).toEqual(["O'ynash", 'Inkor', 'Asoslar']);
    setLang('ru');
    expect(lang.value).toBe('ru');
    expect([t.home.play, b1.title, chapters[0].title]).toEqual(['Играть', 'Отрицание', 'Основы']);
    expect(b1.task).toMatch(/^Выход Q/);
    expect(hintSteps(levelById('x3')!).map((s) => s.text)).toEqual([
      'XOR выдаёт 1, если число единиц на входах нечётно. Их можно соединять цепочкой.',
      'Решение на 3 ★: 2 × XOR.',
      'Начните так: подайте A и B на XOR.',
    ]);
    setLang('uz');
    expect([t.home.play, b1.title, chapters[0].title]).toEqual(["O'ynash", 'Inkor', 'Asoslar']);
  });

  it("noma'lum til — o'zbekcha", () => {
    setLang('xx' as never);
    expect(lang.value).toBe('uz');
    expect(t).toBe(uz);
  });
});

// Ilovadagi holat: lug'atlar alohida bo'lakda, hech biri oldindan yuklanmagan (modullar qaytadan olinadi).
describe("lug'atni kech yuklash", () => {
  afterEach(() => {
    vi.doUnmock('./i18n-ru');
    vi.resetModules();
  });

  it("yuklanmagan til lug'ati kelgach almashadi; ungacha eski til turadi", async () => {
    vi.resetModules();
    const i18n = await import('./i18n');
    expect(i18n.t).toBeUndefined();
    expect(await i18n.setLang('uz')).toBe(true);
    const switching = i18n.setLang('ru');
    expect([i18n.lang.value, i18n.t.home.play]).toEqual(['uz', "O'ynash"]);
    expect(await switching).toBe(true);
    expect([i18n.lang.value, i18n.t.home.play]).toEqual(['ru', 'Играть']);
  });

  it("sekin yuklangan lug'at keyinroq tanlangan til ustidan yozmaydi", async () => {
    vi.resetModules();
    const i18n = await import('./i18n');
    await i18n.setLang('uz');
    const slow = i18n.setLang('ru');
    await i18n.setLang('uz');
    await slow;
    expect([i18n.lang.value, i18n.t.home.play]).toEqual(['uz', "O'ynash"]);
  });

  it("ochilishda til ikki marta so'ralsa ham birinchi natijadan keyin `t` tayyor, oxirida — keyingi so'ralgani", async () => {
    vi.resetModules();
    const i18n = await import('./i18n');
    const first = i18n.setLang('uz');
    const second = i18n.setLang('ru');
    expect(await first).toBe(true);
    expect(i18n.t.home.play).toBeTruthy();
    await second;
    expect([i18n.lang.value, i18n.t.home.play]).toEqual(['ru', 'Играть']);
  });

  it("lug'at yuklanmasa eski til qoladi; keyingi urinish qayta yuklaydi", async () => {
    vi.resetModules();
    vi.doMock('./i18n-ru', () => {
      throw new Error('oflayn');
    });
    const i18n = await import('./i18n');
    await i18n.setLang('uz');
    expect(await i18n.setLang('ru')).toBe(false);
    expect([i18n.lang.value, i18n.t.home.play]).toEqual(['uz', "O'ynash"]);
    await expect(i18n.loadLang('ru')).rejects.toThrow();
    vi.doUnmock('./i18n-ru');
    expect(await i18n.setLang('ru')).toBe(true);
    expect(i18n.t.home.play).toBe('Играть');
  });

  it("tugma (switchLang): lug'at kelgach tanlov saqlanadi; yuklanmasa — eski til va xabar", async () => {
    vi.resetModules();
    vi.doMock('./i18n-ru', () => {
      throw new Error('oflayn');
    });
    const showToast = vi.fn();
    vi.doMock('./components/Toast', () => ({ showToast }));
    const i18n = await import('./i18n');
    const { settings, langReady } = await import('./state');
    const { switchLang } = await import('./lang-switch');
    expect(await langReady).toBe(true);

    await switchLang('ru');
    expect([settings.value.lang, i18n.lang.value]).toEqual([undefined, 'uz']);
    expect(showToast).toHaveBeenCalledWith(i18n.t.langFailed, 'error');
    expect(i18n.t.langFailed).toBe(uz.langFailed);

    vi.doUnmock('./i18n-ru');
    await switchLang('ru');
    expect([settings.value.lang, i18n.lang.value, i18n.t.home.play]).toEqual(['ru', 'ru', 'Играть']);
    expect(showToast).toHaveBeenCalledTimes(1);
    vi.doUnmock('./components/Toast');
  });
});
