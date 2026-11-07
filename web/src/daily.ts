// Kunlik boshqotirma: serverdan bugungi masala, lokal natijalar tarixi va seriya.
// Masalalar faqat serverda (oldindan ko'rib qo'yib bo'lmaydi); bugungisi oflayn davom ettirish uchun keshlanadi.
import { computed, effect, signal } from '@preact/signals';
import { api, ApiError, type DailyInfo, type DailySolveResult } from './api';
import { t } from './i18n';
import type { Circuit, Level } from './sim/types';
import { profile } from './state';
import { load, save } from './storage';
import { exampleFor } from './sim/sim';

const KEYS = { history: 'lg.daily.v1', puzzle: 'lg.dailyPuzzle.v1' };
const HISTORY_DAYS = 400;

export interface DailyResult {
  gates: number;
  stars: number;
  circuit: Circuit;
  at: number;
  synced: boolean;
}

/** Kun raqami (Toshkent bo'yicha 1970-01-01 dan beri) → eng yaxshi natija. */
export const dailyHistory = signal<Record<string, DailyResult>>(load(KEYS.history, {}));
effect(() => save(KEYS.history, dailyHistory.value));

/** Server aytgan seriya (boshqa qurilmadagi natijalarni ham hisobga oladi); includesToday — bugungisi ichidami. */
export const serverStreak = signal<{ day: number; streak: number; includesToday: boolean } | null>(null);

/** Toshkent vaqti bo'yicha kun raqami (serverdagi levels.DayOf bilan bir xil). */
export function dayOf(ms: number): number {
  return Math.floor((ms / 1000 + 5 * 3600) / 86400);
}

export const today = () => dayOf(Date.now());

/** Joriy kun signal sifatida: yarim tunda va sahifaga qaytilganda yangilanadi (seriya va karta uchun). */
export const todaySig = signal(today());
if (typeof window !== 'undefined') {
  const tick = () => {
    if (todaySig.value !== today()) todaySig.value = today();
  };
  const schedule = () => {
    const nextStart = (today() + 1) * 86400000 - 5 * 3600 * 1000;
    setTimeout(() => {
      tick();
      schedule();
    }, Math.max(1000, nextStart - Date.now() + 1000));
  };
  schedule();
  addEventListener('visibilitychange', () => document.visibilityState === 'visible' && tick());
}

/** Kun boshlanishidan (Toshkent yarim tunidan) beri yoki oldin — sana matni: "7-noyabr". */
export function dayLabel(day: number): string {
  const d = new Date(day * 86400000);
  return t.daily.date(d.getUTCDate(), d.getUTCMonth());
}

/** today yoki kechadan orqaga uzluksiz yechilgan kunlar (serverdagi DailyStreak bilan bir xil). */
export function streakFrom(days: number[], now: number): number {
  const set = new Set(days);
  let d = set.has(now) ? now : now - 1;
  let n = 0;
  while (set.has(d)) {
    n++;
    d--;
  }
  return n;
}

export const streak = computed(() => {
  const now = todaySig.value;
  const local = streakFrom(Object.keys(dailyHistory.value).map(Number), now);
  const s = serverStreak.value;
  if (!s || s.day !== now) return local;
  // Bugun lokal yechilgan, lekin server hali bilmasa (oflayn) — bugungi kun qo'shiladi.
  const extra = dailyHistory.value[now] && !s.includesToday ? 1 : 0;
  return Math.max(local, s.streak + extra);
});

export function recordDaily(day: number, circuit: Circuit, gates: number, stars: number) {
  const prev = dailyHistory.value[day];
  const improved = !prev || gates < prev.gates;
  if (improved) {
    const next: Record<string, DailyResult> = { ...dailyHistory.value, [day]: { gates, stars, circuit, at: Date.now(), synced: false } };
    for (const k of Object.keys(next)) if (Number(k) < day - HISTORY_DAYS) delete next[k];
    dailyHistory.value = next;
  }
  return { improved, prev };
}

