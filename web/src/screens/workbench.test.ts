import { describe, expect, it } from 'vitest';
import { checkTiming } from './Workbench';

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
});
