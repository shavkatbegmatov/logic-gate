// Sertifikat ma'lumoti: o'yinchi tugatgan bo'limlar va yulduzlar (toza funksiya — testlanadi).
// Yutuqlar ekranidagi karta ham shuni ishlatadi; chizish (certificate.ts) esa sertifikat ekrani
// bilan birga alohida bo'lakda yuklanadi.
import type { Chapter, Level } from './sim/types';

export interface CertChapter {
  n: number;
  title: string;
  done: boolean;
}

export interface CertData {
  /** Kamida bitta bo'lim tugatilgan — sertifikat ochiq. */
  unlocked: boolean;
  /** Hamma darajalar yechilgan. */
  complete: boolean;
  chapters: CertChapter[];
  doneChapters: number;
  solved: number;
  total: number;
  stars: number;
  maxStars: number;
}

export function certificateData(
  progress: Record<string, { stars: number }>,
  chapters: Chapter[],
  levelsOf: (id: string) => Level[],
): CertData {
  let solved = 0;
  let total = 0;
  let stars = 0;
  const list = chapters.map((ch, i) => {
    const lv = levelsOf(ch.id);
    const got = lv.filter((l) => progress[l.id]);
    solved += got.length;
    total += lv.length;
    stars += got.reduce((s, l) => s + (progress[l.id]?.stars ?? 0), 0);
    return { n: i + 1, title: ch.title, done: lv.length > 0 && got.length === lv.length };
  });
  const doneChapters = list.filter((c) => c.done).length;
  return {
    unlocked: doneChapters > 0,
    complete: total > 0 && solved === total,
    chapters: list,
    doneChapters,
    solved,
    total,
    stars,
    maxStars: total * 3,
  };
}
