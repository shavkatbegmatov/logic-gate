export type GateType = 'NOT' | 'AND' | 'OR' | 'XOR' | 'NAND' | 'NOR' | 'XNOR';

export const GATE_TYPES: GateType[] = ['NOT', 'AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR'];

export const GATE_ARITY: Record<GateType, 1 | 2> = {
  NOT: 1,
  AND: 2,
  OR: 2,
  XOR: 2,
  NAND: 2,
  NOR: 2,
  XNOR: 2,
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
  /** Har bir chiqish uchun 2^n uzunlikdagi "0"/"1" qatori. */
  target: Record<string, string>;
}

export interface Chapter {
  id: string;
  title: string;
  description: string;
  unlockStars: number;
}

export interface LevelPack {
  version: number;
  chapters: Chapter[];
  levels: Level[];
}

export const emptyCircuit = (): Circuit => ({ gates: [], wires: [] });
