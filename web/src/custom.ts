// O'yinchilar yaratgan masalalar: qum qutidagi sxemadan masala, havola orqali ulashish.
// Masala butunlay havolaning o'zida (#/p/<kod>) — server kerak emas, bazaga hech narsa yozilmaydi.
import { signal } from '@preact/signals';
import { t } from './i18n';
import { compile, truthTable, validate, type SimError } from './sim/sim';
import { GATE_ARITY, GATE_TYPES, type Circuit, type GateType, type Level, type Spec } from './sim/types';
import { load, save } from './storage';

export interface CustomPuzzle {
  title: string;
  by: string;
  inputs: string[];
  outputs: string[];
  gates: GateType[];
  /** Muallif yechimidagi elementlar soni. */
  goal: number;
  target: Record<string, string>;
  hints?: { gates: Record<string, number>; first: string[] };
}

export const LIMITS = { title: 40, by: 20 };
const NAME_RE = /^[A-Z][A-Z0-9]?$/;

// ── Kodlash ────────────────────────────────────────────────
// Ixcham JSON → UTF-8 → base64url. Jadval har bir chiqish uchun 16-lik satr: har belgi 4 qator.

function toHex(bits: string): string {
  const padded = bits.padEnd(Math.ceil(bits.length / 4) * 4, '0');
  let out = '';
  for (let i = 0; i < padded.length; i += 4) out += parseInt(padded.slice(i, i + 4), 2).toString(16);
  return out;
}

function fromHex(hex: unknown, rows: number): string | null {
  if (typeof hex !== 'string' || hex.length !== Math.ceil(rows / 4) || !/^[0-9a-f]+$/.test(hex)) return null;
  return [...hex].map((c) => parseInt(c, 16).toString(2).padStart(4, '0')).join('').slice(0, rows);
}

function b64urlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(code: string): string | null {
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

export function encodePuzzle(p: CustomPuzzle): string {
  const mask = GATE_TYPES.reduce((m, g, i) => (p.gates.includes(g) ? m | (1 << i) : m), 0);
  const data: Record<string, unknown> = {
    v: 1,
    i: p.inputs,
    o: p.outputs,
    g: mask,
    n: p.goal,
    x: p.outputs.map((o) => toHex(p.target[o])),
  };
  if (p.title) data.t = p.title;
  if (p.by) data.b = p.by;
  if (p.hints) {
    data.h = GATE_TYPES.map((g) => p.hints!.gates[g] ?? 0);
    const [type, ...srcs] = p.hints.first;
    data.f = [GATE_TYPES.indexOf(type as GateType), ...srcs.map((s) => p.inputs.indexOf(s))];
  }
  return b64urlEncode(JSON.stringify(data));
}

const isInt = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;

const names = (v: unknown, max: number): string[] | null =>
  Array.isArray(v) && v.length >= 1 && v.length <= max && v.every((s) => typeof s === 'string' && NAME_RE.test(s)) && new Set(v).size === v.length
    ? (v as string[])
    : null;

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Havoladagi kodni o'qiydi va qat'iy tekshiradi; buzilgan bo'lsa null. */
export function decodePuzzle(code: string): CustomPuzzle | null {
  if (!/^[A-Za-z0-9_-]{8,2000}$/.test(code)) return null;
  const json = b64urlDecode(code);
  if (!json) return null;
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(json);
  } catch {
    return null;
  }
  if (!d || typeof d !== 'object' || d.v !== 1) return null;
  const inputs = names(d.i, 5);
  const outputs = names(d.o, 4);
  if (!inputs || !outputs || outputs.some((o) => inputs.includes(o))) return null;
  if (!isInt(d.g, 1, (1 << GATE_TYPES.length) - 1) || !isInt(d.n, 1, 64)) return null;
  const gates = GATE_TYPES.filter((_, i) => (d.g as number) & (1 << i));
  if (!Array.isArray(d.x) || d.x.length !== outputs.length) return null;
  const rows = 1 << inputs.length;
  const target: Record<string, string> = {};
  for (let k = 0; k < outputs.length; k++) {
    const bits = fromHex(d.x[k], rows);
    if (!bits) return null;
    target[outputs[k]] = bits;
  }
  const p: CustomPuzzle = { title: text(d.t, LIMITS.title), by: text(d.b, LIMITS.by), inputs, outputs, gates, goal: d.n, target };

  // Maslahat ixtiyoriy: noto'g'ri bo'lsa shunchaki tashlab yuboriladi.
  const h = d.h;
  const f = d.f;
  if (
    Array.isArray(h) && h.length === GATE_TYPES.length && h.every((c) => isInt(c, 0, 64)) &&
    h.reduce((a: number, c: number) => a + c, 0) === p.goal &&
    Array.isArray(f) && isInt(f[0], 0, GATE_TYPES.length - 1)
  ) {
    const type = GATE_TYPES[f[0]];
    const srcs = f.slice(1);
    if (srcs.length === GATE_ARITY[type] && srcs.every((s) => isInt(s, 0, inputs.length - 1)) && gates.includes(type)) {
      const counts: Record<string, number> = {};
      GATE_TYPES.forEach((g, i) => h[i] && (counts[g] = h[i]));
      p.hints = { gates: counts, first: [type, ...srcs.map((s: number) => inputs[s])] };
    }
  }
  return p;
}

