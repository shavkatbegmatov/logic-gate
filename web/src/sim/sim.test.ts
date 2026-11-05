import { describe, expect, it } from 'vitest';
import pack from '../../../levels/levels.json';
import solutions from '../../../levels/solutions.json';
import { check, compile, evaluate, starsFor, truthTable, validate, wouldCycle } from './sim';
import type { Circuit, LevelPack, Spec } from './types';

const levels = (pack as unknown as LevelPack).levels;
const sols = solutions as Record<string, Circuit>;

describe('darajalar', () => {
  it('30 ta daraja va har birida yechim bor', () => {
    expect(levels).toHaveLength(30);
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
