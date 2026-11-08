// Element belgilari (ANSI ko'rinishi), 72×48 maydonda: kirish uchlari x=0 da, chiqish x=72 da.
// Faqat ma'lumot, importlarsiz: build vaqtidagi qo'llanma sahifalari (scripts/pages.mjs) ham
// shu fayldan foydalanadi — Node uni to'g'ridan-to'g'ri o'qiydi.
import type { GateType } from '../sim/types';

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

export const SHAPES: Record<Exclude<GateType, 'DFF'>, ShapeInfo> = {
  NOT: { body: NOT_BODY, tip: 50, bubble: true },
  AND: { body: AND_BODY, tip: 54, bubble: false },
  NAND: { body: AND_BODY, tip: 54, bubble: true },
  OR: { body: OR_BODY, tip: 56, bubble: false },
  NOR: { body: OR_BODY, tip: 56, bubble: true },
  XOR: { body: XOR_BODY, tip: 58, bubble: false, back: XOR_BACK },
  XNOR: { body: XOR_BODY, tip: 58, bubble: true, back: XOR_BACK },
};

/** Kirish uchlari (y koordinatalari): NOT — o'rtada, D-trigger — yuqorida (D), qolganlari — ikkita. */
export const inputLeads = (type: GateType): number[] => (type === 'NOT' ? [24] : type === 'DFF' ? [14] : [14, 34]);

/** Chiqish uchi (y): D-trigger'da Q yuqorida, D bilan bir chiziqda (standart belgi); qolganlarida o'rtada. */
export const outputY = (type: GateType): number => (type === 'DFF' ? 14 : 24);

/** Kirish uchining tana bilan uchrashadigan x nuqtasi. */
export const leadEnd = (type: GateType): number => (type === 'NOT' ? 18 : type === 'DFF' ? 14 : 20);

/**
 * D-trigger: to'rtburchak; D kirishi va Q chiqishi yuqorida, takt belgisi (uchburchak) chap qirraning
 * pastki qismida — standart belgidagi takt kirishi o'rnida (y 29…39, yumaloq burchakka tegmaydi).
 * Takt hamma triggerlar uchun umumiy, shuning uchun uning simi yo'q.
 */
export const DFF_BODY = { x: 14, y: 4, w: 44, h: 40, rx: 5, clock: 'M14,29 L21,34 L14,39', out: 58 };
