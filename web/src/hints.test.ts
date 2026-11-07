import { describe, expect, it } from 'vitest';
import { Editor } from './board/editor';
import { outputColumn } from './board/geometry';
import { hasGate, hintSteps } from './hints';
import { levelById, levels } from './levels';
import { check } from './sim/sim';
import type { Circuit } from './sim/types';

describe('bosqichli maslahat', () => {
  it('har bir darajada uch bosqich: yo\'nalish, tarkib, birinchi element', () => {
    for (const level of levels) {
      const steps = hintSteps(level);
      expect(steps.map((s) => s.kind), level.id).toEqual(['text', 'text', 'place']);
      expect(steps[0].text).toBe(level.hint);
      // Tarkibdagi elementlar soni maqsadga teng (3 ★ yechim).
      const total = Object.values(level.hints!.gates).reduce((a, b) => a + b, 0);
      expect(total, level.id).toBe(level.goal);
    }
  });

  it('matnlar', () => {
    const steps = hintSteps(levelById('c3')!);
    expect(steps[1].text).toBe('3 ★ yechim tarkibi: 1 × NOT, 2 × AND, 1 × OR.');
    expect(steps[2].text).toBe('Boshlang: S ni NOT ga ulang.');
    expect(hintSteps(levelById('n1')!)[2].text).toBe('Boshlang: A ni NAND ning ikkala kirishiga ulang.');
    expect(hintSteps(levelById('x3')!)[2].text).toBe('Boshlang: A va B ni XOR ga ulang.');
  });

  it('maydonga qo\'yilgan element bir qadamda bekor qilinadi va hasGate uni taniydi', () => {
    for (const level of levels) {
      const step = hintSteps(level)[2];
      if (step.kind !== 'place') throw new Error(level.id);
      const ed = new Editor();
      ed.load(level, { gates: [], wires: [] }, outputColumn(level.goal));
      expect(hasGate(ed.circuit.value, step.type, step.sources), level.id).toBe(false);
      const id = ed.placeGate(step.type, step.sources);
      const c = ed.circuit.value;
      expect(c.gates.map((g) => g.id), level.id).toEqual([id]);
      expect(c.wires.every((w) => w.to.startsWith(`${id}:`) && w.from.startsWith('in:')), level.id).toBe(true);
      expect(hasGate(c, step.type, step.sources), level.id).toBe(true);
      // Element kirishlar o'ng tomonida, chiqishlardan chapda.
      const g = c.gates[0];
      expect(g.x).toBeGreaterThan(0);
      expect(g.x).toBeLessThan(ed.outX.value);
      ed.undo();
      expect(ed.circuit.value).toEqual({ gates: [], wires: [] });
    }
  });

  it('hasGate: kirishlar tartibi ahamiyatsiz, tur va manbalar mos bo\'lishi shart', () => {
    const c: Circuit = {
      gates: [{ id: 'g1', type: 'XOR', x: 0, y: 0 }],
      wires: [
        { from: 'in:B', to: 'g1:0' },
        { from: 'in:A', to: 'g1:1' },
      ],
    };
    expect(hasGate(c, 'XOR', ['A', 'B'])).toBe(true);
    expect(hasGate(c, 'AND', ['A', 'B'])).toBe(false);
    expect(hasGate(c, 'XOR', ['A', 'C'])).toBe(false);
    expect(hasGate({ ...c, wires: c.wires.slice(0, 1) }, 'XOR', ['A', 'B'])).toBe(false);
  });

  it('maslahat bilan boshlangan sxema to\'g\'ri yechimga olib boradi (x3)', () => {
    const level = levelById('x3')!;
    const ed = new Editor();
    ed.load(level, { gates: [], wires: [] }, outputColumn(level.goal));
    const step = hintSteps(level)[2];
    if (step.kind !== 'place') throw new Error();
    const first = ed.placeGate(step.type, step.sources);
    ed.addGate('XOR', 400, 100);
    const second = ed.circuit.value.gates[1].id;
    ed.connect(first, `${second}:0`);
    ed.connect('in:C', `${second}:1`);
    ed.connect(second, 'out:Q');
    expect(check(level, ed.circuit.value)).toEqual({ ok: true, gates: 2, stars: 3 });
  });
});
