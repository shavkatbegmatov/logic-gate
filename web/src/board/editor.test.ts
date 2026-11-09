import { describe, expect, it } from 'vitest';
import { Editor } from './editor';
import { bounds, outputColumn, portPoint, wireRoute } from './geometry';

const spec = { inputs: ['A', 'B'], outputs: ['Q'], gates: ['AND' as const] };

function make(vertical: boolean, w: number, h: number, insetTop = 0) {
  const ed = new Editor();
  ed.load(spec, { gates: [{ id: 'g1', type: 'AND', x: 156, y: 36 }], wires: [] }, outputColumn(1));
  ed.size = { w, h };
  ed.vertical.value = vertical;
  ed.insetTop = insetTop;
  ed.fit();
  return ed;
}

describe('ekran ↔ dunyo koordinatalari', () => {
  it.each([false, true])('vertical=%s: toWorld(toScreen(p)) = p', (vertical) => {
    const ed = make(vertical, 375, 560);
    for (const p of [{ x: 0, y: 0 }, { x: 156, y: 36 }, { x: -70, y: 200 }]) {
      const sp = ed.toScreen(p.x, p.y);
      const back = ed.toWorld(sp.x, sp.y);
      expect(back.x).toBeCloseTo(p.x);
      expect(back.y).toBeCloseTo(p.y);
    }
  });

  it('vertikal rejimda dunyo x ekranda pastga, y o\'ngga yo\'naladi', () => {
    const ed = make(true, 375, 560);
    const o = ed.toScreen(0, 0);
    const right = ed.toScreen(100, 0);
    const down = ed.toScreen(0, 100);
    expect(right.y).toBeGreaterThan(o.y);
    expect(right.x).toBeCloseTo(o.x);
    expect(down.x).toBeGreaterThan(o.x);
    expect(down.y).toBeCloseTo(o.y);
  });
});

describe('fit', () => {
  it('vertikal rejimda kontent vazifa qatori ostida va ekran ichida, masshtab kattaroq', () => {
    const inset = 60;
    const v = make(true, 375, 560, inset);
    const h = make(false, 375, 560, inset);
    const b = bounds(v.circuit.value, v.layout.value, true);
    const corners = [
      v.toScreen(b.minX, b.minY),
      v.toScreen(b.maxX, b.maxY),
    ];
    for (const c of corners) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThanOrEqual(375);
      expect(c.y).toBeGreaterThanOrEqual(inset);
      expect(c.y).toBeLessThanOrEqual(560);
    }
    // Tik telefonda vertikal joylashuv sezilarli kattaroq ko'rinishi kerak.
    expect(v.view.value.s).toBeGreaterThan(h.view.value.s * 1.3);
  });

  it('markazga element qo\'shish ko\'rinadigan joyga tushadi', () => {
    const ed = make(true, 375, 560, 60);
    ed.addGateAtCenter('AND');
    const g = ed.circuit.value.gates.at(-1)!;
    const sp = ed.toScreen(g.x + 36, g.y + 24);
    expect(sp.x).toBeGreaterThan(0);
    expect(sp.x).toBeLessThan(375);
    expect(sp.y).toBeGreaterThan(60);
    expect(sp.y).toBeLessThan(560);
  });

  it("markaz pin qatoriga yaqin bo'lsa — element chiqishi pin ro'parasida (sim to'g'ri)", () => {
    const one = { inputs: ['A'], outputs: ['Q'], gates: ['NOT' as const] };
    const ed = new Editor();
    ed.load(one, { gates: [], wires: [] }, outputColumn(1));
    ed.size = { w: 800, h: 500 };
    ed.fit();
    ed.addGateAtCenter('NOT');
    const g = ed.circuit.value.gates[0];
    const lay = ed.layout.value;
    const gates = new Map([[g.id, g]]);
    expect(wireRoute(portPoint(g.id, gates, lay)!, portPoint('out:Q', gates, lay)!)).toHaveLength(2);
    expect(wireRoute(portPoint('in:A', gates, lay)!, portPoint(`${g.id}:0`, gates, lay)!)).toHaveLength(2);
  });
});

