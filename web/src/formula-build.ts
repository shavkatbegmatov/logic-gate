// Formuladan sxema (Qum quti): Bul ifodasini elementlar va simlarga aylantiradi va maydonga joylaydi.
//   - konstantalar soddalashtiriladi (A ∧ 1 = A, A ∨ 1 = 1 …) — maydonda 0/1 manbai yo'q;
//   - inkor ostidagi VA/YOKI/XOR bitta elementga birlashadi: ¬(A ∧ B) → NAND;
//   - bir xil qism-ifodalar bir marta yig'iladi: (A ∧ B) ∨ ¬(A ∧ B) da AND bitta emas, NAND alohida;
//   - qum qutida kirishlar A–E: boshqa harflar tartib bilan A, B, … ga almashtiriladi (xabar beriladi).
// Joylash: element ustuni — chuqurligi (kirishdan nechanchi element), ustun ichida — kirishlari o'rtasida.
import { ExprError, parseExpr, type ExprErrorCode, type ExprNode } from './boolexpr';
import { GATE_H, GATE_W, GRID, layout, outputColumn } from './board/geometry';
import { inputLeads, outputY } from './board/shapes';
import { LIMITS } from './sim/sim';
import type { Circuit, Gate, GateType, Spec, Wire } from './sim/types';

export const SANDBOX_INPUTS = ['A', 'B', 'C', 'D', 'E'];

export type BuildError =
  | { code: ExprErrorCode; pos: number }
  | { code: 'const'; value: 0 | 1 }
  | { code: 'too_many_inputs'; max: number }
  | { code: 'too_many_gates'; max: number };

export interface Built {
  inputs: string[];
  /** Harf almashtirishlari: [ifodadagi, maydondagi]. */
  rename: [string, string][];
  circuit: Circuit;
  /** Chiqishlar ustuni: elementlardan o'ngda. */
  outX: number;
}

export type BuildResult = { ok: true; value: Built } | { ok: false; error: BuildError };

/** Ustunlar orasidagi masofa va birinchi ustun (o'yin darajalaridagi yechimlar kabi). */
const COL_X = 120;
const COL_STEP = 144;
const ROW_GAP = 24;

const snap = (v: number) => Math.round(v / GRID) * GRID;

const FUSED: Record<'and' | 'or' | 'xor', GateType> = { and: 'NAND', or: 'NOR', xor: 'XNOR' };
const PLAIN: Record<'and' | 'or' | 'xor', GateType> = { and: 'AND', or: 'OR', xor: 'XOR' };

/** Konstantalarni yo'qotadi; butun ifoda doimiy bo'lsa — { op: 'const' }. */
export function foldConstants(n: ExprNode): ExprNode {
  if (n.op === 'var' || n.op === 'const') return n;
  if (n.op === 'not') {
    const a = foldConstants(n.a);
    return a.op === 'const' ? { op: 'const', v: a.v ? 0 : 1 } : { op: 'not', a };
  }
  const a = foldConstants(n.a);
  const b = foldConstants(n.b);
  if (a.op !== 'const' && b.op !== 'const') return { op: n.op, a, b };
  if (a.op === 'const' && b.op === 'const') {
    const v = n.op === 'and' ? a.v & b.v : n.op === 'or' ? a.v | b.v : a.v ^ b.v;
    return { op: 'const', v: v ? 1 : 0 };
  }
  const c = (a.op === 'const' ? a : b) as { op: 'const'; v: 0 | 1 };
  const other = a.op === 'const' ? b : a;
  if (n.op === 'and') return c.v ? other : c; // A ∧ 1 = A, A ∧ 0 = 0
  if (n.op === 'or') return c.v ? c : other; // A ∨ 1 = 1, A ∨ 0 = A
  return c.v ? { op: 'not', a: other } : other; // A ⊕ 1 = ¬A, A ⊕ 0 = A
}

/**
 * minInputs — maydonda allaqachon bor kirishlar (kamaytirilmaydi: "bekor qilish" eski sxemani qaytarganda
 * u yaroqli qolsin); outputs — maydondagi chiqishlar, ifoda birinchisiga ulanadi.
 */
