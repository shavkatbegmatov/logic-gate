import { describe, expect, it } from 'vitest';
import { evalExpr, parseExpr } from './boolexpr';
import { GATE_H, GATE_W } from './board/geometry';
import { buildFromFormula, foldConstants } from './formula-build';
import { compile, rowBits, truthTable, validate } from './sim/sim';
import { ALL_GATE_TYPES, type Spec } from './sim/types';

const built = (src: string) => {
  const r = buildFromFormula(src);
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
};
const types = (src: string) => built(src).circuit.gates.map((g) => g.type).join(' ');

/** Yig'ilgan sxemaning haqiqat jadvali ifodaning o'zi bilan bir xil. */
function sameAsExpr(src: string) {
  const b = built(src);
  const spec: Spec = { inputs: b.inputs, outputs: ['Q1'], gates: ALL_GATE_TYPES };
  expect(validate(spec, b.circuit), src).toBeNull();
  const table = truthTable(compile(spec, b.circuit));
  const back = new Map(b.rename.map(([from, to]) => [to, from]));
  const { ast } = parseExpr(src);
  table.forEach((row, r) => {
    const bits = rowBits(b.inputs.length, r);
    const env = Object.fromEntries(b.inputs.map((name, k) => [back.get(name) ?? name, bits[k]]));
    expect(row[0], `${src} @ ${bits.join('')}`).toBe(evalExpr(ast, env));
  });
  return b;
}

describe('formuladan sxema', () => {
  it('elementlar: VA, inkor bilan birlashgan NAND, inkorlar alohida', () => {
    expect(types('A ∧ B')).toBe('AND');
    expect(types('¬(A ∧ B)')).toBe('NAND');
    expect(types('¬(A ∨ B)')).toBe('NOR');
    expect(types('¬(A ⊕ B)')).toBe('XNOR');
    expect(types('¬A ∨ ¬B')).toBe('NOT NOT OR');
    expect(types('¬¬A')).toBe('NOT NOT');
  });

  it("bir xil qism-ifoda bir marta yig'iladi", () => {
    expect(types('(A ∧ B) ∨ (A ∧ B)')).toBe('AND OR');
    expect(types('(A ∧ B) ⊕ C ∨ (A ∧ B)')).toBe('AND XOR OR');
  });

  it("konstantalar: soddalashadi yoki 'doimiy' xatosi", () => {
    expect(foldConstants(parseExpr('A ∧ 1').ast)).toEqual({ op: 'var', v: 'A' });
    expect(foldConstants(parseExpr('A ⊕ 1').ast)).toEqual({ op: 'not', a: { op: 'var', v: 'A' } });
    const wire = built('A ∧ 1');
    expect(wire.circuit).toEqual({ gates: [], wires: [{ from: 'in:A', to: 'out:Q1' }] });
    expect(buildFromFormula('A ∧ 0')).toEqual({ ok: false, error: { code: 'const', value: 0 } });
    expect(buildFromFormula('B ∨ ¬0')).toEqual({ ok: false, error: { code: 'const', value: 1 } });
  });

  it("kirishlar: A–E o'zi, boshqa harflar almashtiriladi, 5 tadan ko'pi — xato", () => {
    expect(built('A ∨ C').inputs).toEqual(['A', 'B', 'C']);
    expect(built('A ∨ C').rename).toEqual([]);
    const xy = built('x ∧ ¬y');
    expect(xy.inputs).toEqual(['A', 'B']);
    expect(xy.rename).toEqual([['X', 'A'], ['Y', 'B']]);
    expect(buildFromFormula('A B C D E F')).toEqual({ ok: false, error: { code: 'too_many_inputs', max: 5 } });
    expect(buildFromFormula('A ∧')).toEqual({ ok: false, error: { code: 'end', pos: 3 } });
  });

  it('har qanday ifoda: sxema jadvali ifoda bilan bir xil, elementlar ustma-ust emas', () => {
    for (const src of [
      '¬(A ∧ B) ∨ C',
      '(A ∧ B) ∨ (A ∧ ¬B)',
      'A ⊕ B ⊕ C',
      '(¬A ∧ B ∧ ¬C) ∨ (¬A ∧ B ∧ C) ∨ (A ∧ B ∧ C)',
      "(A + B)(A' + C)",
      'P ∧ Q ∨ ¬R ∧ S ⊕ T',
      '¬(¬(A ∨ B) ∧ ¬(C ∨ D)) ⊕ E',
    ]) {
      const b = sameAsExpr(src);
      const gs = b.circuit.gates;
      for (const g of gs) expect(g.x + GATE_W, src).toBeLessThan(b.outX);
      for (let i = 0; i < gs.length; i++)
        for (let j = i + 1; j < gs.length; j++) {
          const overlap = Math.abs(gs[i].x - gs[j].x) < GATE_W && Math.abs(gs[i].y - gs[j].y) < GATE_H;
          expect(overlap, `${src}: ${gs[i].id} va ${gs[j].id}`).toBe(false);
        }
    }
  });

  it("chuqur ifoda — chiqishlar ustuni o'ngroqqa suriladi", () => {
    expect(built('A ∧ B').outX).toBe(520);
    expect(built('¬(¬(¬(¬(A ∧ B) ∨ C) ∧ D) ∨ E)').outX).toBeGreaterThan(520);
  });
});
