// Darajalar xaritasi: bo'lim ichidagi darajalar "ilon" tartibida — 1-qator chapdan o'ngga, 2-qator
// o'ngdan chapga... Shunda har bir daraja keyingisiga qisqa yo'l bilan ulanadi (o'ngga, chapga yoki
// pastga), yechilganda signal shu yo'ldan keyingi darajaga "oqadi".
import { signal } from '@preact/signals';
import { load, save } from './storage';

export type Link = 'r' | 'l' | 'd' | null;

/** Plitka eng kam kengligi va oralig'i (styles.css dagi .level-map bilan bir xil). */
export const TILE_MIN = 118;
export const TILE_GAP = 18;

/**
 * Ustunlar soni: sig'adiganining eng kattasi, iloji bo'lsa darajalar soniga bo'linadigan
 * (6 ta daraja: 6, 3 yoki 2 ustun — qatorlar to'la bo'lsin).
 */
export function mapColumns(width: number, n: number): number {
  const fit = Math.max(2, Math.min(n, Math.floor((width + TILE_GAP) / (TILE_MIN + TILE_GAP))));
  for (let c = fit; c >= 2; c--) if (n % c === 0) return c;
  return fit;
}

/** i-darajaning joyi (1 dan) va keyingisiga yo'l yo'nalishi. */
export function mapCell(i: number, n: number, cols: number): { row: number; col: number; link: Link } {
  const row = Math.floor(i / cols);
  const k = i % cols;
  const ltr = row % 2 === 0;
  const col = ltr ? k : cols - 1 - k;
  let link: Link = null;
  if (i < n - 1) link = k === cols - 1 ? 'd' : ltr ? 'r' : 'l';
  return { row: row + 1, col: col + 1, link };
}

const KEY = 'lg.mapSeen.v1';

/** Xaritada allaqachon "yonib bo'lgan" yechimlar: yangilari bir marta animatsiya bilan yonadi. */
export const mapSeen = signal<string[]>(load(KEY, []));

export function markMapSeen(ids: string[]) {
  const next = [...new Set([...mapSeen.value, ...ids])];
  if (next.length === mapSeen.value.length) return;
  mapSeen.value = next;
  save(KEY, next);
}
