// Mantiqiy sxema simulyatori. Xuddi shu qoidalar server/internal/sim da Go'da takrorlangan —
// o'zgartirsangiz, ikkalasini ham yangilang (umumiy testlar levels/solutions.json orqali).
import { GATE_ARITY, type Circuit, type Gate, type GateType, type Level, type Machine, type Spec } from './types';

/** flipflops — D-triggerlar: tekshiruvda holatlar soni 2^n gacha o'sadi. */
export const LIMITS = { gates: 64, wires: 256, flipflops: 8, coord: 100000 };
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
  | 'too_many_flipflops'
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
  // D-trigger chiqishi — saqlangan qiymat (evaluate da alohida); bu — keyingi taktdagi qiymat.
  DFF: (a) => a,
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
  /** Elementlar topologik tartibda (sikldagilar kirmaydi). D-triggerlar — manba, boshida keladi. */
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
    // D-trigger kirishi chiqishiga shu taktda ta'sir qilmaydi — u orqali o'tgan aylana sikl emas.
    if (g.type === 'DFF') continue;
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
    const coordOk = (v: number) => Number.isFinite(v) && Math.abs(v) <= LIMITS.coord;
    if (!GATE_ID_RE.test(g.id) || !(g.type in GATE_ARITY) || !coordOk(g.x) || !coordOk(g.y)) return { code: 'bad_gate', ref: g.id };
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
  if (circuit.gates.filter((g) => g.type === 'DFF').length > LIMITS.flipflops) return { code: 'too_many_flipflops' };
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

/** D-triggerlarda saqlangan qiymatlar (id → 0/1); yo'q bo'lsa — 0 (boshlang'ich holat). */
export type State = Map<string, number>;

export function evaluate(c: Compiled, bits: number[], state?: State): Evaluation {
  const values = new Map<string, number>();
  c.spec.inputs.forEach((name, k) => values.set(`in:${name}`, bits[k] ? 1 : 0));
  const read = (sink: string) => {
    const src = c.drivers.get(sink);
    return src === undefined ? 0 : (values.get(src) ?? 0);
  };
  for (const g of c.order) {
    values.set(g.id, g.type === 'DFF' ? (state?.get(g.id) ?? 0) : applyGate(g.type, read(`${g.id}:0`), read(`${g.id}:1`)));
  }
  const outputs = c.spec.outputs.map((o) => {
    const src = c.drivers.get(`out:${o}`);
    if (src === undefined) return null;
    return values.get(src) ?? null;
  });
  return { values, outputs };
}

/** Takt: har bir D-trigger kirishidagi qiymatni eslab qoladi. */
export function nextState(c: Compiled, values: Map<string, number>): State {
  const next: State = new Map();
  for (const g of c.order) {
    if (g.type !== 'DFF') continue;
    const src = c.drivers.get(`${g.id}:0`);
    next.set(g.id, src === undefined ? 0 : (values.get(src) ?? 0));
  }
  return next;
}

/** Boshlang'ich holatdan berilgan qatorlar bilan ketma-ket taktlardan keyingi holat. */
export function replay(c: Compiled, rows: number[]): State {
  let state: State = new Map();
  const n = c.spec.inputs.length;
  for (const r of rows) state = nextState(c, evaluate(c, rowBits(n, r), state).values);
  return state;
}

/**
 * Manbalar chuqurligi: kirishlar va D-triggerlar 0, element — o'z kirishlariga ulangan eng chuqur
 * manba + 1. Tekshiruv animatsiyasida signal shu tartibda "oqadi".
 */
export function depths(c: Compiled): Map<string, number> {
  const d = new Map<string, number>();
  c.spec.inputs.forEach((name) => d.set(`in:${name}`, 0));
  for (const g of c.order) {
    if (g.type === 'DFF') {
      d.set(g.id, 0);
      continue;
    }
    let m = 0;
    for (let i = 0; i < GATE_ARITY[g.type]; i++) {
      const src = c.drivers.get(`${g.id}:${i}`);
      if (src !== undefined) m = Math.max(m, d.get(src) ?? 0);
    }
    d.set(g.id, m + 1);
  }
  return d;
}

/** Har bir qator uchun chiqishlar: qatorlar[r][i] (xotirali sxemada — joriy holatda). */
export function truthTable(c: Compiled, state?: State): (number | null)[][] {
  const n = c.spec.inputs.length;
  const rows: (number | null)[][] = [];
  for (let r = 0; r < 1 << n; r++) rows.push(evaluate(c, rowBits(n, r), state).outputs);
  return rows;
}

