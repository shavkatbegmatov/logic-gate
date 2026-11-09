import type { Circuit, Gate, Spec } from '../sim/types';
import { inputLeads, outputY } from './shapes';

// Hamma o'lchamlar "dunyo" birliklarida; ekranga View orqali o'tkaziladi.
export const GATE_W = 72;
export const GATE_H = 48;
// Pinlar ham to'rda turadi: PIN_TOP va PIN_SPACING / 2 — GRID ga karrali (aks holda juft sonli
// pinlar to'rdan yarim qadam siljiydi va element chiqishi chiqish pini bilan bir chiziqqa tushmaydi).
export const PIN_SPACING = 96;
export const PIN_TOP = 36;
export const GRID = 12;

export interface Point {
  x: number;
  y: number;
}

/** Chiqish pinlari ustunining x koordinatasi: katta masalalar uchun kengroq maydon. */
export function outputColumn(goal: number): number {
  if (goal <= 2) return 380;
  if (goal <= 4) return 520;
  return 680;
}

function pinY(count: number, rows: number, k: number): number {
  const center = PIN_TOP + ((rows - 1) * PIN_SPACING) / 2;
  return center + (k - (count - 1) / 2) * PIN_SPACING;
}

export interface Layout {
  outX: number;
  inputs: Map<string, Point>;
  outputs: Map<string, Point>;
}

export function layout(spec: Spec, outX: number): Layout {
  const rows = Math.max(spec.inputs.length, spec.outputs.length, 2);
  return {
    outX,
    inputs: new Map(spec.inputs.map((n, k) => [n, { x: 0, y: pinY(spec.inputs.length, rows, k) }])),
    outputs: new Map(spec.outputs.map((n, k) => [n, { x: outX, y: pinY(spec.outputs.length, rows, k) }])),
  };
}

/** Kirish porti (y, element ichida) — belgidagi uch bilan bir joyda (shapes.ts). */
export function inputPortY(gate: Gate, idx: number): number {
  return inputLeads(gate.type)[idx];
}

/** Chiqish porti (y, element ichida): D-trigger'da yuqorida, qolganlarida o'rtada. */
export function outputPortY(gate: Gate): number {
  return outputY(gate.type);
}

/** Port koordinatasi: manba (`in:A`, gid) yoki qabul qiluvchi (`out:Q`, `gid:0`). */
export function portPoint(port: string, gates: Map<string, Gate>, lay: Layout): Point | null {
  if (port.startsWith('in:')) return lay.inputs.get(port.slice(3)) ?? null;
  if (port.startsWith('out:')) return lay.outputs.get(port.slice(4)) ?? null;
  const i = port.lastIndexOf(':');
  if (i < 0) {
    const g = gates.get(port);
    return g ? { x: g.x + GATE_W, y: g.y + outputPortY(g) } : null;
  }
  const g = gates.get(port.slice(0, i));
  return g ? { x: g.x, y: g.y + inputPortY(g, Number(port.slice(i + 1))) } : null;
}

/** Sudralayotgan sim (hali ulanmagan): yumshoq egri chiziq — yo'l emas, "rezina". */
export function wirePath(a: Point, b: Point): string {
  const dx = Math.max(36, Math.abs(b.x - a.x) / 2);
  return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
}

/** Portdan chiqqan to'g'ri qism: yo'l element yoki pinning ichidan boshlanmasin. */
const STUB = 12;
/** To'g'ri burchaklarni kesish (45°) uzunligi. */
const CHAMFER = 10;

/**
 * Sim — platadagi mis yo'l kabi: faqat gorizontal, vertikal va 45° qismlar. a — manba (chiqish porti,
 * sim o'ngga ketadi), b — qabul qiluvchi (kirish porti, sim chapdan keladi).
 *  - joy yetsa: gorizontal → 45° qiyalik (o'rtada) → gorizontal;
 *  - yetmasa: gorizontal → vertikal → gorizontal (burchaklari routePath da kesiladi);
 *  - orqaga qaytuvchi sim (xotira sxemalaridagi teskari bog'lanish): o'ngga chiqib, aylanib keladi.
 */
