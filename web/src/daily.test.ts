import { describe, expect, it } from 'vitest';
import type { DailyInfo } from './api';
import { bestFor, dailyHistory, dailyShareText, dayLabel, dayOf, puzzleLevel, recordPractice, streak, streakFrom, today } from './daily';
import { getDraft, pruneDailyDrafts, setDraft } from './state';
import { hintSteps } from './hints';
import { check } from './sim/sim';
import dailyPack from '../../levels/daily.json';
import dailySolutions from '../../levels/daily-solutions.json';
import type { Circuit } from './sim/types';

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
    expect(hintSteps(puzzleLevel(info)).map((s) => s.text)).toEqual([
      "Jadvalda Q = 1 bo'lgan qatorlarga qarang: ularda kirishlar nimasi bilan o'xshash?",
      '3 ★ yechim tarkibi: 1 × AND, 1 × OR.',
      'Boshlang: A va B ni AND ga ulang.',
    ]);
    expect(dailyShareText(info, 3, 2, 1)).toBe(
      "Logic Gate · Kunlik boshqotirma #2 (8-noyabr)\n★★☆ — 3 ta element (minimum: 2)\nSen ham yechib ko'r!",
    );
    expect(dailyShareText(info, 2, 3, 5)).toContain('\n🔥 5 kun ketma-ket\n');
  });
});

describe('xotira kuni (yakshanba)', () => {
  const puzzles = (dailyPack as unknown as { puzzles: DailyInfo['puzzle'][] }).puzzles;
  const sols = dailySolutions as unknown as Circuit[];

  it("yakshanba masalasi — avtomat, namuna, D-trigger; mos yozuvdagi yechim 3 ★", () => {
    // 2026-11-15 — 9-kun, birinchi xotira kuni; 8-noyabr (bugungi yakshanba) o'zgarmagan.
    expect(puzzles[1].seq).toBeUndefined();
    const p = puzzles[8];
    expect(p.seq).toBeDefined();
    expect(p.gates).toContain('DFF');
    const level = puzzleLevel({ ...info, day: info.day + 7, number: 9, puzzle: p });
    expect(level.seq?.example).toHaveLength(10);
    expect(level.task).toContain('xotira kuni');
    expect(check(level, sols[8])).toEqual({ ok: true, gates: p.goal, stars: 3 });
    const steps = hintSteps(level);
    expect(steps).toHaveLength(3);
  });

  it("har bir xotira kuni yechimi 3 ★ (o'yin tekshiruvi bilan)", () => {
    let n = 0;
    puzzles.forEach((p, i) => {
      if (!p.seq) return;
      n++;
      const level = puzzleLevel({ ...info, puzzle: p });
      expect(check(level, sols[i]), `${i + 1}-masala`).toEqual({ ok: true, gates: p.goal, stars: 3 });
    });
    expect(n).toBeGreaterThan(100);
  });
});

describe('arxiv', () => {
  it('yopiq kun mashqi seriya va kunlik tarixga kirmaydi; eng yaxshi natija tanlanadi', () => {
    const day = today() - 5;
    const before = streak.value;
    expect(recordPractice(day, 5, 2).improved).toBe(true);
    expect(recordPractice(day, 6, 1)).toMatchObject({ improved: false, prev: { gates: 5 } });
    expect(dailyHistory.value[day]).toBeUndefined();
    expect(streak.value).toBe(before);
    expect(bestFor(day)).toEqual({ gates: 5, stars: 2 });
    expect(bestFor(day, { gates: 4, stars: 3 })).toEqual({ gates: 4, stars: 3 });
    expect(bestFor(day - 1)).toBeUndefined();
  });

  it("eski kunlar qoralamalaridan ochilayotgani va oxirgi uchtasi qoladi", () => {
    const now = today();
    const c: Circuit = { gates: [], wires: [] };
    for (const d of [10, 9, 8, 7, 6, 1, 0]) setDraft(`daily-${now - d}`, c);
    pruneDailyDrafts(now, `daily-${now - 10}`);
    const kept = [10, 9, 8, 7, 6, 1, 0].filter((d) => getDraft(`daily-${now - d}`));
    expect(kept).toEqual([10, 8, 7, 6, 1, 0]);
  });
});
