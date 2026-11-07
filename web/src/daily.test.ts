import { describe, expect, it } from 'vitest';
import type { DailyInfo } from './api';
import { dailyShareText, dayLabel, dayOf, hintText, puzzleLevel, streakFrom } from './daily';
import { check } from './sim/sim';

const info: DailyInfo = {
  day: dayOf(Date.parse('2026-11-08T12:00:00Z')),
  number: 2,
  date: '2026-11-08',
  nextAt: 0,
  puzzle: {
    tier: 2,
    inputs: ['A', 'B', 'C'],
    outputs: ['Q'],
    gates: ['NOT', 'AND', 'OR'],
    goal: 2,
    target: { Q: '00010101' },
    hint: { gates: { AND: 1, OR: 1 }, first: ['AND', 'A', 'B'] },
  },
  solvers: 0,
  bestGates: 0,
  me: null,
  streak: 0,
};

describe('kunlik boshqotirma', () => {
  it('kun Toshkent yarim tunida (19:00 UTC) almashadi', () => {
    const before = dayOf(Date.parse('2026-11-07T18:59:59Z'));
    const after = dayOf(Date.parse('2026-11-07T19:00:00Z'));
    expect(after).toBe(before + 1);
    expect(dayLabel(after)).toBe('8-noyabr');
    expect(dayLabel(before)).toBe('7-noyabr');
  });

  it('seriya bugun yoki kechadan orqaga sanaladi', () => {
    expect(streakFrom([10, 9, 8], 10)).toBe(3);
    expect(streakFrom([9, 8], 10)).toBe(2); // bugungisi hali yechilmagan — seriya saqlanadi
    expect(streakFrom([8, 7], 10)).toBe(0);
    expect(streakFrom([10, 8, 7], 10)).toBe(1);
    expect(streakFrom([], 10)).toBe(0);
  });

  it('masala daraja ko\'rinishida tekshiriladi', () => {
    const level = puzzleLevel(info);
    expect(level.id).toBe(`daily-${info.day}`);
    // 00010101 — 3, 5, 7-qatorlar: Q = C AND (A OR B).
    const circuit = {
      gates: [
        { id: 'o', type: 'OR' as const, x: 0, y: 0 },
        { id: 'a', type: 'AND' as const, x: 0, y: 0 },
      ],
      wires: [
        { from: 'in:A', to: 'o:0' },
        { from: 'in:B', to: 'o:1' },
        { from: 'o', to: 'a:0' },
        { from: 'in:C', to: 'a:1' },
        { from: 'a', to: 'out:Q' },
      ],
    };
    expect(check(level, circuit)).toMatchObject({ ok: true, gates: 2, stars: 3 });
  });

  it('maslahat va ulashish matni', () => {
    expect(hintText(info.puzzle)).toBe('Eng kam yechimda: 1 × AND, 1 × OR. Boshlanishi: A va B → AND.');
    expect(hintText({ ...info.puzzle, hint: { gates: { NAND: 4 }, first: ['NAND', 'A', 'A'] } })).toContain('A → NAND');
    expect(dailyShareText(info, 3, 2, 1)).toBe(
      "Logic Gate · Kunlik boshqotirma #2 (8-noyabr)\n★★☆ — 3 ta element (minimum: 2)\nSen ham yechib ko'r!",
    );
    expect(dailyShareText(info, 2, 3, 5)).toContain('\n🔥 5 kun ketma-ket\n');
  });
});
