// Mantiqiy sxema simulyatori. Xuddi shu qoidalar server/internal/sim da Go'da takrorlangan —
// o'zgartirsangiz, ikkalasini ham yangilang (umumiy testlar levels/solutions.json orqali).
import { GATE_ARITY, type Circuit, type Gate, type GateType, type Level, type Spec } from './types';

export const LIMITS = { gates: 64, wires: 256 };
export const GATE_ID_RE = /^[a-z0-9_]{1,16}$/;

export type ErrorCode =
  | 'too_many_gates'
  | 'too_many_wires'
  | 'bad_gate'
  | 'dup_gate'
  | 'gate_not_allowed'
  | 'bad_wire'
  | 'sink_taken'
  | 'cycle'
  | 'unconnected_input'
  | 'unconnected_output';

export interface SimError {
  code: ErrorCode;
  /** Muammoli element id si yoki chiqish nomi (ekranda belgilash uchun). */
  ref?: string;
}

const OPS: Record<GateType, (a: number, b: number) => number> = {
  NOT: (a) => a ^ 1,
  AND: (a, b) => a & b,
  OR: (a, b) => a | b,
  XOR: (a, b) => a ^ b,
  NAND: (a, b) => (a & b) ^ 1,
  NOR: (a, b) => (a | b) ^ 1,
  XNOR: (a, b) => (a ^ b) ^ 1,
};

export function applyGate(type: GateType, a: number, b: number): number {
  return OPS[type](a, b);
}

export function isSource(spec: Spec, gateIds: Set<string>, s: string): boolean {
  if (s.startsWith('in:')) return spec.inputs.includes(s.slice(3));
  return gateIds.has(s);
}

export function isSink(spec: Spec, gates: Map<string, Gate>, s: string): boolean {
  if (s.startsWith('out:')) return spec.outputs.includes(s.slice(4));
  const i = s.lastIndexOf(':');
  if (i < 0) return false;
  const g = gates.get(s.slice(0, i));
  const idx = s.slice(i + 1);
  return !!g && (idx === '0' || (idx === '1' && GATE_ARITY[g.type] === 2));
}

/** Sink → manba. */
export type Drivers = Map<string, string>;

export interface Compiled {
  spec: Spec;
  gates: Map<string, Gate>;
  drivers: Drivers;
  /** Elementlar topologik tartibda (sikldagilar kirmaydi). */
  order: Gate[];
  /** Sikl ichida qolgan elementlar. */
  cyclic: Set<string>;
}

/**
 * Yumshoq kompilyatsiya — jonli simulyatsiya uchun. Noto'g'ri simlar e'tiborsiz qoldiriladi,
 * bitta kirishga ikki sim bo'lsa birinchisi olinadi.
 */
export function compile(spec: Spec, circuit: Circuit): Compiled {
  const gates = new Map<string, Gate>();
  for (const g of circuit.gates) if (!gates.has(g.id)) gates.set(g.id, g);
  const ids = new Set(gates.keys());
  const drivers: Drivers = new Map();
  for (const w of circuit.wires) {
    if (!isSource(spec, ids, w.from) || !isSink(spec, gates, w.to) || drivers.has(w.to)) continue;
    drivers.set(w.to, w.from);
  }
  const { order, cyclic } = topoSort(gates, drivers);
  return { spec, gates, drivers, order, cyclic };
}

function topoSort(gates: Map<string, Gate>, drivers: Drivers) {
  const indeg = new Map<string, number>();
  const users = new Map<string, string[]>();
  for (const g of gates.values()) {
    indeg.set(g.id, 0);
    users.set(g.id, []);
  }
  for (const g of gates.values()) {
    for (let i = 0; i < GATE_ARITY[g.type]; i++) {
      const src = drivers.get(`${g.id}:${i}`);
      if (src && gates.has(src)) {
        indeg.set(g.id, indeg.get(g.id)! + 1);
        users.get(src)!.push(g.id);
      }
    }
  }
  const queue = [...gates.values()].filter((g) => indeg.get(g.id) === 0).map((g) => g.id);
  const order: Gate[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(gates.get(id)!);
    for (const u of users.get(id)!) {
      indeg.set(u, indeg.get(u)! - 1);
      if (indeg.get(u) === 0) queue.push(u);
    }
  }
  const cyclic = new Set([...gates.keys()].filter((id) => indeg.get(id)! > 0));
  return { order, cyclic };
}

/** Qat'iy tekshiruv — "Tekshirish" tugmasi va server uchun. */
export function validate(spec: Spec, circuit: Circuit): SimError | null {
  if (circuit.gates.length > LIMITS.gates) return { code: 'too_many_gates' };
  if (circuit.wires.length > LIMITS.wires) return { code: 'too_many_wires' };
  const gates = new Map<string, Gate>();
  for (const g of circuit.gates) {
    if (!GATE_ID_RE.test(g.id) || !(g.type in GATE_ARITY)) return { code: 'bad_gate', ref: g.id };
    if (gates.has(g.id)) return { code: 'dup_gate', ref: g.id };
    if (!spec.gates.includes(g.type)) return { code: 'gate_not_allowed', ref: g.id };
    gates.set(g.id, g);
  }
  const ids = new Set(gates.keys());
  const drivers: Drivers = new Map();
  for (const w of circuit.wires) {
    if (!isSource(spec, ids, w.from) || !isSink(spec, gates, w.to)) return { code: 'bad_wire' };
    if (drivers.has(w.to)) return { code: 'sink_taken', ref: w.to };
    drivers.set(w.to, w.from);
  }
  const { cyclic } = topoSort(gates, drivers);
  if (cyclic.size) return { code: 'cycle', ref: [...cyclic][0] };
  for (const g of gates.values()) {
    for (let i = 0; i < GATE_ARITY[g.type]; i++) {
      if (!drivers.has(`${g.id}:${i}`)) return { code: 'unconnected_input', ref: g.id };
    }
  }
  for (const o of spec.outputs) {
    if (!drivers.has(`out:${o}`)) return { code: 'unconnected_output', ref: o };
  }
  return null;
}

