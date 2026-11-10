// Sinf vazifalari (o'quvchi tomoni): o'qituvchi bergan darajalar ro'yxati va ixtiyoriy muddat.
// Ro'yxat serverdan (/api/me/classes) olinadi va qurilmada saqlanadi: oflayn ham ko'rinadi, vazifadagi
// darajalar esa yulduzlar yetmasa ham ochiq bo'ladi (state.levelUnlocked).
import { computed, signal } from '@preact/signals';
import type { ClassInfo, ClassTask } from './api';
import { levels } from './levels';
import type { Level } from './sim/types';
import { load, save } from './storage';
import { asString, cleanList, isNum, isObj } from './validate';

export interface StudentTask extends ClassTask {
  classCode: string;
  className: string;
}

const KEY = 'lg.tasks.v1';

/** Server bilan bir xil: sinfda ko'pi bilan 20 ta vazifa, vazifada 12 ta daraja. */
export const MAX_TASKS = 20;
export const MAX_TASK_LEVELS = 12;

const cleanTask = (v: unknown): StudentTask | null =>
  isObj(v) && isNum(v.id) && typeof v.classCode === 'string' && Array.isArray(v.levels)
    ? ({
        ...v,
        title: typeof v.title === 'string' ? v.title : '',
        className: typeof v.className === 'string' ? v.className : '',
        levels: cleanList(v.levels, asString) ?? [],
        due: isNum(v.due) ? v.due : undefined,
        createdAt: isNum(v.createdAt) ? v.createdAt : 0,
      } as StudentTask)
    : null;

export const myTasks = signal<StudentTask[]>(load(KEY, [], (v) => cleanList(v, cleanTask)));

export function setMyTasks(list: StudentTask[]) {
  if (JSON.stringify(list) === JSON.stringify(myTasks.value)) return;
  myTasks.value = list;
  save(KEY, list.length ? list : null);
}

/** Sinflar ro'yxatidan (har birida tasks) — o'quvchi vazifalari. */
export function tasksFromClasses(classes: ClassInfo[]): StudentTask[] {
  return classes.flatMap((c) => (c.tasks ?? []).map((t) => ({ ...t, classCode: c.code, className: c.name })));
}

/** O'quvchiga berilgan barcha darajalar: ular qulfsiz. */
export const assignedLevels = computed(() => new Set(myTasks.value.flatMap((t) => t.levels)));

/** Vazifadagi darajalar (o'yinda yo'qlari tashlab ketiladi — eski versiya yoki o'chirilgan daraja). */
export function taskLevels(task: ClassTask): Level[] {
  const want = new Set(task.levels);
  return levels.filter((l) => want.has(l.id));
}

export function taskProgress(task: ClassTask, solved: (id: string) => boolean): { done: number; total: number } {
  const list = taskLevels(task);
  return { done: list.filter((l) => solved(l.id)).length, total: list.length };
}

export type DueState = 'none' | 'ok' | 'today' | 'over';

export function dueState(due: number | undefined, today: number): DueState {
  if (!due) return 'none';
  if (due < today) return 'over';
  return due === today ? 'today' : 'ok';
}

/**
 * Bosh sahifa uchun bitta vazifa: bajarilmagan va muddati o'tmaganlardan — muddati eng yaqini
 * (muddatsizlar oxirida), teng bo'lsa yangisi.
 */
export function activeTask<T extends ClassTask>(list: T[], solved: (id: string) => boolean, today: number): T | undefined {
  const open = list.filter((t) => {
    const p = taskProgress(t, solved);
    return p.total > 0 && p.done < p.total && dueState(t.due, today) !== 'over';
  });
  const key = (t: ClassTask) => t.due || Number.MAX_SAFE_INTEGER;
  return open.sort((a, b) => key(a) - key(b) || b.id - a.id)[0];
}

/** "YYYY-MM-DD" (sana maydoni) ↔ kun raqami: kalendar sanasi Toshkent kuni bilan bir xil hisoblanadi. */
export function dayToISO(day: number): string {
  return new Date(day * 86400000).toISOString().slice(0, 10);
}

export function isoToDay(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 : 0;
}
