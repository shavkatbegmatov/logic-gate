// Sinf musobaqasi (mijoz tomoni): davom etayotgan musobaqalar (o'quvchi a'zo bo'lgan sinflarda), taymer
// va musobaqa darajalaridagi qoralamalar. Vaqt server javobidagi «qolgan soniyalar» dan hisoblanadi —
// qurilma soati noto'g'ri bo'lsa ham taymer to'g'ri.
import { signal } from '@preact/signals';
import type { ClassInfo, Contest } from './api';
import type { Circuit } from './sim/types';

/** O'qituvchi tanlaydigan davomiylik (daqiqa). Server: 3–120. */
export const CONTEST_MINUTES = [5, 10, 15, 20, 30, 45] as const;

export interface ActiveContest {
  code: string;
  className: string;
  contest: Contest;
  /** tugash vaqti shu qurilma soati bo'yicha (ms) */
  endsAt: number;
}

/** Tugash vaqti shu qurilma soati bo'yicha: javob kelgan payt + qolgan soniyalar. */
export const localEnd = (c: Contest, received = Date.now()) => received + c.remaining * 1000;

/** Davom etayotgan musobaqalar (bosh sahifadagi e'lon): /api/me/classes dan. */
export const activeContests = signal<ActiveContest[]>([]);

/** O'yinchi biror sinfga a'zomi: bo'lsa, bosh sahifa musobaqa boshlanganini tez-tez tekshiradi. */
export const inClass = signal(false);

export function setClassesInfo(classes: ClassInfo[], received = Date.now()) {
  inClass.value = classes.length > 0;
  activeContests.value = classes
    .filter((c) => c.contest && c.contest.remaining > 0)
    .map((c) => ({ code: c.code, className: c.name, contest: c.contest!, endsAt: localEnd(c.contest!, received) }));
}

/** Qolgan vaqt: «4:05», soatdan oshsa «1:04:05»; manfiy — 0. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** Musobaqa darajasidagi ish (sahifa ochiq turguncha): o'quvchi ro'yxatga qaytib, yana kirsa — yo'qolmasin. */
const drafts = new Map<string, Circuit>();
export const contestDraft = (contest: number, level: string) => drafts.get(`${contest}:${level}`);
export const setContestDraft = (contest: number, level: string, c: Circuit) => drafts.set(`${contest}:${level}`, c);
