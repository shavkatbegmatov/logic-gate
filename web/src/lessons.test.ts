import { describe, expect, it } from 'vitest';
import { chapterDone, LESSONS, lessonsRead, markLessonRead, unreadLessons, type Block } from './lessons';
import { chapterLevels, chapters } from './levels';
import { progress } from './state';

const kind = (b: Block) => Object.keys(b)[0];

describe("bo'lim xulosalari", () => {
  it("har bir bo'lim uchun o'zbekcha va ruscha xulosa, tuzilishi bir xil", () => {
    for (const ch of chapters) {
      const uz = LESSONS.uz[ch.id];
      const ru = LESSONS.ru[ch.id];
      expect(uz, ch.id).toBeDefined();
      expect(ru, ch.id).toBeDefined();
      expect(ru.blocks.map(kind), ch.id).toEqual(uz.blocks.map(kind));
      uz.blocks.forEach((b, i) => {
        const r = ru.blocks[i];
        if ('table' in b && 'table' in r) {
          const width = b.table[0].length;
          for (const row of [...b.table, ...r.table]) expect(row).toHaveLength(width);
          expect(r.table.slice(1), ch.id).toEqual(b.table.slice(1));
        }
        if ('f' in b && 'f' in r) expect(r.f.length, ch.id).toBe(b.f.length);
      });
      for (const l of [uz, ru]) {
        expect(l.title.length).toBeGreaterThan(0);
        expect(JSON.stringify(l.blocks)).not.toMatch(/""/);
      }
    }
    expect(Object.keys(LESSONS.uz).sort()).toEqual(chapters.map((c) => c.id).sort());
  });

  it("bo'lim yechilgach ochiladi va o'qilmagan deb belgilanadi", () => {
    const basics = chapterLevels('basics');
    progress.value = Object.fromEntries(basics.slice(0, -1).map((l) => [l.id, { stars: 3, gates: 1, synced: true }])) as typeof progress.value;
    expect(chapterDone('basics')).toBe(false);
    expect(unreadLessons.value).toBe(0);
    progress.value = Object.fromEntries(basics.map((l) => [l.id, { stars: 3, gates: 1, synced: true }])) as typeof progress.value;
    expect(chapterDone('basics')).toBe(true);
    expect(unreadLessons.value).toBe(1);
    markLessonRead('basics');
    markLessonRead('basics');
    expect(lessonsRead.value).toEqual(['basics']);
    expect(unreadLessons.value).toBe(0);
    progress.value = {};
  });
});
