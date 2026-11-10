import { describe, expect, it } from 'vitest';
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
