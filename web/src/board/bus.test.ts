import { describe, expect, it } from 'vitest';
import solutionsData from '../../../levels/solutions.json';
import { levels } from '../levels';
import type { Circuit, Gate } from '../sim/types';
import { blockPinLabels, blockPortNames, bundles, busExamples, busValue, groupValue, isHiddenBit, pinGroups, portGroup } from './bus';
import { Editor } from './editor';
import { bounds, layout, outputColumn } from './geometry';
import { routeAll } from './routing';

const solutions = solutionsData as unknown as Record<string, Circuit>;
const busLevels = levels.filter((l) => l.buses);
const gmapOf = (c: Circuit) => new Map<string, Gate>(c.gates.map((g) => [g.id, g]));

describe('shina pinlari guruhlari', () => {
  it('shina bitlari bitta guruh, oddiy pinlar alohida, tartib saqlanadi', () => {
    const groups = pinGroups(['A3', 'A2', 'A1', 'A0', 'S'], { A: ['A3', 'A2', 'A1', 'A0'] });
    expect(groups).toEqual([
      { name: 'A', pins: ['A3', 'A2', 'A1', 'A0'], idx: [0, 1, 2, 3], bus: true },
      { name: 'S', pins: ['S'], idx: [4], bus: false },
    ]);
  });

  it('shinasiz daraja — har pin o\'z guruhi', () => {
    expect(pinGroups(['A', 'B'], undefined).map((g) => g.name)).toEqual(['A', 'B']);
  });

  it('guruh qiymati — son (eng katta bit birinchi); noma\'lum bit — null', () => {
    expect(groupValue([1, 0, 1, 1], [0, 1, 2, 3])).toBe(11);
    expect(groupValue([1, null, 1, 1], [0, 1, 2, 3])).toBeNull();
    expect(groupValue([0, 0, 1], [2])).toBe(1);
  });

  it('har shinali daraja: shina pinlari maydonda bitta nuqtada', () => {
    for (const l of busLevels) {
      const lay = layout(l, outputColumn(l.goal));
      for (const [, pins] of Object.entries(l.buses!)) {
        const side = l.inputs.includes(pins[0]) ? lay.inputs : lay.outputs;
        const p0 = side.get(pins[0])!;
        for (const p of pins) expect(side.get(p), `${l.id} ${p}`).toEqual(p0);
      }
    }
  });

  it('shina pini keng: maydon chegarasi uni ham o\'z ichiga oladi', () => {
    const l = levels.find((x) => x.id === 'w1')!;
    const b = bounds({ gates: [], wires: [] }, layout(l, outputColumn(l.goal)));
    expect(b.minX).toBeLessThanOrEqual(-150);
    expect(b.maxX).toBeGreaterThanOrEqual(outputColumn(l.goal) + 92);
  });
});

describe('blok shina oyoqlari', () => {
  it('ADD4: A va B — shina boshlari, qolgan bitlari yashirin', () => {
    const g = new Map<string, Gate>([['g1', { id: 'g1', type: 'ADD4', x: 0, y: 0 }]]);
    expect(portGroup('g1:5', g)).toEqual({ key: 'g1:4', ports: ['g1:4', 'g1:5', 'g1:6', 'g1:7'], bit: 1 });
    expect(portGroup('g1:8', g)).toBeNull();
    expect(portGroup('g1.4', g)).toBeNull();
    expect(isHiddenBit('g1:0', g)).toBe(false);
    expect(isHiddenBit('g1:3', g)).toBe(true);
    expect(isHiddenBit('g1.2', g)).toBe(true);
    expect(blockPortNames('ADD4')).toEqual({ ins: ['A', null, null, null, 'B', null, null, null, 'Ci'], outs: ['S', null, null, null, 'Co'] });
  });

  it('yagona shinali tomonda korpus yozuvi yo\'q (SPLIT kirishi, JOIN chiqishi, NOT4)', () => {
    expect(blockPinLabels('SPLIT').ins).toEqual([null, null, null, null]);
    expect(blockPinLabels('SPLIT').outs).toEqual(['A3', 'A2', 'A1', 'A0']);
    expect(blockPinLabels('JOIN').outs).toEqual([null, null, null, null]);
    expect(blockPinLabels('NOT4')).toEqual({ ins: [null, null, null, null], outs: [null, null, null, null] });
    expect(blockPinLabels('MUX4').ins).toEqual(['A', null, null, null, 'B', null, null, null, 'S']);
    expect(blockPinLabels('INC4').outs).toEqual(['Q', null, null, null, 'C']);
  });

  it('misollar jadvali blok funksiyasiga mos (sonlarda)', () => {
    const add = busExamples('ADD4')!;
    expect(add.ins).toEqual(['A', 'B', 'Ci']);
    expect(add.outs).toEqual(['S', 'Co']);
    for (const r of add.rows) {
      const sum = r.ins[0] + r.ins[1] + r.ins[2];
      expect(r.outs).toEqual([sum & 15, sum >> 4]);
    }
    for (const r of busExamples('INC4')!.rows) expect(r.outs).toEqual([(r.ins[0] + 1) & 15, r.ins[0] === 15 ? 1 : 0]);
    for (const r of busExamples('MUX4')!.rows) expect(r.outs).toEqual([r.ins[2] ? r.ins[1] : r.ins[0]]);
    for (const r of busExamples('NOT4')!.rows) expect(r.outs).toEqual([15 - r.ins[0]]);
    for (const r of busExamples('SPLIT')!.rows) expect(r.outs.reduce((v, b) => v * 2 + b, 0)).toBe(r.ins[0]);
    for (const r of busExamples('JOIN')!.rows) expect(r.outs[0]).toBe(r.ins.reduce((v, b) => v * 2 + b, 0));
    expect(busExamples('FA')).toBeNull();
    expect(busExamples('AND')).toBeNull();
  });
});

