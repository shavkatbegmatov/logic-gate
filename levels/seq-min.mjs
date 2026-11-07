// Ketma-ket darajalarda maqsad haqiqatan eng kam element soni ekanini to'liq sanash bilan isbotlaydi.
// Ishga tushirish: node levels/seq-min.mjs   (bir necha soniya)
//
// Har qanday sxema = k ta D-trigger + m ta kombinatsion element. Triggerlar chiqishi — qo'shimcha
// o'zgaruvchilar, shuning uchun elementlar (kirishlar + triggerlar) ustidagi funksiyalarni hisoblaydi.
// Maqsaddan kam (k + m < goal) har bir sxema va uning chiqishlari hamda trigger kirishlariga har bir
// ulanish varianti kerakli avtomat bilan BFS orqali solishtiriladi (o'yindagi tekshiruv bilan bir xil).
// Qisqartirish: boshqa signal bilan bir xil funksiya beradigan element tashlanadi — uni olib tashlab,
// foydalanuvchilarini o'sha signalga ulasak, kamroq elementli teng sxema hosil bo'ladi (u ham sanaladi).
import { machineOf } from './machine.mjs';
import { levels } from './source.mjs';

const OPS = {
  NOT: (a) => ~a,
  AND: (a, b) => a & b,
  OR: (a, b) => a | b,
  XOR: (a, b) => a ^ b,
  NAND: (a, b) => ~(a & b),
  NOR: (a, b) => ~(a | b),
  XNOR: (a, b) => ~(a ^ b),
};

/** k trigger va m element bilan yechim bormi; bo'lsa — tavsifi. */
function search(level, m, k, gatesN) {
  const n = level.inputs.length;
  const V = n + k;
  if (V > 5) throw new Error(`${level.id}: ${V} o'zgaruvchi — 32 bitdan oshadi`);
  const size = 1 << V;
  const mask = size === 32 ? 0xffffffff : (1 << size) - 1;
  const norm = (x) => (x & mask) >>> 0;
  // Haqiqat jadvalida p = qator · 2^k + holat; qator — kirishlar (birinchisi katta bit), holat — triggerlar.
  const vars = [];
  for (let v = 0; v < V; v++) {
    let tt = 0;
    for (let p = 0; p < size; p++) {
      const row = p >> k;
      const st = p & ((1 << k) - 1);
      const bit = v < n ? (row >> (n - 1 - v)) & 1 : (st >> (v - n)) & 1;
      if (bit) tt |= 1 << p;
    }
    vars.push(norm(tt));
  }
  const types = level.gates.filter((g) => g !== 'DFF');
  const outs = level.outputs.length;
  const rows = 1 << n;
  const want = m.out.map((row) => row.map((o) => [...o].map(Number)));

  const equivalent = (sig, outIdx, dIdx) => {
    const seen = new Set([0]);
    const queue = [[0, 0]];
    for (let qi = 0; qi < queue.length; qi++) {
      const [st, s] = queue[qi];
      for (let r = 0; r < rows; r++) {
        const p = r * (1 << k) + st;
        for (let j = 0; j < outs; j++) if (((sig[outIdx[j]] >>> p) & 1) !== want[s][r][j]) return false;
        let ns = 0;
        for (let i = 0; i < k; i++) ns |= ((sig[dIdx[i]] >>> p) & 1) << i;
        const key = ns * m.next.length + m.next[s][r];
        if (!seen.has(key)) {
          seen.add(key);
          queue.push([ns, m.next[s][r]]);
        }
      }
    }
    return true;
  };

  // Chiqishlar va trigger kirishlari: har biri istalgan signalga (kirish, trigger, element) ulanadi.
  const tryAssign = (sig) => {
    const picks = outs + k;
    const idx = new Array(picks).fill(0);
    for (;;) {
      if (equivalent(sig, idx.slice(0, outs), idx.slice(outs))) return idx.slice();
      let i = 0;
      while (i < picks && ++idx[i] === sig.length) idx[i++] = 0;
      if (i === picks) return null;
    }
  };

  const sig = [...vars];
  const stack = [];
  let found = null;
  const rec = (depth) => {
    if (found) return;
    if (depth === gatesN) {
      const idx = tryAssign(sig);
      if (idx) found = { gates: stack.map(([t, a, b]) => [t, a, b]), outputs: idx.slice(0, outs), dffInputs: idx.slice(outs) };
      return;
    }
    const have = new Set(sig);
    for (const type of types) {
      const unary = type === 'NOT';
      for (let b = 0; b < sig.length; b++) {
        for (let a = unary ? b : 0; a <= b; a++) {
          const v = norm(OPS[type](sig[a], sig[b]));
          if (have.has(v)) continue;
          sig.push(v);
          stack.push([type, a, b]);
          rec(depth + 1);
          stack.pop();
          sig.pop();
          if (found) return;
        }
      }
    }
  };
  rec(0);
  return found;
}

let failed = false;
for (const level of levels.filter((l) => l.step)) {
  const m = machineOf(level, (msg) => {
    throw new Error(`${level.id}: ${msg}`);
  });
  const minK = Math.ceil(Math.log2(m.next.length));
  const t0 = Date.now();
  let better = null;
  for (let total = 0; total < level.goal && !better; total++) {
    for (let k = minK; k <= total && !better; k++) {
      const res = search(level, m, k, total - k);
      if (res) better = { total, k, ...res };
    }
  }
  // Qidiruv bo'sh emasligini tekshirish: maqsad sonida yechim albatta topilishi kerak.
  let atGoal = null;
  for (let k = minK; k <= level.goal && !atGoal; k++) atGoal = search(level, m, k, level.goal - k);
  const ms = Date.now() - t0;
  if (!atGoal) {
    failed = true;
    console.log(`${level.id}: maqsad ${level.goal} da ham yechim topilmadi — qidiruvda xato`);
  } else if (better) {
    failed = true;
    console.log(`${level.id}: maqsad ${level.goal}, lekin ${better.total} ta bilan bo'ladi (${better.k} trigger):`, JSON.stringify(better));
  } else {
    console.log(`${level.id}: maqsad ${level.goal} — minimum (avtomat ${m.next.length} holat, kamida ${minK} trigger; ${ms} ms)`);
  }
}
process.exit(failed ? 1 : 0);
