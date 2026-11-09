import type { Theme } from './theme';
import { computed, effect, signal } from '@preact/signals';
import { setLang, type Lang } from './i18n';
import { chapterLevels, chapterOf, chapters, levelById, levels } from './levels';
import type { Chapter, Circuit, Level } from './sim/types';
import { load, save, saveLater } from './storage';
import { assignedLevels } from './tasks';

const KEYS = {
  progress: 'lg.progress.v1',
  profile: 'lg.profile.v1',
  settings: 'lg.settings.v1',
  drafts: 'lg.drafts.v1',
  sandbox: 'lg.sandbox.v1',
  intro: 'lg.intro.v1',
  hints: 'lg.hints.v1',
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
  lang?: Lang;
  /** Rang mavzusi (theme.ts); yo'q bo'lsa — Plata. */
  theme?: Theme;
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
effect(() => setLang(settings.value.lang ?? 'uz'));

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
  // Yechilgan daraja doim ochiq: vazifa orqali yechilgan bo'lsa ham, vazifa o'chirilgandan
  // yoki sinfdan chiqilgandan keyin uni qayta o'ynab, natijani yaxshilash mumkin.
  if (progress.value[level.id]) return true;
  // O'qituvchi bergan vazifadagi daraja yulduzlar yetmasa ham ochiq.
  if (assignedLevels.value.has(level.id)) return true;
  if (!chapterUnlocked(chapterOf(level))) return false;
  const list = chapterLevels(level.chapter);
  const i = list.indexOf(level);
  return i === 0 || !!progress.value[list[i - 1].id];
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

const MAX_CUSTOM_DRAFTS = 40;

export function setDraft(levelId: string, circuit: Circuit) {
  // Kalit oxiriga o'tadi: obyekt tartibi = oxirgi foydalanish tartibi.
  delete drafts[levelId];
  drafts[levelId] = circuit;
  // Do'stlar masalalari cheksiz ko'payishi mumkin — eng eskilari o'chiriladi.
  const custom = Object.keys(drafts).filter((k) => k.startsWith('custom-'));
  for (const k of custom.slice(0, Math.max(0, custom.length - MAX_CUSTOM_DRAFTS))) delete drafts[k];
  saveLater(KEYS.drafts, drafts);
}

const KEEP_OLD_DAILY = 3;

/**
 * Eski kunlik masalalar qoralamalari va maslahatlarini o'chiradi: bugungi, kechagi, ochilayotgan (keep)
 * va arxivdan oxirgi ishlatilgan 3 tasi qoladi.
 */
export function pruneDailyDrafts(today: number, keep?: string) {
  const prune = (store: Record<string, unknown>) => {
    const old = Object.keys(store).filter((k) => {
      const m = /^daily-(\d+)$/.exec(k);
      return m && Number(m[1]) < today - 1 && k !== keep;
    });
    // Qoralamalarda tartib = oxirgi foydalanish tartibi (setDraft kalitni oxiriga o'tkazadi).
    const drop = old.slice(0, Math.max(0, old.length - KEEP_OLD_DAILY));
    for (const k of drop) delete store[k];
    return drop.length > 0;
  };
  if (prune(drafts)) saveLater(KEYS.drafts, drafts);
  if (prune(hintSteps)) saveLater(KEYS.hints, hintSteps);
}

// Har bir daraja uchun ochilgan maslahatlar soni.
const hintSteps: Record<string, number> = load(KEYS.hints, {});

export function hintStep(levelId: string): number {
  return hintSteps[levelId] ?? 0;
}

export function allHintSteps(): Record<string, number> {
  return { ...hintSteps };
}

export function setHintStep(levelId: string, n: number) {
  hintSteps[levelId] = n;
  saveLater(KEYS.hints, hintSteps);
}

export function markIntroSeen(types: string[]) {
  seenIntro.value = [...new Set([...seenIntro.value, ...types])];
}

export function resetLocalProgress() {
  progress.value = {};
  seenIntro.value = [];
  for (const k of Object.keys(drafts)) delete drafts[k];
  for (const k of Object.keys(hintSteps)) delete hintSteps[k];
  save(KEYS.drafts, null);
  save(KEYS.hints, null);
  save(KEYS.sandbox, null);
}

export { chapters };
