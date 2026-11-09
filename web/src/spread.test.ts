import { describe, expect, it } from 'vitest';
import { percent, spreadView } from './spread';

describe('yechimlar taqsimoti', () => {
  it("bitta o'yinchi yoki bo'sh — diagramma yo'q", () => {
    expect(spreadView(undefined, 4)).toBeNull();
    expect(spreadView([], 4)).toBeNull();
    expect(spreadView([[4, 1]], 4)).toBeNull();
  });

  it("oradagi bo'sh sonlar ham ustun, o'yinchining ustuni belgilanadi", () => {
    const v = spreadView([[3, 2], [5, 4], [6, 1]], 5)!;
    expect(v.cols.map((c) => [c.label, c.count, c.mine])).toEqual([
      ['3', 2, false],
      ['4', 0, false],
      ['5', 4, true],
      ['6', 1, false],
    ]);
    expect(v.total).toBe(7);
    expect(v.fewer).toBe(2);
  });

  it('ortiqchasi oxirgi "N+" ustunga yig\'iladi', () => {
    const v = spreadView([[2, 5], [3, 1], [9, 2], [20, 1]], 12, 4)!;
    expect(v.cols.map((c) => [c.label, c.count, c.mine])).toEqual([
      ['2', 5, false],
      ['3', 1, false],
      ['4', 0, false],
      ['5+', 3, true],
    ]);
    expect(v.fewer).toBe(8);
  });

  it('eng yaxshisi — sizdan kami yo\'q', () => {
    expect(spreadView([[4, 3], [6, 2]], 4)!.fewer).toBe(0);
  });

  it('foiz', () => {
    expect(percent(0, 10)).toBe('0%');
    expect(percent(1, 400)).toBe('<1%');
    expect(percent(1, 3)).toBe('33%');
    expect(percent(5, 5)).toBe('100%');
  });
});
