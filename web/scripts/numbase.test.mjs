import { describe, expect, it } from 'vitest';
import { BaseError, convert, divisionSteps, expansionTerms, groupBits, parseInBase, stepsHtml, toBase } from './numbase.mjs';

const code = (fn) => {
  try {
    fn();
  } catch (e) {
    return e instanceof BaseError ? e.code : 'other';
  }
  return 'ok';
};

const L = {
  division: 'div {to}',
  expansion: 'exp {from}',
  group: 'grp {from} to {to}',
  via10: 'via {from} to {to}',
  dividend: 'D',
  quotient: 'Q',
  remainder: 'R',
  readUp: 'read:',
  digitsTo: 'digits {n}',
  bitsTo: 'bits {n}',
  same: 'same',
};

describe('sanoq sistemalari', () => {
  it("o'qish va yozish: har qanday asos, katta-kichik harf, bo'shliqlar", () => {
    for (let base = 2; base <= 16; base++)
      for (const n of [0, 1, 7, 15, 16, 255, 2026, 65535, 1e9]) {
        const s = n.toString(base);
        expect(toBase(parseInBase(s, base), base)).toBe(s.toUpperCase());
        expect(Number(parseInBase(s, base))).toBe(n);
      }
    expect(parseInBase('1010 1100', 2)).toBe(172n);
    expect(parseInBase('7ea', 16)).toBe(2026n);
    expect(toBase(2n ** 64n - 1n, 16)).toBe('FFFFFFFFFFFFFFFF');
  });

  it('xatolar', () => {
    expect(code(() => parseInBase('', 10))).toBe('empty');
    expect(code(() => parseInBase('102', 2))).toBe('digit');
    expect(code(() => parseInBase('G', 16))).toBe('digit');
    expect(code(() => parseInBase('-5', 10))).toBe('digit');
    expect(code(() => parseInBase('1.5', 10))).toBe('digit');
    expect(code(() => parseInBase('1'.repeat(65), 2))).toBe('big');
    expect(code(() => convert('1', 1, 10))).toBe('base');
    expect(code(() => convert('1', 10, 17))).toBe('base');
  });

  it('bosqichlar: bo\'lish va yoyish natijaga olib keladi', () => {
    const d = divisionSteps(2026n, 16);
    expect(d.map((s) => s.remainder)).toEqual([10, 14, 7]);
    expect(d.at(-1).quotient).toBe(0n);
    const e = expansionTerms('7EA', 16);
    expect(e.map((t) => t.term)).toEqual([1792n, 224n, 10n]);
    expect(groupBits('11111101010', 4).map((g) => g.digit).join('')).toBe('7EA');
    expect(groupBits('11111101010', 3).map((g) => g.bits)).toEqual(['011', '111', '101', '010']);
  });

  it('usul tanlash', () => {
    expect(convert('2026', 10, 16)).toMatchObject({ method: 'division', result: '7EA' });
    expect(convert('7EA', 16, 10)).toMatchObject({ method: 'expansion', result: '2026' });
    expect(convert('11111101010', 2, 8)).toMatchObject({ method: 'group', result: '3752', split: null });
    expect(convert('3752', 8, 16)).toMatchObject({ method: 'group', result: '7EA' });
    expect(convert('7EA', 16, 2)).toMatchObject({ method: 'group', result: '11111101010', join: null });
    expect(convert('1012', 3, 5)).toMatchObject({ method: 'via10', result: '112' });
    expect(convert('42', 10, 10)).toMatchObject({ method: 'same', result: '42' });
    // Har qanday juftlik: natija to'g'ri.
    for (let from = 2; from <= 16; from++)
      for (let to = 2; to <= 16; to++) for (const n of [0, 5, 100, 4095]) expect(convert(n.toString(from), from, to).result).toBe(n.toString(to).toUpperCase());
  });

  it('yechim HTML: har usulda javob va bosqichlar', () => {
    const html = (s, f, t) => stepsHtml(convert(s, f, t), L);
    expect(html('2026', 10, 16)).toContain('<strong>2026₁₀ = 7EA₁₆</strong>');
    expect(html('2026', 10, 16)).toContain('14 (E)');
    expect(html('7EA', 16, 10)).toContain('7EA₁₆ = 7·16² + 14·16¹ + 10·16⁰ = 1792 + 224 + 10 = 2026₁₀');
    expect(html('3752', 8, 16)).toContain('digits 3');
    expect(html('3752', 8, 16)).toContain('bits 4');
    expect(html('1012', 3, 5)).toContain('via 3 to 5');
    expect(() => html('<b>', 10, 2)).toThrow(BaseError);
  });
});
