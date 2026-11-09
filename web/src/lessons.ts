// Bo'lim xulosalari: bo'limning barcha darajalari yechilgach ochiladi — avval o'yinchi o'zi kashf qiladi,
// keyin formulalar bilan mustahkamlaydi (oldindan ochilsa, jumboqlarning yechimini aytib qo'yardi).
// Matnlar — lesson-texts.ts (xulosa ekrani bilan birga alohida yuklanadi).
import { computed, effect, signal } from '@preact/signals';
import { chapterLevels, chapters } from './levels';
import { progress } from './state';
import { load, save } from './storage';

/** Bo'limning barcha darajalari yechilganmi (xulosa ochiladi). */
export function chapterDone(chapter: string): boolean {
  const list = chapterLevels(chapter);
  return list.length > 0 && list.every((l) => progress.value[l.id]);
}

const KEY = 'lg.lessons.v1';
/** O'qilgan xulosalar (bo'lim id lari) — yangi ochilgani belgi bilan ko'rsatiladi. */
export const lessonsRead = signal<string[]>(load(KEY, []));
effect(() => save(KEY, lessonsRead.value));

export function markLessonRead(chapter: string) {
  if (!lessonsRead.value.includes(chapter)) lessonsRead.value = [...lessonsRead.value, chapter];
}

/** Ochilgan, lekin hali o'qilmagan xulosalar soni. */
// Har bo'limga xulosa bor (lessons.test.ts tekshiradi).
export const unreadLessons = computed(() => chapters.filter((c) => chapterDone(c.id) && !lessonsRead.value.includes(c.id)).length);
