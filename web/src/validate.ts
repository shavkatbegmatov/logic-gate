// Qurilmada saqlangan ma'lumotlar shaklini tekshirish. localStorage'ga eski versiya, boshqa tab yoki
// ko'chirish havolasi yozgan bo'lishi mumkin: shakli buzuq yozuv ilovani ochilishidayoq to'xtatib
// qo'ymasin — noto'g'ri qismlar tashlab yuboriladi. Ilova modullarini import qilmaydi (migrate.ts ham ishlatadi).
import { GATE_ARITY, type Circuit, type Gate, type GateType, type Wire } from './sim/types';

export type Rec = Record<string, unknown>;

export const isObj = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);

/** Obyektning o'z kaliti: `in` meros qolgan kalitlarni ham (masalan, "constructor") topib qo'yadi. */
export const hasOwn = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const isGateType = (t: unknown): t is GateType => typeof t === 'string' && hasOwn(GATE_ARITY, t);

export const asString = (v: unknown): string | null => (typeof v === 'string' ? v : null);

export const asNumber = (v: unknown): number | null => (isNum(v) ? v : null);

/** Sxema: noto'g'ri elementlar va simlar tashlanadi; sxema umuman bo'lmasa — null. */
export function cleanCircuit(v: unknown): Circuit | null {
  if (!isObj(v) || !Array.isArray(v.gates) || !Array.isArray(v.wires)) return null;
  const gates: Gate[] = [];
  for (const g of v.gates) {
    if (isObj(g) && typeof g.id === 'string' && isGateType(g.type) && isNum(g.x) && isNum(g.y)) {
      gates.push({ id: g.id, type: g.type, x: g.x, y: g.y });
    }
  }
  const wires: Wire[] = [];
  for (const w of v.wires) {
    if (isObj(w) && typeof w.from === 'string' && typeof w.to === 'string') wires.push({ from: w.from, to: w.to });
  }
  return { gates, wires };
}

/** Kalit → yozuv to'plami; clean null qaytargan yozuvlar tashlanadi. Obyekt bo'lmasa — null. */
export function cleanRecord<T>(v: unknown, clean: (x: unknown) => T | null): Record<string, T> | null {
  if (!isObj(v)) return null;
  const out: Record<string, T> = {};
  for (const [k, x] of Object.entries(v)) {
    if (k === '__proto__') continue;
    const c = clean(x);
    if (c !== null) out[k] = c;
  }
  return out;
}

/** Ro'yxat; clean null qaytargan elementlar tashlanadi. Massiv bo'lmasa — null. */
export function cleanList<T>(v: unknown, clean: (x: unknown) => T | null): T[] | null {
  if (!Array.isArray(v)) return null;
  const out: T[] = [];
  for (const x of v) {
    const c = clean(x);
    if (c !== null) out.push(c);
  }
  return out;
}

export interface Result {
  stars: number;
  gates: number;
  circuit: Circuit;
  at: number;
  synced: boolean;
}

/**
 * Daraja yoki kunlik masala natijasi. Sxemasi buzuq natija ham qoladi (yulduzlar yo'qolmasin) — bo'sh
 * sxema bilan.
 */
export function cleanResult(v: unknown): Result | null {
  if (!isObj(v) || !isNum(v.stars) || !isNum(v.gates)) return null;
  return {
    stars: v.stars,
    gates: v.gates,
    circuit: cleanCircuit(v.circuit) ?? { gates: [], wires: [] },
    at: isNum(v.at) ? v.at : 0,
    synced: v.synced === true,
  };
}

/** Sxemasiz natija (kunlik mashq, do'stlar masalasi): elementlar soni va yulduzlar shart. */
export function cleanScore(v: unknown): Rec | null {
  if (!isObj(v) || !isNum(v.stars) || !isNum(v.gates)) return null;
  const out: Rec = { gates: v.gates, stars: v.stars, at: isNum(v.at) ? v.at : 0 };
  if (isNum(v.goal)) out.goal = v.goal;
  return out;
}
