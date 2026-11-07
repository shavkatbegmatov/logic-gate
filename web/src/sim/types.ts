export type GateType = 'NOT' | 'AND' | 'OR' | 'XOR' | 'NAND' | 'NOR' | 'XNOR' | 'DFF';

/** Kombinatsion elementlar. Do'stlar masalasi kodi shu tartibga bog'liq — o'zgartirmang. */
export const GATE_TYPES: GateType[] = ['NOT', 'AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR'];

/** Qum qutidagi barcha elementlar: kombinatsion va xotira (D-trigger). */
export const ALL_GATE_TYPES: GateType[] = [...GATE_TYPES, 'DFF'];

export const GATE_ARITY: Record<GateType, 1 | 2> = {
  NOT: 1,
  AND: 2,
  OR: 2,
  XOR: 2,
  NAND: 2,
  NOR: 2,
  XNOR: 2,
  // D-trigger: kirish D, chiqish Q — saqlangan qiymat; har taktda Q := D.
  DFF: 1,
};

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
