import { describe, expect, it } from 'vitest';
import pack from '../../../levels/levels.json';
import solutions from '../../../levels/solutions.json';
import {
  check,
  compile,
  counterexample,
  depths,
  evaluate,
  exampleFor,
  machineOf,
  machineOut,
  machineReplay,
  replay,
  starsFor,
  truthTable,
  validate,
  wouldCycle,
} from './sim';
import type { Circuit, Level, LevelPack, Spec } from './types';

const levels = (pack as unknown as LevelPack).levels;
const sols = solutions as Record<string, Circuit>;

describe('darajalar', () => {
  it('36 ta daraja va har birida yechim bor', () => {
    expect(levels).toHaveLength(36);
    for (const l of levels) expect(sols[l.id], l.id).toBeDefined();
  });

  it.each(levels.map((l) => [l.id, l] as const))('%s: mos yozuvdagi yechim 3★ oladi', (_, level) => {
    const res = check(level, sols[level.id]);
    expect(res).toEqual({ ok: true, gates: level.goal, stars: 3 });
  });

  it('bo\'limlar tartibi va ochilish chegaralari o\'sib boradi', () => {
    const { chapters } = pack as unknown as LevelPack;
    for (let i = 1; i < chapters.length; i++) {
      expect(chapters[i].unlockStars).toBeGreaterThan(chapters[i - 1].unlockStars);
    }
  });
});

const spec: Spec = { inputs: ['A', 'B'], outputs: ['Q'], gates: ['AND', 'NOT', 'OR'] };

describe('validate', () => {
  it('ulanmagan chiqishni topadi', () => {
    expect(validate(spec, { gates: [], wires: [] })).toEqual({ code: 'unconnected_output', ref: 'Q' });
  });

  it('ulanmagan element kirishini topadi', () => {
    const c: Circuit = {
      gates: [{ id: 'g1', type: 'AND', x: 0, y: 0 }],
      wires: [
        { from: 'in:A', to: 'g1:0' },
        { from: 'g1', to: 'out:Q' },
      ],
    };
    expect(validate(spec, c)).toEqual({ code: 'unconnected_input', ref: 'g1' });
  });

  it('siklni topadi', () => {
    const c: Circuit = {
      gates: [
        { id: 'g1', type: 'OR', x: 0, y: 0 },
        { id: 'g2', type: 'NOT', x: 0, y: 0 },
      ],
      wires: [
        { from: 'in:A', to: 'g1:0' },
        { from: 'g2', to: 'g1:1' },
        { from: 'g1', to: 'g2:0' },
        { from: 'g1', to: 'out:Q' },
      ],
    };
    expect(validate(spec, c)?.code).toBe('cycle');
  });

  it('bitta kirishga ikki simni rad etadi', () => {
    const c: Circuit = {
      gates: [],
      wires: [
        { from: 'in:A', to: 'out:Q' },
        { from: 'in:B', to: 'out:Q' },
      ],
    };
    expect(validate(spec, c)).toEqual({ code: 'sink_taken', ref: 'out:Q' });
  });

  it('ruxsat etilmagan element va noto\'g\'ri simlarni rad etadi', () => {
    expect(validate(spec, { gates: [{ id: 'x', type: 'XOR', x: 0, y: 0 }], wires: [] })?.code).toBe(
      'gate_not_allowed',
    );
    expect(validate(spec, { gates: [], wires: [{ from: 'in:Z', to: 'out:Q' }] })?.code).toBe('bad_wire');
    expect(
      validate(spec, { gates: [{ id: 'n', type: 'NOT', x: 0, y: 0 }], wires: [{ from: 'in:A', to: 'n:1' }] })
        ?.code,
    ).toBe('bad_wire');
    expect(validate(spec, { gates: [{ id: 'Bad id', type: 'NOT', x: 0, y: 0 }], wires: [] })?.code).toBe(
      'bad_gate',
    );
  });
});