// ── Qum qutidan masala ─────────────────────────────────────

export type CreateError = SimError | { code: 'empty' } | { code: 'sequential' };

/** Sxemadan masala: jadval — sxema natijasi, maqsad — muallif ishlatgan elementlar soni. */
export function puzzleFromCircuit(
  spec: Spec,
  circuit: Circuit,
  meta: { title: string; by: string },
): { ok: true; puzzle: CustomPuzzle } | { ok: false; error: CreateError } {
  // Chiqishlarga yetib bormaydigan (ortiqcha) elementlar tashlab yuboriladi: aks holda maqsad
  // sun'iy oshib, maslahat ham ortiqcha elementdan boshlanib qolardi.
  if (!circuit.gates.length) return { ok: false, error: { code: 'empty' } };
  const loose = spec.outputs.find((o) => !circuit.wires.some((w) => w.to === `out:${o}`));
  if (loose) return { ok: false, error: { code: 'unconnected_output', ref: loose } };
  circuit = liveCircuit(circuit);
  if (!circuit.gates.length) return { ok: false, error: { code: 'empty' } };
  // Masala havolasi haqiqat jadvalini saqlaydi — xotirali sxemaning xatti-harakati unga sig'maydi.
  if (circuit.gates.some((g) => g.type === 'DFF')) return { ok: false, error: { code: 'sequential' } };
  const err = validate(spec, circuit);
  if (err) return { ok: false, error: err };
  const c = compile(spec, circuit);
  const table = truthTable(c);
  const target = Object.fromEntries(spec.outputs.map((o, k) => [o, table.map((row) => String(row[k])).join('')]));
  const counts: Record<string, number> = {};
  for (const g of circuit.gates) counts[g.type] = (counts[g.type] ?? 0) + 1;
  const used = GATE_TYPES.filter((g) => counts[g]);
  // Topologik tartibdagi birinchi element faqat kirishlarga ulangan.
  const first = c.order[0];
  const srcs = Array.from({ length: GATE_ARITY[first.type] }, (_, i) => c.drivers.get(`${first.id}:${i}`)!.slice(3));
  return {
    ok: true,
    puzzle: {
      title: meta.title.trim().slice(0, LIMITS.title),
      by: meta.by.trim().slice(0, LIMITS.by),
      inputs: spec.inputs,
      outputs: spec.outputs,
      gates: used,
      goal: circuit.gates.length,
      target,
      hints: { gates: counts, first: [first.type, ...srcs] },
    },
  };
}

/** Faqat chiqishlarga (bevosita yoki boshqa elementlar orqali) ulangan elementlar va ularning simlari. */
export function liveCircuit(circuit: Circuit): Circuit {
  const driver = new Map(circuit.wires.map((w) => [w.to, w.from]));
  const live = new Set<string>();
  const stack = circuit.wires.filter((w) => w.to.startsWith('out:')).map((w) => w.from);
  while (stack.length) {
    const src = stack.pop()!;
    if (src.startsWith('in:') || live.has(src)) continue;
    live.add(src);
    for (const i of [0, 1]) {
      const from = driver.get(`${src}:${i}`);
      if (from) stack.push(from);
    }
  }
  const sinkLive = (to: string) => to.startsWith('out:') || live.has(to.slice(0, to.lastIndexOf(':')));
  return {
    gates: circuit.gates.filter((g) => live.has(g.id)),
    wires: circuit.wires.filter((w) => sinkLive(w.to)),
  };
}

/** Kod uchun qisqa barqaror id (qoralama va natijalar kaliti). */
export function customId(code: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < code.length; i++) h = Math.imul(h ^ code.charCodeAt(i), 0x01000193);
  return `custom-${(h >>> 0).toString(36)}`;
}

export function customLevel(p: CustomPuzzle, code: string): Level {
  return {
    id: customId(code),
    chapter: 'custom',
    title: p.title || t.custom.untitled,
    task: t.custom.task(p.outputs, p.goal),
    hint: t.custom.hint,
    hints: p.hints,
    inputs: p.inputs,
    outputs: p.outputs,
    gates: p.gates,
    goal: p.goal,
    target: p.target,
  };
}

// ── Lokal natijalar ────────────────────────────────────────

interface CustomStore {
  solved: Record<string, { gates: number; stars: number; goal: number; at: number }>;
  created: number;
}

const KEY = 'lg.custom.v1';
export const customStore = signal<CustomStore>({ solved: {}, created: 0, ...load<Partial<CustomStore>>(KEY, {}) });

function persist(next: CustomStore) {
  customStore.value = next;
  save(KEY, next);
}

export function recordCustom(id: string, gates: number, stars: number, goal: number) {
  const prev = customStore.value.solved[id];
  const improved = !prev || gates < prev.gates;
  if (improved) persist({ ...customStore.value, solved: { ...customStore.value.solved, [id]: { gates, stars, goal, at: Date.now() } } });
  return { improved, prev };
}

export function markCreated() {
  persist({ ...customStore.value, created: customStore.value.created + 1 });
}

export function resetCustom() {
  persist({ solved: {}, created: 0 });
}
