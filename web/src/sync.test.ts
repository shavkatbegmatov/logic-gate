import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { mergeProgress, type LevelProgress } from './state';
import { skippable } from './sync';

const res = (gates: number, synced = true): LevelProgress => ({ stars: 3, gates, circuit: { gates: [], wires: [] }, at: 1, synced });

describe('ikki tab: natijalarni birlashtirish', () => {
  it("har darajada kamroq elementlisi qoladi, boshqa tabdagi yangi natija qo'shiladi", () => {
    const tab1 = { b1: res(2), b2: res(5, false) };
    const tab2 = { b2: res(3, false), b3: res(1, false) };
    expect(mergeProgress(tab1, tab2)).toEqual({ b1: res(2), b2: res(3, false), b3: res(1, false) });
  });

  it("teng bo'lsa — server biladigani; o'zgarish yo'q bo'lsa, o'sha obyekt (qayta saqlanmaydi)", () => {
    const mine = { b1: res(2, false) };
    expect(mergeProgress(mine, { b1: res(2, true) })).toEqual({ b1: res(2, true) });
    const same = { b1: res(2) };
    expect(mergeProgress(same, { b1: res(4) })).toBe(same);
    expect(mergeProgress(same, {})).toBe(same);
  });

  it("buzilgan yozuv e'tiborsiz", () => {
    const mine = { b1: res(2) };
    expect(mergeProgress(mine, { b2: null, b3: { stars: 1 } } as never)).toBe(mine);
  });
});

describe('sinxronlash: qaysi xato boshqa natijalarni to\'xtatmaydi', () => {
  it('faqat shu natijaga tegishli 4xx — o\'tkazib yuboriladi', () => {
    expect(skippable(new ApiError(404, 'no_level'))).toBe(true);
    expect(skippable(new ApiError(400, 'bad_json'))).toBe(true);
    expect(skippable(new ApiError(0, 'network'))).toBe(false);
    expect(skippable(new ApiError(401, 'unauthorized'))).toBe(false);
    expect(skippable(new ApiError(429, 'rate_limited'))).toBe(false);
    expect(skippable(new ApiError(502, 'http'))).toBe(false);
    expect(skippable(new Error('x'))).toBe(false);
  });
});
