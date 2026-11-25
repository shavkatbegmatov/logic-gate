import { describe, expect, it } from 'vitest';
import type { Circuit, Gate, Spec } from '../sim/types';
import { layout, outputColumn, type Point } from './geometry';
import { crossing, divergence, routeAll, routeD } from './routing';

type S = { ax: number; ay: number; bx: number; by: number };

function segs(pts: Point[]): S[] {
  return pts.slice(1).map((p, i) => ({ ax: pts[i].x, ay: pts[i].y, bx: p.x, by: p.y }));
}

/** Ikki qismning bir chiziqdagi umumiy uzunligi (gorizontal, vertikal yoki 45°). */
function overlap(s: S, q: S): number {
  const dir = (z: S) => [Math.sign(z.bx - z.ax), Math.sign(z.by - z.ay)];
  const [sx, sy] = dir(s);
  const [qx, qy] = dir(q);
  const parallel = (sx === qx && sy === qy) || (sx === -qx && sy === -qy);
  if (!parallel) return 0;
  // Bir chiziqdami: q ning boshi s chizig'ida.
  const cross = (s.bx - s.ax) * (q.ay - s.ay) - (s.by - s.ay) * (q.ax - s.ax);
  if (Math.abs(cross) > 1e-6) return 0;
  const along = (z: number, w: number) => (sx !== 0 ? z : w);
  const s0 = Math.min(along(s.ax, s.ay), along(s.bx, s.by));
  const s1 = Math.max(along(s.ax, s.ay), along(s.bx, s.by));
  const q0 = Math.min(along(q.ax, q.ay), along(q.bx, q.by));
  const q1 = Math.max(along(q.ax, q.ay), along(q.bx, q.by));
  return Math.max(0, Math.min(s1, q1) - Math.max(s0, q0));
}

function run(spec: Spec, circuit: Circuit, outX = outputColumn(4)) {
  const gates = new Map<string, Gate>(circuit.gates.map((g) => [g.id, g]));
  return { routed: routeAll(circuit.wires, gates, layout(spec, outX)), circuit };
}

/** "Faqat bittasi" (8-daraja) skrinshotidagi sxema: A va B ikkala AND ga, AND lar — OR ga. */
const x2: Circuit = {
  gates: [
    { id: 'g1', type: 'AND', x: 288, y: 24 },
    { id: 'g2', type: 'AND', x: 288, y: 132 },
    { id: 'g3', type: 'OR', x: 420, y: 72 },
  ],
  wires: [
    { from: 'in:A', to: 'g1:0' },
    { from: 'in:B', to: 'g1:1' },
    { from: 'in:A', to: 'g2:0' },
    { from: 'in:B', to: 'g2:1' },
    { from: 'g1', to: 'g3:0' },
    { from: 'g2', to: 'g3:1' },
    { from: 'g3', to: 'out:Q' },
  ],
};
const spec2 = { inputs: ['A', 'B'], outputs: ['Q'], gates: ['AND' as const, 'OR' as const] };