/** Kutilgan qiymat: target[chiqish][r] (kombinatsion masala). */
export function expected(level: Level, r: number): number[] {
  return level.outputs.map((o) => (level.target?.[o][r] === '1' ? 1 : 0));
}

// ── Ketma-ket masalalar ────────────────────────────────────

/** Avtomatning shu qatorlar bilan taktlardan keyingi holati. */
export function machineReplay(m: Machine, rows: number[]): number {
  let s = 0;
  for (const r of rows) s = m.next[s][r];
  return s;
}

export function machineOut(m: Machine, s: number, r: number): number[] {
  return [...m.out[s][r]].map(Number);
}

/**
 * Sxema avtomat bilan har qanday kirishlar ketma-ketligida bir xil ishlaydimi. Ikkalasi birga,
 * boshlang'ich holatdan kenglik bo'yicha (BFS) yuradi — har bir erishiladigan juft holat bir marta.
 * Farq bo'lsa, uni ko'rsatadigan eng qisqa ketma-ketlik (qatorlar) qaytadi: oxirgi taktda chiqish
 * noto'g'ri. Bir xil bo'lsa — null. Sxema oldindan validate dan o'tgan bo'lishi kerak.
 */
export function counterexample(c: Compiled, m: Machine): number[] | null {
  const n = c.spec.inputs.length;
  const dffs = c.order.filter((g) => g.type === 'DFF');
  const toState = (mask: number): State => new Map(dffs.map((g, i) => [g.id, (mask >> i) & 1]));
  const toMask = (st: State) => dffs.reduce((mask, g, i) => mask | ((st.get(g.id) ?? 0) << i), 0);
  const states = m.next.length;
  const key = (mask: number, s: number) => mask * states + s;
  const parent = new Map<number, { prev: number; row: number } | null>([[key(0, 0), null]]);
  const path = (k: number, row: number) => {
    const rows = [row];
    for (let p = parent.get(k); p; p = parent.get(p.prev)) rows.unshift(p.row);
    return rows;
  };
  const queue: [number, number][] = [[0, 0]];
  for (let qi = 0; qi < queue.length; qi++) {
    const [mask, s] = queue[qi];
    const st = toState(mask);
    for (let r = 0; r < 1 << n; r++) {
      const ev = evaluate(c, rowBits(n, r), st);
      const want = machineOut(m, s, r);
      if (want.some((v, i) => ev.outputs[i] !== v)) return path(key(mask, s), r);
      const next = key(toMask(nextState(c, ev.values)), m.next[s][r]);
      if (!parent.has(next)) {
        parent.set(next, { prev: key(mask, s), row: r });
        queue.push([Math.floor(next / states), next % states]);
      }
    }
  }
  return null;
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
  | { ok: false; wrongRows: number[] }
  /** Ketma-ket masala: xatoni ko'rsatadigan qatorlar ketma-ketligi (oxirgi taktda xato). */
  | { ok: false; trace: number[] };

export function check(level: Level, circuit: Circuit): CheckResult {
  const error = validate(level, circuit);
  if (error) return { ok: false, error };
  if (level.seq) {
    const trace = counterexample(compile(level, circuit), level.seq);
    if (trace) return { ok: false, trace };
    const gates = circuit.gates.length;
    return { ok: true, gates, stars: starsFor(level.goal, gates) };
  }
  const table = truthTable(compile(level, circuit));
  const wrongRows = table.flatMap((got, r) => (rowMatches(level, r, got) ? [] : [r]));
  if (wrongRows.length) return { ok: false, wrongRows };
  const gates = circuit.gates.length;
  return { ok: true, gates, stars: starsFor(level.goal, gates) };
}

/**
 * `from` manbadan `to` qabul qiluvchiga sim tortilsa sikl hosil bo'ladimi. D-trigger kirishiga
 * boradigan sim sikl hosil qilmaydi: signal u orqali faqat keyingi taktda o'tadi.
 */
export function wouldCycle(circuit: Circuit, from: string, to: string): boolean {
  if (from.startsWith('in:') || to.startsWith('out:')) return false;
  const types = new Map(circuit.gates.map((g) => [g.id, g.type]));
  const target = to.slice(0, to.lastIndexOf(':'));
  if (types.get(target) === 'DFF') return false;
  if (target === from) return true;
  // target chiqishidan pastga qarab yurib, from ga yetib bo'ladimi?
  const next = new Map<string, string[]>();
  for (const w of circuit.wires) {
    if (w.to.startsWith('out:')) continue;
    const g = w.to.slice(0, w.to.lastIndexOf(':'));
    if (types.get(g) === 'DFF') continue;
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
