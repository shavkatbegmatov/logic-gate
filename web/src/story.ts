// Kampaniya hikoyasi: qaysi bo'limda hikoya bor, qaysi sahna ko'rilgan va qachon ko'rsatiladi.
// Matnlar — story-texts.ts (alohida yuklanadi), sahna ekrani — components/StoryScene.tsx (lazy).
// Hikoya faqat asosiy kampaniyada: kunlik masala, sinf vazifasi, musobaqa va qum qutida yo'q.
import { effect, signal } from '@preact/signals';
import { chapterDone } from './lessons';
import { chapterLevels } from './levels';
import { settings } from './state';
import { load, save } from './storage';
import type * as Texts from './story-texts';
import { asString, cleanList } from './validate';

/** Hikoyasi yozilgan bo'limlar (story.test.ts story-texts.ts bilan solishtiradi). */
export const STORY_CHAPTERS = ['basics', 'chips'];

export type SceneKind = 'intro' | 'outro';
export interface SceneRef {
  chapter: string;
  kind: SceneKind;
}

const KEY = 'lg.story.v1';
/** Ko'rilgan (yoki o'tkazib yuborilgan) sahnalar: "basics:intro", "basics:outro". */
export const scenesSeen = signal<string[]>(load(KEY, [], (v) => cleanList(v, asString)));
effect(() => save(KEY, scenesSeen.value));

const sceneKey = (s: SceneRef) => `${s.chapter}:${s.kind}`;

export const storyOn = () => settings.value.story !== false;

export function sceneSeen(s: SceneRef): boolean {
  return scenesSeen.value.includes(sceneKey(s));
}

export function markSceneSeen(s: SceneRef) {
  if (!sceneSeen(s)) scenesSeen.value = [...scenesSeen.value, sceneKey(s)];
}

/** Boshqa o'quvchi (umumiy kompyuter) yoki «Progressni o'chirish». */
export function resetStory() {
  scenesSeen.value = [];
}

const hasStory = (chapter: string) => STORY_CHAPTERS.includes(chapter);

/** Daraja ochilganda: bo'lim hali tugamagan va kirish sahnasi ko'rilmagan bo'lsa — o'sha sahna. */
export function introFor(levelId: string): SceneRef | null {
  const chapter = chapterOf(levelId);
  if (!chapter || !hasStory(chapter) || !storyOn() || chapterDone(chapter)) return null;
  const s: SceneRef = { chapter, kind: 'intro' };
  return sceneSeen(s) ? null : s;
}

/** Daraja yechilgandan keyin: bo'lim shu bilan tugagan va chiqish sahnasi ko'rilmagan bo'lsa — o'sha sahna. */
export function outroFor(levelId: string): SceneRef | null {
  const chapter = chapterOf(levelId);
  if (!chapter || !hasStory(chapter) || !storyOn() || !chapterDone(chapter)) return null;
  const s: SceneRef = { chapter, kind: 'outro' };
  return sceneSeen(s) ? null : s;
}

function chapterOf(levelId: string): string | null {
  for (const chapter of STORY_CHAPTERS) if (chapterLevels(chapter).some((l) => l.id === levelId)) return chapter;
  return null;
}

/** Yuklangan matnlar moduli (hikoya qatori darhol chiqishi uchun bo'limlar ro'yxatida oldindan yuklanadi). */
export const storyTexts = signal<typeof Texts | null>(null);
let pending: Promise<void> | null = null;

export function preloadStory(): Promise<void> {
  pending ??= import('./story-texts').then(
    (m) => {
      storyTexts.value = m;
    },
    () => {
      pending = null; // Oflayn yoki eski versiya — keyingi safar qayta uriniladi.
    },
  );
  return pending;
}

/** Masala ustidagi hikoya qatori (matnlar hali yuklanmagan yoki hikoya o'chiq bo'lsa — yo'q). */
export function storyLine(chapter: string, levelId: string): string | undefined {
  if (!storyOn() || !hasStory(chapter)) return undefined;
  return storyTexts.value?.storyFor(chapter)?.lines[levelId];
}

/** Bo'lim kartasidagi joy nomi. */
export function storyPlace(chapter: string): string | undefined {
  if (!storyOn() || !hasStory(chapter)) return undefined;
  return storyTexts.value?.storyFor(chapter)?.place;
}
