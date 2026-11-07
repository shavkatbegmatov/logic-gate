import { describe, expect, it } from 'vitest';
import { customId, customLevel, decodePuzzle, encodePuzzle, puzzleFromCircuit, type CustomPuzzle } from './custom';
import { hintSteps } from './hints';
import { check } from './sim/sim';
import { GATE_TYPES, type Circuit, type Spec } from './sim/types';

const spec: Spec = { inputs: ['A', 'B', 'C'], outputs: ['Q1'], gates: GATE_TYPES };

// Q1 = (A XOR B) AND C
const circuit: Circuit = {
  gates: [
    { id: 'g1', type: 'XOR', x: 0, y: 0 },
    { id: 'g2', type: 'AND', x: 0, y: 0 },
  ],
  wires: [
    { from: 'in:A', to: 'g1:0' },
    { from: 'in:B', to: 'g1:1' },
    { from: 'g1', to: 'g2:0' },
    { from: 'in:C', to: 'g2:1' },
    { from: 'g2', to: 'out:Q1' },
  ],
};

const make = (title = 'Sinov', by = 'Ali') => {
  const res = puzzleFromCircuit(spec, circuit, { title, by });
  if (!res.ok) throw new Error(res.error.code);
  return res.puzzle;
};

describe("do'stlar masalasi", () => {
  it('sxemadan masala: jadval, maqsad, elementlar va maslahat', () => {
    const p = make();
    expect(p.target).toEqual({ Q1: '00010100' }); // 3 (011) va 5 (101)-qatorlar
    expect(p.goal).toBe(2);
    expect(p.gates).toEqual(['AND', 'XOR']);
    expect(p.hints).toEqual({ gates: { XOR: 1, AND: 1 }, first: ['XOR', 'A', 'B'] });
  });

  it("bo'sh yoki ulanmagan sxemadan masala bo'lmaydi", () => {
    expect(puzzleFromCircuit(spec, { gates: [], wires: [] }, { title: '', by: '' })).toEqual({ ok: false, error: { code: 'empty' } });
    const res = puzzleFromCircuit(spec, { ...circuit, wires: circuit.wires.slice(0, 4) }, { title: '', by: '' });
    expect(res).toMatchObject({ ok: false, error: { code: 'unconnected_output' } });
  });

  it("chiqishga ta'sir qilmaydigan elementlar maqsad va maslahatga kirmaydi", () => {
    // Ortiqcha NOT A (hech qayerga ulanmagan) va ulanmagan kirishli ortiqcha OR.
    const messy: Circuit = {
      gates: [
        { id: 'g9', type: 'NOT', x: 0, y: 0 },
        { id: 'g8', type: 'OR', x: 0, y: 0 },
        ...circuit.gates,
      ],
      wires: [{ from: 'in:A', to: 'g9:0' }, ...circuit.wires],
    };
    const res = puzzleFromCircuit(spec, messy, { title: '', by: '' });
    if (!res.ok) throw new Error(res.error.code);
    expect(res.puzzle.goal).toBe(2);
    expect(res.puzzle.gates).toEqual(['AND', 'XOR']);
    expect(res.puzzle.hints).toEqual({ gates: { XOR: 1, AND: 1 }, first: ['XOR', 'A', 'B'] });
    // Faqat ortiqcha elementlar bo'lsa — bo'sh masala.
    const onlyJunk: Circuit = { gates: messy.gates.slice(0, 1), wires: [{ from: 'in:A', to: 'g9:0' }, { from: 'in:B', to: 'out:Q1' }] };
    expect(puzzleFromCircuit(spec, onlyJunk, { title: '', by: '' })).toEqual({ ok: false, error: { code: 'empty' } });
  });

  it("kodlash va o'qish — o'zbekcha nom bilan ham bir xil", () => {
    const p = make("G'alati sxema — o'yla!", 'Shavkat');
    const code = encodePuzzle(p);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code.length).toBeLessThan(300);
    expect(decodePuzzle(code)).toEqual(p);
  });

  it('nomsiz va maslahatsiz masala ham ishlaydi', () => {
    const p: CustomPuzzle = { ...make('', ''), hints: undefined };
    expect(decodePuzzle(encodePuzzle(p))).toEqual(p);
  });

  it("katta masala: 5 kirish, 4 chiqish — 32 qatorli jadval to'g'ri tiklanadi", () => {
    const big: CustomPuzzle = {
      title: '',
      by: '',
      inputs: ['A', 'B', 'C', 'D', 'E'],
      outputs: ['Q1', 'Q2', 'Q3', 'Q4'],
      gates: ['NAND'],
      goal: 12,
      target: {
        Q1: '01101001100101101001011001101001',
        Q2: '00000000000000001111111111111111',
        Q3: '10101010101010101010101010101010',
        Q4: '11111111111111111111111111111110',
      },
    };
    expect(decodePuzzle(encodePuzzle(big))).toEqual(big);
  });

  it('buzilgan yoki soxta kodlar rad etiladi', () => {
    const enc = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const good = { v: 1, i: ['A', 'B'], o: ['Q1'], g: 2, n: 1, x: ['1'] };
    expect(decodePuzzle(enc(good))).not.toBeNull();
    for (const bad of [
      { ...good, v: 2 },
      { ...good, i: [] },
      { ...good, i: ['A', 'A'] },
      { ...good, i: ['a'] },
      { ...good, i: ['<b>'] },
      { ...good, o: ['A'] },
      { ...good, g: 0 },
      { ...good, g: 128 },
      { ...good, n: 0 },
      { ...good, n: 65 },
      { ...good, x: ['12'] },
      { ...good, x: ['z'] },
      { ...good, x: [] },
    ]) {
      expect(decodePuzzle(enc(bad)), JSON.stringify(bad)).toBeNull();
    }
    expect(decodePuzzle('!!!')).toBeNull();
    expect(decodePuzzle('aGVsbG8gd29ybGQ')).toBeNull(); // "hello world"
    // Noto'g'ri maslahat shunchaki tashlab yuboriladi.
    expect(decodePuzzle(enc({ ...good, h: [9, 0, 0, 0, 0, 0, 0], f: [1, 0, 1] }))?.hints).toBeUndefined();
    // Nom uzunligi cheklanadi.
    expect(decodePuzzle(enc({ ...good, t: 'x'.repeat(100) }))?.title).toHaveLength(40);
  });

  it("muallif yechimi masalani 3 ★ bilan yechadi, maslahat birinchi elementni ko'rsatadi", () => {
    const p = make();
    const code = encodePuzzle(p);
    const level = customLevel(decodePuzzle(code)!, code);
    expect(level.id).toBe(customId(code));
    expect(check(level, circuit)).toEqual({ ok: true, gates: 2, stars: 3 });
    const steps = hintSteps(level);
    expect(steps.map((s) => s.kind)).toEqual(['text', 'text', 'place']);
    expect(steps[2].text).toBe('Boshlang: A va B ni XOR ga ulang.');
    expect(level.task).toBe('Jadvaldagi Q1 ustunini hosil qiling. Muallif 2 ta element ishlatgan.');
  });

  it('id barqaror va kodga bog\'liq', () => {
    const a = encodePuzzle(make('A'));
    const b = encodePuzzle(make('B'));
    expect(customId(a)).toBe(customId(a));
    expect(customId(a)).not.toBe(customId(b));
    expect(customId(a)).toMatch(/^custom-[0-9a-z]+$/);
  });
});
