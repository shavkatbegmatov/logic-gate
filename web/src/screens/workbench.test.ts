import { describe, expect, it } from 'vitest';
import { badRowTiming, checkTiming } from './Workbench';

describe('tekshiruv animatsiyasi vaqti', () => {
  it('jami vaqt qatorlar sonidan qat\'i nazar ~1,6 s atrofida', () => {
    for (const [rows, depth] of [[4, 2], [8, 3], [8, 12], [16, 5], [32, 6]]) {
      const t = checkTiming(rows, depth);
      const total = rows * (Math.ceil(t.steps / t.stride) * t.step + t.hold);
      expect(total, `${rows} qator, chuqurlik ${depth}`).toBeGreaterThan(1300);
      expect(total, `${rows} qator, chuqurlik ${depth}`).toBeLessThan(2000);
      expect(t.step, "kadrdan qisqa qadam ko'rinmaydi").toBeGreaterThanOrEqual(16);
    }
  });

  it("qisqa jadvalda qator sekinroq; sayoz sxemada har bir qadam ko'rsatiladi", () => {
    expect(checkTiming(2, 1).hold).toBeGreaterThan(checkTiming(16, 1).hold);
    expect(checkTiming(8, 0)).toMatchObject({ steps: 3, stride: 1 });
    expect(checkTiming(16, 10).stride).toBeGreaterThan(1);
  });

  it("xato qator sekinroq: birinchi qatorning o'zi xato bo'lsa ham to'lqin ko'rinadi", () => {
    const wave = (t: { steps: number; stride: number; step: number }) => Math.ceil(t.steps / t.stride) * t.step;
    for (const depth of [0, 1, 3, 6, 12, 30]) {
      const bad = badRowTiming(depth);
      expect(wave(bad), `chuqurlik ${depth}`).toBeGreaterThanOrEqual(600);
      expect(wave(bad), `chuqurlik ${depth}`).toBeLessThanOrEqual(1200);
      expect(bad.step, "kadrdan qisqa qadam ko'rinmaydi").toBeGreaterThanOrEqual(16);
      for (const rows of [2, 4, 8, 32]) {
        const t = checkTiming(rows, depth);
        expect(wave(bad) + bad.hold).toBeGreaterThan(wave(t) + t.hold);
      }
    }
  });
});
