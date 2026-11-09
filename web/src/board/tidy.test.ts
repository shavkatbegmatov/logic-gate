import { describe, expect, it } from 'vitest';
import { buildFromFormula } from '../formula-build';
import { compile, truthTable } from '../sim/sim';
import { ALL_GATE_TYPES, type Circuit, type Spec } from '../sim/types';
import { GATE_H, GATE_W } from './geometry';
import { COL_STEP, COL_X, tidy } from './tidy';

const spec = (n: number, outs = ['Q']): Spec => ({ inputs: ['A', 'B', 'C', 'D', 'E'].slice(0, n), outputs: outs, gates: ALL_GATE_TYPES });

function noOverlap(c: Circuit) {
  const g = c.gates;
  for (let i = 0; i < g.length; i++)
    for (let j = i + 1; j < g.length; j++) {
      const hit = Math.abs(g[i].x - g[j].x) < GATE_W && Math.abs(g[i].y - g[j].y) < GATE_H;
      expect(hit, `${g[i].id} va ${g[j].id}`).toBe(false);
    }
}

/** Formuladan sxema, keyin elementlar tasodifiy joylarga sochiladi — "chalkash" sxema. */
function messy(src: string, _n?: number) {
  const r = buildFromFormula(src);
  if (!r.ok) throw new Error(src);
  const c = r.value.circuit;
  return { ...c, gates: c.gates.map((g, i) => ({ ...g, x: (i * 37) % 300, y: (i * 53) % 200 })), wires: c.wires.map((w) => ({ ...w, to: w.to.replace('out:Q1', 'out:Q') })) } as Circuit & { n?: number };
}

describe('tartibga keltirish', () => {
  it("chuqurlik bo'yicha ustunlar, simlar va jadval o'zgarmaydi, ustma-ust emas", () => {
    for (const [src, n] of [
      ['¬(A ∧ B) ∨ C', 3],
      ['(A ⊕ B) ∧ (C ∨ ¬D)', 4],
      ['((A ∧ B) ∨ (C ∧ D)) ⊕ E', 5],
    ] as const) {
      const c = messy(src, n);
      const s = spec(n);
      const t = tidy(s, c, 520);
      expect(t.circuit.wires).toEqual(c.wires);
      expect(truthTable(compile(s, t.circuit))).toEqual(truthTable(compile(s, c)));
      noOverlap(t.circuit);
      for (const g of t.circuit.gates) {
        expect((g.x - COL_X) % COL_STEP).toBe(0);
        expect(g.x + GATE_W).toBeLessThan(t.outX);
      }
      // Manba doim chaproqda.
      const x = new Map(t.circuit.gates.map((g) => [g.id, g.x]));
      for (const w of t.circuit.wires) if (x.has(w.from) && !w.to.startsWith('out:')) expect(x.get(w.from)!).toBeLessThan(x.get(w.to.split(':')[0])!);
    }
  });

  it("fit: darajadagi chiqishlar joyiga sig'diradi (ustunlar orasi qisqaradi)", () => {
    const c = messy('¬(¬(A ∧ B) ∨ C)', 3); // 3 ustun: NAND, OR, NOT
    const loose = tidy(spec(3), c, 380);
    expect(loose.outX).toBeGreaterThan(380);
    const fit = tidy(spec(3), c, 520, { fit: true });
    expect(fit.outX).toBe(520);
    noOverlap(fit.circuit);
  });

  it("D-trigger bilan teskari bog'lanish: yiqilmaydi, sonlar chekli", () => {
    const c: Circuit = {
      gates: [
        { id: 'g1', type: 'DFF', x: 300, y: 200 },
        { id: 'g2', type: 'XOR', x: 10, y: 10 },
        { id: 'g3', type: 'AND', x: 50, y: 400 }, // hech narsaga ulanmagan
      ],
      wires: [
        { from: 'in:A', to: 'g2:0' },
        { from: 'g1', to: 'g2:1' },
        { from: 'g2', to: 'g1:0' },
        { from: 'g1', to: 'out:Q' },
      ],
    };
    const t = tidy(spec(1), c, 380, { fit: true });
    for (const g of t.circuit.gates) {
      expect(Number.isFinite(g.x) && Number.isFinite(g.y)).toBe(true);
    }
    const byId = new Map(t.circuit.gates.map((g) => [g.id, g]));
    expect(byId.get('g2')!.x).toBeLessThan(byId.get('g1')!.x);
    noOverlap(t.circuit);
  });

  it("bo'sh sxema", () => {
    expect(tidy(spec(2), { gates: [], wires: [] }, 380)).toEqual({ circuit: { gates: [], wires: [] }, outX: 380 });
  });
});
