import { describe, expect, it } from 'vitest';
import solutions from '../../../levels/solutions.json';
import { formulaLines } from './formula';
import type { Circuit, GateType } from './types';

/** Qisqa yozuv: { nom: [tur, manba1, manba2?] }, chiqishlar { Q: manba }. Katta harf — kirish. */
function circuit(g: Record<string, [GateType, string, string?]>, out: Record<string, string>): Circuit {
  const src = (s: string) => (/^[A-Z]/.test(s) ? `in:${s}` : s);
  return {
    gates: Object.entries(g).map(([id, [type]]) => ({ id, type, x: 0, y: 0 })),
    wires: [
      ...Object.entries(g).flatMap(([id, [, a, b]]) => [
        { from: src(a), to: `${id}:0` },
        ...(b ? [{ from: src(b), to: `${id}:1` }] : []),
      ]),
      ...Object.entries(out).map(([o, s]) => ({ from: src(s), to: `out:${o}` })),
    ],
  };
}

const text = (c: Circuit, outputs: string[]) => formulaLines(c, outputs).map((l) => `${l.name} = ${l.expr}`);

describe('formula', () => {
  it('oddiy elementlar va qavslar', () => {
    const c = circuit({ a: ['AND', 'A', 'B'], n: ['NOT', 'C'], o: ['OR', 'a', 'n'] }, { Q: 'o' });
    expect(text(c, ['Q'])).toEqual(['Q = (A ∧ B) ∨ ¬C']);
  });

  it("bir xil amal zanjiri qavssiz, NAND/NOR/XNOR — inkor bilan", () => {
    const c = circuit(
      { x: ['XOR', 'A', 'B'], y: ['XOR', 'x', 'C'], n: ['NAND', 'A', 'B'], m: ['NOR', 'n', 'C'], e: ['XNOR', 'A', 'm'] },
      { P: 'y', Q: 'e' },
    );
    expect(text(c, ['P', 'Q'])).toEqual(['P = A ⊕ B ⊕ C', 'Q = ¬(A ⊕ ¬(¬(A ∧ B) ∨ C))']);
  });

  it('umumiy element nom oladi; chiqishga ulangan bo\'lsa — chiqish nomi', () => {
    // To'liq summator: x ikki joyda, s esa S chiqishi va boshqa elementga ulangan.
    const c = circuit(
      { x: ['XOR', 'A', 'B'], s: ['XOR', 'x', 'C'], a: ['AND', 'A', 'B'], b: ['AND', 'x', 'C'], o: ['OR', 'a', 'b'], z: ['NOT', 's'] },
      { S: 's', K: 'o', Z: 'z' },
    );
    expect(text(c, ['S', 'K', 'Z'])).toEqual(['t1 = A ⊕ B', 'S = t1 ⊕ C', 'K = (A ∧ B) ∨ (t1 ∧ C)', 'Z = ¬S']);
  });

  it("ulanmagan joylar — ?, kirish to'g'ridan-to'g'ri chiqishga", () => {
    const c = circuit({ a: ['AND', 'A', 'B'] }, { Q: 'B' });
    c.wires = c.wires.filter((w) => w.to !== 'a:1');
    c.wires.push({ from: 'a', to: 'out:R' });
    expect(text(c, ['Q', 'R', 'S'])).toEqual(['Q = B', 'R = A ∧ ?', 'S = ?']);
  });

  it("D-trigger: holat q1, keyingi qiymat q1⁺ (sxemadagi tartibda)", () => {
    // Ketma-ket qo'shuvchi (a6): ko'chirma triggerda.
    const c = circuit(
      { x: ['XOR', 'A', 'B'], s: ['XOR', 'x', 'c'], a: ['AND', 'A', 'B'], b: ['AND', 'x', 'c'], o: ['OR', 'a', 'b'], c: ['DFF', 'o'] },
      { S: 's' },
    );
    expect(text(c, ['S'])).toEqual(['t1 = A ⊕ B', 'S = t1 ⊕ q1', 'q1⁺ = (A ∧ B) ∨ (t1 ∧ q1)']);
    expect(formulaLines(c, ['S']).map((l) => l.kind)).toEqual(['tmp', 'out', 'next']);
  });

  it("barcha mos yozuvdagi yechimlar uchun formula to'liq (? va … yo'q)", () => {
    const levels = Object.entries(solutions as Record<string, Circuit>);
    expect(levels.length).toBeGreaterThan(40);
    for (const [, c] of levels) {
      const outs = [...new Set(c.wires.filter((w) => w.to.startsWith('out:')).map((w) => w.to.slice(4)))];
      for (const l of formulaLines(c, outs)) expect(l.expr).not.toMatch(/[?…]/);
    }
  });
});

describe('formula: bloklar', () => {
  it("blok chiqishi oddiy amallarda, kirishlari nom bilan (ifoda ikki baravar o'smasin)", () => {
    const c: Circuit = {
      gates: [
        { id: 'h', type: 'HA', x: 0, y: 0 },
        { id: 'x', type: 'AND', x: 0, y: 0 },
        { id: 'f', type: 'FA', x: 0, y: 0 },
      ],
      wires: [
        { from: 'in:A', to: 'h:0' },
        { from: 'in:B', to: 'h:1' },
        { from: 'in:A', to: 'x:0' },
        { from: 'in:C', to: 'x:1' },
        { from: 'x', to: 'f:0' },
        { from: 'in:B', to: 'f:1' },
        { from: 'h.1', to: 'f:2' },
        { from: 'h', to: 'out:S' },
        { from: 'f.1', to: 'out:Co' },
      ],
    };
    expect(formulaLines(c, ['S', 'Co'])).toEqual([
      { name: 'S', expr: 'A ⊕ B', kind: 'out' },
      { name: 't1', expr: 'A ∧ C', kind: 'tmp' },
      { name: 't2', expr: 'A ∧ B', kind: 'tmp' },
      { name: 'Co', expr: '(t1 ∧ B) ∨ (t2 ∧ (t1 ⊕ B))', kind: 'out' },
    ]);
  });
});
