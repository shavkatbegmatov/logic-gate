// Sxemaning mantiqiy formulasi: har bir chiqish va D-triggerning keyingi qiymati Bul ifodasi sifatida.
// Bitta joyga ulangan element ifodaga to'g'ridan-to'g'ri qo'yiladi; bir nechta joyda ishlatilgani
// alohida nom oladi (chiqishga ham ulangan bo'lsa — o'sha chiqish nomi, aks holda t1, t2, …) — xuddi
// sxemadagidek, umumiy qism bir marta hisoblanadi. D-trigger chiqishi — holat q1, q2, … (sxemadagi
// D-triggerlar tartibida), keyingi takt qiymati — q1⁺.
import { BLOCKS, GATE_ARITY, isBlock, parseSource, type BlockType, type Circuit, type GateType } from './types';

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

const neg = (x: Expr): Expr => ({ text: x.op === 'atom' || x.op === 'not' ? `¬${x.text}` : `¬(${x.text})`, op: 'not' });

function bin(op: 'AND' | 'OR' | 'XOR', a: Expr, b: Expr): Expr {
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
  }
}

/** D-triggerlar holat nomlari (sxemadagi tartibda): maydondagi yozuv va formula bir xil bo'lsin. */
export function stateNames(c: Circuit): Map<string, string> {
  return new Map(c.gates.filter((g) => g.type === 'DFF').map((g, i) => [g.id, `q${i + 1}`]));
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
  const states = stateNames(c);
  const shared = (src: string) =>
    ((fanout.get(src) ?? 0) > 1 || blockFed.has(src)) && gates.get(parseSource(src).id)?.type !== 'DFF';

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
    if (g.type === 'DFF') return { text: states.get(src)!, op: 'atom' };
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
  for (const [id, q] of states) lines.push({ name: `${q}⁺`, expr: ref(pin.get(`${id}:0`)).text, kind: 'next' });
  return lines;
}
