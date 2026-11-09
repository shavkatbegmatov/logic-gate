import { describe, expect, it } from 'vitest';
import { compareExprs, ExprError, parseExpr, truthTableOf } from './boolexpr.mjs';

const q = (src) => truthTableOf(src).rows.map((r) => r.q).join('');
const err = (src) => {
  try {
    parseExpr(src);
  } catch (e) {
    return e instanceof ExprError ? `${e.code}@${e.pos}` : 'other';
  }
  return 'ok';
};

describe('mantiqiy ifodalar', () => {
  it('asosiy amallar va har xil yozuvlar', () => {
    expect(q('A ∧ B')).toBe('0001');
    expect(q('A & B')).toBe('0001');
    expect(q('A·B')).toBe('0001');
    expect(q('AB')).toBe('0001');
    expect(q('a and b')).toBe('0001');
    expect(q('A ∨ B')).toBe('0111');
    expect(q('A + B')).toBe('0111');
    expect(q('A | B')).toBe('0111');
    expect(q('A ⊕ B')).toBe('0110');
    expect(q('A ^ B')).toBe('0110');
    expect(q('¬A')).toBe('10');
    expect(q('!A')).toBe('10');
    expect(q("A'")).toBe('10');
    expect(q('NOT A')).toBe('10');
    expect(q('¬¬A')).toBe('01');
    expect(q('A ∧ 1')).toBe('01');
    expect(q('A ∨ 1')).toBe('11');
  });

  it("ustunlik: NOT > AND > XOR > OR, qavslar", () => {
    expect(q('A ∨ B ∧ C')).toBe(q('A ∨ (B ∧ C)'));
    expect(q('A ⊕ B ∧ C')).toBe(q('A ⊕ (B ∧ C)'));
    expect(q('A ∨ B ⊕ C')).toBe(q('A ∨ (B ⊕ C)'));
    expect(q('¬A ∧ B')).toBe(q('(¬A) ∧ B'));
    expect(q("(AB)'")).toBe(q('¬(A ∧ B)'));
    expect(truthTableOf('C ∨ A').vars).toEqual(['A', 'C']);
  });

  it('xatolar: joyi bilan', () => {
    expect(err('')).toBe('empty@0');
    expect(err('A ∧')).toBe('end@3');
    expect(err('A ∧ ∨ B')).toBe('unexpected@4');
    expect(err('(A ∨ B')).toBe('paren@6');
    expect(err('A ∨ B)')).toBe('unexpected@5');
    expect(err('A = B')).toBe('char@2');
    expect(err('A B C D E F')).toBe('ok');
    expect(err('A B C D E F G')).toBe('vars@0');
  });

  it('solishtirish: teng yoki farq qiladigan qator', () => {
    expect(compareExprs('¬(A ∧ B)', '¬A ∨ ¬B').equal).toBe(true);
    const r = compareExprs('¬(A ∧ B)', '¬A ∧ ¬B');
    expect(r.equal).toBe(false);
    expect(r.counter).toEqual({ A: 0, B: 1 });
    expect(r.values).toEqual([1, 0]);
    // Turli o'zgaruvchilar: A ∨ ¬A = 1 (B qiymati ahamiyatsiz).
    expect(compareExprs('A ∨ ¬A', 'B ∨ 1').equal).toBe(true);
  });
});