export function wireRoute(a: Point, b: Point): Point[] {
  const dx = b.x - a.x;
  const ady = Math.abs(b.y - a.y);
  if (ady < 0.5 && dx >= 0) return [a, b];
  const mid = (a.x + b.x) / 2;
  if (dx >= 2 * STUB + ady) {
    return [a, { x: mid - ady / 2, y: a.y }, { x: mid + ady / 2, y: b.y }, b];
  }
  if (dx >= 2 * STUB) {
    return [a, { x: mid, y: a.y }, { x: mid, y: b.y }, b];
  }
  const xa = a.x + 2 * STUB;
  const xb = b.x - 2 * STUB;
  // Ikki port deyarli bir qatorda bo'lsa, oradagi elementlar ustidan emas — pastdan aylanadi.
  const my = ady > 60 ? (a.y + b.y) / 2 : Math.max(a.y, b.y) + 44;
  return [a, { x: xa, y: a.y }, { x: xa, y: my }, { x: xb, y: my }, { x: xb, y: b.y }, b];
}

/** Yo'l chizig'i: o'zaro perpendikulyar qismlar orasidagi burchak 45° bilan kesiladi. */
export function routePath(pts: Point[], r = CHAMFER): string {
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i - 1];
    const c = pts[i];
    const n = pts[i + 1];
    const inH = p.y === c.y;
    const outH = c.y === n.y;
    const inV = p.x === c.x;
    const outV = c.x === n.x;
    if ((inH && outV) || (inV && outH)) {
      const cut = Math.min(r, Math.hypot(c.x - p.x, c.y - p.y) / 2, Math.hypot(n.x - c.x, n.y - c.y) / 2);
      const before = { x: c.x - Math.sign(c.x - p.x) * cut, y: c.y - Math.sign(c.y - p.y) * cut };
      const after = { x: c.x + Math.sign(n.x - c.x) * cut, y: c.y + Math.sign(n.y - c.y) * cut };
      d += ` L${before.x},${before.y} L${after.x},${after.y}`;
    } else {
      d += ` L${c.x},${c.y}`;
    }
  }
  const last = pts[pts.length - 1];
  return `${d} L${last.x},${last.y}`;
}

/** Yo'lning uzunligi bo'yicha o'rtasi (o'chirish tugmasi shu yerda). */
export function routeMid(pts: Point[]): Point {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  let left = lens.reduce((s, l) => s + l, 0) / 2;
  for (let i = 0; i < lens.length; i++) {
    if (left <= lens[i] || i === lens.length - 1) {
      const k = lens[i] ? Math.min(1, left / lens[i]) : 0;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k };
    }
    left -= lens[i];
  }
  return pts[0];
}

export function snap(v: number): number {
  return Math.round(v / GRID) * GRID;
}

export function isSourcePort(port: string): boolean {
  return port.startsWith('in:') || (!port.startsWith('out:') && !port.includes(':'));
}

/**
 * Pinlar va elementlarni o'z ichiga olgan to'rtburchak. Vertikal rejimda "kerak" yozuvi
 * chiqish qutisining ostida (dunyoda — o'ngida) turadi, shuning uchun joy ko'proq.
 */
export function bounds(circuit: Circuit, lay: Layout, vertical = false) {
  let minX = -80;
  let maxX = lay.outX + (vertical ? 104 : 80);
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of [...lay.inputs.values(), ...lay.outputs.values()]) {
    minY = Math.min(minY, p.y - 40);
    maxY = Math.max(maxY, p.y + 52);
  }
  for (const g of circuit.gates) {
    minX = Math.min(minX, g.x - 16);
    maxX = Math.max(maxX, g.x + GATE_W + 16);
    minY = Math.min(minY, g.y - 16);
    maxY = Math.max(maxY, g.y + GATE_H + 16);
  }
  return { minX, minY, maxX, maxY };
}

export function gateIdNumber(id: string): number {
  const m = /^g(\d+)$/.exec(id);
  return m ? Number(m[1]) : 0;
}
