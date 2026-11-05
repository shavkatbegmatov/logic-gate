import { GATE_ARITY, type Circuit, type Gate, type Spec } from '../sim/types';

// Hamma o'lchamlar "dunyo" birliklarida; ekranga View orqali o'tkaziladi.
export const GATE_W = 72;
export const GATE_H = 48;
export const PIN_SPACING = 84;
export const PIN_TOP = 40;
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

export function inputPortY(gate: Gate, idx: number): number {
  if (GATE_ARITY[gate.type] === 1) return GATE_H / 2;
  return idx === 0 ? 14 : 34;
}

/** Port koordinatasi: manba (`in:A`, gid) yoki qabul qiluvchi (`out:Q`, `gid:0`). */
export function portPoint(port: string, gates: Map<string, Gate>, lay: Layout): Point | null {
  if (port.startsWith('in:')) return lay.inputs.get(port.slice(3)) ?? null;
  if (port.startsWith('out:')) return lay.outputs.get(port.slice(4)) ?? null;
  const i = port.lastIndexOf(':');
  if (i < 0) {
    const g = gates.get(port);
    return g ? { x: g.x + GATE_W, y: g.y + GATE_H / 2 } : null;
  }
  const g = gates.get(port.slice(0, i));
  return g ? { x: g.x, y: g.y + inputPortY(g, Number(port.slice(i + 1))) } : null;
}

export function wirePath(a: Point, b: Point): string {
  const dx = Math.max(36, Math.abs(b.x - a.x) / 2);
  return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
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
  let minX = -72;
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
