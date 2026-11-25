/** Oddiy elementlar va D-trigger. */
export type BasicGateType = 'NOT' | 'AND' | 'OR' | 'XOR' | 'NAND' | 'NOR' | 'XNOR' | 'DFF';
/** Bloklar (mikrosxemalar): yechilgan darajadan olingan tayyor qurilma, bir nechta chiqishli bo'lishi mumkin. */
export type BlockType = 'HA' | 'FA' | 'MUX' | 'DEC';
export type GateType = BasicGateType | BlockType;

/** Kombinatsion elementlar. Do'stlar masalasi kodi shu tartibga bog'liq — o'zgartirmang. */
export const GATE_TYPES: GateType[] = ['NOT', 'AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR'];

/** Qum qutidagi oddiy elementlar: kombinatsion va xotira (D-trigger). Bloklar — BLOCK_TYPES. */
export const ALL_GATE_TYPES: GateType[] = [...GATE_TYPES, 'DFF'];

export interface BlockDef {
  /** Kirish oyoqlari nomlari (birinchisi — jadval qatorining eng katta biti). */
  inputs: string[];
  /** Chiqish oyoqlari nomlari: 0-chiqish manbasi — `gid`, k-chiqish — `gid.k`. */
  outputs: string[];
  /**
   * Har chiqish uchun haqiqat jadvali bitmaskasi: r-bit — r-qatordagi qiymat (r = kirish bitlari,
   * birinchi kirish eng katta bit). Hisoblashda blok ichidagi sxema emas, shu jadval ishlatiladi.
   * Xuddi shu jadvallar server/internal/sim/sim.go va levels/blocks.mjs da — testlar solishtiradi.
   */
  luts: number[];
  /** Blok qaysi daraja yechilganda ochiladi (Qum qutida). */
  from: string;
}

export const BLOCKS: Record<BlockType, BlockDef> = {
  // Yarim summator: S = A XOR B, C = A AND B.
  HA: { inputs: ['A', 'B'], outputs: ['S', 'C'], luts: [0b0110, 0b1000], from: 'c1' },
  // To'liq summator: S — toq sanoq, Co — ko'pchilik.
  FA: { inputs: ['A', 'B', 'Ci'], outputs: ['S', 'Co'], luts: [0x96, 0xe8], from: 'c6' },
  // Multipleksor: S = 0 da A, S = 1 da B.
  MUX: { inputs: ['A', 'B', 'S'], outputs: ['Q'], luts: [0xd8], from: 'c3' },
  // Dekoder: Yk = 1, agar 2A + B = k.
  DEC: { inputs: ['A', 'B'], outputs: ['Y0', 'Y1', 'Y2', 'Y3'], luts: [0b0001, 0b0010, 0b0100, 0b1000], from: 'c4' },
};

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
