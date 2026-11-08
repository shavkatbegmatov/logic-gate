import { afterEach, describe, expect, it } from 'vitest';
import { hintSteps } from './hints';
import { lang, ru, setLang, t, uz } from './i18n';
import { chapters, levelById } from './levels';

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