describe('tarix va tanlov', () => {
  const three = { inputs: ['A', 'B', 'C'], outputs: ['Q'], gates: ['AND' as const, 'NOT' as const] };
  const base = () => {
    const ed = new Editor();
    ed.load(
      three,
      {
        gates: [
          { id: 'g1', type: 'AND', x: 156, y: 36 },
          { id: 'g2', type: 'NOT', x: 156, y: 156 },
        ],
        wires: [
          { from: 'in:A', to: 'g1:0' },
          { from: 'in:C', to: 'g1:1' },
          { from: 'g1', to: 'out:Q' },
        ],
      },
      outputColumn(2),
    );
    return ed;
  };

  it("o'chirilgan elementning porti tanlangan bo'lib qolmaydi, ko'rinmas sim yaratilmaydi", () => {
    const ed = base();
    ed.selection.value = { kind: 'gate', id: 'g2' };
    ed.pending.value = 'g2';
    ed.removeSelection();
    expect(ed.pending.value).toBe(null);
    // Undo/redo orqali ham: port qaytsa ham, yo'qolsa ham — tanlov eskirgan bo'lib qolmaydi.
    ed.undo();
    ed.pending.value = 'g2';
    ed.redo();
    expect(ed.pending.value).toBe(null);
    expect(ed.connect('g2', 'g1:0')).toBe('invalid');
    expect(ed.circuit.value.wires).toContainEqual({ from: 'in:A', to: 'g1:0' });
  });

  it("tanlangan sim joyi o'zgarsa ham o'sha simda qoladi, o'chsa — tanlov yo'qoladi", () => {
    const ed = base();
    ed.selection.value = { kind: 'wire', index: 2 }; // g1 → Q
    ed.connect('in:B', 'g1:0'); // A→g1:0 o'rniga B→g1:0 (oxiriga qo'shiladi)
    const sel = ed.selection.value;
    expect(sel?.kind === 'wire' && ed.circuit.value.wires[sel.index]).toEqual({ from: 'g1', to: 'out:Q' });
    ed.removeSelection();
    expect(ed.circuit.value.wires).toContainEqual({ from: 'in:B', to: 'g1:0' });
    expect(ed.circuit.value.wires).not.toContainEqual({ from: 'g1', to: 'out:Q' });
  });

  it("«Tartibga keltirish» kengaytirgan chiqishlar ustuni qayta ochilganda ham saqlanadi", () => {
    const ed = new Editor();
    // NOT→NOT→NOT zanjiri tartibga keltirilgandan keyin: oxirgi element x=336 da (outputColumn(1) = 380).
    const chain = { gates: [{ id: 'g3', type: 'NOT' as const, x: 336, y: 12 }], wires: [] };
    ed.load(three, chain, outputColumn(1));
    expect(ed.outX.value).toBe(504);
    ed.load(three, { gates: [], wires: [] }, outputColumn(1));
    expect(ed.outX.value).toBe(380);
  });

  it("Qum qutida kirishlar kamaytirilib, keyin bekor qilinsa — spec ham qaytadi", () => {
    const ed = base();
    ed.setSpec({ ...three, inputs: ['A', 'B'] });
    expect(ed.circuit.value.wires).not.toContainEqual({ from: 'in:C', to: 'g1:1' });
    ed.undo();
    expect(ed.spec.value.inputs).toEqual(['A', 'B', 'C']);
    expect(ed.bits.value).toHaveLength(3);
    expect(ed.circuit.value.wires).toContainEqual({ from: 'in:C', to: 'g1:1' });
    ed.redo();
    expect(ed.spec.value.inputs).toEqual(['A', 'B']);
    expect(ed.circuit.value.wires.every((w) => w.from !== 'in:C')).toBe(true);
  });
});
