import { beforeEach, describe, expect, it } from 'vitest';
import { chapterLevels, chapters, levelById } from './levels';
import { continueLevel, progress, seenIntro, starsShortfall, unseenGates } from './state';

const solve = (ids: string[], stars = 3) =>
  Object.fromEntries(ids.map((id) => [id, { stars, gates: 1, circuit: { gates: [], wires: [] }, at: 1, synced: true }]));

beforeEach(() => {
  progress.value = {};
  seenIntro.value = [];
});

describe('«Davom etish» kartasi', () => {
  it("ochiq yechilmagan daraja bor — o'sha; yulduz yetishmovchiligi yo'q", () => {
    progress.value = solve(['b1']);
    expect(continueLevel().id).toBe('b2');
    expect(starsShortfall()).toBeNull();
  });

  it("ochiq darajalar tugab, keyingi bo'limga yulduz yetmasa — yaxshilasa bo'ladigan daraja va kerakli yulduzlar", () => {
    const first = [...chapterLevels(chapters[0].id), ...chapterLevels(chapters[1].id)].map((l) => l.id);
    progress.value = { ...solve(first, 1), [first[0]]: solve([first[0]], 3)[first[0]] };
    const short = starsShortfall();
    expect(short?.chapter.id).toBe(chapters[2].id);
    expect(short?.need).toBe(chapters[2].unlockStars - (first.length - 1 + 3));
    // 1-daraja allaqachon 3 ★ — undan keyingi, yulduzi kam daraja taklif qilinadi.
    expect(continueLevel().id).toBe(first[1]);
  });
});

describe('yangi element tanishtiruvi', () => {
  const c1 = levelById('c1')!;

  it("o'qituvchi vazifasi orqali oldingi darajalar o'tkazib yuborilsa — hamma tanish bo'lmagan elementlar", () => {
    expect(unseenGates(c1)).toEqual(c1.gates);
  });

  it("yechilgan darajada kiritilgan element tanish hisoblanadi (karta qayta chiqmaydi)", () => {
    progress.value = solve(['b1', 'b2', 'b3']);
    expect(unseenGates(c1)).toEqual(['XOR']);
    seenIntro.value = ['XOR'];
    expect(unseenGates(c1)).toEqual([]);
  });
});
