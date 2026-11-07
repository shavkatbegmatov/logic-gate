import { describe, expect, it } from 'vitest';
import { customId, customLevel, decodePuzzle, encodePuzzle, puzzleFromCircuit, type CustomPuzzle } from './custom';
import { hintSteps } from './hints';
import { check } from './sim/sim';
import { ALL_GATE_TYPES, GATE_TYPES, type Circuit, type Spec } from './sim/types';

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

describe("xotirali do'stlar masalasi", () => {
  const seqSpec: Spec = { inputs: ['A'], outputs: ['Q1'], gates: ALL_GATE_TYPES };
  // Almashtirgich: A = 1 bo'lgan taktdan keyin Q1 teskarisiga o'zgaradi.
  const toggle: Circuit = {
    gates: [
      { id: 'x', type: 'XOR', x: 0, y: 0 },
      { id: 'd', type: 'DFF', x: 0, y: 0 },
    ],
    wires: [
      { from: 'in:A', to: 'x:0' },
      { from: 'd', to: 'x:1' },
      { from: 'x', to: 'd:0' },
      { from: 'd', to: 'out:Q1' },
    ],
  };
  const delay: Circuit = {
    gates: [{ id: 'd', type: 'DFF', x: 0, y: 0 }],
    wires: [
      { from: 'in:A', to: 'd:0' },
      { from: 'd', to: 'out:Q1' },
    ],
  };

  it("sxemadan avtomat, havola va qayta o'qish; muallif yechimi 3 ★, boshqa sxema — qarshi misol", () => {
    const res = puzzleFromCircuit(seqSpec, toggle, { title: 'Almashtirgich', by: 'Ali' });
    if (!res.ok) throw new Error(res.error.code);
    const p = res.puzzle;
    expect(p.target).toBeUndefined();
    expect(p.seq).toEqual({ next: [[0, 1], [1, 0]], out: [['0', '0'], ['1', '1']] });
    expect(p.gates).toEqual(['XOR', 'DFF']);
    expect(p.hints).toEqual({ gates: { XOR: 1, DFF: 1 }, first: ['DFF'] });
    const code = encodePuzzle(p);
    expect(decodePuzzle(code)).toEqual(p);
    const level = customLevel(decodePuzzle(code)!, code);
    expect(level.seq?.example).toHaveLength(10);
    expect(check(level, toggle)).toEqual({ ok: true, gates: 2, stars: 3 });
    expect(check(level, delay)).toEqual({ ok: false, trace: [1, 0, 0] });
    expect(level.task).toBe("Namunadagidek ishlaydigan xotirali sxema yig'ing: Q1 vaqt diagrammasidagidek bo'lsin. Muallif 2 ta element ishlatgan.");
    expect(hintSteps(level)[2].text).toBe("Boshlang: maydonga DFF qo'ying.");
  });

  it("holatlari juda ko'p sxema havolaga sig'maydi", () => {
    // 5 ta trigger siljitish registri: 32 holat > 16.
    const gates = Array.from({ length: 5 }, (_, i) => ({ id: `d${i}`, type: 'DFF' as const, x: 0, y: 0 }));
    const wires = gates.map((g, i) => ({ from: i ? `d${i - 1}` : 'in:A', to: `${g.id}:0` }));
    // Chiqish hamma triggerlarga bog'liq bo'lsin (aks holda kichraytirishda holatlar birlashadi).
    const xs = Array.from({ length: 4 }, (_, i) => ({ id: `x${i}`, type: 'XOR' as const, x: 0, y: 0 }));
    const xw = xs.flatMap((x, i) => [
      { from: i ? `x${i - 1}` : 'd0', to: `${x.id}:0` },
      { from: `d${i + 1}`, to: `${x.id}:1` },
    ]);
    const res = puzzleFromCircuit(seqSpec, { gates: [...gates, ...xs], wires: [...wires, ...xw, { from: 'x3', to: 'out:Q1' }] }, { title: '', by: '' });
    expect(res).toEqual({ ok: false, error: { code: 'too_complex' } });
  });

  it('buzilgan xotirali havolalar rad etiladi', () => {
    const enc = (d: unknown) => btoa(JSON.stringify(d)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const good = { v: 1, i: ['A'], o: ['Q1'], g: (1 << 3) | (1 << 7), n: 2, s: { q: '0110', y: '0011' } };
    expect(decodePuzzle(enc(good))?.seq).toEqual({ next: [[0, 1], [1, 0]], out: [['0', '0'], ['1', '1']] });
    expect(decodePuzzle(enc({ ...good, g: 1 << 3 }))).toBeNull(); // DFF ruxsat etilmagan
    expect(decodePuzzle(enc({ ...good, s: { q: '0120', y: '0011' } }))).toBeNull(); // yo'q holat
    expect(decodePuzzle(enc({ ...good, s: { q: '011', y: '001' } }))).toBeNull(); // qatorlarga bo'linmaydi
    expect(decodePuzzle(enc({ ...good, s: { q: '0110', y: '0021' } }))).toBeNull(); // 1 chiqish — faqat 0/1
    expect(decodePuzzle(enc({ ...good, s: { q: '0'.repeat(160), y: '0'.repeat(160) } }))).toBeNull(); // juda katta
    // Kombinatsion masalada DFF bo'lishi mumkin emas.
    const comb = { v: 1, i: ['A'], o: ['Q1'], g: 1 | (1 << 7), n: 1, x: ['1'] };
    expect(decodePuzzle(enc(comb))).toBeNull();
  });
});
