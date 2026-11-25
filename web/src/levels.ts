import { effect, signal } from '@preact/signals';
// Bosh yuklamada — faqat xarita va bosh sahifa uchun kerakli qism: nomlar, oyoqlar, elementlar, maqsad.
// Jadvallar, vazifa matni va maslahatlar alohida bo'lakda (loadLevelDetails). Bo'lish — vite.config.ts.
import data from 'virtual:levels/meta';
import { lang } from './i18n';
import type { Chapter, GateType, Level } from './sim/types';

export const chapters: Chapter[] = data.chapters as Chapter[];
export const levels: Level[] = data.levels as Level[];
export const MAX_STARS = levels.length * 3;

const byId = new Map(levels.map((l) => [l.id, l]));

/** Daraja jadvallari, vazifa matni va maslahatlari yuklandimi (loadLevelDetails). */
export const detailsLoaded = signal(false);

// Tanlangan til matnlari daraja obyektlarining o'ziga yoziladi: barcha ekranlar `level.title` ni o'qiydi.
// O'zbekcha asl matnlar shu yerda saqlanadi (vazifa va maslahat — tafsilotlar yuklangach qo'shiladi).
type LevelText = Partial<Pick<Level, 'title' | 'task' | 'hint'>>;
const uzLevels = new Map<string, LevelText>(levels.map((l) => [l.id, { title: l.title }]));
const uzChapters = new Map(chapters.map((c) => [c.id, { title: c.title, description: c.description }]));
effect(() => {
  const l = lang.value;
  void detailsLoaded.value; // Tafsilotlar kelganda vazifa matni ham tanlangan tilda yoziladi.
  for (const lv of levels) Object.assign(lv, lv.i18n?.[l] ?? uzLevels.get(lv.id));
  for (const ch of chapters) Object.assign(ch, ch.i18n?.[l] ?? uzChapters.get(ch.id));
});

let loading: Promise<void> | null = null;

/**
 * Daraja tafsilotlarini (jadval yoki avtomat, vazifa, maslahatlar) yuklaydi — ish stoli ochilishidan oldin.
 * Bir marta yuklanadi; xato bo'lsa, keyingi chaqiruv qayta urinadi.
 */
export function loadLevelDetails(): Promise<void> {
  loading ??= import('virtual:levels/detail').then(
    ({ default: detail }) => {
      for (const lv of levels) {
        const { i18n, ...rest } = detail[lv.id] as Partial<Level>;
        Object.assign(lv, rest);
        Object.assign(uzLevels.get(lv.id)!, { task: rest.task, hint: rest.hint });
        for (const [l, text] of Object.entries(i18n ?? {})) Object.assign(((lv.i18n ??= {})[l] ??= {}), text);
      }
      detailsLoaded.value = true;
    },
    (e) => {
      loading = null;
      throw e;
    },
  );
  return loading;
}

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
