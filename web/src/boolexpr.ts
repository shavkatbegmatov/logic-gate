// Mantiqiy ifodalar: o'qish (parser), hisoblash, haqiqat jadvali va ikki ifodani solishtirish.
// Bitta manba uch joyda ishlatiladi:
//   - o'yin: Qum qutida formuladan sxema yig'ish (src/formula-build.ts);
//   - build: "Bul algebrasi" qo'llanmasidagi misollar va statik jadval (scripts/pages.mjs);
//   - brauzer: qo'llanmadagi kalkulyator — pages.mjs bu faylni turlari va `export` so'zlarisiz
//     dist/guide-bool.js ga qo'shadi (node:module stripTypeScriptTypes).
// Shuning uchun bu yerda import yo'q va faqat o'chiriladigan TypeScript (turlar, interfeyslar):
// enum, namespace, parametr-xossalar ishlatilmaydi.
//
// Yozuv: o'zgaruvchilar — bitta lotin harfi (A–Z, kichigi ham), 0 va 1.
//   NOT: ¬ ! ~ NOT, yoki keyin ' (A')   AND: ∧ & · * AND, yoki yonma-yon (AB)
//   XOR: ⊕ ^ XOR                          OR:  ∨ | + OR
// Ustunlik: NOT > AND > XOR > OR; qavslar ( ).

export const MAX_VARS = 6;

export type ExprNode =
  | { op: 'var'; v: string }
  | { op: 'const'; v: 0 | 1 }
  | { op: 'not'; a: ExprNode }
  | { op: 'and' | 'or' | 'xor'; a: ExprNode; b: ExprNode };

export type ExprErrorCode = 'empty' | 'char' | 'end' | 'unexpected' | 'paren' | 'vars';

export interface ParsedExpr {
  ast: ExprNode;
  vars: string[];
}

export type Env = Record<string, number>;

type TokenType = 'var' | 'const' | 'not' | 'and' | 'or' | 'xor' | '(' | ')' | 'post';

interface Token {
  t: TokenType;
  v?: string | number;
  pos: number;
}

const WORDS: Record<string, TokenType> = { NOT: 'not', AND: 'and', OR: 'or', XOR: 'xor' };
const SYMBOLS: Record<string, TokenType> = {
  '¬': 'not', '!': 'not', '~': 'not',
  '∧': 'and', '&': 'and', '·': 'and', '*': 'and', '⋅': 'and',
  '∨': 'or', '|': 'or', '+': 'or',
  '⊕': 'xor', '^': 'xor',
  '(': '(', ')': ')', "'": 'post', '’': 'post',
};

export class ExprError extends Error {
  code: ExprErrorCode;
  pos: number;
  constructor(code: ExprErrorCode, pos: number) {
    super(code);
    this.code = code;
    this.pos = pos;
  }
}

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '0' || ch === '1') {
      out.push({ t: 'const', v: Number(ch), pos: i });
      i++;
      continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z]/.test(src[j])) j++;
      const word = src.slice(i, j).toUpperCase();
      if (WORDS[word]) out.push({ t: WORDS[word], pos: i });
      else for (let k = i; k < j; k++) out.push({ t: 'var', v: src[k].toUpperCase(), pos: k });
      i = j;
      continue;
    }
    if (SYMBOLS[ch]) {
      out.push({ t: SYMBOLS[ch], pos: i });
      i++;
      continue;
    }
    throw new ExprError('char', i);
  }
  return out;
}

/** Ifodani o'qiydi: { ast, vars } (vars — alifbo tartibida). Xatoda ExprError (code, pos). */
export function parseExpr(src: string): ParsedExpr {
  const tokens = tokenize(String(src));
  if (!tokens.length) throw new ExprError('empty', 0);
  let i = 0;
  const peek = (): Token | undefined => tokens[i];
  const end = () => tokens[tokens.length - 1].pos + 1;
  const startsOperand = (tok: Token | undefined) =>
    !!tok && (tok.t === 'var' || tok.t === 'const' || tok.t === '(' || tok.t === 'not');

  function or(): ExprNode {
    let left = xor();
    while (peek()?.t === 'or') {
      i++;
      left = { op: 'or', a: left, b: xor() };
    }
    return left;
  }
  function xor(): ExprNode {
    let left = and();
    while (peek()?.t === 'xor') {
      i++;
      left = { op: 'xor', a: left, b: and() };
    }
    return left;
  }
  function and(): ExprNode {
    let left = unary();
    for (;;) {
      if (peek()?.t === 'and') {
        i++;
        left = { op: 'and', a: left, b: unary() };
      } else if (startsOperand(peek())) {
        left = { op: 'and', a: left, b: unary() }; // yonma-yon: AB = A ∧ B
      } else return left;
    }
  }
  function unary(): ExprNode {
    if (peek()?.t === 'not') {
      i++;
      return { op: 'not', a: unary() };
    }
    let node = atom();
    while (peek()?.t === 'post') {
      i++;
      node = { op: 'not', a: node };
    }
    return node;
  }
  function atom(): ExprNode {
    const tok = peek();
    if (!tok) throw new ExprError('end', end());
    if (tok.t === 'var') {
      i++;
      return { op: 'var', v: String(tok.v) };
    }
    if (tok.t === 'const') {
      i++;
      return { op: 'const', v: tok.v === 1 ? 1 : 0 };
    }
    if (tok.t === '(') {
      i++;
      const inner = or();
      if (peek()?.t !== ')') throw new ExprError('paren', peek()?.pos ?? end());
      i++;
      return inner;
    }
    throw new ExprError('unexpected', tok.pos);
  }

  const ast = or();
  if (i < tokens.length) throw new ExprError('unexpected', tokens[i].pos);
  const vars = [...collectVars(ast, new Set<string>())].sort();
  if (vars.length > MAX_VARS) throw new ExprError('vars', 0);
  return { ast, vars };
}

