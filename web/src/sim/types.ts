/** Oddiy elementlar va D-trigger. */
export type BasicGateType = 'NOT' | 'AND' | 'OR' | 'XOR' | 'NAND' | 'NOR' | 'XNOR' | 'DFF';
/** Bloklar (mikrosxemalar): yechilgan darajadan olingan tayyor qurilma, bir nechta chiqishli bo'lishi mumkin. */
export type BlockType = 'HA' | 'FA' | 'MUX' | 'DEC' | 'SPLIT' | 'JOIN' | 'NOT4' | 'ADD4' | 'MUX4' | 'INC4';
export type GateType = BasicGateType | BlockType;

/** Kombinatsion elementlar. Do'stlar masalasi kodi shu tartibga bog'liq — o'zgartirmang. */
export const GATE_TYPES: GateType[] = ['NOT', 'AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR'];

/** Qum qutidagi oddiy elementlar: kombinatsion va xotira (D-trigger). Bloklar — BLOCK_TYPES. */
export const ALL_GATE_TYPES: GateType[] = [...GATE_TYPES, 'DFF'];

/** Shina oyoqlari: [boshi, kengligi] — ketma-ket oyoqlar bitta keng port (birinchisi — eng katta bit). */
export type BusSpan = [number, number];

export interface BlockDef {
  /** Kirish oyoqlari nomlari (birinchisi — jadval qatorining eng katta biti). */
  inputs: string[];
  /** Chiqish oyoqlari nomlari: 0-chiqish manbasi — `gid`, k-chiqish — `gid.k`. */
  outputs: string[];
  /**
   * Blok nima qiladi: kirish bitlari → chiqish bitlari (outputs tartibida). Hisoblashda blok ichidagi sxema
   * emas, shundan tuzilgan jadval ishlatiladi (blockTable). Xuddi shu jadvallar server/internal/sim/sim.go va
   * levels/blocks.mjs da — testlar levels.json dagi `blocks` bilan solishtiradi.
   */
  fn: (...a: number[]) => number[];
  /** Blok qaysi daraja yechilganda ochiladi (Qum qutida). */
  from: string;
  /** Shina oyoqlari (maydonda bitta keng port bo'lib chiziladi). */
  bus?: { in?: BusSpan[]; out?: BusSpan[] };
}

const num = (bits: number[]) => bits.reduce((a, b) => a * 2 + b, 0);
const bitsOf = (v: number, n: number) => Array.from({ length: n }, (_, i) => (v >> (n - 1 - i)) & 1);
const pins = (name: string) => [3, 2, 1, 0].map((i) => `${name}${i}`);
/** Son + ko'chirish: to'rt bit va eng katta (beshinchi) bit oxirida. */
const withCarry = (v: number) => {
  const b = bitsOf(v, 5);
  return [...b.slice(1), b[0]];
};

export const BLOCKS: Record<BlockType, BlockDef> = {
  // Yarim summator: S = A XOR B, C = A AND B.
  HA: { inputs: ['A', 'B'], outputs: ['S', 'C'], fn: (a, b) => [a ^ b, a & b], from: 'c1' },
  // To'liq summator: S — toq sanoq, Co — ko'pchilik.
  FA: { inputs: ['A', 'B', 'Ci'], outputs: ['S', 'Co'], fn: (a, b, c) => [(a + b + c) & 1, (a + b + c) >> 1], from: 'c6' },
  // Multipleksor: S = 0 da A, S = 1 da B.
  MUX: { inputs: ['A', 'B', 'S'], outputs: ['Q'], fn: (a, b, s) => [s ? b : a], from: 'c3' },
  // Dekoder: Yk = 1, agar 2A + B = k.
  DEC: { inputs: ['A', 'B'], outputs: ['Y0', 'Y1', 'Y2', 'Y3'], fn: (a, b) => [0, 1, 2, 3].map((k) => (k === a * 2 + b ? 1 : 0)), from: 'c4' },
  // ── Shinalar (4 bit) ──
  // Bo'laklovchi: shina → to'rt alohida bit; birlashtiruvchi — aksincha.
  SPLIT: { inputs: pins('A'), outputs: pins('A'), fn: (...a) => a, from: 'w1', bus: { in: [[0, 4]] } },
  JOIN: { inputs: pins('A'), outputs: pins('Q'), fn: (...a) => a, from: 'w1', bus: { out: [[0, 4]] } },
  NOT4: { inputs: pins('A'), outputs: pins('Q'), fn: (...a) => a.map((v) => v ^ 1), from: 'w1', bus: { in: [[0, 4]], out: [[0, 4]] } },
  ADD4: {
    inputs: [...pins('A'), ...pins('B'), 'Ci'],
    outputs: [...pins('S'), 'Co'],
    fn: (...a) => withCarry(num(a.slice(0, 4)) + num(a.slice(4, 8)) + a[8]),
    from: 'w3',
    bus: { in: [[0, 4], [4, 4]], out: [[0, 4]] },
  },
  MUX4: {
    inputs: [...pins('A'), ...pins('B'), 'S'],
    outputs: pins('Q'),
    fn: (...a) => (a[8] ? a.slice(4, 8) : a.slice(0, 4)),
    from: 'w4',
    bus: { in: [[0, 4], [4, 4]], out: [[0, 4]] },
  },
  INC4: { inputs: pins('A'), outputs: [...pins('Q'), 'C'], fn: (...a) => withCarry(num(a) + 1), from: 'w5', bus: { in: [[0, 4]], out: [[0, 4]] } },
};