function markDailySynced(day: number) {
  const r = dailyHistory.value[day];
  if (r && !r.synced) dailyHistory.value = { ...dailyHistory.value, [day]: { ...r, synced: true } };
}

/** Masalani o'yindagi daraja ko'rinishiga keltiradi (maydon va tekshiruv uchun). */
export function puzzleLevel(info: DailyInfo): Level {
  const p = info.puzzle;
  return {
    id: `daily-${info.day}`,
    chapter: 'daily',
    title: t.daily.title,
    task: p.seq ? t.daily.taskSeq(p.outputs) : t.daily.task(p.outputs),
    hint: p.seq ? t.daily.strategySeq : t.daily.strategy(p.outputs.length),
    hints: p.hint,
    inputs: p.inputs,
    outputs: p.outputs,
    gates: p.gates,
    goal: p.goal,
    target: p.target,
    seq: p.seq && { ...p.seq, example: exampleFor(p.seq) },
  };
}

export function dailyShareText(info: DailyInfo, gates: number, stars: number, streakDays: number): string {
  const s = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  return t.daily.share(info.number, dayLabel(info.day), s, gates, info.puzzle.goal, streakDays);
}

/** Bugungi masala: serverdan, aloqa bo'lmasa — bugun olingan kesh. */
export async function fetchDaily(): Promise<DailyInfo> {
  try {
    const info = await api.daily();
    save(KEYS.puzzle, info);
    if (profile.value) serverStreak.value = { day: info.day, streak: info.streak, includesToday: !!info.me };
    if (info.me) mergeServerResult(info.day, info.me.gates, info.me.stars);
    return info;
  } catch (e) {
    const cached = load<DailyInfo | null>(KEYS.puzzle, null);
    if (cached && cached.day === today()) return cached;
    throw e;
  }
}

// Boshqa qurilmada yaxshiroq yechilgan bo'lsa: sxemasi yo'q, lekin natija tarixda ko'rinadi.
function mergeServerResult(day: number, gates: number, stars: number) {
  const local = dailyHistory.value[day];
  if (!local || gates < local.gates) {
    dailyHistory.value = { ...dailyHistory.value, [day]: { gates, stars, circuit: local?.circuit ?? { gates: [], wires: [] }, at: Date.now(), synced: true } };
  } else if (gates === local.gates) {
    markDailySynced(day);
  }
}

/**
 * Kun natijasini serverga yuboradi: har doim qurilmadagi eng yaxshi sxema (yo'q bo'lsa — fallback).
 * Server eng yaxshisini bilgandagina "yuborilgan" deb belgilanadi — yomonroq urinish rekordni yashirmaydi.
 * Profil yoki aloqa bo'lmasa — null (natija lokal saqlangan).
 */
export async function submitDaily(day: number, fallback?: Circuit): Promise<DailySolveResult | null> {
  if (!profile.value) return null;
  const local = dailyHistory.value[day];
  const circuit = local?.circuit.gates.length ? local.circuit : fallback;
  if (!circuit) return null;
  try {
    const res = await api.solveDaily(day, circuit);
    if (!local || res.best.gates <= local.gates) markDailySynced(day);
    serverStreak.value = { day: todaySig.value, streak: res.streak, includesToday: !!res.todaySolved };
    return res;
  } catch (e) {
    // Server rad etsa (kun yopilgan), qayta-qayta yubormaslik uchun belgilanadi.
    if (e instanceof ApiError && (e.status === 409 || e.status === 422)) markDailySynced(day);
    return null;
  }
}

/** Ilova ochilganda: bugungi va kechagi yuborilmagan natijalar jo'natiladi. */
export async function syncDaily() {
  if (!profile.value) return;
  const now = today();
  for (const day of [now - 1, now]) {
    const r = dailyHistory.value[day];
    if (r && !r.synced && r.circuit.gates.length) await submitDaily(day, r.circuit);
  }
}

export function resetDaily() {
  dailyHistory.value = {};
  serverStreak.value = null;
  save(KEYS.puzzle, null);
}