export function buildFromFormula(src: string, opts: { minInputs?: number; outputs?: string[] } = {}): BuildResult {
  const outputs = opts.outputs?.length ? opts.outputs : ['Q1'];
  const output = outputs[0];
  let parsed;
  try {
    parsed = parseExpr(src);
  } catch (e) {
    if (e instanceof ExprError) return { ok: false, error: { code: e.code, pos: e.pos } };
    throw e;
  }
  const root = foldConstants(parsed.ast);
  if (root.op === 'const') return { ok: false, error: { code: 'const', value: root.v } };

  // Ifodada qolgan o'zgaruvchilar (konstantalar bilan yo'qolganlari hisobga olinmaydi).
  const vars = [...collect(root, new Set())].sort();
  if (vars.length > SANDBOX_INPUTS.length) return { ok: false, error: { code: 'too_many_inputs', max: SANDBOX_INPUTS.length } };
  const own = vars.every((v) => SANDBOX_INPUTS.includes(v));
  const name = new Map(vars.map((v, i) => [v, own ? v : SANDBOX_INPUTS[i]]));
  const rename = [...name].filter(([a, b]) => a !== b);
  const used = [...name.values()].map((v) => SANDBOX_INPUTS.indexOf(v));
  const inputs = SANDBOX_INPUTS.slice(0, Math.max(Math.max(...used) + 1, Math.min(opts.minInputs ?? 0, SANDBOX_INPUTS.length)));

  // Elementlar: bolalari avval (post-order) — chuqurlik va joylash shu tartibda hisoblanadi.
  const gates: Gate[] = [];
  const wires: Wire[] = [];
  const memo = new Map<string, string>();
  const source = (n: ExprNode): string => {
    if (n.op === 'var') return `in:${name.get(n.v)}`;
    const key = JSON.stringify(n);
    const hit = memo.get(key);
    if (hit) return hit;
    let type: GateType;
    let ins: ExprNode[];
    if (n.op === 'not') {
      const a = n.a;
      if (a.op === 'and' || a.op === 'or' || a.op === 'xor') {
        type = FUSED[a.op];
        ins = [a.a, a.b];
      } else {
        type = 'NOT';
        ins = [a];
      }
    } else if (n.op === 'const') {
      throw new Error('const after fold');
    } else {
      type = PLAIN[n.op];
      ins = [n.a, n.b];
    }
    const from = ins.map(source);
    const id = `g${gates.length + 1}`;
    gates.push({ id, type, x: 0, y: 0 });
    from.forEach((f, i) => wires.push({ from: f, to: `${id}:${i}` }));
    memo.set(key, id);
    return id;
  };
  wires.push({ from: source(root), to: `out:${output}` });
  if (gates.length > LIMITS.gates) return { ok: false, error: { code: 'too_many_gates', max: LIMITS.gates } };

  const spec: Spec = { inputs, outputs, gates: [] };
  const outX = place(spec, gates, wires);
  return { ok: true, value: { inputs, rename, circuit: { gates, wires }, outX } };
}

function collect(n: ExprNode, set: Set<string>): Set<string> {
  if (n.op === 'var') set.add(n.v);
  else if (n.op === 'not') collect(n.a, set);
  else if (n.op !== 'const') {
    collect(n.a, set);
    collect(n.b, set);
  }
  return set;
}

/** Elementlarni ustunlarga joylaydi (gates o'zgaradi) va chiqishlar ustunini qaytaradi. */
function place(spec: Spec, gates: Gate[], wires: Wire[]): number {
  const pins = layout(spec, 0).inputs;
  const byId = new Map(gates.map((g) => [g.id, g]));
  const inputsOf = (g: Gate) =>
    wires
      .filter((w) => w.to.startsWith(`${g.id}:`))
      .sort((a, b) => a.to.localeCompare(b.to))
      .map((w) => w.from);
  const depth = new Map<string, number>();
  for (const g of gates) {
    depth.set(g.id, 1 + Math.max(0, ...inputsOf(g).map((f) => depth.get(f) ?? 0)));
  }
  const maxDepth = Math.max(0, ...depth.values());
  // Manba porti y: kirish pin'i yoki element chiqishi.
  const sourceY = (f: string) => {
    if (f.startsWith('in:')) return pins.get(f.slice(3))!.y;
    const g = byId.get(f)!;
    return g.y + outputY(g.type);
  };
  for (let d = 1; d <= maxDepth; d++) {
    const column = gates
      .filter((g) => depth.get(g.id) === d)
      .map((g) => {
        const from = inputsOf(g);
        const leads = inputLeads(g.type);
        // Kirish portlari manbalar ro'parasida bo'lsin: o'rtacha farq bo'yicha.
        const want = from.reduce((s, f, i) => s + sourceY(f) - leads[i], 0) / from.length;
        return { g, want };
      })
      .sort((a, b) => a.want - b.want);
    let next = -Infinity;
    for (const { g, want } of column) {
      g.x = COL_X + (d - 1) * COL_STEP;
      g.y = snap(Math.max(want, next));
      if (g.y < next) g.y += GRID;
      next = g.y + GATE_H + ROW_GAP;
    }
  }
  return Math.max(outputColumn(4), snap(COL_X + (maxDepth - 1) * COL_STEP + GATE_W + 96));
}
