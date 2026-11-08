// Sinf rejimi (mijoz tomoni). O'qituvchi yaratgan sinflar — shu qurilmada: kod, nom va o'qituvchi
// kaliti (serverda faqat xeshi; kalit yo'qolsa, hisobotni ochib bo'lmaydi — shuning uchun ekranda
// ko'rsatiladi va boshqa qurilmaga ko'chirsa bo'ladi).
import { signal } from '@preact/signals';
import type { ClassMember } from './api';
import { chapterLevels, chapters, levels } from './levels';
import { load, save } from './storage';

export interface TeacherClass {
  code: string;
  name: string;
  key: string;
  createdAt: number;
}

const KEY = 'lg.teacher.v1';

export const teacherClasses = signal<TeacherClass[]>(load(KEY, []));

export function saveTeacherClass(c: TeacherClass) {
  teacherClasses.value = [c, ...teacherClasses.value.filter((x) => x.code !== c.code)];
  save(KEY, teacherClasses.value);
}

export function forgetTeacherClass(code: string) {
  teacherClasses.value = teacherClasses.value.filter((x) => x.code !== code);
  save(KEY, teacherClasses.value);
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

/** O'quvchilar uchun havola (sayt). */
export const classLink = (code: string, origin = location.origin) => `${origin}/#/class/${code}`;

/** O'qituvchi hisobotidagi o'quvchi qatori: jami, bo'limlar bo'yicha, oxirgi faollik. */
export interface MemberSummary {
  member: ClassMember;
  stars: number;
  solved: number;
  /** har bir bo'lim: yechilgan / jami */
  chapters: { solved: number; total: number; stars: number }[];
  /** necha kun oldin kirgan (0 — bugun) */
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
    seenDays: Math.max(0, Math.floor((now - m.lastSeen) / 86400)),
  };
}

export type ReportSort = 'name' | 'stars';

export function sortSummaries(list: MemberSummary[], by: ReportSort): MemberSummary[] {
  const byName = (a: MemberSummary, b: MemberSummary) =>
    a.member.nickname.localeCompare(b.member.nickname, undefined, { sensitivity: 'base' });
  return [...list].sort(by === 'name' ? byName : (a, b) => b.stars - a.stars || b.solved - a.solved || byName(a, b));
}
