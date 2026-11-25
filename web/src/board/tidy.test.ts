import { describe, expect, it } from 'vitest';
import { buildFromFormula } from '../formula-build';
import { compile, truthTable } from '../sim/sim';
import { ALL_GATE_TYPES, type Circuit, type Spec } from '../sim/types';
import { GATE_H, GATE_W, layout, portPoint, wireRoute } from './geometry';
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

  it("bitta element: kirish va chiqish simlari to'g'ri chiziq (pog'onasiz)", () => {
    for (const type of ALL_GATE_TYPES) {
      const two = type !== 'NOT' && type !== 'DFF';
      const s = spec(two ? 2 : 1);
      const c: Circuit = {
        gates: [{ id: 'g1', type, x: 200, y: 300 }],
        wires: [{ from: 'in:A', to: 'g1:0' }, ...(two ? [{ from: 'in:B', to: 'g1:1' }] : []), { from: 'g1', to: 'out:Q' }],
      };
      const t = tidy(s, c, 520, { fit: true });
      const lay = layout(s, t.outX);
      const gates = new Map(t.circuit.gates.map((g) => [g.id, g]));
      const out = wireRoute(portPoint('g1', gates, lay)!, portPoint('out:Q', gates, lay)!);
      expect(out, `${type} → Q`).toHaveLength(2);
      if (!two) {
        const inp = wireRoute(portPoint('in:A', gates, lay)!, portPoint('g1:0', gates, lay)!);
        expect(inp, `A → ${type}`).toHaveLength(2);
      }
    }
  });

  it("chiqishga boradigan sim to'g'ri: oxirgi element pin ro'parasida (bir va ikki chiqish)", () => {
    const route = (s: Spec, c: Circuit, from: string, to: string) => {
      const t = tidy(s, c, 520, { fit: true });
      const lay = layout(s, t.outX);
      const gates = new Map(t.circuit.gates.map((g) => [g.id, g]));
      return wireRoute(portPoint(from, gates, lay)!, portPoint(to, gates, lay)!);
    };
    // (A ∧ B) ∨ C — OR'ning manbalari uni boshqa joyga tortadi, lekin chiqish simi baribir to'g'ri.
    const chain: Circuit = {
      gates: [
        { id: 'g1', type: 'AND', x: 0, y: 0 },
        { id: 'g2', type: 'OR', x: 0, y: 0 },
      ],
      wires: [
        { from: 'in:A', to: 'g1:0' },
        { from: 'in:B', to: 'g1:1' },
        { from: 'g1', to: 'g2:0' },
        { from: 'in:C', to: 'g2:1' },
        { from: 'g2', to: 'out:Q' },
      ],
    };
    expect(route(spec(3), chain, 'g2', 'out:Q')).toHaveLength(2);
    // Yarim summator: S = A ⊕ B, C = A ∧ B — ikkala chiqish simi ham to'g'ri.
    const half: Circuit = {
      gates: [
        { id: 'g1', type: 'XOR', x: 0, y: 0 },
        { id: 'g2', type: 'AND', x: 0, y: 0 },
      ],
      wires: [
        { from: 'in:A', to: 'g1:0' },
        { from: 'in:B', to: 'g1:1' },
        { from: 'in:A', to: 'g2:0' },
        { from: 'in:B', to: 'g2:1' },
        { from: 'g1', to: 'out:S' },
        { from: 'g2', to: 'out:C' },
      ],
    };
    const s2 = spec(2, ['S', 'C']);
    expect(route(s2, half, 'g1', 'out:S')).toHaveLength(2);
    expect(route(s2, half, 'g2', 'out:C')).toHaveLength(2);
  });

  it("bo'sh sxema", () => {
    expect(tidy(spec(2), { gates: [], wires: [] }, 380)).toEqual({ circuit: { gates: [], wires: [] }, outX: 380 });
  });

  it("to'liq ayirgich (m4): barcha chiqish elementlari oxirgi ustunda, simlari to'g'ri va zanjirlar tartibli", () => {
    const m4Spec: Spec = { inputs: ['A', 'B', 'Bi'], outputs: ['D', 'Bo'], gates: ['AND', 'OR', 'NOT', 'XOR'] };
    const m4: Circuit = {
      gates: [
        { id: 'n1', type: 'NOT', x: 0, y: 0 },
        { id: 'n2', type: 'NOT', x: 0, y: 0 },
        { id: 'x1', type: 'XOR', x: 0, y: 0 },
        { id: 'n3', type: 'NOT', x: 0, y: 0 },
        { id: 'x2', type: 'XOR', x: 0, y: 0 },
        { id: 'a1', type: 'AND', x: 0, y: 0 },
        { id: 'a2', type: 'AND', x: 0, y: 0 },
        { id: 'or1', type: 'OR', x: 0, y: 0 },
      ],
      wires: [
        { from: 'in:A', to: 'n1:0' },
        { from: 'n1', to: 'x1:0' },
        { from: 'in:B', to: 'x1:1' },
        { from: 'x1', to: 'x2:0' },
        { from: 'in:Bi', to: 'x2:1' },
        { from: 'x2', to: 'out:D' },
        { from: 'x1', to: 'n3:0' },
        { from: 'n3', to: 'a1:0' },
        { from: 'in:B', to: 'a1:1' },
        { from: 'in:A', to: 'n2:0' },
        { from: 'n2', to: 'a2:0' },
        { from: 'in:Bi', to: 'a2:1' },
        { from: 'a1', to: 'or1:0' },
        { from: 'a2', to: 'or1:1' },
        { from: 'or1', to: 'out:Bo' },
      ],
    };
    const t = tidy(m4Spec, m4, 680, { fit: true });
    noOverlap(t.circuit);
    const byId = new Map(t.circuit.gates.map((g) => [g.id, g]));
    // Ikkala chiqish elementi (XOR2 → D va OR → Bo) bir xil oxirgi ustunda.
    expect(byId.get('x2')!.x).toBe(byId.get('or1')!.x);
    // Ikkala AND bir ustunda, ikkala ichki NOT (n3 va n2) ularning chap ustunida.
    expect(byId.get('a1')!.x).toBe(byId.get('a2')!.x);
    expect(byId.get('n3')!.x).toBe(byId.get('n2')!.x);
    expect(byId.get('n3')!.x).toBeLessThan(byId.get('a1')!.x);
    expect(byId.get('a1')!.x).toBeLessThan(byId.get('or1')!.x);
    // Tartib kesishmasin: n3 (→ a1) n2 (→ a2) dan yuqorida; a1 (→ or1:0) a2 (→ or1:1) dan yuqorida.
    expect(byId.get('n3')!.y).toBeLessThan(byId.get('n2')!.y);
    expect(byId.get('a1')!.y).toBeLessThan(byId.get('a2')!.y);
    // Chiqish simlari va ichki NOT → AND ulanishlari to'g'ri gorizontal chiziq.
    const lay = layout(m4Spec, t.outX);
    expect(wireRoute(portPoint('x2', byId, lay)!, portPoint('out:D', byId, lay)!)).toHaveLength(2);
    expect(wireRoute(portPoint('or1', byId, lay)!, portPoint('out:Bo', byId, lay)!)).toHaveLength(2);
    expect(wireRoute(portPoint('n3', byId, lay)!, portPoint('a1:0', byId, lay)!)).toHaveLength(2);
    expect(wireRoute(portPoint('n2', byId, lay)!, portPoint('a2:0', byId, lay)!)).toHaveLength(2);
  });
});
