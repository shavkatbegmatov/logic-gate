// Ketma-ket masalalar uchun umumiy: kirishlar qatorlari va kerakli avtomatni qurish.
// build.mjs va seq-min.mjs (minimumni isbotlash) ishlatadi.

export const rowsOf = (n) => Array.from({ length: 1 << n }, (_, r) => Array.from({ length: n }, (_, k) => (r >> (n - 1 - k)) & 1));

/**
 * step(holat, ...kirishlar) → [keyingi holat, chiqishlar] dan eng kichik avtomat: erishiladigan
 * holatlar, so'ng bir xil ishlaydigan holatlarni birlashtirish (Moore algoritmi). Holatlar
 * boshlang'ichdan kenglik bo'yicha raqamlanadi — natija yagona (kanonik).
 */
export function machineOf(level, fail) {
  const rows = rowsOf(level.inputs.length);
  const keyOf = (s) => JSON.stringify(s);
  const ids = new Map([[keyOf(level.init), 0]]);
  const raw = [level.init];
  const next = [];
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    next.push([]);
    out.push([]);
    for (const bits of rows) {
      const [s, o] = level.step(raw[i], ...bits);
      if (o.length !== level.outputs.length) fail(`step ${o.length} ta chiqish qaytardi`);
      if (!ids.has(keyOf(s))) {
        ids.set(keyOf(s), raw.length);
        raw.push(s);
      }
      next[i].push(ids.get(keyOf(s)));
      out[i].push(o.map((v) => (v ? '1' : '0')).join(''));
    }
    if (raw.length > 64) {
      fail("avtomat holatlari juda ko'p");
      return null;
    }
  }
  // Bir xil chiqishli holatlar bir sinf; keyingi holatlar sinflari farq qilsa — ajratiladi.
  let cls = out.map((o) => o.join());
  for (;;) {
    const sig = cls.map((c, i) => `${c}|${next[i].map((j) => cls[j]).join()}`);
    const ids2 = new Map();
    const refined = sig.map((s) => (ids2.has(s) ? ids2.get(s) : (ids2.set(s, String(ids2.size)), String(ids2.size - 1))));
    if (new Set(refined).size === new Set(cls).size) break;
    cls = refined;
  }
  const order = new Map([[cls[0], 0]]);
  const reps = [0];
  for (let i = 0; i < reps.length; i++) {
    for (const j of next[reps[i]]) {
      if (!order.has(cls[j])) {
        order.set(cls[j], reps.length);
        reps.push(j);
      }
    }
  }
  return {
    next: reps.map((i) => next[i].map((j) => order.get(cls[j]))),
    out: reps.map((i) => out[i]),
  };
}
