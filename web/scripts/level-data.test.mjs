import { describe, expect, it } from 'vitest';
import pack from '../../levels/levels.json';
import { DETAIL, splitLevels } from './level-data.mjs';

describe("daraja ma'lumotlari: bosh yuklama va tafsilotlar", () => {
  const { meta, detail } = splitLevels(pack);

  it("bosh yuklamada jadval, avtomat, vazifa va maslahat yo'q (tarjimada ham)", () => {
    for (const level of meta.levels) {
      for (const key of DETAIL) expect(level, `${level.id}.${key}`).not.toHaveProperty(key);
      expect(Object.keys(level.i18n.ru)).toEqual(['title']);
    }
    expect(meta.chapters).toEqual(pack.chapters);
  });

  it("ikki bo'lak birga — aynan levels.json", () => {
    const merged = meta.levels.map((level) => {
      const { i18n, ...more } = detail[level.id];
      return { ...level, ...more, i18n: { ru: { ...level.i18n.ru, ...i18n.ru } } };
    });
    expect(merged).toEqual(pack.levels);
    expect(Object.keys(detail)).toEqual(pack.levels.map((l) => l.id));
  });
});
