// Sxemaning mantiqiy formulasi: har bir chiqish va D-triggerning keyingi qiymati Bul ifodasi sifatida.
// Bitta joyga ulangan element ifodaga to'g'ridan-to'g'ri qo'yiladi; bir nechta joyda ishlatilgani
// alohida nom oladi (chiqishga ham ulangan bo'lsa — o'sha chiqish nomi, aks holda t1, t2, …) — xuddi
// sxemadagidek, umumiy qism bir marta hisoblanadi. D-trigger chiqishi — holat q1, q2, … (sxemadagi
// D-triggerlar tartibida), keyingi takt qiymati — q1⁺. Registr bloklari chiqishlari ham holat: ular ham q
// nomlarini oladi (D-triggerlardan keyin, har bit alohida) va keyingi qiymati blok jadvalidan.
import {
  BLOCKS,
  GATE_ARITY,
  gateOutputs,
  isBlock,
  isStateful,
  parseSource,
  sourcePort,
  type BlockType,
  type Circuit,
  type GateType,
} from './types';

export interface FormulaLine {
  name: string;
  expr: string;
  /** out — chiqish, tmp — umumiy oraliq qiymat, next — D-triggerning keyingi qiymati. */
  kind: 'out' | 'tmp' | 'next';
}

type Op = 'atom' | 'not' | 'AND' | 'OR' | 'XOR';

interface Expr {
  text: string;
  op: Op;
}

const SYM: Record<'AND' | 'OR' | 'XOR', string> = { AND: '∧', OR: '∨', XOR: '⊕' };
const UNKNOWN: Expr = { text: '?', op: 'atom' };

// Doimiy manbalar (ONE, ZERO): ifodada 1 va 0 — amallarda soddalashtiriladi (A ∧ 1 = A, A ⊕ 1 = ¬A).
const ONE: Expr = { text: '1', op: 'atom' };
const ZERO: Expr = { text: '0', op: 'atom' };
const isConst = (x: Expr) => x.op === 'atom' && (x.text === '0' || x.text === '1');

const neg = (x: Expr): Expr =>
  isConst(x) ? (x.text === '1' ? ZERO : ONE) : { text: x.op === 'atom' || x.op === 'not' ? `¬${x.text}` : `¬(${x.text})`, op: 'not' };

function bin(op: 'AND' | 'OR' | 'XOR', a: Expr, b: Expr): Expr {
  if (isConst(a) || isConst(b)) {
    const [c, x] = isConst(a) ? [a, b] : [b, a];
    const one = c.text === '1';
    return op === 'AND' ? (one ? x : ZERO) : op === 'OR' ? (one ? ONE : x) : one ? neg(x) : x;
  }
  // Bir xil amal zanjiri (A ∧ B ∧ C) qavssiz; turli amallar doim qavs bilan — o'quvchiga aniqroq.
  const part = (x: Expr) => (x.op === 'atom' || x.op === 'not' || x.op === op ? x.text : `(${x.text})`);
  return { text: `${part(a)} ${SYM[op]} ${part(b)}`, op };
}

function combine(type: GateType, a: Expr, b: Expr): Expr {
  switch (type) {
    case 'NOT':
      return neg(a);
    case 'AND':
    case 'OR':
    case 'XOR':
      return bin(type, a, b);
    case 'NAND':
      return neg(bin('AND', a, b));
    case 'NOR':
      return neg(bin('OR', a, b));
    case 'XNOR':
      return neg(bin('XOR', a, b));
    default:
      return UNKNOWN;
  }
}

const mux = (s: Expr, a: Expr, b: Expr) => bin('OR', bin('AND', neg(s), a), bin('AND', s, b));

/**
 * To'rt bitli summator: a, b — eng katta bit birinchi. Natija: [S3, S2, S1, S0, Co].
 * Ko'chirish zanjiri: c0 = Ci, c(j+1) = Aj∧Bj ∨ cj∧(Aj⊕Bj); Sj = Aj⊕Bj⊕cj (j — bit raqami, A0 = a[3]).
 */
function adder(a: Expr[], b: Expr[], ci: Expr): Expr[] {
  let c = ci;
  const sum: Expr[] = [];
  for (let j = 0; j < 4; j++) {
    const x = a[3 - j];
    const y = b[3 - j];
    sum[3 - j] = bin('XOR', bin('XOR', x, y), c);
    c = bin('OR', bin('AND', x, y), bin('AND', c, bin('XOR', x, y)));
  }
  return [...sum, c];
}

