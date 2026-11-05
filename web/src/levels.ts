import data from '../../levels/levels.json';
import type { Chapter, Level, LevelPack } from './sim/types';

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
