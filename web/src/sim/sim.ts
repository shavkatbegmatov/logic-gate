// Mantiqiy sxema simulyatori. Xuddi shu qoidalar server/internal/sim da Go'da takrorlangan —
// o'zgartirsangiz, ikkalasini ham yangilang (umumiy testlar levels/solutions.json orqali).
import {
  BLOCKS,
  blockTable,
  GATE_ARITY,
  gateOutputs,
  isBlock,
  isStateful,
  parseSource,
  sourcePort,
  stateBits,
  tableWidth,
  type Circuit,
  type Gate,
  type GateType,
  type Level,
  type Machine,
  type Spec,
} from './types';

/** flipflops — xotira bitlari (D-trigger — 1, registr — chiqishlari soni): tekshiruvda holatlar 2^n gacha o'sadi. */
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

const OPS: Record<Exclude<GateType, keyof typeof BLOCKS>, (a: number, b: number) => number> = {
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

/** Oddiy element: kirishlar a, b (bir kirishlida b e'tiborsiz). Blok uchun — 0-chiqish. */
export function applyGate(type: GateType, a: number, b: number): number {
  return isBlock(type) ? gateOutputValues(type, [a, b])[0] : OPS[type](a, b);
}

/**
 * Element chiqishlari: blokda jadvaldan (birinchi kirish — qatorning eng katta biti). Xotirali blokda ins —
 * kirishlar va joriy chiqishlar, natija — keyingi takt chiqishlari.
 */
export function gateOutputValues(type: GateType, ins: number[]): number[] {
  if (!isBlock(type)) return [OPS[type](ins[0] ?? 0, ins[1] ?? 0)];
  const b = BLOCKS[type];
  let r = 0;
  for (let i = 0; i < tableWidth(type); i++) r = (r << 1) | (ins[i] ? 1 : 0);
  const m = blockTable(type)[r];
  return b.outputs.map((_, k) => (m >> k) & 1);
}

/** Element manbasi (`gid` yoki `gid.k`) bo'lsa — element id si, aks holda null. */
function sourceGate(gates: { has(id: string): boolean }, s: string): string | null {
  if (s.startsWith('in:')) return null;
  const { id } = parseSource(s);
  return gates.has(id) ? id : null;
}

export function isSource(spec: Spec, gates: Map<string, Gate>, s: string): boolean {
  if (s.startsWith('in:')) return spec.inputs.includes(s.slice(3));
  const { id, k } = parseSource(s);
  const g = gates.get(id);
  return !!g && k >= 0 && k < gateOutputs(g.type) && sourcePort(id, k) === s;
}

export function isSink(spec: Spec, gates: Map<string, Gate>, s: string): boolean {
  if (s.startsWith('out:')) return spec.outputs.includes(s.slice(4));
  const i = s.lastIndexOf(':');
  if (i < 0) return false;
  const g = gates.get(s.slice(0, i));
  const idx = s.slice(i + 1);
  const k = Number(idx);
  return !!g && /^\d$/.test(idx) && k < GATE_ARITY[g.type];
}

/** Sink → manba. */
export type Drivers = Map<string, string>;

export interface Compiled {
  spec: Spec;
  gates: Map<string, Gate>;
  drivers: Drivers;
  /** Elementlar topologik tartibda (sikldagilar kirmaydi). Xotirali elementlar — manba, boshida keladi. */
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
  const drivers: Drivers = new Map();
  for (const w of circuit.wires) {
    if (!isSource(spec, gates, w.from) || !isSink(spec, gates, w.to) || drivers.has(w.to)) continue;
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
    // Xotirali element (D-trigger, registr) kirishi chiqishiga shu taktda ta'sir qilmaydi — u orqali o'tgan
    // aylana sikl emas.
    if (isStateful(g.type)) continue;
    for (let i = 0; i < GATE_ARITY[g.type]; i++) {
      const src = drivers.get(`${g.id}:${i}`);
      const from = src === undefined ? null : sourceGate(gates, src);
      if (from) {
        indeg.set(g.id, indeg.get(g.id)! + 1);
        users.get(from)!.push(g.id);
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
  const drivers: Drivers = new Map();
  for (const w of circuit.wires) {
    if (!isSource(spec, gates, w.from) || !isSink(spec, gates, w.to)) return { code: 'bad_wire' };
    if (drivers.has(w.to)) return { code: 'sink_taken', ref: w.to };
    drivers.set(w.to, w.from);
  }
  const { cyclic } = topoSort(gates, drivers);
  if (cyclic.size) return { code: 'cycle', ref: [...cyclic][0] };
  if (circuit.gates.reduce((n, g) => n + stateBits(g.type), 0) > LIMITS.flipflops) return { code: 'too_many_flipflops' };
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
  /** Manba qiymatlari: `in:A`, element id si (blokda `gid.k` ham). Ulanmagan kirishli element ham 0/1 qiymat oladi. */
  values: Map<string, number>;
  /** Chiqishlar: ulanmagan bo'lsa null. */
  outputs: (number | null)[];
}

/**
 * Xotirali elementlarda saqlangan qiymatlar: id → D-triggerda 0/1, registrda chiqishlar maskasi (k-bit —
 * k-chiqish); yo'q bo'lsa — 0 (boshlang'ich holat).
 */
export type State = Map<string, number>;

export function evaluate(c: Compiled, bits: number[], state?: State): Evaluation {
  const values = new Map<string, number>();
  c.spec.inputs.forEach((name, k) => values.set(`in:${name}`, bits[k] ? 1 : 0));
  const read = (sink: string) => {
    const src = c.drivers.get(sink);
    return src === undefined ? 0 : (values.get(src) ?? 0);
  };
  for (const g of c.order) {
    if (g.type === 'DFF') values.set(g.id, state?.get(g.id) ?? 0);
    else if (isStateful(g.type)) {
      const word = state?.get(g.id) ?? 0;
      for (let k = 0; k < gateOutputs(g.type); k++) values.set(sourcePort(g.id, k), (word >> k) & 1);
    } else if (isBlock(g.type)) {
      const ins = Array.from({ length: GATE_ARITY[g.type] }, (_, i) => read(`${g.id}:${i}`));
      gateOutputValues(g.type, ins).forEach((v, k) => values.set(sourcePort(g.id, k), v));
    } else values.set(g.id, applyGate(g.type, read(`${g.id}:0`), read(`${g.id}:1`)));
  }
  const outputs = c.spec.outputs.map((o) => {
    const src = c.drivers.get(`out:${o}`);
    if (src === undefined) return null;
    return values.get(src) ?? null;
  });
  return { values, outputs };
}

/** Takt: har bir D-trigger kirishidagi qiymatni eslab qoladi, registr esa o'z jadvali bo'yicha yangilanadi. */
export function nextState(c: Compiled, values: Map<string, number>): State {
  const next: State = new Map();
  const read = (sink: string) => {
    const src = c.drivers.get(sink);
    return src === undefined ? 0 : (values.get(src) ?? 0);
  };
  for (const g of c.order) {
    if (g.type === 'DFF') next.set(g.id, read(`${g.id}:0`));
    else if (isStateful(g.type)) {
      const n = gateOutputs(g.type);
      const ins = Array.from({ length: GATE_ARITY[g.type] }, (_, i) => read(`${g.id}:${i}`));
      const q = Array.from({ length: n }, (_, k) => values.get(sourcePort(g.id, k)) ?? 0);
      next.set(g.id, gateOutputValues(g.type, [...ins, ...q]).reduce((m, v, k) => m | (v << k), 0));
    }
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
 * Manbalar chuqurligi: kirishlar va xotirali elementlar 0, element — o'z kirishlariga ulangan eng chuqur
 * manba + 1. Tekshiruv animatsiyasida signal shu tartibda "oqadi".
 */
export function depths(c: Compiled): Map<string, number> {
  const d = new Map<string, number>();
  c.spec.inputs.forEach((name) => d.set(`in:${name}`, 0));
  for (const g of c.order) {
    if (isStateful(g.type)) {
      for (let k = 0; k < gateOutputs(g.type); k++) d.set(sourcePort(g.id, k), 0);
      continue;
    }
    let m = 0;
    for (let i = 0; i < GATE_ARITY[g.type]; i++) {
      const src = c.drivers.get(`${g.id}:${i}`);
      if (src !== undefined) m = Math.max(m, d.get(src) ?? 0);
    }
    for (let k = 0; k < gateOutputs(g.type); k++) d.set(sourcePort(g.id, k), m + 1);
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
 * Bir xil ishlaydigan holatlarni birlashtiradi (Moore algoritmi) va holatlarni boshlang'ichdan kenglik
 * bo'yicha raqamlaydi — natija yagona (kanonik). levels/machine.mjs dagi bilan aynan bir xil: daraja
 * avtomati va shu darajaning yechimidan qurilgan avtomat tengligi testlarda tekshiriladi.
 */
export function minimizeMachine(m: Machine): Machine {
  const { next, out } = m;
  let cls = out.map((o) => o.join());
  for (;;) {
    const ids = new Map<string, string>();
    const refined = cls.map((c, i) => {
      const sig = `${c}|${next[i].map((j) => cls[j]).join()}`;
      if (!ids.has(sig)) ids.set(sig, String(ids.size));
      return ids.get(sig)!;
    });
    if (new Set(refined).size === new Set(cls).size) break;
    cls = refined;
  }
  const order = new Map<string, number>([[cls[0], 0]]);
  const reps = [0];
  for (let i = 0; i < reps.length; i++) {
    for (const j of next[reps[i]]) {
      if (!order.has(cls[j])) {
        order.set(cls[j], reps.length);
        reps.push(j);
      }
    }
  }
  return { next: reps.map((i) => next[i].map((j) => order.get(cls[j])!)), out: reps.map((i) => out[i]) };
}

/**
 * Sxema holati bitmaska sifatida: xotirali elementlar `order` tartibida, har biri o'z bitlari bilan (Go dagi
 * bilan bir xil joylashuv). Ko'pi bilan LIMITS.flipflops bit.
 */
function stateCodec(c: Compiled) {
  const cells: { id: string; off: number; bits: number }[] = [];
  let width = 0;
  for (const g of c.order) {
    const bits = stateBits(g.type);
    if (!bits) continue;
    cells.push({ id: g.id, off: width, bits });
    width += bits;
  }
  return {
    toState: (mask: number): State => new Map(cells.map((x) => [x.id, (mask >> x.off) & ((1 << x.bits) - 1)])),
    toMask: (st: State) => cells.reduce((mask, x) => mask | ((st.get(x.id) ?? 0) << x.off), 0),
  };
}

/** Sxemaning xatti-harakati — eng kichik avtomat (boshlang'ich holat: barcha xotira bitlari 0). */
export function machineOf(c: Compiled): Machine {
  const n = c.spec.inputs.length;
  const { toState, toMask } = stateCodec(c);
  const ids = new Map<number, number>([[0, 0]]);
  const masks = [0];
  const next: number[][] = [];
  const out: string[][] = [];
  for (let i = 0; i < masks.length; i++) {
    const st = toState(masks[i]);
    next.push([]);
    out.push([]);
    for (let r = 0; r < 1 << n; r++) {
      const ev = evaluate(c, rowBits(n, r), st);
      const nm = toMask(nextState(c, ev.values));
      if (!ids.has(nm)) {
        ids.set(nm, masks.length);
        masks.push(nm);
      }
      next[i].push(ids.get(nm)!);
      out[i].push(ev.outputs.map((v) => (v ? '1' : '0')).join(''));
    }
  }
  return minimizeMachine({ next, out });
}

/**
 * Vaqt diagrammasi uchun namuna: har qadamda joriy holatdan hali o'tilmagan o'tish tanlanadi
 * (avtomatning turli tomonlari ko'rinsin). Bir avtomat uchun har doim bir xil.
 */
export function exampleFor(m: Machine, length = 10): number[] {
  const rows = m.next[0].length;
  const used = new Set<number>();
  const seq: number[] = [];
  let s = 0;
  for (let i = 0; i < length; i++) {
    let r = -1;
    for (let k = 0; k < rows && r < 0; k++) {
      const cand = (k + i) % rows;
      if (!used.has(s * rows + cand)) r = cand;
    }
    if (r < 0) r = (i * 5 + 1) % rows;
    used.add(s * rows + r);
    seq.push(r);
    s = m.next[s][r];
  }
  return seq;
}

/**
 * Sxema avtomat bilan har qanday kirishlar ketma-ketligida bir xil ishlaydimi. Ikkalasi birga,
 * boshlang'ich holatdan kenglik bo'yicha (BFS) yuradi — har bir erishiladigan juft holat bir marta.
 * Farq bo'lsa, uni ko'rsatadigan eng qisqa ketma-ketlik (qatorlar) qaytadi: oxirgi taktda chiqish
 * noto'g'ri. Bir xil bo'lsa — null. Sxema oldindan validate dan o'tgan bo'lishi kerak.
 */
export function counterexample(c: Compiled, m: Machine): number[] | null {
  const n = c.spec.inputs.length;
  const { toState, toMask } = stateCodec(c);
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
 * `from` manbadan `to` qabul qiluvchiga sim tortilsa sikl hosil bo'ladimi. Xotirali element (D-trigger,
 * registr) kirishiga boradigan sim sikl hosil qilmaydi: signal u orqali faqat keyingi taktda o'tadi.
 */
export function wouldCycle(circuit: Circuit, from: string, to: string): boolean {
  if (from.startsWith('in:') || to.startsWith('out:')) return false;
  from = parseSource(from).id;
  const types = new Map(circuit.gates.map((g) => [g.id, g.type]));
  const target = to.slice(0, to.lastIndexOf(':'));
  const stateful = (id: string) => {
    const t = types.get(id);
    return t !== undefined && isStateful(t);
  };
  if (stateful(target)) return false;
  if (target === from) return true;
  // target chiqishidan pastga qarab yurib, from ga yetib bo'ladimi?
  const next = new Map<string, string[]>();
  for (const w of circuit.wires) {
    if (w.to.startsWith('out:')) continue;
    const g = w.to.slice(0, w.to.lastIndexOf(':'));
    if (stateful(g)) continue;
    const src = parseSource(w.from).id;
    if (!next.has(src)) next.set(src, []);
    next.get(src)!.push(g);
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