describe('shina simlari', () => {
  it('yechimlarda har shina simi to\'liq: boshi chiziladi, bitlari uning yo\'lida', () => {
    for (const l of busLevels) {
      const c = solutions[l.id];
      const gm = gmapOf(c);
      const { rep, bus } = bundles(c.wires, gm, l.buses);
      expect(bus.size, l.id).toBeGreaterThan(0);
      for (const [head, members] of bus) {
        expect(members[0]).toBe(head);
        expect(members.length).toBe(4);
        for (const m of members) expect(rep[m]).toBe(head);
      }
      const routed = routeAll(c.wires, gm, layout(l, outputColumn(l.goal)), false, rep);
      rep.forEach((r, i) => expect(routed.routes[i], `${l.id} ${i}`).toEqual(routed.routes[r]));
    }
  });

  it('shina qiymati bitlar manbalaridan', () => {
    const v = new Map([
      ['in:A3', 1],
      ['in:A2', 0],
      ['in:A1', 1],
      ['in:A0', 0],
    ]);
    expect(busValue(['in:A3', 'in:A2', 'in:A1', 'in:A0'], v)).toBe(10);
    expect(busValue(['in:A3', 'in:X'], v)).toBeNull();
  });

  it('qisman ulangan shina — alohida simlar', () => {
    const g = new Map<string, Gate>([['g1', { id: 'g1', type: 'SPLIT', x: 120, y: 0 }]]);
    const wires = [
      { from: 'in:A3', to: 'g1:0' },
      { from: 'in:A2', to: 'g1:1' },
    ];
    const { rep, bus } = bundles(wires, g, { A: ['A3', 'A2', 'A1', 'A0'] });
    expect(bus.size).toBe(0);
    expect(rep).toEqual([0, 1]);
  });
});

describe('muharrir: shina ulash va o\'chirish', () => {
  const w6 = levels.find((l) => l.id === 'w6')!;
  const make = () => {
    const ed = new Editor();
    ed.load(w6, { gates: [{ id: 'g1', type: 'INC4', x: 120, y: 0 }, { id: 'g2', type: 'MUX4', x: 264, y: 0 }], wires: [] }, outputColumn(w6.goal));
    return ed;
  };

  it('shina boshi ulansa — hamma bitlar tartib bilan ulanadi', () => {
    const ed = make();
    expect(ed.connect('in:A3', 'g1:0')).toBe('ok');
    expect(ed.circuit.value.wires).toEqual([
      { from: 'in:A3', to: 'g1:0' },
      { from: 'in:A2', to: 'g1:1' },
      { from: 'in:A1', to: 'g1:2' },
      { from: 'in:A0', to: 'g1:3' },
    ]);
    expect(ed.connect('in:A3', 'g1:0')).toBe('same');
  });

  it('kengligi farq qilsa yoki biri oddiy sim — ulanmaydi', () => {
    const ed = make();
    expect(ed.connect('in:S', 'g1:0')).toBe('width');
    expect(ed.connect('g1.4', 'g2:4')).toBe('width');
    expect(ed.connect('in:A3', 'g2:8')).toBe('width');
    expect(ed.circuit.value.wires).toEqual([]);
    expect(ed.connect('in:S', 'g2:8')).toBe('ok');
  });

  it('shina simi o\'chirilsa — hamma bitlari birga', () => {
    const ed = make();
    expect(ed.connect('g1', 'g2:4')).toBe('ok');
    ed.connect('in:S', 'g2:8');
    expect(ed.circuit.value.wires.length).toBe(5);
    ed.selection.value = { kind: 'wire', index: 2 };
    ed.removeSelection();
    expect(ed.circuit.value.wires).toEqual([{ from: 'in:S', to: 'g2:8' }]);
  });

  it('yechim tekshiruvdan o\'tadi: chiqish shinasi Q = A + S', () => {
    const ed = make();
    ed.connect('in:A3', 'g1:0');
    ed.connect('in:A3', 'g2:0');
    ed.connect('g1', 'g2:4');
    ed.connect('in:S', 'g2:8');
    ed.connect('g2', 'out:Q3');
    expect(ed.circuit.value.wires.length).toBe(17);
    // A = 1011 (11), S = 1 → Q = 12 = 1100.
    ed.setRow(0b10111);
    expect(ed.evaluation.value.outputs).toEqual([1, 1, 0, 0]);
  });
});
