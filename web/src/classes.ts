// Sinf rejimi (mijoz tomoni). O'qituvchi yaratgan sinflar — shu qurilmada: kod, nom va o'qituvchi
// kaliti (serverda faqat xeshi; kalit yo'qolsa, hisobotni ochib bo'lmaydi — shuning uchun ekranda
// ko'rsatiladi va boshqa qurilmaga ko'chirsa bo'ladi).
import { signal } from '@preact/signals';
import { api, type ClassMember } from './api';
import { dayOf } from './daily';
import { chapterLevels, chapters, levels } from './levels';
import { profile } from './state';
import { load, save } from './storage';
import { myTasks, setMyTasks, tasksFromClasses } from './tasks';
import { cleanList, isNum, isObj } from './validate';

export interface TeacherClass {
  code: string;
  name: string;
  key: string;
  createdAt: number;
}

const KEY = 'lg.teacher.v1';

const cleanClass = (v: unknown): TeacherClass | null =>
  isObj(v) && typeof v.code === 'string' && typeof v.key === 'string'
    ? { code: v.code, key: v.key, name: typeof v.name === 'string' ? v.name : '', createdAt: isNum(v.createdAt) ? v.createdAt : 0 }
    : null;

export const teacherClasses = signal<TeacherClass[]>(load(KEY, [], (v) => cleanList(v, cleanClass)));

export function saveTeacherClass(c: TeacherClass) {
  teacherClasses.value = [c, ...teacherClasses.value.filter((x) => x.code !== c.code)];
  save(KEY, teacherClasses.value);
}

export function forgetTeacherClass(code: string) {
  teacherClasses.value = teacherClasses.value.filter((x) => x.code !== code);
  save(KEY, teacherClasses.value);
}

/** Qurilmani tozalash (Sozlamalar → «Progressni o'chirish»): kalitlar keyingi foydalanuvchiga qolmasin. */
export function forgetAllTeacherClasses() {
  teacherClasses.value = [];
  save(KEY, null);
}

/** Boshqa qurilmadan (Telegram bulutidan) kelgan sinflar: bu yerda yo'qlari ro'yxat oxiriga qo'shiladi. */
export function mergeTeacherClasses(incoming: TeacherClass[]) {
  const have = new Set(teacherClasses.value.map((c) => c.code));
  const added = incoming.filter((c) => !have.has(c.code));
  if (!added.length) return;
  teacherClasses.value = [...teacherClasses.value, ...added];
  save(KEY, teacherClasses.value);
}

/** Telegram CloudStorage'da bitta qiymat ko'pi bilan 4096 belgi. */
const CLOUD_LIMIT = 4096;

/**
 * Sinflar Telegram bulutiga ixcham ko'rinishda: [kod, kalit, nom, yaratilgan (sekund)]. Sig'masa, eng
 * eskilari (ro'yxat oxiri) tushib qoladi — ular shu qurilmada baribir saqlanadi.
 */
export function encodeTeacherClasses(list: TeacherClass[]): string {
  const rows = list.map((c) => [c.code, c.key, c.name, Math.floor(c.createdAt / 1000)]);
  let out = JSON.stringify(rows);
  while (out.length > CLOUD_LIMIT && rows.length) {
    rows.pop();
    out = JSON.stringify(rows);
  }
  return out;
}

export function decodeTeacherClasses(raw: string | null): TeacherClass[] {
  try {
    const rows: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((r): r is [string, string, string, number] =>
        Array.isArray(r) && typeof r[0] === 'string' && typeof r[1] === 'string' && typeof r[2] === 'string' && typeof r[3] === 'number')
      .filter(([code]) => normalizeClassCode(code) === code)
      .map(([code, key, name, at]) => ({ code, key, name, createdAt: at * 1000 }));
  } catch {
    return [];
  }
}

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Sinf kodi (6 belgi): kichik harf, bo'shliq, O→0, I/L→1 — server bilan bir xil; noto'g'ri bo'lsa ''. */
export function normalizeClassCode(s: string): string {
  let out = '';
  for (let ch of s.toUpperCase()) {
    if (ch === '-' || ch === ' ') continue;
    if (ch === 'O') ch = '0';
    if (ch === 'I' || ch === 'L') ch = '1';
    if (!ALPHABET.includes(ch)) return '';
    out += ch;
  }
  return out.length === 6 ? out : '';
}

let lastTasksFetch = 0;

/**
 * O'quvchi vazifalarini serverdan yangilaydi (bosh sahifa ochilganda — ko'pi bilan daqiqada bir marta;
 * sinfga qo'shilish/chiqishdan keyin — darhol). Profil yo'q bo'lsa ro'yxat tozalanadi.
 */
export async function refreshMyTasks(force = false) {
  if (!profile.value) {
    if (myTasks.value.length) setMyTasks([]);
    return;
  }
  if (!force && Date.now() - lastTasksFetch < 60_000) return;
  lastTasksFetch = Date.now();
  try {
    setMyTasks(tasksFromClasses((await api.myClasses()).classes));
  } catch {
    // oflayn — saqlangan ro'yxat qoladi
  }
}

/** O'quvchilar uchun havola (sayt). */
export const classLink = (code: string, origin = location.origin) => `${origin}/#/class/${code}`;

/** O'qituvchi hisobotidagi o'quvchi qatori: jami, bo'limlar bo'yicha, oxirgi faollik. */
export interface MemberSummary {
  member: ClassMember;
  stars: number;
  solved: number;
  /** har bir bo'lim: yechilgan / jami */
  chapters: { solved: number; total: number; stars: number }[];
  /** necha kun oldin kirgan (0 — bugun): Toshkent vaqti bo'yicha kalendar kunlari, 24 soatlar emas */
  seenDays: number;
}

export function summarize(m: ClassMember, now: number): MemberSummary {
  let stars = 0;
  let solved = 0;
  for (const l of levels) {
    const s = m.levels[l.id];
    if (s) {
      stars += s;
      solved++;
    }
  }
  return {
    member: m,
    stars,
    solved,
    chapters: chapters.map((ch) => {
      const list = chapterLevels(ch.id);
      const got = list.filter((l) => m.levels[l.id]);
      return { solved: got.length, total: list.length, stars: got.reduce((s, l) => s + m.levels[l.id], 0) };
    }),
    // Kecha 23:00 da kirgan o'quvchi ertalab "kecha" bo'lib ko'rinsin (CSV'dagi sana bilan bir xil).
    seenDays: Math.max(0, dayOf(now * 1000) - dayOf(m.lastSeen * 1000)),
  };
}

export type ReportSort = 'name' | 'stars';

export function sortSummaries(list: MemberSummary[], by: ReportSort): MemberSummary[] {
  const byName = (a: MemberSummary, b: MemberSummary) =>
    a.member.nickname.localeCompare(b.member.nickname, undefined, { sensitivity: 'base' });
  return [...list].sort(by === 'name' ? byName : (a, b) => b.stars - a.stars || b.solved - a.solved || byName(a, b));
}