function collectVars(node: ExprNode, set: Set<string>): Set<string> {
  if (node.op === 'var') set.add(node.v);
  else if (node.op === 'not') collectVars(node.a, set);
  else if (node.op !== 'const') {
    collectVars(node.a, set);
    collectVars(node.b, set);
  }
  return set;
}

/** Qiymat: env — { A: 0|1, ... }. */
export function evalExpr(node: ExprNode, env: Env): number {
  switch (node.op) {
    case 'var':
      return env[node.v] ? 1 : 0;
    case 'const':
      return node.v;
    case 'not':
      return 1 - evalExpr(node.a, env);
    case 'and':
      return evalExpr(node.a, env) & evalExpr(node.b, env);
    case 'or':
      return evalExpr(node.a, env) | evalExpr(node.b, env);
    default:
      return evalExpr(node.a, env) ^ evalExpr(node.b, env);
  }
}

/** Kirishlarning barcha qiymatlari: 00…0 dan 11…1 gacha (birinchi o'zgaruvchi — katta bit). */
export function rowsOf(vars: string[]): Env[] {
  const rows: Env[] = [];
  for (let r = 0; r < 1 << vars.length; r++) {
    const env: Env = {};
    vars.forEach((v, k) => (env[v] = (r >> (vars.length - 1 - k)) & 1));
    rows.push(env);
  }
  return rows;
}

/** Haqiqat jadvali: { vars, rows: [{ env, q }] }. */
export function truthTableOf(src: string): { vars: string[]; rows: { env: Env; q: number }[] } {
  const { ast, vars } = parseExpr(src);
  return { vars, rows: rowsOf(vars).map((env) => ({ env, q: evalExpr(ast, env) })) };
}

/** Ikki ifoda tengmi: { equal, vars, counter } — counter: farq qiladigan birinchi qator (yoki null). */
export function compareExprs(a: string, b: string): { equal: boolean; vars: string[]; counter: Env | null; values: number[] | null } {
  const x = parseExpr(a);
  const y = parseExpr(b);
  const vars = [...new Set([...x.vars, ...y.vars])].sort();
  if (vars.length > MAX_VARS) throw new ExprError('vars', 0);
  for (const env of rowsOf(vars)) {
    const p = evalExpr(x.ast, env);
    const q = evalExpr(y.ast, env);
    if (p !== q) return { equal: false, vars, counter: env, values: [p, q] };
  }
  return { equal: true, vars, counter: null, values: null };
}

const escHtml = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Kalkulyator jadvali (HTML): o'zgaruvchilar ustunlari va har bir ifoda natijasi.
 * outs — [{ label, values }]; ikkita bo'lsa, farq qiladigan qatorlar belgilanadi.
 */
export function calcTableHtml(vars: string[], rows: Env[], outs: { label: string; values: number[] }[]): string {
  const head = vars.map((v) => `<th>${v}</th>`).join('') + outs.map((o) => `<th class="out">${escHtml(o.label)}</th>`).join('');
  const body = rows
    .map((env, r) => {
      const differ = outs.length > 1 && outs.some((o) => o.values[r] !== outs[0].values[r]);
      const ins = vars.map((v) => `<td>${env[v]}</td>`).join('');
      const res = outs.map((o) => `<td class="out${o.values[r] ? ' one' : ''}">${o.values[r]}</td>`).join('');
      return `<tr${differ ? ' class="differ"' : ''}>${ins}${res}</tr>`;
    })
    .join('');
  return `<table class="truth calc-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
