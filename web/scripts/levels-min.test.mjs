import { describe, expect, it } from 'vitest';
import { proveMinimum } from '../../levels/comb-min.mjs';
import { levels } from '../../levels/source.mjs';

// Kombinatsion darajalarda maqsad — isbotlangan minimum: kamroq element bilan bo'lmaydi va maqsad sonida
// yechim bor (levels/comb-min.mjs — to'liq sanash). m5 (ikki bitli summator, 7 element) ~15 s — faqat qo'lda:
// node levels/comb-min.mjs m5. Ketma-ket darajalar — levels/seq-min.mjs (qo'lda, ~1 daqiqa).
const SLOW = new Set(['m5']);

describe('kombinatsion darajalar: maqsad — isbotlangan minimum', () => {
  for (const level of levels.filter((l) => !l.step && !SLOW.has(l.id))) {
    it(`${level.id}: ${level.goal} ta element`, () => {
      expect(proveMinimum(level, 5e6)).toEqual({ min: level.goal, ok: true });
    });
  }

  it("qidiruv kamroq elementli yechimni topadi (maqsad ataylab oshirilsa — yiqiladi)", () => {
    const r5 = levels.find((l) => l.id === 'r5');
    expect(proveMinimum({ ...r5, goal: 6 }, 5e6)).toEqual({ min: 5, ok: false });
  });
});
