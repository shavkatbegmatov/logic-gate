import { describe, expect, it } from 'vitest';
import { levelById, levels, newGates } from './levels';
import { ALL_GATE_TYPES } from './sim/types';

describe('newGates', () => {
  it('har bir element birinchi chiqqan darajada tanishtiriladi', () => {
    const intro = Object.fromEntries(levels.filter((l) => newGates(l).length).map((l) => [l.id, newGates(l)]));
    expect(intro).toEqual({
      b1: ['NOT'],
      b2: ['AND'],
      b3: ['OR'],
      x3: ['XOR'],
      n1: ['NAND'],
      m2: ['NOR'],
      m3: ['XNOR'],
      s1: ['DFF'],
    });
  });

  it('har bir element turi roppa-rosa bir marta tanishtiriladi', () => {
    const all = levels.flatMap((l) => newGates(l));
    expect([...all].sort()).toEqual([...ALL_GATE_TYPES].sort());
  });

  it("allaqachon tanish elementlar qayta ko'rsatilmaydi", () => {
    expect(newGates(levelById('b5')!)).toEqual([]);
    expect(newGates(levelById('x2')!)).toEqual([]);
  });
});
