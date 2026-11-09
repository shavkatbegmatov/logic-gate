import { describe, expect, it } from 'vitest';
import { certificateData } from './certificate';
import { chapterLevels, chapters, levels } from './levels';

const solve = (ids: string[], stars = 3) => Object.fromEntries(ids.map((id) => [id, { stars }]));

describe('sertifikat', () => {
  it("bo'lim tugamaguncha yopiq", () => {
    const d = certificateData(solve(chapterLevels(chapters[0].id).slice(1).map((l) => l.id)), chapters, chapterLevels);
    expect(d.unlocked).toBe(false);
    expect(d.doneChapters).toBe(0);
  });

  it("bitta bo'lim tugasa ochiladi; yulduzlar va sonlar", () => {
    const first = chapterLevels(chapters[0].id).map((l) => l.id);
    const d = certificateData({ ...solve(first, 2), [chapterLevels(chapters[1].id)[0].id]: { stars: 3 } }, chapters, chapterLevels);
    expect(d.unlocked).toBe(true);
    expect(d.complete).toBe(false);
    expect(d.doneChapters).toBe(1);
    expect(d.chapters[0]).toMatchObject({ n: 1, done: true });
    expect(d.chapters[1].done).toBe(false);
    expect(d.solved).toBe(first.length + 1);
    expect(d.stars).toBe(first.length * 2 + 3);
    expect(d.total).toBe(levels.length);
    expect(d.maxStars).toBe(levels.length * 3);
  });

  it('hamma daraja — kurs tugatildi', () => {
    const d = certificateData(solve(levels.map((l) => l.id)), chapters, chapterLevels);
    expect(d.complete).toBe(true);
    expect(d.doneChapters).toBe(chapters.length);
    expect(d.stars).toBe(d.maxStars);
  });
});
