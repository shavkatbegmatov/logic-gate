// Yutuqlar: o'yinchining lokal natijalaridan hisoblanadi, bir marta ochilgani saqlanib qoladi.
import { computed, effect, signal } from '@preact/signals';
import { sfx } from './audio';
import { showToast } from './components/Toast';
import { customStore } from './custom';
import { dailyHistory, streak } from './daily';
import { t } from './i18n';
import { chapterLevels, chapters, levelById, levels } from './levels';
import { allHintSteps, progress } from './state';
import { load, save } from './storage';

export interface Snapshot {
  progress: Record<string, { stars: number; gates: number }>;
  daily: Record<string, { stars: number }>;
  streak: number;
  /** Daraja → ochilgan maslahatlar soni. */
  hints: Record<string, number>;
  custom: { solved: Record<string, { gates: number; stars: number; goal?: number }>; created: number };
}

export interface Achievement {
  id: string;
  icon: string;
  title: () => string;
  text: () => string;
  /** [hozirgi, kerak]; hozirgi ≥ kerak bo'lsa — ochilgan. */
  measure: (s: Snapshot) => [number, number];
}

const count = <T>(items: T[], pred: (x: T) => boolean) => items.filter(pred).length;
const stars = (s: Snapshot) => Object.entries(s.progress).reduce((sum, [id, p]) => sum + (levelById(id) ? p.stars : 0), 0);
const MAX_STARS = levels.length * 3;
const a = () => t.achievements;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', icon: '🚀', title: () => a().first.title, text: () => a().first.text, measure: (s) => [Math.min(1, count(levels, (l) => !!s.progress[l.id])), 1] },
  ...chapters.map((ch): Achievement => {
    const list = chapterLevels(ch.id);
    return {
      id: `chapter-${ch.id}`,
      icon: '📘',
      title: () => a().chapter.title(ch.title),
      text: () => a().chapter.text(list.length),
      measure: (s) => [count(list, (l) => !!s.progress[l.id]), list.length],
    };
  }),
  { id: 'stars-half', icon: '⭐', title: () => a().starsHalf(MAX_STARS / 2).title, text: () => a().starsHalf(MAX_STARS / 2).text, measure: (s) => [Math.min(stars(s), MAX_STARS / 2), MAX_STARS / 2] },
  { id: 'stars-all', icon: '🌟', title: () => a().starsAll(MAX_STARS).title, text: () => a().starsAll(MAX_STARS).text, measure: (s) => [stars(s), MAX_STARS] },
  {
    id: 'independent',
    icon: '💎',
    title: () => a().independent(10).title, text: () => a().independent(10).text,
    measure: (s) => [Math.min(10, count(levels, (l) => s.progress[l.id]?.stars === 3 && !s.hints[l.id])), 10],
  },
  {
    id: 'nand-master',
    icon: '🧠',
    title: () => a().nandMaster.title, text: () => a().nandMaster.text,
    measure: (s) => {
      const list = chapterLevels('nand');
      return [count(list, (l) => s.progress[l.id]?.stars === 3), list.length];
    },
  },
  { id: 'daily-first', icon: '📅', title: () => a().dailyFirst.title, text: () => a().dailyFirst.text, measure: (s) => [Math.min(1, Object.keys(s.daily).length), 1] },
  {
    id: 'daily-perfect',
    icon: '🎯',
    title: () => a().dailyPerfect.title, text: () => a().dailyPerfect.text,
    measure: (s) => [Math.min(1, count(Object.values(s.daily), (d) => d.stars === 3)), 1],
  },
  { id: 'streak-3', icon: '🔥', title: () => a().streak(3).title, text: () => a().streak(3).text, measure: (s) => [Math.min(s.streak, 3), 3] },
  { id: 'streak-7', icon: '🔥', title: () => a().streak(7).title, text: () => a().streak(7).text, measure: (s) => [Math.min(s.streak, 7), 7] },
  { id: 'creator', icon: '✏️', title: () => a().creator.title, text: () => a().creator.text, measure: (s) => [Math.min(1, s.custom.created), 1] },
  { id: 'friend', icon: '🤝', title: () => a().friend.title, text: () => a().friend.text, measure: (s) => [Math.min(1, Object.keys(s.custom.solved).length), 1] },
  {
    id: 'beat-author',
    icon: '🏅',
    title: () => a().beatAuthor.title, text: () => a().beatAuthor.text,
    measure: (s) => [Math.min(1, count(Object.values(s.custom.solved), (c) => c.goal !== undefined && c.gates < c.goal)), 1],
  },
];

export interface AchievementState {
  a: Achievement;
  n: number;
  max: number;
  done: boolean;
}

export function evaluate(s: Snapshot): AchievementState[] {
  return ACHIEVEMENTS.map((ach) => {
    const [n, max] = ach.measure(s);
    return { a: ach, n: Math.min(n, max), max, done: n >= max };
  });
}

// ── Saqlash va e'lon qilish ───────────────────────────────

const KEY = 'lg.achievements.v1';
const stored = load<Record<string, number> | null>(KEY, null);
/** Ochilgan yutuqlar: id → vaqt. */
export const unlocked = signal<Record<string, number>>(stored ?? {});
// Birinchi ishga tushishda (yoki yutuqlar paydo bo'lishidan oldingi o'yinchida) xabarlar chiqmaydi —
// allaqachon bajarilganlar jimgina belgilanadi.
let announce = stored !== null;

const snapshot = computed<Snapshot>(() => ({
  progress: progress.value,
  daily: dailyHistory.value,
  streak: streak.value,
  // Maslahatlar signal emas: ular yechim paytida o'qiladi — shu yetarli.
  hints: allHintSteps(),
  custom: customStore.value,
}));

export const states = computed(() => {
  const got = unlocked.value;
  return evaluate(snapshot.value).map((x) => (got[x.a.id] ? { ...x, n: x.max, done: true } : x));
});

effect(() => {
  const fresh = evaluate(snapshot.value).filter((x) => x.done && !unlocked.peek()[x.a.id]);
  if (!fresh.length) {
    if (!announce) {
      announce = true;
      save(KEY, unlocked.peek());
    }
    return;
  }
  const now = Date.now();
  const next = { ...unlocked.peek() };
  for (const x of fresh) next[x.a.id] = now;
  unlocked.value = next;
  save(KEY, next);
  if (announce) {
    sfx.achievement();
    showToast(t.achievements.unlocked(fresh.map((x) => `${x.a.icon} ${x.a.title()}`)), 'ok', 4500);
  }
  announce = true;
});

export function resetAchievements() {
  unlocked.value = {};
  save(KEY, {});
}
