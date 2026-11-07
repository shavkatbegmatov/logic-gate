// Sxemaning mantiqiy formulasi: har bir chiqish va D-triggerning keyingi qiymati Bul ifodasi sifatida.
// Bitta joyga ulangan element ifodaga to'g'ridan-to'g'ri qo'yiladi; bir nechta joyda ishlatilgani
// alohida nom oladi (chiqishga ham ulangan bo'lsa — o'sha chiqish nomi, aks holda t1, t2, …) — xuddi
// sxemadagidek, umumiy qism bir marta hisoblanadi. D-trigger chiqishi — holat q1, q2, … (sxemadagi
// D-triggerlar tartibida), keyingi takt qiymati — q1⁺.
import type { Circuit, GateType } from './types';

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

/** D-triggerlar holat nomlari (sxemadagi tartibda): maydondagi yozuv va formula bir xil bo'lsin. */
export function stateNames(c: Circuit): Map<string, string> {
  return new Map(c.gates.filter((g) => g.type === 'DFF').map((g, i) => [g.id, `q${i + 1}`]));
}

export function formulaLines(c: Circuit, outputs: string[]): FormulaLine[] {
  const gates = new Map(c.gates.map((g) => [g.id, g]));
  const pin = new Map<string, string>();
  const outSrc = new Map<string, string>();
  const fanout = new Map<string, number>();
  for (const w of c.wires) {
    if (w.to.startsWith('out:')) outSrc.set(w.to.slice(4), w.from);
    else pin.set(w.to, w.from);
    fanout.set(w.from, (fanout.get(w.from) ?? 0) + 1);
  }
  const states = stateNames(c);
  const shared = (id: string) => (fanout.get(id) ?? 0) > 1 && gates.get(id)?.type !== 'DFF';

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

  const build = (id: string): Expr => {
    const g = gates.get(id)!;
    // Trigger orqali o'tmaydigan aylana (muharrir yo'l qo'ymaydi, lekin buzilgan qoralama bo'lishi mumkin).
    if (visiting.has(id)) return { text: '…', op: 'atom' };
    visiting.add(id);
    const a = ref(pin.get(`${id}:0`));
    const b = g.type === 'NOT' ? a : ref(pin.get(`${id}:1`));
    visiting.delete(id);
    return combine(g.type, a, b);
  };

  const ref = (src: string | undefined): Expr => {
    if (!src) return UNKNOWN;
    if (src.startsWith('in:')) return { text: src.slice(3), op: 'atom' };
    const g = gates.get(src);
    if (!g) return UNKNOWN;
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
