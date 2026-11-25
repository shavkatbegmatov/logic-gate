import { afterEach, describe, expect, it } from 'vitest';
import { setLang } from './i18n';
import { chapterLevels } from './levels';
import { progress, settings } from './state';
import { introFor, markSceneSeen, outroFor, preloadStory, resetStory, scenesSeen, sceneSeen, STORY_CHAPTERS, storyLine, storyPlace } from './story';
import { STORIES, storyFor } from './story-texts';

const solveAll = (ids: string[]) =>
  (progress.value = Object.fromEntries(ids.map((id) => [id, { stars: 3, gates: 1, synced: true }])) as typeof progress.value);

afterEach(async () => {
  resetStory();
  progress.value = {};
  settings.value = { ...settings.value, story: undefined };
  await setLang('uz');
});

describe('kampaniya hikoyasi: matnlar', () => {
  it("hikoyali bo'limlar ro'yxati matnlar bilan bir xil, uz va ru tuzilishi bir xil", () => {
    expect(Object.keys(STORIES.uz).sort()).toEqual([...STORY_CHAPTERS].sort());
    expect(Object.keys(STORIES.ru).sort()).toEqual([...STORY_CHAPTERS].sort());
    for (const ch of STORY_CHAPTERS) {
      const uz = STORIES.uz[ch];
      const ru = STORIES.ru[ch];
      for (const kind of ['intro', 'outro'] as const) {
        expect(uz[kind].frames.length, `${ch} ${kind}`).toBeGreaterThanOrEqual(3);
        expect(uz[kind].frames.length, `${ch} ${kind}`).toBeLessThanOrEqual(5);
        // Kadrlar soni, rasmi va gapiruvchisi tillarda bir xil — faqat matn tarjima qilinadi.
        expect(ru[kind].frames.map((f) => [f.art, f.who, f.note])).toEqual(uz[kind].frames.map((f) => [f.art, f.who, f.note]));
      }
      // Har bir darajada hikoya qatori bor, ortiqchasi yo'q.
      const ids = chapterLevels(ch).map((l) => l.id).sort();
      expect(Object.keys(uz.lines).sort()).toEqual(ids);
      expect(Object.keys(ru.lines).sort()).toEqual(ids);
      for (const s of [uz, ru]) expect(JSON.stringify(s)).not.toMatch(/""/);
    }
  });

  it("o'zbekcha matnda kirill harfi yo'q, ruschada — o'zbekcha joy nomi qolmagan", () => {
    expect(JSON.stringify(STORIES.uz)).not.toMatch(/[Ѐ-ӿ]/);
    expect(STORIES.ru.basics.place).not.toBe(STORIES.uz.basics.place);
  });

  it('joriy til bo\'yicha tanlanadi', async () => {
    expect(storyFor('basics')?.place).toBe(STORIES.uz.basics.place);
    await setLang('ru');
    expect(storyFor('basics')?.place).toBe(STORIES.ru.basics.place);
    expect(storyFor('master')).toBeUndefined();
  });
});

describe('kampaniya hikoyasi: qachon ko\'rsatiladi', () => {
  const basics = chapterLevels('basics').map((l) => l.id);

  it("kirish sahnasi — bo'limning istalgan darajasiga birinchi kirishda, bir marta", () => {
    expect(introFor(basics[0])).toEqual({ chapter: 'basics', kind: 'intro' });
    expect(introFor(basics[3])).toEqual({ chapter: 'basics', kind: 'intro' });
    markSceneSeen({ chapter: 'basics', kind: 'intro' });
    expect(introFor(basics[0])).toBeNull();
    expect(scenesSeen.value).toEqual(['basics:intro']);
    markSceneSeen({ chapter: 'basics', kind: 'intro' });
    expect(scenesSeen.value).toEqual(['basics:intro']);
  });

  it("bo'lim allaqachon tugagan o'yinchiga kirish sahnasi majburlanmaydi", () => {
    solveAll(basics);
    expect(introFor(basics[0])).toBeNull();
  });

  it("chiqish sahnasi — bo'lim tugagandagina, bir marta", () => {
    solveAll(basics.slice(0, -1));
    expect(outroFor(basics.at(-1)!)).toBeNull();
    solveAll(basics);
    expect(outroFor(basics.at(-1)!)).toEqual({ chapter: 'basics', kind: 'outro' });
    markSceneSeen({ chapter: 'basics', kind: 'outro' });
    expect(outroFor(basics.at(-1)!)).toBeNull();
    expect(sceneSeen({ chapter: 'basics', kind: 'outro' })).toBe(true);
  });

  it("hikoyasiz bo'lim va o'chirilgan hikoya — sahna ham, qator ham yo'q", async () => {
    expect(introFor(chapterLevels('master')[0].id)).toBeNull();
    await preloadStory();
    expect(storyLine('basics', basics[0])).toBe(STORIES.uz.basics.lines[basics[0]]);
    expect(storyPlace('basics')).toBe(STORIES.uz.basics.place);
    expect(storyLine('master', chapterLevels('master')[0].id)).toBeUndefined();
    settings.value = { ...settings.value, story: false };
    expect(introFor(basics[0])).toBeNull();
    expect(storyLine('basics', basics[0])).toBeUndefined();
    expect(storyPlace('basics')).toBeUndefined();
  });

  it("progress o'chirilganda ko'rilgan sahnalar ham tozalanadi", () => {
    markSceneSeen({ chapter: 'basics', kind: 'intro' });
    resetStory();
    expect(scenesSeen.value).toEqual([]);
  });
});
