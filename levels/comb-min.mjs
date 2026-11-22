// Kombinatsion darajalarda maqsad haqiqatan eng kam element soni ekanini to'liq sanash bilan isbotlaydi
// (ketma-ket darajalar uchun — seq-min.mjs).
//
//   node levels/comb-min.mjs            barcha kombinatsion darajalar (~20 s; eng uzog'i m5 — ~15 s)
//   node levels/comb-min.mjs r5 n6 c3   faqat shular
// Testda (web/scripts/levels-min.test.mjs) — m5 dan tashqari hammasi, kichik chegara bilan (< 1 s).
//
// Sxema — darajada ruxsat etilgan elementlardan k tasi; har element kirishlari — daraja kirishlari yoki
// oldingi elementlar, bir manba ikkala kirishga ham ulanishi mumkin (o'yindagi kabi: NAND(A, A) = NOT A).
// Signal — haqiqat jadvali bitmaskasi (qator r da kirish k = (r >> (n-1-k)) & 1, build.mjs dagi kabi).
// Qisqartirish: mavjud signal bilan bir xil funksiya beradigan element tashlanadi — eng kam elementli
// sxemada bunday element bo'lmaydi (uni olib, foydalanuvchilarini o'sha signalga ulash mumkin).
import { fileURLToPath } from 'node:url';

const BINARY = {
  AND: (a, b) => a & b,
  OR: (a, b) => a | b,
  XOR: (a, b) => a ^ b,
  NAND: (a, b) => ~(a & b),
  NOR: (a, b) => ~(a | b),
  XNOR: (a, b) => ~(a ^ b),
};

function tables(level) {
  const n = level.inputs.length;
  const rows = 1 << n;
  const full = rows === 32 ? 0xffffffff : (1 << rows) - 1;
  const inputs = level.inputs.map((_, k) => {
    let m = 0;
    for (let r = 0; r < rows; r++) if ((r >> (n - 1 - k)) & 1) m |= 1 << r;
    return m >>> 0;
  });
  const targets = level.outputs.map((_, i) => {
    let m = 0;
    for (let r = 0; r < rows; r++) {
      const bits = level.inputs.map((_, k) => (r >> (n - 1 - k)) & 1);
      if (level.fn(...bits)[i]) m |= 1 << r;
    }
    return m >>> 0;
  });
  return { inputs, targets, full };
}

/**
 * k ta elementdan iborat, barcha chiqishlarni beradigan sxema bormi. budget — ko'rib chiqiladigan elementlar
 * soni chegarasi: oshsa, natija noma'lum (null).
 */
export function reachable(level, k, budget = 2e7) {
  if (level.inputs.length > 5) return null;
  const { inputs, targets, full } = tables(level);
  const ops = level.gates.filter((g) => g !== 'DFF');
  const unary = ops.includes('NOT');
  const binary = ops.filter((g) => g in BINARY).map((g) => BINARY[g]);
  const sigs = [...inputs];
  const seen = new Set(sigs);
  let nodes = 0;
  const done = () => targets.every((t) => seen.has(t));
  const tryAdd = (v, used) => {
    v >>>= 0;
    v &= full;
    v >>>= 0;
    if (seen.has(v)) return false;
    if (++nodes > budget) throw new Error('budget');
    sigs.push(v);
    seen.add(v);
    const ok = rec(used + 1);
    sigs.pop();
    seen.delete(v);
    return ok;
  };
  const rec = (used) => {
    if (done()) return true;
    if (used === k) return false;
    // Qolgan elementlar hali yo'q chiqishlarning hammasini bera olmaydi — chuqurroq qidirish behuda.
    if (targets.filter((t) => !seen.has(t)).length > k - used) return false;
    const len = sigs.length;
    for (let i = 0; i < len; i++) {
      if (unary && tryAdd(~sigs[i], used)) return true;
      for (let j = i; j < len; j++) for (const f of binary) if (tryAdd(f(sigs[i], sigs[j]), used)) return true;
    }
    return false;
  };
  try {
    return rec(0);
  } catch (e) {
    if (e.message === 'budget') return null;
    throw e;
  }
}

/** { min, ok }: min — eng kam element soni (yoki null — qidiruv chegaradan oshdi), ok — maqsadga tengmi. */
export function proveMinimum(level, budget) {
  for (let k = 0; k < level.goal; k++) {
    const r = reachable(level, k, budget);
    if (r === null) return { min: null, ok: null };
    if (r) return { min: k, ok: false };
  }
  // Qidiruv to'g'riligining tekshiruvi: maqsad sonida yechim albatta topilishi kerak.
  const atGoal = reachable(level, level.goal, budget);
  if (atGoal === null) return { min: null, ok: null };
  return atGoal ? { min: level.goal, ok: true } : { min: Infinity, ok: false };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { levels } = await import('./source.mjs');
  const ids = process.argv.slice(2);
  let failed = false;
  for (const level of levels.filter((l) => !l.step && (!ids.length || ids.includes(l.id)))) {
    const t0 = Date.now();
    const { min, ok } = proveMinimum(level, 3e9);
    const ms = Date.now() - t0;
    if (ok === null) console.log(`${level.id}: maqsad ${level.goal} — tekshirilmadi (qidiruv juda katta; ${ms} ms)`);
    else if (ok) console.log(`${level.id}: maqsad ${level.goal} — minimum (${ms} ms)`);
    else {
      failed = true;
      console.log(min === Infinity ? `${level.id}: maqsad ${level.goal} da ham yechim topilmadi — qidiruvda xato` : `${level.id}: maqsad ${level.goal}, lekin ${min} ta bilan bo'ladi`);
    }
  }
  process.exit(failed ? 1 : 0);
}
