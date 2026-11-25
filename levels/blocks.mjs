// Bloklar (mikrosxemalar): yechilgan darajadan olingan tayyor qurilma. Hisoblashda blok ichidagi
// sxema emas, shu jadval ishlatiladi — o'yinchining eski yechimi keyingi darajani buzmaydi.
// Xuddi shu jadvallar web/src/sim/types.ts (BLOCKS) va server/internal/sim/sim.go (Blocks) da:
// build ularni levels.json ga `blocks` sifatida yozadi, ikkala tomondagi testlar solishtiradi.
//
// fn   — kirish bitlari → chiqishlar (outputs tartibida); luts shu fn dan hisoblanadi.
// from — blok qaysi daraja yechilganda ochiladi (Qum qutida); o'sha darajaning fn i bilan bir xil bo'lishi
//        build da tekshiriladi (bo'laklovchi va birlashtirgich — o'sha darajaning o'zida beriladi, tekshiruvsiz).
// bus  — shina oyoqlari: [boshi, kengligi] — ketma-ket oyoqlar bitta keng port bo'lib chiziladi (birinchisi —
//        eng katta bit). Hisoblash bitlar bo'yicha, shina faqat ko'rinish va ulash qulayligi.
// state — xotirali blok (registr): chiqishlar saqlangan qiymat (D-trigger kabi), fn esa (...kirishlar,
//        ...joriy chiqishlar) → keyingi taktdagi chiqishlar. Jadval kirishlar va chiqishlar ustida. Chiqishi
//        kirishiga shu taktda bog'liq emas — u orqali o'tgan aylana sikl emas (ALU + registr halqasi).
//        `from` — ketma-ket daraja: build blok va daraja avtomatlari tengligini tekshiradi.

const num = (bits) => bits.reduce((a, b) => a * 2 + b, 0);
const bitsOf = (v, n) => Array.from({ length: n }, (_, i) => (v >> (n - 1 - i)) & 1);
const pins = (name) => [3, 2, 1, 0].map((i) => `${name}${i}`);
/** Son + ko'chirish: to'rt bit va beshinchi bit (ko'chirish) oxirida. */
const withCarry = (v) => {
  const b = bitsOf(v, 5);
  return [...b.slice(1), b[0]];
};
/** Bitma-bit amal ikki shina ustida: Qk = op(Ak, Bk). */
const bitwise = (op) => ({
  inputs: [...pins('A'), ...pins('B')],
  outputs: pins('Q'),
  from: 'l4',
  bus: { in: [[0, 4], [4, 4]], out: [[0, 4]] },
  fn: (...a) => a.slice(0, 4).map((v, i) => op(v, a[4 + i])),
  free: true,
});

/** ALU: amal kodi f (0 — ADD, 1 — SUB, 2 — AND, 3 — OR) → R (to'rt bit), C, Z. */
export function alu(A, B, f) {
  const v = f === 0 ? A + B : f === 1 ? A + 16 - B : f === 2 ? A & B : A | B;
  const r = v & 15;
  return [...bitsOf(r, 4), f < 2 ? v >> 4 : 0, r === 0 ? 1 : 0];
}

