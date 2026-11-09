import { describe, expect, it } from 'vitest';
import { ALL_GATE_TYPES } from '../sim/types';
import { GRID, layout, routeMid, routePath, wireRoute, type Point } from './geometry';
import { inputLeads, outputY } from './shapes';

describe("to'r: uchlar va pinlar bir to'rda", () => {
  // Element to'rga (GRID) joylanadi. Uchlar yoki pinlar to'rdan siljigan bo'lsa, element chiqishini
  // chiqish pini (yoki keyingi element kirishi) bilan bir chiziqqa qo'yib bo'lmaydi — sim o'rtasida
  // mayda pog'ona qoladi.
  it("element uchlari GRID ga karrali", () => {
    for (const t of ALL_GATE_TYPES) {
      for (const y of [...inputLeads(t), outputY(t)]) expect(y % GRID, `${t}: ${y}`).toBe(0);
    }
  });

  it("daraja pinlari GRID ga karrali (har qanday kirish/chiqish sonida)", () => {
    for (let ni = 1; ni <= 5; ni++) {
      for (let no = 1; no <= 4; no++) {
        const lay = layout({ inputs: 'ABCDE'.slice(0, ni).split(''), outputs: ['Q', 'R', 'S', 'T'].slice(0, no), gates: [] }, 520);
        for (const p of [...lay.inputs.values(), ...lay.outputs.values()]) expect(p.y % GRID, `${ni}/${no}: ${p.y}`).toBe(0);
      }
    }
  });
});

const CASES: [Point, Point][] = [
  [{ x: 0, y: 0 }, { x: 200, y: 0 }], // to'g'ri
  [{ x: 0, y: 0 }, { x: 200, y: 60 }], // 45° qiyalik
  [{ x: 0, y: 0 }, { x: 60, y: -150 }], // joy yetmaydi — to'g'ri burchak
  [{ x: 300, y: 40 }, { x: 100, y: 200 }], // orqaga, uzoq qatorda
  [{ x: 300, y: 40 }, { x: 100, y: 52 }], // orqaga, deyarli bir qatorda
  [{ x: 100, y: 0 }, { x: 100, y: 0 }], // nol uzunlik
];

const angle = (p: Point, q: Point) => {
  const dx = Math.abs(q.x - p.x);
  const dy = Math.abs(q.y - p.y);
  return dx < 1e-9 || dy < 1e-9 ? 'axis' : Math.abs(dx - dy) < 1e-6 ? 'diag' : 'other';
};

describe("simlar — plata yo'llari", () => {
  it("uchlari portlarda, qismlari faqat gorizontal, vertikal yoki 45°", () => {
    for (const [a, b] of CASES) {
      const pts = wireRoute(a, b);
      expect(pts[0]).toEqual(a);
      expect(pts[pts.length - 1]).toEqual(b);
      for (let i = 1; i < pts.length; i++) expect(angle(pts[i - 1], pts[i]), JSON.stringify([a, b])).not.toBe('other');
      // Chizilgan yo'l ham (burchaklar kesilgandan keyin) faqat shu yo'nalishlarda.
      const nums = routePath(pts).match(/-?\d+(\.\d+)?/g)!.map(Number);
      const drawn = Array.from({ length: nums.length / 2 }, (_, i) => ({ x: nums[2 * i], y: nums[2 * i + 1] }));
      for (let i = 1; i < drawn.length; i++) expect(angle(drawn[i - 1], drawn[i])).not.toBe('other');
    }
  });

  it("port chiqishi va kirishi gorizontal: sim element ichidan boshlanmaydi", () => {
    for (const [a, b] of CASES.slice(1, 5)) {
      const pts = wireRoute(a, b);
      expect(pts[1].y).toBe(a.y);
      expect(pts[1].x).toBeGreaterThan(a.x);
      expect(pts[pts.length - 2].y).toBe(b.y);
      expect(pts[pts.length - 2].x).toBeLessThan(b.x);
    }
  });

  it("o'rtasi yo'lning ustida", () => {
    for (const [a, b] of CASES) {
      const pts = wireRoute(a, b);
      const m = routeMid(pts);
      const onSeg = pts.slice(1).some((q, i) => {
        const p = pts[i];
        const cross = (q.x - p.x) * (m.y - p.y) - (q.y - p.y) * (m.x - p.x);
        const within = Math.min(p.x, q.x) - 1e-6 <= m.x && m.x <= Math.max(p.x, q.x) + 1e-6 && Math.min(p.y, q.y) - 1e-6 <= m.y && m.y <= Math.max(p.y, q.y) + 1e-6;
        return Math.abs(cross) < 1e-6 && within;
      });
      expect(onSeg, JSON.stringify([a, b])).toBe(true);
    }
    expect(routeMid(wireRoute({ x: 0, y: 0 }, { x: 200, y: 60 }))).toEqual({ x: 100, y: 30 });
  });
});
