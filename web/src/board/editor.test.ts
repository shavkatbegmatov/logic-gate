import { describe, expect, it } from 'vitest';
import { Editor } from './editor';
import { bounds, outputColumn } from './geometry';

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
});
