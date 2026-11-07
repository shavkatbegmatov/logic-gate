import { effect } from '@preact/signals';
import data from '../../levels/levels.json';
import { lang } from './i18n';
import type { Chapter, GateType, Level, LevelPack } from './sim/types';

const pack = data as unknown as LevelPack;

export const chapters: Chapter[] = pack.chapters;
export const levels: Level[] = pack.levels;
export const MAX_STARS = levels.length * 3;

const byId = new Map(levels.map((l) => [l.id, l]));

// Tanlangan til matnlari daraja obyektlarining o'ziga yoziladi: barcha ekranlar `level.title` ni o'qiydi.
const uzLevels = new Map(levels.map((l) => [l.id, { title: l.title, task: l.task, hint: l.hint }]));
const uzChapters = new Map(chapters.map((c) => [c.id, { title: c.title, description: c.description }]));
effect(() => {
  const l = lang.value;
  for (const lv of levels) Object.assign(lv, lv.i18n?.[l] ?? uzLevels.get(lv.id));
  for (const ch of chapters) Object.assign(ch, ch.i18n?.[l] ?? uzChapters.get(ch.id));
});

export function levelById(id: string): Level | undefined {
  return byId.get(id);
}

export function chapterLevels(chapterId: string): Level[] {
  return levels.filter((l) => l.chapter === chapterId);
}

export function chapterOf(level: Level): Chapter {
  return chapters.find((c) => c.id === level.chapter)!;
}

/** Darajaning umumiy tartib raqami (1 dan). */
export function levelNumber(level: Level): number {
  return levels.indexOf(level) + 1;
}

// Har bir daraja birinchi marta tanishtiradigan elementlar (oldingi darajalarda bo'lmaganlari).
const introduced = new Map<string, GateType[]>();
{
  const seen = new Set<GateType>();
  for (const l of levels) {
    introduced.set(l.id, l.gates.filter((g) => !seen.has(g)));
    l.gates.forEach((g) => seen.add(g));
  }
}

export function newGates(level: Level): GateType[] {
  return introduced.get(level.id) ?? [];
}
