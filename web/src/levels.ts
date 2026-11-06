import data from '../../levels/levels.json';
import type { Chapter, GateType, Level, LevelPack } from './sim/types';

const pack = data as unknown as LevelPack;

export const chapters: Chapter[] = pack.chapters;
export const levels: Level[] = pack.levels;
export const MAX_STARS = levels.length * 3;

const byId = new Map(levels.map((l) => [l.id, l]));

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
