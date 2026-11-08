import { describe, expect, it } from 'vitest';
import { mapCell, mapColumns, markMapSeen, mapSeen } from './levelmap';

describe('darajalar xaritasi', () => {
  it("ustunlar: sig'adiganining eng kattasi, qatorlar to'la", () => {
    expect(mapColumns(900, 6)).toBe(6);
    expect(mapColumns(640, 6)).toBe(3); // 4 sig'adi, lekin 6 ga bo'linmaydi
    expect(mapColumns(420, 6)).toBe(3);
    expect(mapColumns(300, 6)).toBe(2);
    expect(mapColumns(100, 6)).toBe(2);
    expect(mapColumns(900, 7)).toBe(6); // 7 sig'maydi, bo'linadigani yo'q — sig'adigani
    expect(mapColumns(500, 7)).toBe(3); // 7 tub — sig'adigani
  });

  it('ilon tartibi: har bir daraja keyingisiga qo\'shni', () => {
    for (const [n, cols] of [
      [6, 6],
      [6, 3],
      [6, 2],
      [7, 3],
    ]) {
      const cells = Array.from({ length: n }, (_, i) => mapCell(i, n, cols));
      // Barcha joylar har xil.
      expect(new Set(cells.map((c) => `${c.row},${c.col}`)).size).toBe(n);
      for (let i = 0; i < n - 1; i++) {
        const a = cells[i];
        const b = cells[i + 1];
        const step = { r: [0, 1], l: [0, -1], d: [1, 0] }[a.link!];
        expect([b.row - a.row, b.col - a.col], `${n}/${cols} #${i}`).toEqual(step);
      }
      expect(cells[n - 1].link).toBeNull();
    }
    expect([0, 1, 2, 3, 4, 5].map((i) => mapCell(i, 6, 3).col)).toEqual([1, 2, 3, 3, 2, 1]);
  });

  it("ko'rilgan yechimlar takrorlanmaydi", () => {
    mapSeen.value = [];
    markMapSeen(['b1', 'b2']);
    markMapSeen(['b2', 'b3']);
    expect(mapSeen.value).toEqual(['b1', 'b2', 'b3']);
  });
});