describe('simulyatsiya', () => {
  it('kirishdan to\'g\'ridan-to\'g\'ri chiqishga sim', () => {
    const c = compile(spec, { gates: [], wires: [{ from: 'in:B', to: 'out:Q' }] });
    expect(truthTable(c)).toEqual([[0], [1], [0], [1]]);
  });

  it('ulanmagan chiqish null qaytaradi, ulanmagan kirish 0 deb olinadi', () => {
    const c = compile(spec, {
      gates: [{ id: 'n', type: 'NOT', x: 0, y: 0 }],
      wires: [{ from: 'n', to: 'out:Q' }],
    });
    expect(evaluate(c, [1, 1]).outputs).toEqual([1]);
    expect(evaluate(compile(spec, { gates: [], wires: [] }), [0, 0]).outputs).toEqual([null]);
  });

  it('yulduzlar', () => {
    expect(starsFor(4, 3)).toBe(3);
    expect(starsFor(4, 4)).toBe(3);
    expect(starsFor(4, 6)).toBe(2);
    expect(starsFor(4, 7)).toBe(1);
  });

  it('noto\'g\'ri javobda xato qatorlarni qaytaradi', () => {
    const level = levels.find((l) => l.id === 'b2')!;
    const res = check(level, {
      gates: [{ id: 'o', type: 'AND', x: 0, y: 0 }],
      wires: [
        { from: 'in:A', to: 'o:0' },
        { from: 'in:A', to: 'o:1' },
        { from: 'o', to: 'out:Q' },
      ],
    });
    expect(res).toEqual({ ok: false, wrongRows: [2] });
  });
});

describe('wouldCycle', () => {
  const c: Circuit = {
    gates: [
      { id: 'a', type: 'AND', x: 0, y: 0 },
      { id: 'b', type: 'NOT', x: 0, y: 0 },
    ],
    wires: [{ from: 'a', to: 'b:0' }],
  };
  it('o\'ziga ulash va orqaga ulash sikl', () => {
    expect(wouldCycle(c, 'a', 'a:0')).toBe(true);
    expect(wouldCycle(c, 'b', 'a:1')).toBe(true);
  });
  it('oldinga ulash sikl emas', () => {
    expect(wouldCycle(c, 'in:A', 'a:0')).toBe(false);
    expect(wouldCycle(c, 'b', 'out:Q')).toBe(false);
  });
});

describe('depths', () => {
  it('kirishlar 0, element — eng chuqur kirishi + 1; ulanmagan kirish 0 hisoblanadi', () => {
    const c: Circuit = {
      gates: [
        { id: 'o', type: 'OR', x: 0, y: 0 },
        { id: 'n', type: 'NOT', x: 0, y: 0 },
        { id: 'a', type: 'AND', x: 0, y: 0 },
        { id: 'z', type: 'AND', x: 0, y: 0 },
      ],
      wires: [
        { from: 'n', to: 'o:0' },
        { from: 'in:B', to: 'o:1' },
        { from: 'in:A', to: 'n:0' },
        { from: 'o', to: 'a:0' },
        { from: 'in:A', to: 'a:1' },
        { from: 'a', to: 'out:Q' },
      ],
    };
    const d = depths(compile(spec, c));
    expect(Object.fromEntries(d)).toEqual({ 'in:A': 0, 'in:B': 0, n: 1, o: 2, a: 3, z: 1 });
  });
});

// ── Xotira (D-trigger) ─────────────────────────────────────

const lvl = (id: string) => levels.find((l) => l.id === id)! as Level;
const dff = (id: string, src: string) => [{ id, type: 'DFF' as const, x: 0, y: 0 }, { from: src, to: `${id}:0` }] as const;

