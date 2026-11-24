import { describe, expect, it } from 'vitest';
import { alignmentPositions, dataCapacity, formatBits, penalty, qrEncode, qrPath, rsRemainder, versionBits } from './qr';

// Kodlovchi qo'shilganda mustaqil dekoder (jsQR) bilan tekshirilgan: 4 daraja × 8 niqob × 1–10 versiya,
// UTF-8 matnlar — hammasi o'qildi. Bu yerda — standartdagi ma'lum javoblar va shu holatning nusxasi.
describe('QR kod', () => {
  it("Reed–Solomon: standart misol (HELLO WORLD, 1-M)", () => {
    const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
    expect(rsRemainder(data, 10)).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  });

  it('format va versiya satrlari standart jadval bilan bir xil', () => {
    const f = (l: 'L' | 'M' | 'Q' | 'H', m: number) => formatBits(l, m).toString(2).padStart(15, '0');
    expect(f('L', 0)).toBe('111011111000100');
    expect(f('M', 0)).toBe('101010000010010');
    expect(f('Q', 0)).toBe('011010101011111');
    expect(f('H', 0)).toBe('001011010001001');
    expect(f('M', 5)).toBe('100000011001110');
    expect(versionBits(7)).toBe(0x07c94);
    expect(versionBits(10)).toBe(0x0a4d3);
  });

  it("sig'im va tekislash naqshlari", () => {
    expect([1, 3, 10].map((v) => dataCapacity(v, 'M'))).toEqual([16, 44, 216]);
    expect(dataCapacity(4, 'Q')).toBe(48);
    expect(alignmentPositions(1)).toEqual([]);
    expect(alignmentPositions(2)).toEqual([6, 18]);
    expect(alignmentPositions(7)).toEqual([6, 22, 38]);
    expect(alignmentPositions(10)).toEqual([6, 28, 50]);
  });

  it("eng kichik versiya tanlanadi; juda uzun matn — xato", () => {
    expect(qrEncode('HELLO').version).toBe(1);
    // Sinf havolasi (38 bayt) — 3-versiya, 29×29: tarqatmada katta modullar.
    const link = qrEncode('https://logic.noesis.uz/#/class/C7FD68');
    expect(link.version).toBe(3);
    expect(link.modules).toHaveLength(29);
    expect(qrEncode('x'.repeat(213)).version).toBe(10);
    expect(() => qrEncode('x'.repeat(214))).toThrow();
  });

  it('qidiruv, vaqt naqshlari va qora modul joyida', () => {
    const m = qrEncode('https://logic.noesis.uz/#/class/C7FD68').modules;
    const n = m.length;
    for (const [x0, y0] of [
      [0, 0],
      [n - 7, 0],
      [0, n - 7],
    ]) {
      for (let i = 0; i < 7; i++) {
        expect(m[y0][x0 + i]).toBe(true);
        expect(m[y0 + 6][x0 + i]).toBe(true);
        expect(m[y0 + 3][x0 + i]).toBe(i !== 1 && i !== 5);
      }
    }
    for (let i = 8; i < n - 8; i++) {
      expect(m[6][i]).toBe(i % 2 === 0);
      expect(m[i][6]).toBe(i % 2 === 0);
    }
    expect(m[n - 8][8]).toBe(true);
  });

  it("niqob jarimasi eng kami bo'yicha tanlanadi", () => {
    const text = 'https://logic.noesis.uz/#/class/C7FD68';
    const auto = qrEncode(text);
    const scores = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => penalty(qrEncode(text, 'M', k).modules));
    expect(scores[auto.mask]).toBe(Math.min(...scores));
  });

  it("o'zgarmadi: 'LOGIC' (1-M, jsQR bilan o'qilgan nusxa)", () => {
    const q = qrEncode('LOGIC');
    expect(q.mask).toBe(0);
    expect(q.modules.map((r) => r.map((d) => (d ? '#' : '.')).join(''))).toEqual([
      '#######.....#.#######',
      '#.....#.#..##.#.....#',
      '#.###.#...#...#.###.#',
      '#.###.#..#.##.#.###.#',
      '#.###.#.###.#.#.###.#',
      '#.....#..##.#.#.....#',
      '#######.#.#.#.#######',
      '.........####........',
      '#.#.#.#....#....#..#.',
      '#.##....#.....#...##.',
      '..#########.#...##.##',
      '##..#..###....#....#.',
      '#######.#...#.#.#.##.',
      '........####.#.#...#.',
      '#######..#.#.###.#.##',
      '#.....#..#.###.##....',
      '#.###.#.####.###..###',
      '#.###.#.......##.###.',
      '#.###.#.###.#...###.#',
      '#.....#...#...#.#..#.',
      '#######.##..#.#.#.###',
    ]);
  });

  it("SVG yo'li: qatordagi ketma-ket qora modullar bitta to'rtburchak", () => {
    expect(
      qrPath([
        [true, true, false, true],
        [false, false, false, false],
        [false, true, true, true],
      ]),
    ).toBe('M0 0h2v1h-2zM3 0h1v1h-1zM1 2h3v1h-3z');
  });
});
