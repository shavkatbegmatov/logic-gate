import { describe, expect, it } from 'vitest';
import type { ClassInfo, Contest } from './api';
import { activeContests, contestDraft, formatClock, inClass, localEnd, setClassesInfo, setContestDraft } from './contest';

const contest = (remaining: number): Contest => ({ id: 7, title: 'TEST', levels: ['b1'], startsAt: 0, endsAt: 0, remaining });
const cls = (code: string, c?: Contest): ClassInfo => ({ code, name: `TEST ${code}`, members: 3, member: true, contest: c });

describe('sinf musobaqasi', () => {
  it('taymer: daqiqa:soniya, soatdan oshsa — soat ham; tugagani — 0:00', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(-5000)).toBe('0:00');
    expect(formatClock(59_001)).toBe('1:00');
    expect(formatClock(605_000)).toBe('10:05');
    expect(formatClock(3_725_000)).toBe('1:02:05');
  });

  it("tugash vaqti qurilma soati bo'yicha: javob kelgan payt + qolgan soniyalar", () => {
    expect(localEnd(contest(90), 1_000_000)).toBe(1_090_000);
  });

  it("e'lon: faqat davom etayotgan musobaqalar; a'zolik belgisi", () => {
    setClassesInfo([cls('AAAAAA', contest(120)), cls('BBBBBB', contest(0)), cls('CCCCCC')], 5_000);
    expect(inClass.value).toBe(true);
    expect(activeContests.value.map((c) => [c.code, c.className, c.endsAt])).toEqual([['AAAAAA', 'TEST AAAAAA', 125_000]]);
    setClassesInfo([]);
    expect(inClass.value).toBe(false);
    expect(activeContests.value).toEqual([]);
  });

  it("darajadagi ish sahifa ochiq turguncha saqlanadi (musobaqa va daraja bo'yicha alohida)", () => {
    const c = { gates: [], wires: [] };
    setContestDraft(7, 'b1', c);
    expect(contestDraft(7, 'b1')).toBe(c);
    expect(contestDraft(7, 'b2')).toBeUndefined();
    expect(contestDraft(8, 'b1')).toBeUndefined();
  });
});
