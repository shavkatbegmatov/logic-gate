// O'yinchilar yaratgan masalalar: qum qutidagi sxemadan masala, havola orqali ulashish.
// Masala butunlay havolaning o'zida (#/p/<kod>) — server kerak emas, bazaga hech narsa yozilmaydi.
import { t } from './i18n';
import { compile, exampleFor, machineOf, truthTable, validate, type SimError } from './sim/sim';
import { ALL_GATE_TYPES, GATE_ARITY, type Circuit, type GateType, type Level, type Machine, type Spec } from './sim/types';

export interface CustomPuzzle {
  title: string;
  by: string;
  inputs: string[];
  outputs: string[];
  gates: GateType[];
  /** Muallif yechimidagi elementlar soni. */
  goal: number;
  /** Kombinatsion masala: haqiqat jadvali. */
  target?: Record<string, string>;
  /** Xotirali masala: muallif sxemasining eng kichik avtomati. */
  seq?: Machine;
  hints?: { gates: Record<string, number>; first: string[] };
}

/** seqStates/seqCells — xotirali masala avtomati havolaga sig'sin (Telegram startapp ≤ 512 belgi). */
export const LIMITS = { title: 40, by: 20, seqStates: 16, seqCells: 128 };
const NAME_RE = /^[A-Z][A-Z0-9]?$/;

// ── Kodlash ────────────────────────────────────────────────
// Ixcham JSON → UTF-8 → base64url. Jadval har bir chiqish uchun 16-lik satr: har belgi 4 qator.
// Elementlar — ALL_GATE_TYPES bo'yicha bit maskasi (tartib eski havolalar uchun o'zgarmaydi, DFF — 7-bit).
// Xotirali masala: s = { q: keyingi holatlar (36-lik, holat×qator), y: chiqishlar (16-lik, bitlar) };
// vaqt diagrammasi namunasi havolaga yozilmaydi — avtomatdan bir xil tarzda qayta hosil qilinadi.

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
  const mask = ALL_GATE_TYPES.reduce((m, g, i) => (p.gates.includes(g) ? m | (1 << i) : m), 0);
  const data: Record<string, unknown> = { v: 1, i: p.inputs, o: p.outputs, g: mask, n: p.goal };
  if (p.seq) {
    data.s = {
      q: p.seq.next.flat().map((s) => s.toString(36)).join(''),
      y: p.seq.out.flat().map((o) => parseInt(o, 2).toString(16)).join(''),
    };
  } else {
    data.x = p.outputs.map((o) => toHex(p.target?.[o] ?? ''));
  }
  if (p.title) data.t = p.title;
  if (p.by) data.b = p.by;
  if (p.hints) {
    // Kombinatsion masalada — 7 ta (eski havolalar bilan bir xil), xotirali masalada — DFF bilan 8 ta.
    const types = p.seq ? ALL_GATE_TYPES : ALL_GATE_TYPES.slice(0, 7);
    data.h = types.map((g) => p.hints!.gates[g] ?? 0);
    const [type, ...srcs] = p.hints.first;
    data.f = [ALL_GATE_TYPES.indexOf(type as GateType), ...srcs.map((s) => p.inputs.indexOf(s))];
  }
  return b64urlEncode(JSON.stringify(data));
}

