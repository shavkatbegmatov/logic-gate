import { describe, expect, it } from 'vitest';
import { levelById, levels, newGates } from './levels';
import { ALL_GATE_TYPES, BLOCK_TYPES } from './sim/types';

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
      k1: ['FA'],
      k2: ['HA'],
      k3: ['MUX'],
      k5: ['DEC'],
      w1: ['SPLIT', 'JOIN'],
      w6: ['NOT4', 'ADD4', 'MUX4', 'INC4'],
      l2: ['ONE', 'ZERO'],
      l4: ['AND4', 'OR4', 'XOR4'],
      l5: ['SUB4', 'NOR4'],
    });
  });

  it('har bir element turi roppa-rosa bir marta tanishtiriladi', () => {
    const all = levels.flatMap((l) => newGates(l));
    // ALU4 — oxirgi darajadan ochiladi: hozircha faqat Qum qutida, darajada keyingi bo'limda tanishtiriladi.
    const later = ['ALU4'];
    expect([...all].sort()).toEqual([...ALL_GATE_TYPES, ...BLOCK_TYPES.filter((b) => !later.includes(b))].sort());
  });

  it("allaqachon tanish elementlar qayta ko'rsatilmaydi", () => {
    expect(newGates(levelById('b5')!)).toEqual([]);
    expect(newGates(levelById('x2')!)).toEqual([]);
  });
});