/**
 * Blokning k-chiqishi oddiy amallarda (blok ichidagi mos yozuvdagi sxema kabi). Kirishlari doim atom yoki
 * nom bo'ladi (formulaLines ularni nomlaydi) — ifoda ko'chirish zanjirida ikki baravar o'sib ketmasin.
 */
function blockExpr(type: BlockType, k: number, x: Expr[]): Expr {
  switch (type) {
    case 'HA':
      return k === 0 ? bin('XOR', x[0], x[1]) : bin('AND', x[0], x[1]);
    case 'FA':
      return k === 0
        ? bin('XOR', bin('XOR', x[0], x[1]), x[2])
        : bin('OR', bin('AND', x[0], x[1]), bin('AND', x[2], bin('XOR', x[0], x[1])));
    case 'MUX':
      return bin('OR', bin('AND', neg(x[2]), x[0]), bin('AND', x[2], x[1]));
    case 'DEC':
      return bin('AND', k & 2 ? x[0] : neg(x[0]), k & 1 ? x[1] : neg(x[1]));
    // Shina bloklari: k-chiqish (0 — eng katta bit) bitlar bo'yicha.
    case 'SPLIT':
    case 'JOIN':
      return x[k];
    case 'NOT4':
      return neg(x[k]);
    case 'MUX4':
      return bin('OR', bin('AND', neg(x[8]), x[k]), bin('AND', x[8], x[4 + k]));
    case 'INC4': {
      // Qk = Ak ⊕ (undan kichik bitlarning hammasi 1); C — hammasi 1. A0 = x[3].
      const all = (n: number) => x.slice(4 - n).reduce((a, b) => bin('AND', a, b));
      if (k === 4) return all(4);
      return k === 3 ? neg(x[3]) : bin('XOR', x[k], all(3 - k));
    }
    case 'ADD4':
      return adder(x.slice(0, 4), x.slice(4, 8), x[8])[k];
    case 'NOR4':
      return neg(x.reduce((a, b) => bin('OR', a, b)));
    case 'ONE':
      return ONE;
    case 'ZERO':
      return ZERO;
    // A − B = A + ¬B + 1.
    case 'SUB4':
      return adder(x.slice(0, 4), x.slice(4, 8).map(neg), ONE)[k];
    case 'AND4':
      return bin('AND', x[k], x[4 + k]);
    case 'OR4':
      return bin('OR', x[k], x[4 + k]);
    case 'XOR4':
      return bin('XOR', x[k], x[4 + k]);
    case 'ALU4': {
      // «Qo'sh yoki ayir» (B ⊕ F0, Ci = F0), mantiq — F0 bilan AND yoki OR, so'ng F1 bilan tanlov.
      const [f1, f0] = [x[8], x[9]];
      const s = adder(x.slice(0, 4), x.slice(4, 8).map((b) => bin('XOR', b, f0)), f0);
      const r = (j: number) => mux(f1, s[j], mux(f0, bin('AND', x[j], x[4 + j]), bin('OR', x[j], x[4 + j])));
      if (k === 4) return bin('AND', neg(f1), s[4]);
      return k === 5 ? neg([0, 1, 2, 3].map(r).reduce((a, b) => bin('OR', a, b))) : r(k);
    }
    // Xotirali bloklar: keyingi takt qiymati; x — kirishlar, keyin joriy chiqishlar (holat).
    case 'REG1':
      return mux(x[1], x[2], x[0]);
    case 'REG4':
      return mux(x[4], x[5 + k], x[k]);
    case 'PC4':
      return mux(x[4], blockExpr('INC4', k, x.slice(5, 9)), x[k]);
  }
}

/** D-triggerlar holat nomlari (sxemadagi tartibda): maydondagi yozuv va formula bir xil bo'lsin. */
export function stateNames(c: Circuit): Map<string, string> {
  return new Map(c.gates.filter((g) => g.type === 'DFF').map((g, i) => [g.id, `q${i + 1}`]));
}

/** Formuladagi barcha holatlar (manba → nom): D-triggerlar, keyin registrlar chiqishlari (har bit alohida). */
function formulaStates(c: Circuit): Map<string, string> {
  const names = stateNames(c);
  for (const g of c.gates) {
    if (g.type === 'DFF' || !isStateful(g.type)) continue;
    for (let k = 0; k < gateOutputs(g.type); k++) names.set(sourcePort(g.id, k), `q${names.size + 1}`);
  }
  return names;
}