/** Havoladagi avtomat: o'lchami, belgilar va qiymatlar chegarasi qat'iy tekshiriladi. */
function decodeMachine(s: unknown, rows: number, outputs: number): Machine | null {
  if (!s || typeof s !== 'object') return null;
  const { q, y } = s as { q?: unknown; y?: unknown };
  if (typeof q !== 'string' || typeof y !== 'string' || q.length !== y.length || q.length % rows !== 0) return null;
  const states = q.length / rows;
  if (states < 1 || states > LIMITS.seqStates || q.length > LIMITS.seqCells) return null;
  if (!/^[0-9a-z]+$/.test(q) || !/^[0-9a-f]+$/.test(y)) return null;
  const next: number[][] = [];
  const out: string[][] = [];
  for (let st = 0; st < states; st++) {
    next.push([]);
    out.push([]);
    for (let r = 0; r < rows; r++) {
      const n = parseInt(q[st * rows + r], 36);
      const o = parseInt(y[st * rows + r], 16);
      if (n >= states || o >= 1 << outputs) return null;
      next[st].push(n);
      out[st].push(o.toString(2).padStart(outputs, '0'));
    }
  }
  return { next, out };
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
  if (!isInt(d.g, 1, (1 << ALL_GATE_TYPES.length) - 1) || !isInt(d.n, 1, 64)) return null;
  const gates = ALL_GATE_TYPES.filter((_, i) => (d.g as number) & (1 << i));
  const rows = 1 << inputs.length;
  const base = { title: text(d.t, LIMITS.title), by: text(d.b, LIMITS.by), inputs, outputs, gates, goal: d.n };
  let p: CustomPuzzle;
  if (d.s !== undefined) {
    // Xotirali masala: D-trigger ruxsat etilgan bo'lishi shart.
    const seq = decodeMachine(d.s, rows, outputs.length);
    if (!seq || !gates.includes('DFF')) return null;
    p = { ...base, seq };
  } else {
    if (gates.includes('DFF') || !Array.isArray(d.x) || d.x.length !== outputs.length) return null;
    const target: Record<string, string> = {};
    for (let k = 0; k < outputs.length; k++) {
      const bits = fromHex(d.x[k], rows);
      if (!bits) return null;
      target[outputs[k]] = bits;
    }
    p = { ...base, target };
  }

  // Maslahat ixtiyoriy: noto'g'ri bo'lsa shunchaki tashlab yuboriladi.
  const h = d.h;
  const f = d.f;
  const types = p.seq ? ALL_GATE_TYPES : ALL_GATE_TYPES.slice(0, 7);
  if (
    Array.isArray(h) && h.length === types.length && h.every((c) => isInt(c, 0, 64)) &&
    h.reduce((a: number, c: number) => a + c, 0) === p.goal &&
    Array.isArray(f) && isInt(f[0], 0, types.length - 1)
  ) {
    const type = types[f[0]];
    const srcs = f.slice(1);
    // Xotirali sxemada birinchi element bo'sh D-trigger bo'lishi mumkin (hamma narsa u orqali aylanadi).
    const arityOk = srcs.length === GATE_ARITY[type] || (type === 'DFF' && srcs.length === 0);
    if (arityOk && srcs.every((s) => isInt(s, 0, inputs.length - 1)) && gates.includes(type)) {
      const counts: Record<string, number> = {};
      types.forEach((g, i) => h[i] && (counts[g] = h[i]));
      p.hints = { gates: counts, first: [type, ...srcs.map((s: number) => inputs[s])] };
    }
  }
  return p;
}

// ── Qum qutidan masala ─────────────────────────────────────

export type CreateError = SimError | { code: 'empty' } | { code: 'too_complex' };

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
  const err = validate(spec, circuit);
  if (err) return { ok: false, error: err };
  const c = compile(spec, circuit);
  const counts: Record<string, number> = {};
  for (const g of circuit.gates) counts[g.type] = (counts[g.type] ?? 0) + 1;
  const used = ALL_GATE_TYPES.filter((g) => counts[g]);
  // Faqat kirishlarga ulangan birinchi element (topologik tartibda); xotirali sxemada bunday element
  // bo'lmasligi mumkin — unda maslahat bo'sh D-triggerdan boshlanadi.
  const first = c.order.find((g) =>
    Array.from({ length: GATE_ARITY[g.type] }, (_, i) => c.drivers.get(`${g.id}:${i}`)).every((s) => s?.startsWith('in:')),
  );
  const hintFirst = first
    ? [first.type, ...Array.from({ length: GATE_ARITY[first.type] }, (_, i) => c.drivers.get(`${first.id}:${i}`)!.slice(3))]
    : ['DFF'];
  const puzzle: CustomPuzzle = {
    title: meta.title.trim().slice(0, LIMITS.title),
    by: meta.by.trim().slice(0, LIMITS.by),
    inputs: spec.inputs,
    outputs: spec.outputs,
    gates: used,
    goal: circuit.gates.length,
    hints: { gates: counts, first: hintFirst },
  };
  if (counts.DFF) {
    // Xotirali sxema: masala — uning vaqt bo'yicha xatti-harakati (eng kichik avtomat).
    const seq = machineOf(c);
    const cells = seq.next.length * seq.next[0].length;
    if (seq.next.length > LIMITS.seqStates || cells > LIMITS.seqCells) return { ok: false, error: { code: 'too_complex' } };
    return { ok: true, puzzle: { ...puzzle, seq } };
  }
  const table = truthTable(c);
  const target = Object.fromEntries(spec.outputs.map((o, k) => [o, table.map((row) => String(row[k])).join('')]));
  return { ok: true, puzzle: { ...puzzle, target } };
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
    task: p.seq ? t.custom.taskSeq(p.outputs, p.goal) : t.custom.task(p.outputs, p.goal),
    hint: p.seq ? t.custom.hintSeq : t.custom.hint,
    hints: p.hints,
    inputs: p.inputs,
    outputs: p.outputs,
    gates: p.gates,
    goal: p.goal,
    target: p.target,
    seq: p.seq && { ...p.seq, example: exampleFor(p.seq) },
  };
}

// ── Lokal natijalar ────────────────────────────────────────
// custom-store.ts da: o'yin ochilishida faqat natijalar kerak (yutuqlar, sinxronlash), bu modul esa
// (kodlash, o'qish, tekshirish) kam ochiladigan ekranlar bilan birga yuklanadi.
export { customStore, markCreated, recordCustom, resetCustom } from './custom-store';