export const blocks = {
  HA: { inputs: ['A', 'B'], outputs: ['S', 'C'], from: 'c1', fn: (A, B) => [A ^ B, A & B] },
  FA: {
    inputs: ['A', 'B', 'Ci'],
    outputs: ['S', 'Co'],
    from: 'c6',
    fn: (A, B, Ci) => [(A + B + Ci) & 1, (A + B + Ci) >> 1],
  },
  MUX: { inputs: ['A', 'B', 'S'], outputs: ['Q'], from: 'c3', fn: (A, B, S) => [S ? B : A] },
  DEC: {
    inputs: ['A', 'B'],
    outputs: ['Y0', 'Y1', 'Y2', 'Y3'],
    from: 'c4',
    fn: (A, B) => [0, 1, 2, 3].map((i) => (i === A * 2 + B ? 1 : 0)),
  },
  // ── Shinalar (4 bit) ──
  SPLIT: { inputs: pins('A'), outputs: pins('A'), from: 'w1', bus: { in: [[0, 4]] }, fn: (...a) => a, free: true },
  JOIN: { inputs: pins('A'), outputs: pins('Q'), from: 'w1', bus: { out: [[0, 4]] }, fn: (...a) => a, free: true },
  NOT4: { inputs: pins('A'), outputs: pins('Q'), from: 'w1', bus: { in: [[0, 4]], out: [[0, 4]] }, fn: (...a) => a.map((v) => v ^ 1) },
  ADD4: {
    inputs: [...pins('A'), ...pins('B'), 'Ci'],
    outputs: [...pins('S'), 'Co'],
    from: 'w3',
    bus: { in: [[0, 4], [4, 4]], out: [[0, 4]] },
    fn: (...a) => {
      const v = bitsOf(num(a.slice(0, 4)) + num(a.slice(4, 8)) + a[8], 5);
      return [...v.slice(1), v[0]];
    },
  },
  MUX4: {
    inputs: [...pins('A'), ...pins('B'), 'S'],
    outputs: pins('Q'),
    from: 'w4',
    bus: { in: [[0, 4], [4, 4]], out: [[0, 4]] },
    fn: (...a) => (a[8] ? a.slice(4, 8) : a.slice(0, 4)),
  },
  INC4: {
    inputs: pins('A'),
    outputs: [...pins('Q'), 'C'],
    from: 'w5',
    bus: { in: [[0, 4]], out: [[0, 4]] },
    fn: (...a) => {
      const v = bitsOf(num(a) + 1, 5);
      return [...v.slice(1), v[0]];
    },
  },
  // Nolmi? (w2): to'rt kirishli NOR — Z = 1 faqat shina qiymati 0 bo'lsa.
  NOR4: { inputs: pins('A'), outputs: ['Z'], from: 'w2', bus: { in: [[0, 4]] }, fn: (...a) => [a.some((v) => v) ? 0 : 1] },
  // ── ALU ──
  // Doimiy manbalar: kirishi yo'q, chiqishi doim 1 yoki 0 (ayirgichda Ci = 1 uchun). «Ayirgich» darajasida beriladi.
  ONE: { inputs: [], outputs: ['Q'], from: 'l2', fn: () => [1], free: true },
  ZERO: { inputs: [], outputs: ['Q'], from: 'l2', fn: () => [0], free: true },
  // Ayirgich: D = A − B (to'rt bit, 16 ga qoldiq), C = 1 — qarz yo'q (A ≥ B). Ichida: A + NOT B + 1.
  SUB4: {
    inputs: [...pins('A'), ...pins('B')],
    outputs: [...pins('D'), 'C'],
    from: 'l2',
    bus: { in: [[0, 4], [4, 4]], out: [[0, 4]] },
    fn: (...a) => withCarry(num(a.slice(0, 4)) + 16 - num(a.slice(4, 8))),
  },
  // Bitma-bit mantiqiy amallar (to'rtta AND / OR / XOR) — «Mantiqiy blok» darajasida beriladi.
  AND4: bitwise((x, y) => x & y),
  OR4: bitwise((x, y) => x | y),
  XOR4: bitwise((x, y) => x ^ y),
  // ALU: F1 F0 = 00 — A + B, 01 — A − B (C — ko'chirish / qarz yo'q), 10 — A AND B, 11 — A OR B (C = 0).
  // Z = 1, agar natija 0 bo'lsa.
  ALU4: {
    inputs: [...pins('A'), ...pins('B'), 'F1', 'F0'],
    outputs: [...pins('R'), 'C', 'Z'],
    from: 'l6',
    bus: { in: [[0, 4], [4, 4]], out: [[0, 4]] },
    fn: (...a) => alu(num(a.slice(0, 4)), num(a.slice(4, 8)), a[8] * 2 + a[9]),
  },
  // ── Registrlar va xotira (xotirali bloklar) ──
  // Yuklanuvchi bit: LD = 1 bo'lgan taktdan keyin Q = D, aks holda Q saqlanadi.
  REG1: { inputs: ['D', 'LD'], outputs: ['Q'], from: 'g1', state: true, fn: (D, LD, Q) => [LD ? D : Q] },
  // To'rt bitli registr: xuddi shunday, D va Q — shinalar.
  REG4: {
    inputs: [...pins('D'), 'LD'],
    outputs: pins('Q'),
    from: 'g2',
    bus: { in: [[0, 4]], out: [[0, 4]] },
    state: true,
    fn: (...a) => (a[4] ? a.slice(0, 4) : a.slice(5, 9)),
  },
  // Dastur hisoblagichi: J = 1 bo'lsa PC := D (o'tish), aks holda PC := PC + 1 (16 dan keyin 0).
  PC4: {
    inputs: [...pins('D'), 'J'],
    outputs: pins('Q'),
    from: 'g4',
    bus: { in: [[0, 4]], out: [[0, 4]] },
    state: true,
    fn: (...a) => (a[4] ? a.slice(0, 4) : bitsOf(num(a.slice(5, 9)) + 1, 4)),
  },
};

/** Jadval ustunlari: kirishlar, xotirali blokda — keyin joriy chiqishlar ham. */
export const tableInputs = (b) => (b.state ? [...b.inputs, ...b.outputs] : b.inputs);

/**
 * Har chiqish uchun jadval — o'n oltilik son (satr): r-bit — r-qatordagi qiymat (birinchi kirish — eng
 * katta bit). Satr, son emas: 9–10 kirishli blokda jadval 512–1024 bit.
 */
export function lutsOf(b) {
  const n = tableInputs(b).length;
  const luts = b.outputs.map(() => 0n);
  for (let r = 0; r < 1 << n; r++) {
    const bits = Array.from({ length: n }, (_, k) => (r >> (n - 1 - k)) & 1);
    b.fn(...bits).forEach((v, i) => {
      if (v) luts[i] |= 1n << BigInt(r);
    });
  }
  return luts.map((l) => l.toString(16));
}

/** Blok chiqishlari (bitlar massividan). Xotirali blokda — keyingi takt chiqishlari (ins — kirishlar va joriy chiqishlar). */
export function blockOutputs(type, ins) {
  return blocks[type].fn(...ins);
}