/** Kirish bitlari: r-qatordagi k-kirish (birinchi kirish — eng katta bit). */
export function rowBits(n: number, r: number): number[] {
  return Array.from({ length: n }, (_, k) => (r >> (n - 1 - k)) & 1);
}

export interface Evaluation {
  /** Manba qiymatlari: `in:A`, element id si. Ulanmagan kirishli element ham 0/1 qiymat oladi. */
  values: Map<string, number>;
  /** Chiqishlar: ulanmagan bo'lsa null. */
  outputs: (number | null)[];
}

export function evaluate(c: Compiled, bits: number[]): Evaluation {
  const values = new Map<string, number>();
  c.spec.inputs.forEach((name, k) => values.set(`in:${name}`, bits[k] ? 1 : 0));
  const read = (sink: string) => {
    const src = c.drivers.get(sink);
    return src === undefined ? 0 : (values.get(src) ?? 0);
  };
  for (const g of c.order) {
    values.set(g.id, applyGate(g.type, read(`${g.id}:0`), read(`${g.id}:1`)));
  }
  const outputs = c.spec.outputs.map((o) => {
    const src = c.drivers.get(`out:${o}`);
    if (src === undefined) return null;
    return values.get(src) ?? null;
  });
  return { values, outputs };
}

/**
 * Manbalar chuqurligi: kirishlar 0, element — o'z kirishlariga ulangan eng chuqur manba + 1.
 * Tekshiruv animatsiyasida signal shu tartibda "oqadi".
 */
export function depths(c: Compiled): Map<string, number> {
  const d = new Map<string, number>();
  c.spec.inputs.forEach((name) => d.set(`in:${name}`, 0));
  for (const g of c.order) {
    let m = 0;
    for (let i = 0; i < GATE_ARITY[g.type]; i++) {
      const src = c.drivers.get(`${g.id}:${i}`);
      if (src !== undefined) m = Math.max(m, d.get(src) ?? 0);
    }
    d.set(g.id, m + 1);
  }
  return d;
}

/** Har bir qator uchun chiqishlar: qatorlar[r][i]. */
export function truthTable(c: Compiled): (number | null)[][] {
  const n = c.spec.inputs.length;
  const rows: (number | null)[][] = [];
  for (let r = 0; r < 1 << n; r++) rows.push(evaluate(c, rowBits(n, r)).outputs);
  return rows;
}

/** Kutilgan qiymat: target[chiqish][r]. */
export function expected(level: Level, r: number): number[] {
  return level.outputs.map((o) => (level.target[o][r] === '1' ? 1 : 0));
}

export function rowMatches(level: Level, r: number, got: (number | null)[]): boolean {
  return expected(level, r).every((v, i) => got[i] === v);
}

export function starsFor(goal: number, gateCount: number): 1 | 2 | 3 {
  if (gateCount <= goal) return 3;
  if (gateCount <= goal + 2) return 2;
  return 1;
}

export type CheckResult =
  | { ok: true; gates: number; stars: 1 | 2 | 3 }
  | { ok: false; error: SimError }
  | { ok: false; wrongRows: number[] };

export function check(level: Level, circuit: Circuit): CheckResult {
  const error = validate(level, circuit);
  if (error) return { ok: false, error };
  const table = truthTable(compile(level, circuit));
  const wrongRows = table.flatMap((got, r) => (rowMatches(level, r, got) ? [] : [r]));
  if (wrongRows.length) return { ok: false, wrongRows };
  const gates = circuit.gates.length;
  return { ok: true, gates, stars: starsFor(level.goal, gates) };
}

/** `from` manbadan `to` qabul qiluvchiga sim tortilsa sikl hosil bo'ladimi. */
export function wouldCycle(circuit: Circuit, from: string, to: string): boolean {
  if (from.startsWith('in:') || to.startsWith('out:')) return false;
  const target = to.slice(0, to.lastIndexOf(':'));
  if (target === from) return true;
  // target chiqishidan pastga qarab yurib, from ga yetib bo'ladimi?
  const next = new Map<string, string[]>();
  for (const w of circuit.wires) {
    if (w.to.startsWith('out:')) continue;
    const g = w.to.slice(0, w.to.lastIndexOf(':'));
    if (!next.has(w.from)) next.set(w.from, []);
    next.get(w.from)!.push(g);
  }
  const seen = new Set<string>();
  const stack = [target];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === from) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(next.get(id) ?? []));
  }
  return false;
}
