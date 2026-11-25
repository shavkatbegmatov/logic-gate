// Element belgilari (ANSI ko'rinishi), 72×48 maydonda: kirish uchlari x=0 da, chiqish x=72 da.
// Faqat ma'lumot, importlarsiz: build vaqtidagi qo'llanma sahifalari (scripts/pages.mjs) ham
// shu fayldan foydalanadi — Node uni to'g'ridan-to'g'ri o'qiydi.
import type { BlockType, GateType } from '../sim/types';

export const SHAPE_W = 72;
export const SHAPE_H = 48;

const AND_BODY = 'M14,4 H34 A20,20 0 0 1 34,44 H14 Z';
const OR_BODY = 'M10,4 Q24,24 10,44 Q40,44 56,24 Q40,4 10,4 Z';
const XOR_BODY = 'M16,4 Q30,24 16,44 Q44,44 58,24 Q44,4 16,4 Z';
const XOR_BACK = 'M8,4 Q22,24 8,44';
const NOT_BODY = 'M16,6 L50,24 L16,42 Z';

export interface ShapeInfo {
  body: string;
  /** Tananing o'ng uchi (chiqish yoki inversiya doirachasi shu yerdan boshlanadi). */
  tip: number;
  bubble: boolean;
  back?: string;
}

export const SHAPES: Record<Exclude<GateType, 'DFF' | BlockType>, ShapeInfo> = {
  NOT: { body: NOT_BODY, tip: 50, bubble: true },
  AND: { body: AND_BODY, tip: 54, bubble: false },
  NAND: { body: AND_BODY, tip: 54, bubble: true },
  OR: { body: OR_BODY, tip: 56, bubble: false },
  NOR: { body: OR_BODY, tip: 56, bubble: true },
  XOR: { body: XOR_BODY, tip: 58, bubble: false, back: XOR_BACK },
  XNOR: { body: XOR_BODY, tip: 58, bubble: true, back: XOR_BACK },
};

// Barcha uchlarning y si to'r qadamiga (geometry.ts GRID = 12) karrali: element to'rga joylanadi,
// shuning uchun uchlar ham, daraja pinlari ham bir to'rda turadi va sim to'g'ri chiziq bo'la oladi.
// Karrali bo'lmasa, ro'parama-ro'para qo'yilgan elementlar orasida ham sim o'rtasida mayda pog'ona qoladi.

/**
 * Blok (mikrosxema) korpusi: balandligi va oyoqlari (y). Kenglik oddiy element bilan bir xil (72), shuning
 * uchun simlar va to'r o'zgarmaydi; ko'p oyoqli blok pastga cho'ziladi. Oyoqlar to'rda (12 ga karrali).
 */
