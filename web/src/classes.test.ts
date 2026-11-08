import { describe, expect, it } from 'vitest';
import type { ClassMember } from './api';
import { classLink, forgetTeacherClass, normalizeClassCode, saveTeacherClass, sortSummaries, summarize, teacherClasses } from './classes';
import { chapterLevels, chapters } from './levels';

const member = (nickname: string, levels: Record<string, number>, lastSeen = 1000): ClassMember => ({
  id: nickname,
  nickname,
  joinedAt: 0,
  lastSeen,
  levels,
  dailyToday: 0,
  dailyWeek: 0,
});

describe('sinf rejimi', () => {
  it('sinf kodi server bilan bir xil normallashadi', () => {
    expect(normalizeClassCode('ab cd-ef')).toBe('ABCDEF');
    expect(normalizeClassCode('oil234')).toBe('011234');
    expect(normalizeClassCode('ABCDE')).toBe('');
    expect(normalizeClassCode('ABCDU1')).toBe('');
    expect(classLink('ABCDEF', 'https://x.uz')).toBe('https://x.uz/#/class/ABCDEF');
  });

  it("hisobot: jami, bo'limlar, faollik va tartib", () => {
    const basics = chapterLevels(chapters[0].id);
    const ali = summarize(member('Ali', { [basics[0].id]: 3, [basics[1].id]: 2, eski: 3 }, 1000), 1000 + 2 * 86400 + 5);
    expect(ali.stars).toBe(5); // mavjud bo'lmagan daraja hisoblanmaydi
    expect(ali.solved).toBe(2);
    expect(ali.chapters[0]).toEqual({ solved: 2, total: basics.length, stars: 5 });
    expect(ali.chapters[1].solved).toBe(0);
    expect(ali.seenDays).toBe(2);
    const vali = summarize(member('vali', { [basics[0].id]: 3 }), 1000);
    const bek = summarize(member('Bek', {}), 1000);
    expect(sortSummaries([vali, bek, ali], 'name').map((s) => s.member.nickname)).toEqual(['Ali', 'Bek', 'vali']);
    expect(sortSummaries([vali, bek, ali], 'stars').map((s) => s.member.nickname)).toEqual(['Ali', 'vali', 'Bek']);
  });

  it("o'qituvchi sinflari qurilmada saqlanadi", () => {
    teacherClasses.value = [];
    saveTeacherClass({ code: 'AAAAAA', name: 'A', key: 'k1', createdAt: 1 });
    saveTeacherClass({ code: 'BBBBBB', name: 'B', key: 'k2', createdAt: 2 });
    saveTeacherClass({ code: 'AAAAAA', name: 'A2', key: 'k1', createdAt: 1 });
    expect(teacherClasses.value.map((c) => c.name)).toEqual(['A2', 'B']);
    forgetTeacherClass('BBBBBB');
    expect(teacherClasses.value.map((c) => c.code)).toEqual(['AAAAAA']);
    teacherClasses.value = [];
  });
});
