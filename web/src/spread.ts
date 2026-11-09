/** Yechimlar taqsimoti: nechta o'yinchi necha element ishlatgan (har birining eng yaxshi yechimi). */

/** Serverdan: [element soni, o'yinchilar], element soni o'sib boradi. */
export type Spread = [number, number][];

export interface SpreadCol {
  /** Ustun tagidagi yozuv: "4" yoki oxirgi umumlashgan ustun uchun "12+". */
  label: string;
  count: number;
  mine: boolean;
}

export interface SpreadView {
  cols: SpreadCol[];
  total: number;
  /** Sizdan kamroq element bilan yechganlar. */
  fewer: number;
}

/** Ustunlar ko'pi bilan shuncha: telefonda ham sig'adi. */
export const MAX_COLS = 10;

/**
 * Taqsimotni ustunlarga aylantiradi: eng kamidan boshlab har bir element soni alohida ustun
 * (oradagi bo'sh sonlar ham — shakl to'g'ri ko'rinsin), ortiqchasi oxirgi "N+" ustunga yig'iladi.
 * Solishtirish uchun kamida 2 o'yinchi kerak, aks holda null.
 */
export function spreadView(spread: Spread | undefined, mine: number, maxCols = MAX_COLS): SpreadView | null {
  if (!spread?.length) return null;
  const total = spread.reduce((s, [, n]) => s + n, 0);
  if (total < 2) return null;
  const min = spread[0][0];
  const max = spread[spread.length - 1][0];
  const capped = max - min + 1 > maxCols;
  const last = capped ? min + maxCols - 1 : max;
  const cols: SpreadCol[] = [];
  for (let g = min; g <= last; g++) {
    const tail = capped && g === last;
    const count = spread.filter(([x]) => (tail ? x >= g : x === g)).reduce((s, [, n]) => s + n, 0);
    cols.push({ label: tail ? `${g}+` : String(g), count, mine: tail ? mine >= g : mine === g });
  }
  const fewer = spread.filter(([x]) => x < mine).reduce((s, [, n]) => s + n, 0);
  return { cols, total, fewer };
}

/** Ulush foizda: 0 dan katta bo'lsa kamida "<1%". */
export function percent(part: number, total: number): string {
  if (!total || !part) return '0%';
  const p = Math.round((part / total) * 100);
  return p < 1 ? '<1%' : `${p}%`;
}