export const BLOCK_SHAPE: Record<BlockType, { h: number; ins: number[]; outs: number[] }> = {
  HA: { h: 48, ins: [12, 36], outs: [12, 36] },
  FA: { h: 72, ins: [12, 36, 60], outs: [24, 48] },
  MUX: { h: 72, ins: [12, 36, 60], outs: [36] },
  DEC: { h: 96, ins: [36, 60], outs: [12, 36, 60, 84] },
  // Shina oyoqlari bitta uchda (bus.ts): to'rt bit — bitta keng port.
  SPLIT: { h: 96, ins: [48, 48, 48, 48], outs: [12, 36, 60, 84] },
  JOIN: { h: 96, ins: [12, 36, 60, 84], outs: [48, 48, 48, 48] },
  NOT4: { h: 48, ins: [24, 24, 24, 24], outs: [24, 24, 24, 24] },
  ADD4: { h: 72, ins: [12, 12, 12, 12, 36, 36, 36, 36, 60], outs: [24, 24, 24, 24, 48] },
  MUX4: { h: 72, ins: [12, 12, 12, 12, 36, 36, 36, 36, 60], outs: [36, 36, 36, 36] },
  INC4: { h: 48, ins: [24, 24, 24, 24], outs: [12, 12, 12, 12, 36] },
  NOR4: { h: 48, ins: [24, 24, 24, 24], outs: [24] },
  // Doimiy manba: kirish oyog'i yo'q.
  ONE: { h: 48, ins: [], outs: [24] },
  ZERO: { h: 48, ins: [], outs: [24] },
  SUB4: { h: 48, ins: [12, 12, 12, 12, 36, 36, 36, 36], outs: [12, 12, 12, 12, 36] },
  AND4: { h: 48, ins: [12, 12, 12, 12, 36, 36, 36, 36], outs: [24, 24, 24, 24] },
  OR4: { h: 48, ins: [12, 12, 12, 12, 36, 36, 36, 36], outs: [24, 24, 24, 24] },
  XOR4: { h: 48, ins: [12, 12, 12, 12, 36, 36, 36, 36], outs: [24, 24, 24, 24] },
  ALU4: { h: 96, ins: [12, 12, 12, 12, 36, 36, 36, 36, 60, 84], outs: [24, 24, 24, 24, 48, 72] },
  // Xotirali bloklar: yuqorida ma'lumot (D), pastda boshqaruv (LD yoki J), chiqish o'rtada.
  REG1: { h: 48, ins: [12, 36], outs: [24] },
  REG4: { h: 48, ins: [12, 12, 12, 12, 36], outs: [24, 24, 24, 24] },
  PC4: { h: 48, ins: [12, 12, 12, 12, 36], outs: [24, 24, 24, 24] },
};

/** Korpusdagi yozuv: doimiy manbada — qiymatning o'zi (1 yoki 0), qolganlarida — turi. */
export const blockText = (type: GateType): string => (type === 'ONE' ? '1' : type === 'ZERO' ? '0' : type);

/** Blok korpusi x bo'yicha: oyoqlar uchun ikki chetda joy qoladi. */
export const BLOCK_BODY = { x: 12, w: 48, rx: 4 };

const blockShape = (type: GateType) => (type in BLOCK_SHAPE ? BLOCK_SHAPE[type as BlockType] : null);

/** Element balandligi: oddiy elementlar 48, bloklar oyoqlariga qarab. */
export const gateHeight = (type: GateType): number => blockShape(type)?.h ?? SHAPE_H;

/** Kirish uchlari (y koordinatalari): NOT — o'rtada, D-trigger — yuqorida (D), qolganlari — ikkita. */
export const inputLeads = (type: GateType): number[] =>
  blockShape(type)?.ins ?? (type === 'NOT' ? [24] : type === 'DFF' ? [12] : [12, 36]);

/** Chiqish uchlari (y): blokda bir nechta, qolganlarida bitta (outputY). */
export const outputLeads = (type: GateType): number[] => blockShape(type)?.outs ?? [type === 'DFF' ? 12 : 24];

/** 0-chiqish uchi (y): D-trigger'da Q yuqorida, D bilan bir chiziqda (standart belgi); qolganlarida o'rtada. */
export const outputY = (type: GateType): number => outputLeads(type)[0];

/** Kirish uchining tana bilan uchrashadigan x nuqtasi. */
export const leadEnd = (type: GateType): number =>
  blockShape(type) ? BLOCK_BODY.x : type === 'NOT' ? 18 : type === 'DFF' ? 14 : 20;

/**
 * D-trigger: to'rtburchak; D kirishi va Q chiqishi yuqorida, takt belgisi (uchburchak) chap qirraning
 * pastki qismida — standart belgidagi takt kirishi o'rnida (y 29…39, yumaloq burchakka tegmaydi).
 * Takt hamma triggerlar uchun umumiy, shuning uchun uning simi yo'q.
 */
export const DFF_BODY = { x: 14, y: 4, w: 44, h: 40, rx: 5, clock: 'M14,29 L21,34 L14,39', out: 58 };
