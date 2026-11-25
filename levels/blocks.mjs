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

const num = (bits) => bits.reduce((a, b) => a * 2 + b, 0);
const bitsOf = (v, n) => Array.from({ length: n }, (_, i) => (v >> (n - 1 - i)) & 1);
const pins = (name) => [3, 2, 1, 0].map((i) => `${name}${i}`);

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
};

/**
 * Har chiqish uchun jadval — o'n oltilik son (satr): r-bit — r-qatordagi qiymat (birinchi kirish — eng
 * katta bit). Satr, son emas: 9–10 kirishli blokda jadval 512–1024 bit.
 */
export function lutsOf(b) {
  const n = b.inputs.length;
  const luts = b.outputs.map(() => 0n);
  for (let r = 0; r < 1 << n; r++) {
    const bits = b.inputs.map((_, k) => (r >> (n - 1 - k)) & 1);
    b.fn(...bits).forEach((v, i) => {
      if (v) luts[i] |= 1n << BigInt(r);
    });
  }
  return luts.map((l) => l.toString(16));
}

/** Blok chiqishlari (bitlar massividan). */
export function blockOutputs(type, ins) {
  return blocks[type].fn(...ins);
}
