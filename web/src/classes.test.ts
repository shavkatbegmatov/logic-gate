import { describe, expect, it } from 'vitest';
import type { ClassMember } from './api';
import {
  classLink,
  decodeTeacherClasses,
  encodeTeacherClasses,
  forgetAllTeacherClasses,
  forgetTeacherClass,
  mergeTeacherClasses,
  normalizeClassCode,
  saveTeacherClass,
  sortSummaries,
  summarize,
  teacherClasses,
} from './classes';
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

  it("faollik — Toshkent kalendar kunlari bo'yicha, 24 soatlar emas", () => {
    // 2026-11-09 23:00 (Toshkent) = 18:00 UTC; ertasi 08:00 (Toshkent) = 03:00 UTC.
    const evening = Date.UTC(2026, 10, 9, 18) / 1000;
    const morning = Date.UTC(2026, 10, 10, 3) / 1000;
    expect(summarize(member('Ali', {}, evening), morning).seenDays).toBe(1);
    // Bir kunning ertalabi va kechasi — "bugun".
    expect(summarize(member('Ali', {}, morning), morning + 14 * 3600).seenDays).toBe(0);
    // Server soati biroz oldinda bo'lsa ham manfiy emas.
    expect(summarize(member('Ali', {}, morning + 60), morning).seenDays).toBe(0);
  });

  it("o'qituvchi sinflari Telegram bulutiga ixcham yoziladi va qaytariladi", () => {
    const list = [
      { code: 'AAAAAA', name: '8-B «Fizika»', key: 'K1K1-K1K1-K1K1-K1K1', createdAt: 1_700_000_000_000 },
      { code: 'BBBBBB', name: 'B', key: 'K2K2-K2K2-K2K2-K2K2', createdAt: 1_700_000_100_000 },
    ];
    expect(decodeTeacherClasses(encodeTeacherClasses(list))).toEqual(list);
    // Buzilgan yoki begona yozuvlar e'tiborsiz.
    expect(decodeTeacherClasses('not json')).toEqual([]);
    expect(decodeTeacherClasses(null)).toEqual([]);
    expect(decodeTeacherClasses(JSON.stringify([['abc', 'k', 'n', 1], ['CCCCCC', 'k', 'n', 1], 5]))).toEqual([
      { code: 'CCCCCC', key: 'k', name: 'n', createdAt: 1000 },
    ]);
    // 4096 belgidan oshsa — eng eskilari (ro'yxat oxiri) tushib qoladi.
    const many = Array.from({ length: 80 }, (_, i) => ({
      code: `A${String(i).padStart(5, '0')}`,
      name: 'Sinf nomi juda uzun bo\'lishi mumkin — ellik belgigacha',
      key: 'XXXX-XXXX-XXXX-XXXX',
      createdAt: 0,
    }));
    const raw = encodeTeacherClasses(many);
    expect(raw.length).toBeLessThanOrEqual(4096);
    const back = decodeTeacherClasses(raw);
    expect(back.length).toBeGreaterThan(20);
    expect(back[0].code).toBe('A00000');
  });

  it("bulutdagi sinflar qo'shiladi; qurilmani tozalash kalitlarni ham o'chiradi", () => {
    teacherClasses.value = [];
    saveTeacherClass({ code: 'AAAAAA', name: 'Mahalliy', key: 'k1', createdAt: 1 });
    mergeTeacherClasses([
      { code: 'AAAAAA', name: 'Bulutdagi eski nom', key: 'k1', createdAt: 1 },
      { code: 'BBBBBB', name: 'B', key: 'k2', createdAt: 2 },
    ]);
    expect(teacherClasses.value.map((c) => c.name)).toEqual(['Mahalliy', 'B']);
    forgetAllTeacherClasses();
    expect(teacherClasses.value).toEqual([]);
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