describe('D-trigger', () => {
  const seqSpec: Spec = { inputs: ['T'], outputs: ['Q'], gates: ['DFF', 'XOR', 'NOT'] };
  // Almashtirgich: d = DFF(XOR(T, d)) — aylana trigger orqali o'tadi, sikl emas.
  const toggle: Circuit = {
    gates: [
      { id: 'x', type: 'XOR', x: 0, y: 0 },
      { id: 'd', type: 'DFF', x: 0, y: 0 },
    ],
    wires: [
      { from: 'in:T', to: 'x:0' },
      { from: 'd', to: 'x:1' },
      { from: 'x', to: 'd:0' },
      { from: 'd', to: 'out:Q' },
    ],
  };

  it('trigger orqali aylana — sikl emas, triggersiz aylana — sikl', () => {
    expect(validate(seqSpec, toggle)).toBeNull();
    expect(wouldCycle({ gates: toggle.gates, wires: toggle.wires.filter((w) => w.to !== 'd:0') }, 'x', 'd:0')).toBe(false);
    const noDff: Circuit = {
      gates: [{ id: 'x', type: 'XOR', x: 0, y: 0 }],
      wires: [{ from: 'in:T', to: 'x:0' }],
    };
    expect(wouldCycle(noDff, 'x', 'x:1')).toBe(true);
  });

  it('takt: holat kirishlar tarixidan hisoblanadi, boshida 0', () => {
    const c = compile(seqSpec, toggle);
    expect(evaluate(c, [1]).outputs).toEqual([0]);
    expect(evaluate(c, [0], replay(c, [1])).outputs).toEqual([1]);
    expect(evaluate(c, [0], replay(c, [1, 0, 1])).outputs).toEqual([0]);
    expect(evaluate(c, [0], replay(c, [1, 1, 1])).outputs).toEqual([1]);
    // Trigger — manba: chuqurligi 0, to'lqin unda ham boshidan yonadi.
    expect(depths(c).get('d')).toBe(0);
    expect(depths(c).get('x')).toBe(1);
  });

  it('s3 (almashtirgich) — avtomat bilan solishtirish', () => {
    const level = lvl('s3');
    expect(check(level, toggle)).toEqual({ ok: true, gates: 2, stars: 3 });
    // XOR o'rniga to'g'ridan-to'g'ri T — bu kechikish, almashtirgich emas.
    const delay: Circuit = { gates: [{ id: 'd', type: 'DFF', x: 0, y: 0 }], wires: [{ from: 'in:T', to: 'd:0' }, { from: 'd', to: 'out:Q' }] };
    const res = check(level, delay);
    expect(res.ok).toBe(false);
    const trace = 'trace' in res ? res.trace : [];
    // Eng qisqa farq: T = 1, 0, 0 — 3-taktda kechikish 0 ni (oldingi T), almashtirgich 1 ni ko'rsatadi.
    expect(trace).toEqual([1, 0, 0]);
    const seq = level.seq!;
    const c = compile(level, delay);
    const last = trace[trace.length - 1];
    expect(evaluate(c, [last], replay(c, trace.slice(0, -1))).outputs).toEqual([0]);
    expect(machineOut(seq, machineReplay(seq, trace.slice(0, -1)), last)).toEqual([1]);
  });

  it('counterexample birinchi taktdagi xatoni ham topadi', () => {
    const level = lvl('s1');
    const wire: Circuit = { gates: [], wires: [{ from: 'in:A', to: 'out:Q' }] };
    // Q = A: birinchi taktda A = 1 bo'lsa, Q 0 bo'lishi kerak edi.
    expect(counterexample(compile(level, wire), level.seq!)).toEqual([1]);
  });

  it("8 tadan ortiq trigger — xato (holatlar soni chegaralanadi)", () => {
    const gates = Array.from({ length: 9 }, (_, i) => ({ id: `d${i}`, type: 'DFF' as const, x: 0, y: 0 }));
    const wires = gates.map((g) => ({ from: 'in:A', to: `${g.id}:0` }));
    const spec: Spec = { inputs: ['A'], outputs: ['Q'], gates: ['DFF'] };
    expect(validate(spec, { gates, wires: [...wires, { from: 'd0', to: 'out:Q' }] })).toEqual({ code: 'too_many_flipflops' });
  });

  it("kombinatsion darajada DFF ruxsat etilmaydi", () => {
    const [g, w] = dff('d', 'in:A');
    expect(validate(lvl('b1'), { gates: [g], wires: [w, { from: 'd', to: 'out:Q' }] })).toEqual({ code: 'gate_not_allowed', ref: 'd' });
  });

  it('qum qutidagi jadval joriy holatda hisoblanadi', () => {
    const spec: Spec = { inputs: ['A'], outputs: ['Q'], gates: ['DFF'] };
    const [g, w] = dff('d', 'in:A');
    const c = compile(spec, { gates: [g], wires: [w, { from: 'd', to: 'out:Q' }] });
    expect(truthTable(c)).toEqual([[0], [0]]);
    expect(truthTable(c, replay(c, [1]))).toEqual([[1], [1]]);
  });
});

describe('sxemadan avtomat', () => {
  it("har bir xotira darajasining yechimidan qurilgan avtomat — darajaning o'zi (kanonik shakl bir xil)", () => {
    for (const level of levels.filter((l) => l.seq)) {
      const m = machineOf(compile(level, sols[level.id]));
      expect({ id: level.id, ...m }).toEqual({ id: level.id, next: level.seq!.next, out: level.seq!.out });
    }
  });

  it("namuna bir xil avtomat uchun bir xil va hamma holatlardan o'tadi", () => {
    const s6 = lvl('s6').seq!;
    const ex = exampleFor(s6);
    expect(ex).toEqual(exampleFor({ next: s6.next, out: s6.out }));
    expect(ex).toHaveLength(10);
    const seen = new Set([0]);
    let s = 0;
    for (const r of ex) seen.add((s = s6.next[s][r]));
    expect(seen.size).toBe(s6.next.length);
  });
});