export function formulaLines(c: Circuit, outputs: string[]): FormulaLine[] {
  const gates = new Map(c.gates.map((g) => [g.id, g]));
  const pin = new Map<string, string>();
  const outSrc = new Map<string, string>();
  const fanout = new Map<string, number>();
  // Blok kirishiga ulangan manbalar: blok ifodasida kirish bir necha marta qatnashadi — nom oladi.
  const blockFed = new Set<string>();
  for (const w of c.wires) {
    if (w.to.startsWith('out:')) outSrc.set(w.to.slice(4), w.from);
    else {
      pin.set(w.to, w.from);
      const t = gates.get(w.to.slice(0, w.to.lastIndexOf(':')))?.type;
      if (t && isBlock(t)) blockFed.add(w.from);
    }
    fanout.set(w.from, (fanout.get(w.from) ?? 0) + 1);
  }
  const states = formulaStates(c);
  // Doimiy manba (1 yoki 0) va holat nom olmaydi: ifodaga qiymat yoki holat nomining o'zi qo'yiladi.
  const shared = (src: string) => {
    const t = gates.get(parseSource(src).id)?.type;
    return ((fanout.get(src) ?? 0) > 1 || blockFed.has(src)) && t !== undefined && !isStateful(t) && t !== 'ONE' && t !== 'ZERO';
  };

  // Umumiy element chiqishga ham ulangan bo'lsa, uning nomi — chiqish nomi.
  const names = new Map<string, string>();
  for (const o of outputs) {
    const s = outSrc.get(o);
    if (s && shared(s) && !names.has(s)) names.set(s, o);
  }

  const lines: FormulaLine[] = [];
  const emitted = new Set<string>();
  const visiting = new Set<string>();
  let tmp = 0;

  const build = (src: string): Expr => {
    const { id, k } = parseSource(src);
    const g = gates.get(id)!;
    // Trigger orqali o'tmaydigan aylana (muharrir yo'l qo'ymaydi, lekin buzilgan qoralama bo'lishi mumkin).
    if (visiting.has(id)) return { text: '…', op: 'atom' };
    visiting.add(id);
    if (isBlock(g.type)) {
      const ins = Array.from({ length: GATE_ARITY[g.type] }, (_, i) => ref(pin.get(`${id}:${i}`)));
      visiting.delete(id);
      return blockExpr(g.type, k, ins);
    }
    const a = ref(pin.get(`${id}:0`));
    const b = g.type === 'NOT' ? a : ref(pin.get(`${id}:1`));
    visiting.delete(id);
    return combine(g.type, a, b);
  };

  const ref = (src: string | undefined): Expr => {
    if (!src) return UNKNOWN;
    if (src.startsWith('in:')) return { text: src.slice(3), op: 'atom' };
    const { id, k } = parseSource(src);
    const g = gates.get(id);
    if (!g || k < 0 || k >= (isBlock(g.type) ? BLOCKS[g.type].outputs.length : 1)) return UNKNOWN;
    if (isStateful(g.type)) return { text: states.get(src)!, op: 'atom' };
    if (!shared(src)) return build(src);
    if (!names.has(src)) names.set(src, `t${++tmp}`);
    const name = names.get(src)!;
    if (!emitted.has(src)) {
      emitted.add(src);
      const e = build(src);
      // Ifoda ichida ishlatilgan boshqa nomlar undan oldin yozilgan bo'ladi.
      lines.push({ name, expr: e.text, kind: outputs.includes(name) ? 'out' : 'tmp' });
    }
    return { text: name, op: 'atom' };
  };

  for (const o of outputs) {
    const s = outSrc.get(o);
    if (s && names.get(s) === o) {
      ref(s);
      continue;
    }
    lines.push({ name: o, expr: ref(s).text, kind: 'out' });
  }
  for (const [src, q] of states) {
    const { id, k } = parseSource(src);
    const g = gates.get(id)!;
    const ins = Array.from({ length: GATE_ARITY[g.type] }, (_, i) => ref(pin.get(`${id}:${i}`)));
    const expr = isBlock(g.type)
      ? blockExpr(g.type, k, [...ins, ...Array.from({ length: gateOutputs(g.type) }, (_, j) => ({ text: states.get(sourcePort(id, j))!, op: 'atom' as const }))])
      : ins[0];
    lines.push({ name: `${q}⁺`, expr: expr.text, kind: 'next' });
  }
  return lines;
}