const tables = new Map<BlockType, Uint8Array>();

/** Blok jadvali: r-qator (kirish bitlari, birinchisi — eng katta) → chiqishlar maskasi (k-bit — k-chiqish). */
export function blockTable(t: BlockType): Uint8Array {
  let tab = tables.get(t);
  if (!tab) {
    const b = BLOCKS[t];
    const n = b.inputs.length;
    tab = new Uint8Array(1 << n);
    for (let r = 0; r < 1 << n; r++) tab[r] = b.fn(...bitsOf(r, n)).reduce((m, v, k) => m | ((v & 1) << k), 0);
    tables.set(t, tab);
  }
  return tab;
}

/** Har chiqish jadvali o'n oltilik satr sifatida (levels.json dagi `luts` bilan solishtirish uchun). */
export function blockLuts(t: BlockType): string[] {
  const tab = blockTable(t);
  return BLOCKS[t].outputs.map((_, k) => {
    let v = 0n;
    for (let r = tab.length - 1; r >= 0; r--) v = (v << 1n) | BigInt((tab[r] >> k) & 1);
    return v.toString(16);
  });
}

export const BLOCK_TYPES = Object.keys(BLOCKS) as BlockType[];

export const isBlock = (t: GateType): t is BlockType => t in BLOCKS;

/** Kirishlar soni. */
export const GATE_ARITY: Record<GateType, number> = {
  NOT: 1,
  AND: 2,
  OR: 2,
  XOR: 2,
  NAND: 2,
  NOR: 2,
  XNOR: 2,
  // D-trigger: kirish D, chiqish Q — saqlangan qiymat; har taktda Q := D.
  DFF: 1,
  HA: 2,
  FA: 3,
  MUX: 3,
  DEC: 2,
  SPLIT: 4,
  JOIN: 4,
  NOT4: 4,
  ADD4: 9,
  MUX4: 9,
  INC4: 4,
};

/** Chiqishlar soni: oddiy elementlarda 1. */
export const gateOutputs = (t: GateType): number => (isBlock(t) ? BLOCKS[t].outputs.length : 1);

/** Manba porti: `gid` — 0-chiqish, `gid.k` — k-chiqish (faqat blokda). */
export const sourcePort = (gateId: string, k: number): string => (k === 0 ? gateId : `${gateId}.${k}`);

/** Manba portidan element id si va chiqish raqami (`in:A` uchun ham ishlaydi — id o'zi qaytadi). */
export function parseSource(s: string): { id: string; k: number } {
  const i = s.lastIndexOf('.');
  if (i < 0 || s.startsWith('in:')) return { id: s, k: 0 };
  const k = Number(s.slice(i + 1));
  return Number.isInteger(k) && k > 0 ? { id: s.slice(0, i), k } : { id: s, k: -1 };
}

export interface Gate {
  id: string;
  type: GateType;
  x: number;
  y: number;
}

/**
 * from — manba: `in:A` (kirish) yoki element id si.
 * to   — qabul qiluvchi: `out:Q` (chiqish) yoki `gid:0` / `gid:1` (element kirishi).
 */
export interface Wire {
  from: string;
  to: string;
}

export interface Circuit {
  gates: Gate[];
  wires: Wire[];
}

/** Sxema qaysi kirish/chiqishlar va qaysi elementlar bilan yig'ilishi. */
export interface Spec {
  inputs: string[];
  outputs: string[];
  gates: GateType[];
  /** Shinalar: nom → daraja oyoqlari (ketma-ket, eng katta bit birinchi) — maydonda bitta keng pin. */
  buses?: Record<string, string[]>;
}

export interface Level extends Spec {
  id: string;
  chapter: string;
  title: string;
  task: string;
  hint: string;
  goal: number;
  /** Kombinatsion masala: har bir chiqish uchun 2^n uzunlikdagi "0"/"1" qatori. */
  target?: Record<string, string>;
  /** Ketma-ket masala (xotira bilan): kerakli xatti-harakat avtomat sifatida. */
  seq?: SeqSpec;
  /** Bosqichli maslahat: 3 ★ yechim tarkibi va kirishlarga ulangan birinchi element [tur, manba...]. */
  hints?: { gates: Record<string, number>; first: string[] };
  /** Boshqa tillardagi matnlar (masalan, ru). */
  i18n?: Record<string, { title: string; task: string; hint: string }>;
}

/**
 * Ketma-ket masalaning kerakli xatti-harakati — eng kichik avtomat (Mealy), boshlang'ich holat 0.
 * Har taktda: chiqish = out[holat][qator], keyin holat = next[holat][qator].
 */
export interface Machine {
  /** next[holat][qator] — keyingi holat (qator — kirish bitlari, rowBits tartibida). */
  next: number[][];
  /** out[holat][qator] — chiqishlar qatori ("01…", outputs tartibida). */
  out: string[][];
}

export interface SeqSpec extends Machine {
  /** Vaqt diagrammasidagi namuna: har takt uchun kirishlar qatori. */
  example: number[];
}

export interface Chapter {
  id: string;
  title: string;
  description: string;
  unlockStars: number;
  i18n?: Record<string, { title: string; description: string }>;
}

export interface LevelPack {
  version: number;
  chapters: Chapter[];
  levels: Level[];
}

export const emptyCircuit = (): Circuit => ({ gates: [], wires: [] });