describe('simlarni birgalikda yo\'naltirish', () => {
  it("turli manbalardan kelgan simlar bir chiziq ustiga tushmaydi", () => {
    const { routed, circuit } = run(spec2, x2);
    const all = routed.routes.flatMap((r, i) => segs(r!).map((s) => ({ s, net: circuit.wires[i].from })));
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        if (all[i].net === all[j].net) continue;
        expect(overlap(all[i].s, all[j].s), `${all[i].net} / ${all[j].net}`).toBeLessThan(0.5);
      }
    }
  });

  it("turli simlar kesishsa — ko'prikcha; o'z tarmog'i bilan — yo'q", () => {
    const { routed, circuit } = run(spec2, x2);
    const crossings: { a: number; b: number }[] = [];
    routed.routes.forEach((r, i) =>
      routed.routes.forEach((q, j) => {
        if (j <= i || circuit.wires[i].from === circuit.wires[j].from) return;
        for (const s of segs(r!)) for (const t of segs(q!)) if (crossing(seg(s), seg(t))) crossings.push({ a: i, b: j });
      }),
    );
    const hops = routed.hops.reduce((n, w) => n + w.reduce((m, s) => m + s.length, 0), 0);
    expect(crossings.length).toBeGreaterThan(0);
    // Har kesishishga bitta ko'prikcha (burchakka juda yaqinlari bundan mustasno).
    expect(hops).toBeGreaterThan(0);
    expect(hops).toBeLessThanOrEqual(crossings.length);
    const d = routeD(routed.routes[routed.hops.findIndex((w) => w.some((s) => s.length))]!, routed.hops[routed.hops.findIndex((w) => w.some((s) => s.length))]);
    expect(d).toMatch(/ A7,7 0 0 [01] /);
  });

  it('bir manbadan bir necha simga — ayrilgan joyda nuqta', () => {
    const { routed } = run(spec2, x2);
    const nets = new Set(routed.dots.map((d) => d.net));
    // A va B ikkitadan elementga ketadi: ular kirish pinidan keyin ayriladi.
    expect(nets).toEqual(new Set(['in:A', 'in:B']));
  });

  it("sim boshqa element ichidan o'tmaydi (joy bo'lsa)", () => {
    // A → g2 to'g'ridan qiyalik bilan borsa, oradagi g1 ning ichidan o'tardi.
    const spec = { inputs: ['A'], outputs: ['Q'], gates: ['NOT' as const] };
    const c: Circuit = {
      gates: [
        { id: 'g1', type: 'NOT', x: 156, y: 60 },
        { id: 'g2', type: 'NOT', x: 456, y: 132 },
      ],
      wires: [{ from: 'in:A', to: 'g2:0' }],
    };
    const { routed } = run(spec, c, 680);
    const g = c.gates[0];
    for (const s of segs(routed.routes[0]!)) {
      const hit = crossingBox(s, { x0: g.x, y0: g.y, x1: g.x + 72, y1: g.y + 48 });
      expect(hit).toBe(false);
    }
  });

  it('natija deterministik', () => {
    expect(run(spec2, x2).routed).toEqual(run(spec2, x2).routed);
  });

  it("divergence: umumiy boshlanishning oxiri; boshidanoq ayrilsa — null", () => {
    const a = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 80, y: 30 }];
    const b = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }];
    expect(divergence(a, b)).toEqual({ x: 50, y: 0 });
    expect(divergence([{ x: 0, y: 0 }, { x: 10, y: 10 }], [{ x: 0, y: 0 }, { x: 10, y: -10 }])).toBeNull();
  });

  it("katta sxema ham tez yo'naltiriladi", () => {
    // 60 element, 3 qator ustun; har biri oldingi ustundan ikkita kirish oladi.
    const gates: Gate[] = [];
    const wires: Circuit['wires'] = [];
    for (let i = 0; i < 60; i++) {
      const col = Math.floor(i / 12);
      gates.push({ id: `g${i + 1}`, type: 'AND', x: 120 + col * 132, y: 12 + (i % 12) * 60 });
      const src = (k: number) => (col === 0 ? `in:${'ABCDE'[(i + k) % 5]}` : `g${(col - 1) * 12 + ((i + k * 5) % 12) + 1}`);
      wires.push({ from: src(0), to: `g${i + 1}:0` }, { from: src(1), to: `g${i + 1}:1` });
    }
    const spec = { inputs: ['A', 'B', 'C', 'D', 'E'], outputs: ['Q'], gates: ['AND' as const] };
    const t0 = performance.now();
    run(spec, { gates, wires }, 900);
    expect(performance.now() - t0).toBeLessThan(400);
  });

  it("ko'pchilik ovozi (x6) barcha joylashuvlarida kesishgan simlar ko'priksiz qolmaydi", () => {
    const spec3: Spec = { inputs: ['A', 'B', 'C'], outputs: ['Q'], gates: ['AND', 'OR'] };
    const wires: Circuit['wires'] = [
      { from: 'in:A', to: 'g2:0' },
      { from: 'in:B', to: 'g1:0' },
      { from: 'in:C', to: 'g1:1' },
      { from: 'g1', to: 'g2:1' },
      { from: 'in:B', to: 'g3:0' },
      { from: 'in:C', to: 'g3:1' },
      { from: 'g2', to: 'g4:0' },
      { from: 'g3', to: 'g4:1' },
      { from: 'g4', to: 'out:Q' },
    ];
    let crossings = 0;
    for (const orX of [108, 120, 144, 180, 216]) {
      for (const orY of [96, 120, 156, 168]) {
        const c: Circuit = {
          gates: [
            { id: 'g1', type: 'OR', x: orX, y: orY },
            { id: 'g2', type: 'AND', x: 276, y: 48 },
            { id: 'g3', type: 'AND', x: 276, y: 192 },
            { id: 'g4', type: 'OR', x: 420, y: 108 },
          ],
          wires,
        };
        const { routed } = run(spec3, c, outputColumn(4));
        const all = routed.routes.flatMap((r, wi) =>
          segs(r!).map((s, si) => ({ s: seg(s), net: wires[wi].from, wi, si })),
        );
        for (let i = 0; i < all.length; i++) {
          for (let j = i + 1; j < all.length; j++) {
            if (all[i].net === all[j].net) continue;
            const p = crossing(all[i].s, all[j].s);
            if (!p) continue;
            crossings++;
            const bridged = [
              ...(routed.hops[all[i].wi]?.[all[i].si] ?? []),
              ...(routed.hops[all[j].wi]?.[all[j].si] ?? []),
            ].some((h) => Math.hypot(h.x - p.x, h.y - p.y) < 1);
            expect(bridged, `or=(${orX},${orY}) ${all[i].net} x ${all[j].net} at (${p.x},${p.y})`).toBe(true);
          }
        }
      }
    }
    expect(crossings).toBeGreaterThan(0);
  });

  it("gorizontal qism tor bo'lsa ham ko'prikcha vertikal qismga qo'yiladi (quick rejimda ham)", () => {
    const spec3: Spec = { inputs: ['A', 'B', 'C'], outputs: ['Q'], gates: ['AND', 'OR'] };
    const wires: Circuit['wires'] = [
      { from: 'g1', to: 'g2:1' },
      { from: 'in:B', to: 'g3:0' },
    ];
    // g1 chiqishi (192,180) dan atigi 6 birlikda kesishish: quick=true bo'lganda ham ko'prik tushib qolmasin.
    const tightGates = new Map<string, Gate>([
      ['g1', { id: 'g1', type: 'OR', x: 120, y: 156 }],
      ['g2', { id: 'g2', type: 'AND', x: 240, y: 48 }],
      ['g3', { id: 'g3', type: 'AND', x: 396, y: 192 }],
    ]);
    const routed = routeAll(wires, tightGates, layout(spec3, outputColumn(4)), true);
    const totalHops = routed.hops.reduce((n, w) => n + w.reduce((m, s) => m + s.length, 0), 0);
    expect(totalHops).toBe(1);
    const hopWire = routed.hops.findIndex((w) => w.some((s) => s.length));
    expect(routeD(routed.routes[hopWire]!, routed.hops[hopWire])).toMatch(/ A[\d.]+,[\d.]+ 0 0 [01] /);
  });
});

function seg(s: S) {
  return {
    ...s,
    net: '',
    wire: 0,
    index: 0,
    kind: 'd' as const,
    minX: Math.min(s.ax, s.bx),
    maxX: Math.max(s.ax, s.bx),
    minY: Math.min(s.ay, s.by),
    maxY: Math.max(s.ay, s.by),
  };
}

function crossingBox(s: S, b: { x0: number; y0: number; x1: number; y1: number }): boolean {
  // Qismni mayda bo'laklarga bo'lib, biror nuqtasi to'rtburchak ichida (chegarasiz) yotadimi.
  for (let k = 0; k <= 200; k++) {
    const x = s.ax + ((s.bx - s.ax) * k) / 200;
    const y = s.ay + ((s.by - s.ay) * k) / 200;
    if (x > b.x0 + 1 && x < b.x1 - 1 && y > b.y0 + 1 && y < b.y1 - 1) return true;
  }
  return false;
}
