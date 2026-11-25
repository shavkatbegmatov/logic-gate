// Bloklar (mikrosxemalar): yechilgan darajadan olingan tayyor qurilma. Hisoblashda blok ichidagi
// sxema emas, shu jadval ishlatiladi — o'yinchining eski yechimi keyingi darajani buzmaydi.
// Xuddi shu jadvallar web/src/sim/types.ts (BLOCKS) va server/internal/sim/sim.go (Blocks) da:
// build ularni levels.json ga `blocks` sifatida yozadi, ikkala tomondagi testlar solishtiradi.
//
// fn   — kirish bitlari → chiqishlar (outputs tartibida); luts shu fn dan hisoblanadi.
// from — blok qaysi daraja yechilganda ochiladi (Qum qutida); o'sha darajaning fn i bilan bir xil bo'lishi
//        build da tekshiriladi.

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
};

/** Har chiqish uchun bitmaska: r-bit — r-qatordagi qiymat (birinchi kirish — eng katta bit). */
export function lutsOf(b) {
  const n = b.inputs.length;
  const luts = b.outputs.map(() => 0);
  for (let r = 0; r < 1 << n; r++) {
    const bits = b.inputs.map((_, k) => (r >> (n - 1 - k)) & 1);
    b.fn(...bits).forEach((v, i) => {
      if (v) luts[i] |= 1 << r;
    });
  }
  return luts;
}

/** Blok chiqishlari (bitlar massividan). */
export function blockOutputs(type, ins) {
  return blocks[type].fn(...ins);
}
