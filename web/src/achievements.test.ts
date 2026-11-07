import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, evaluate, type Snapshot } from './achievements';
import { chapterLevels, levels } from './levels';

const empty: Snapshot = { progress: {}, daily: {}, streak: 0, hints: {}, custom: { solved: {}, created: 0 } };
const solved = (ids: string[], stars = 3) =>
  Object.fromEntries(ids.map((id) => [id, { stars, gates: levels.find((l) => l.id === id)!.goal }]));
const doneIds = (s: Snapshot) => evaluate(s).filter((x) => x.done).map((x) => x.a.id);

describe('yutuqlar', () => {
  it("id lar takrorlanmaydi va hammasining matni bor", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ACHIEVEMENTS) expect(a.title && a.text && a.icon, a.id).toBeTruthy();
  });

  it("yangi o'yinchida hech qaysi yutuq ochilmagan", () => {
    expect(doneIds(empty)).toEqual([]);
  });

  it('birinchi daraja va bo\'lim', () => {
    const basics = chapterLevels('basics').map((l) => l.id);
    expect(doneIds({ ...empty, progress: solved(['b1']) })).toEqual(['first']);
    const s = { ...empty, progress: solved(basics) };
    expect(doneIds(s)).toContain('chapter-basics');
    const ch = evaluate({ ...empty, progress: solved(basics.slice(0, 2)) }).find((x) => x.a.id === 'chapter-basics')!;
    expect([ch.n, ch.max, ch.done]).toEqual([2, basics.length, false]);
  });

  it('barcha darajalar 3 ★ bilan — kampaniya yutuqlarining hammasi', () => {
    const s = { ...empty, progress: solved(levels.map((l) => l.id)) };
    const got = doneIds(s);
    for (const id of ['first', 'stars-half', 'stars-all', 'independent', 'nand-master']) expect(got).toContain(id);
    expect(got.filter((id) => id.startsWith('chapter-'))).toHaveLength(5);
  });

  it('maslahat ishlatilgan darajalar «Mustaqil» ga hisoblanmaydi', () => {
    const ids = levels.slice(0, 10).map((l) => l.id);
    const s = { ...empty, progress: solved(ids) };
    expect(doneIds(s)).toContain('independent');
    expect(doneIds({ ...s, hints: { [ids[0]]: 1 } })).not.toContain('independent');
  });

  it('kunlik, seriya va do\'stlar masalasi', () => {
    const s: Snapshot = {
      ...empty,
      daily: { 20764: { stars: 2 }, 20765: { stars: 3 } },
      streak: 3,
      custom: { solved: { 'custom-a': { gates: 3, stars: 3, goal: 4 } }, created: 1 },
    };
    expect(doneIds(s).sort()).toEqual(['beat-author', 'creator', 'daily-first', 'daily-perfect', 'friend', 'streak-3'].sort());
    const week = evaluate(s).find((x) => x.a.id === 'streak-7')!;
    expect([week.n, week.max]).toEqual([3, 7]);
    // Muallif bilan teng natija — «Muallifdan o'tdingiz» emas.
    const tie = { ...s, custom: { solved: { x: { gates: 4, stars: 3, goal: 4 } }, created: 0 } };
    expect(doneIds(tie)).not.toContain('beat-author');
  });
});
