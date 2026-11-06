import { computed, effect, signal } from '@preact/signals';
import { chapterLevels, chapterOf, chapters, levelById, levels } from './levels';
import type { Chapter, Circuit, Level } from './sim/types';
import { load, save, saveLater } from './storage';

const KEYS = {
  progress: 'lg.progress.v1',
  profile: 'lg.profile.v1',
  settings: 'lg.settings.v1',
  drafts: 'lg.drafts.v1',
  sandbox: 'lg.sandbox.v1',
  intro: 'lg.intro.v1',
};
export { KEYS };

export interface LevelProgress {
  stars: number;
  gates: number;
  circuit: Circuit;
  at: number;
  /** Server bu natijani biladimi. */
  synced: boolean;
}

export interface Profile {
  id: string;
  nickname: string;
  code: string;
}

export interface Settings {
  sound: boolean;
}

export const progress = signal<Record<string, LevelProgress>>(load(KEYS.progress, {}));
export const profile = signal<Profile | null>(load(KEYS.profile, null));
export const settings = signal<Settings>({ sound: true, ...load<Partial<Settings>>(KEYS.settings, {}) });

/** Tanishtiruv kartasi ko'rsatilgan elementlar. */
export const seenIntro = signal<string[]>(load(KEYS.intro, []));

effect(() => save(KEYS.progress, progress.value));
effect(() => save(KEYS.intro, seenIntro.value));
effect(() => save(KEYS.profile, profile.value));
effect(() => save(KEYS.settings, settings.value));

export const totalStars = computed(() =>
  Object.entries(progress.value).reduce((sum, [id, p]) => sum + (levelById(id) ? p.stars : 0), 0),
);
export const solvedCount = computed(() => levels.filter((l) => progress.value[l.id]).length);

export function chapterUnlocked(ch: Chapter): boolean {
  return totalStars.value >= ch.unlockStars;
}

export function chapterStars(ch: Chapter): number {
  return chapterLevels(ch.id).reduce((s, l) => s + (progress.value[l.id]?.stars ?? 0), 0);
}

export function levelUnlocked(level: Level): boolean {
  if (!chapterUnlocked(chapterOf(level))) return false;
  const list = chapterLevels(level.chapter);
  const i = list.indexOf(level);
  return i === 0 || !!progress.value[list[i - 1].id] || !!progress.value[level.id];
}

export function nextLevel(level: Level): Level | undefined {
  return levels[levels.indexOf(level) + 1];
}

/** "O'ynash" tugmasi uchun: birinchi ochiq, lekin yechilmagan daraja. */
export function continueLevel(): Level {
  return levels.find((l) => levelUnlocked(l) && !progress.value[l.id]) ?? levels[0];
}

/** Yechimni saqlaydi, agar u avvalgisidan yaxshiroq bo'lsa. */
export function recordSolve(levelId: string, circuit: Circuit, gates: number, stars: number) {
  const prev = progress.value[levelId];
  const improved = !prev || gates < prev.gates;
  if (improved) {
    progress.value = {
      ...progress.value,
      [levelId]: { stars, gates, circuit, at: Date.now(), synced: false },
    };
  }
  return { improved, prev };
}

export function markSynced(levelId: string) {
  const p = progress.value[levelId];
  if (p && !p.synced) progress.value = { ...progress.value, [levelId]: { ...p, synced: true } };
}

// Har bir daraja uchun tugallanmagan sxema (qoralama).
const drafts: Record<string, Circuit> = load(KEYS.drafts, {});

export function getDraft(levelId: string): Circuit | undefined {
  return drafts[levelId];
}

export function setDraft(levelId: string, circuit: Circuit) {
  drafts[levelId] = circuit;
  saveLater(KEYS.drafts, drafts);
}

export function markIntroSeen(types: string[]) {
  seenIntro.value = [...new Set([...seenIntro.value, ...types])];
}

export function resetLocalProgress() {
  progress.value = {};
  seenIntro.value = [];
  for (const k of Object.keys(drafts)) delete drafts[k];
  save(KEYS.drafts, null);
  save(KEYS.sandbox, null);
}

export { chapters };
