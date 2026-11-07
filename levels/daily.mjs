// Kunlik boshqotirmalar generatori: `node levels/daily.mjs` → daily.json (server uchun) va daily-solutions.json (testlar uchun).
//
// Har bir masala — 3 kirishli (8 qatorli jadval) 1 yoki 2 chiqishli funksiya. "Maqsad" — eng kam element soni:
// u taxmin emas, barcha sxemalarni to'liq sanab chiqib topiladi, shuning uchun 3 ★ olish chindan mahorat talab qiladi.
//
// Generator deterministik (o'zgarmas urug'): qayta ishga tushirish aynan shu faylni beradi. COUNT ni oshirish
// mavjud kunlarni o'zgartirmaydi, faqat oxiriga qo'shadi. Lekin tanlash qoidalarini o'zgartirish o'tgan kunlar
// masalalarini ham o'zgartiradi — ularning natijalari bazada qoladi, shuning uchun buni qilmang.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { circuitOfWitness, exampleFor, hintOfWitness, machineOfWitness, search } from './seqsearch.mjs';

const here = dirname(fileURLToPath(import.meta.url));

/** Birinchi masala kuni (Toshkent vaqti). */
const START = '2026-11-07';
/** 104 hafta: 7 ga karrali, shunda hafta kuni → qiyinlik moslashuvi takrorlanishda ham saqlanadi. */
const COUNT = 728;
const SEED = 0x10c1c;

const BASES = {
  full: { gates: ['NOT', 'AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR'], depth: 5 },
  classic: { gates: ['NOT', 'AND', 'OR'], depth: 7 },
  nand: { gates: ['NAND'], depth: 8 },
  nor: { gates: ['NOR'], depth: 8 },
};

// Qiyinlik (1–5) bo'yicha shablonlar: [bazis, chiqishlar soni, maqsad oralig'i].
const TEMPLATES = {
  1: [['full', 1, 3, 3], ['classic', 1, 3, 4]],
  2: [['full', 1, 4, 4], ['classic', 1, 5, 5], ['full', 2, 3, 3]],
  3: [['classic', 1, 5, 6], ['full', 2, 4, 4], ['nand', 1, 5, 5], ['nor', 1, 4, 5], ['classic', 2, 4, 4]],
  4: [['classic', 1, 6, 6], ['full', 2, 5, 5], ['nand', 1, 6, 6], ['nor', 1, 6, 6], ['classic', 2, 5, 5]],
  5: [['classic', 1, 6, 7], ['nand', 1, 7, 8], ['nor', 1, 7, 7], ['classic', 2, 6, 7], ['nand', 2, 6, 7]],
};
// Hafta kuni (0 — yakshanba) → qiyinlik: dushanba oson, shanba eng qiyin.
const TIER_BY_WEEKDAY = [2, 1, 2, 3, 3, 4, 5];

const INPUTS = ['A', 'B', 'C'];
const INPUT_TT = [0xf0, 0xcc, 0xaa]; // bit r — r-qatordagi qiymat (A — eng katta bit)
const OPS = {
  NOT: (a) => ~a & 255,
  AND: (a, b) => a & b,
  OR: (a, b) => a | b,
  XOR: (a, b) => a ^ b,
  NAND: (a, b) => ~(a & b) & 255,
  NOR: (a, b) => ~(a | b) & 255,
  XNOR: (a, b) => ~(a ^ b) & 255,
};

/**
 * Berilgan elementlar bilan ko'pi bilan `depth` ta elementli barcha sxemalarni sanaydi va har bir funksiya
 * (best1) hamda funksiyalar juftligi (best2) uchun eng kam elementli sxemani topadi.
 *
 * Qisqartirishlar (eng kam sxemani yo'qotmaydi):
 *  - bir xil funksiyani ikki marta yoki o'zgarmas 0/1 ni hisoblash foydasiz;
 *  - bir-biriga bog'liq bo'lmagan qo'shni elementlar faqat kalit o'sish tartibida (almashtirishlar takrorlanmaydi);
 *  - oxirida ko'pi bilan 2 ta element ishlatilmay qolishi mumkin (ular — chiqishlar).
 */
function enumerate(basis) {
  const { gates: types, depth: D } = BASES[basis];
  const hasNot = types.includes('NOT');
  const best1 = new Map();
  const best2 = new Map();
  const sig = [...INPUT_TT];
  const used = new Array(3 + D).fill(0);
  const has = new Uint8Array(256);
  INPUT_TT.forEach((v) => (has[v] = 1));
  const keys = [];
  const stack = []; // [tur, a, b]

  const record = (m, depth) => {
    const f = sig[m - 1];
    if (!best1.has(f) || best1.get(f).length > depth) best1.set(f, stack.slice());
    for (let i = 3; i < m - 1; i++) {
      const k = pairKey(f, sig[i]);
      if (!best2.has(k) || best2.get(k).length > depth) best2.set(k, stack.slice());
    }
  };

  const rec = (depth) => {
    if (depth === D) return;
    const m = 3 + depth;
    let unused = 0;
    for (let i = 3; i < m; i++) if (!used[i]) unused++;
    const left = D - depth - 1;
    for (let t = 0; t < types.length; t++) {
      const type = types[t];
      const unary = type === 'NOT';
      for (let b = 0; b < m; b++) {
        for (let a = unary ? b : 0; a <= b; a++) {
          if (!unary && a === b && hasNot) continue; // NAND(x, x) = NOT x — NOT bor bo'lsa ortiqcha
          const key = (b * 64 + a) * 8 + t;
          if (depth && key <= keys[depth - 1] && a !== m - 1 && b !== m - 1) continue;
          const v = OPS[type](sig[a], sig[b]);
          if (v === 0 || v === 255 || has[v]) continue;
          const u = unused + 1 - (a >= 3 && !used[a] ? 1 : 0) - (b !== a && b >= 3 && !used[b] ? 1 : 0);
          if (u - left > 2) continue;
          sig[m] = v;
          has[v] = 1;
          keys[depth] = key;
          used[a]++;
          if (b !== a) used[b]++;
          used[m] = 0;
          stack.push([type, a, b]);
          record(m + 1, depth + 1);
          rec(depth + 1);
          stack.pop();
          used[a]--;
          if (b !== a) used[b]--;
          has[v] = 0;
        }
      }
    }
  };
  rec(0);
  return { best1, best2 };
}

const pairKey = (f, g) => (f < g ? f * 256 + g : g * 256 + f);

function dependsOn(f, k) {
  const flip = 1 << (2 - k);
  for (let r = 0; r < 8; r++) if (((f >> r) & 1) !== ((f >> (r ^ flip)) & 1)) return true;
  return false;
}
const support = (f) => [0, 1, 2].filter((k) => dependsOn(f, k)).length;
const ttString = (f) => Array.from({ length: 8 }, (_, r) => (f >> r) & 1).join('');

// Masala nomzodlari: shablon kaliti → [{ fns, sol }].
function candidates(basis, outputs, lo, hi, tables) {
  const out = [];
  if (outputs === 1) {
    for (const [f, sol] of tables.best1) {
      if (sol.length >= lo && sol.length <= hi && support(f) === 3) out.push({ fns: [f], sol });
    }
  } else {
    for (const [k, sol] of tables.best2) {
      const f = k >> 8, g = k & 255;
      if (sol.length < lo || sol.length > hi) continue;
      if ((f ^ g) === 255 || support(f) < 2 || support(g) < 2) continue;
      const deps = [0, 1, 2].filter((i) => dependsOn(f, i) || dependsOn(g, i));
      if (deps.length < 3) continue;
      // Ikki chiqish alohida-alohida yig'ilganidan arzonroq bo'lsin — umumiy qism izlash qiziqroq.
      const c1 = tables.best1.get(f)?.length ?? 99, c2 = tables.best1.get(g)?.length ?? 99;
      if (sol.length >= c1 + c2) continue;
      out.push({ fns: [f, g], sol });
    }
  }
  // Map tartibi sanash tartibiga bog'liq — barqaror bo'lishi uchun saralanadi.
  return out.sort((x, y) => x.fns[0] - y.fns[0] || (x.fns[1] ?? 0) - (y.fns[1] ?? 0));
}

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sanab topilgan yechimni (signal indekslari) o'yin sxemasiga aylantiradi. */
function toCircuit(sol, outputs, fns) {
  const names = [...INPUTS.map((n) => `in:${n}`)];
  const sigs = [...INPUT_TT];
  const depth = [0, 0, 0];
  const rows = {};
  const gates = sol.map(([type, a, b], i) => {
    const id = `g${i + 1}`;
    const d = 1 + Math.max(depth[a], depth[b]);
    depth.push(d);
    rows[d] = (rows[d] ?? 0) + 1;
    names.push(id);
    sigs.push(OPS[type](sigs[a], sigs[b]));
    return { id, type, x: 120 + (d - 1) * 140, y: 40 + (rows[d] - 1) * 90 };
  });
  const wires = [];
  sol.forEach(([type, a, b], i) => {
    wires.push({ from: names[a], to: `g${i + 1}:0` });
    if (type !== 'NOT') wires.push({ from: names[b], to: `g${i + 1}:1` });
  });
  outputs.forEach((o, i) => {
    const at = sigs.lastIndexOf(fns[i]);
    if (at < 3) throw new Error(`${o}: yechimda funksiya topilmadi`);
    wires.push({ from: names[at], to: `out:${o}` });
  });
  return { gates, wires };
}

function hintFor(sol) {
  const gates = {};
  for (const [type] of sol) gates[type] = (gates[type] ?? 0) + 1;
  const [type, a, b] = sol[0];
  return { gates, first: type === 'NOT' ? [type, INPUTS[a]] : [type, INPUTS[a], INPUTS[b]] };
}

// ── Asosiy qism ───────────────────────────────────────────────
const t0 = Date.now();
const tables = Object.fromEntries(Object.keys(BASES).map((b) => [b, enumerate(b)]));
const pools = new Map();
for (const list of Object.values(TEMPLATES)) {
  for (const [basis, outs, lo, hi] of list) {
    const key = `${basis}/${outs}/${lo}-${hi}`;
    if (pools.has(key)) continue;
    const all = candidates(basis, outs, lo, hi, tables[basis]);
    if (!all.length) throw new Error(`${key}: nomzod yo'q`);
    pools.set(key, { all, left: [] });
  }
}

const rand = mulberry32(SEED);
const startDay = Date.parse(`${START}T00:00:00Z`) / 86400000;
const puzzles = [];
const solutions = [];
for (let i = 0; i < COUNT; i++) {
  const weekday = (startDay + i + 4) % 7; // 1970-01-01 — payshanba
  const tier = i < 2 ? 2 : TIER_BY_WEEKDAY[weekday]; // ishga tushirish dam olish kunlariga to'g'ri keldi
  const list = TEMPLATES[tier];
  const [basis, outs, lo, hi] = list[Math.floor(rand() * list.length)];
  const pool = pools.get(`${basis}/${outs}/${lo}-${hi}`);
  if (!pool.left.length) pool.left = pool.all.slice();
  const pick = pool.left.splice(Math.floor(rand() * pool.left.length), 1)[0];
  // Juftlikda chiqishlar tartibi ham tasodifiy.
  const fns = outs === 2 && rand() < 0.5 ? [pick.fns[1], pick.fns[0]] : pick.fns;
  const outputs = outs === 1 ? ['Q'] : ['X', 'Y'];
  puzzles.push({
    tier,
    inputs: INPUTS,
    outputs,
    gates: BASES[basis].gates,
    goal: pick.sol.length,
    target: Object.fromEntries(outputs.map((o, k) => [o, ttString(fns[k])])),
    hint: hintFor(pick.sol),
  });
  solutions.push(toCircuit(pick.sol, outputs, fns));
}

// ── Xotira kuni (yakshanba) ───────────────────────────────────
// Oddiy masalalar yuqorida o'zgarishsiz yaratiladi (urug' va tartib o'sha) — so'ng SEQ_FROM dan boshlab
// yakshanbalar xotirali (D-triggerli) masalaga almashtiriladi. Undan oldingi kunlar o'zgarmaydi.
// Masala — kichik tasodifiy sxemaning eng kichik avtomati; maqsad — to'liq qidiruv bilan isbotlangan
// eng kam element soni (seqsearch.mjs, darajalar minimumi bilan bir xil usul).
const SEQ_FROM = 8; // 2026-11-15 — birinchi xotira kuni
const SEQ_SEED = 0x5e9d;
const SEQ_GATES = ['NOT', 'AND', 'OR', 'XOR'];

/** Har bir kirish biror holatda chiqishga yoki keyingi holatga ta'sir qiladimi (ortiqcha kirish bo'lmasin). */
function allInputsMatter(mach, n) {
  for (let k = 0; k < n; k++) {
    const flip = 1 << (n - 1 - k);
    const matters = mach.next.some((row, s) =>
      row.some((_, r) => mach.next[s][r] !== mach.next[s][r ^ flip] || mach.out[s][r] !== mach.out[s][r ^ flip]),
    );
    if (!matters) return false;
  }
  return true;
}

// Nomzodlar: maqsadi 3 va 4 bo'lganlar alohida yig'iladi — ikkalasi ham yetarli bo'lsin.
const SEQ_WANT = { 3: 60, 4: 50 };

function seqCandidates() {
  const rnd = mulberry32(SEQ_SEED);
  const pick = (n) => Math.floor(rnd() * n);
  const seen = new Set();
  const out = [];
  const have = { 3: 0, 4: 0 };
  for (let attempt = 0; attempt < 60000 && (have[3] < SEQ_WANT[3] || have[4] < SEQ_WANT[4]); attempt++) {
    const inputs = rnd() < 0.4 ? ['A'] : ['A', 'B'];
    const n = inputs.length;
    // Jami ≤ 4: minimum isboti uchun qidiruv ≤ 3 element bilan, ya'ni ≤ 5 o'zgaruvchi (32 bitli jadval).
    const total = rnd() < 0.25 ? 3 : 4;
    const k = 1 + pick(2);
    const m = total - k;
    const gates = [];
    for (let i = 0; i < m; i++) gates.push([SEQ_GATES[pick(4)], pick(n + k + i), pick(n + k + i)]);
    const S = n + k + m;
    const w = { gates, outputs: [m && rnd() < 0.7 ? S - 1 : pick(S)], dffInputs: Array.from({ length: k }, () => pick(S)) };
    const mach = machineOfWitness(inputs, ['Q'], k, w);
    if (mach.next.length < 2 || mach.next.length > 4) continue;
    const key = n + JSON.stringify(mach);
    if (seen.has(key)) continue;
    seen.add(key);
    // Kirishga bog'liq bo'lsin va namunada chiqish ham 0, ham 1 bo'lsin.
    const dependsOnInput = [...mach.out, ...mach.next].some((row) => new Set(row).size > 1);
    let st = 0;
    const shown = new Set();
    for (const r of exampleFor(mach)) {
      shown.add(mach.out[st][r]);
      st = mach.next[st][r];
    }
    if (!dependsOnInput || shown.size < 2 || !allInputsMatter(mach, n)) continue;
    // Eng kam element soni: kichik jami sonlardan boshlab qidiriladi; topilmasa — generator sxemasining o'zi.
    const minK = Math.ceil(Math.log2(mach.next.length));
    let best = null;
    for (let t = minK; t < total && !best; t++) {
      for (let kk = minK; kk <= t && !best; kk++) {
        const res = search({ id: 'kunlik', inputs, outputs: ['Q'], gates: SEQ_GATES }, mach, kk, t - kk);
        if (res) best = { goal: t, k: kk, w: res };
      }
    }
    const sol = best ?? { goal: total, k, w };
    if (!(sol.goal in have) || have[sol.goal] >= SEQ_WANT[sol.goal]) continue;
    have[sol.goal]++;
    out.push({ inputs, machine: mach, ...sol });
  }
  return out;
}

const seqPool = seqCandidates();
const seqRand = mulberry32(SEQ_SEED + 1);
let seqLeft = [];
let seqDays = 0;
for (let i = SEQ_FROM; i < COUNT; i++) {
  if ((startDay + i + 4) % 7 !== 0) continue;
  if (!seqLeft.length) seqLeft = seqPool.slice();
  const c = seqLeft.splice(Math.floor(seqRand() * seqLeft.length), 1)[0];
  puzzles[i] = {
    tier: c.goal <= 3 ? 2 : 3,
    inputs: c.inputs,
    outputs: ['Q'],
    gates: ['DFF', ...SEQ_GATES],
    goal: c.goal,
    seq: c.machine,
    hint: hintOfWitness(c.inputs, c.k, c.w),
  };
  solutions[i] = circuitOfWitness(c.inputs, ['Q'], c.k, c.w);
  seqDays++;
}

writeFileSync(join(here, 'daily.json'), JSON.stringify({ version: 1, start: START, puzzles }) + '\n');
writeFileSync(join(here, 'daily-solutions.json'), JSON.stringify(solutions) + '\n');
const byTier = {};
for (const p of puzzles) byTier[p.tier] = (byTier[p.tier] ?? 0) + 1;
console.log(`${puzzles.length} ta kunlik masala yozildi (${Date.now() - t0} ms). Qiyinlik bo'yicha: ${JSON.stringify(byTier)}`);
for (const [k, p] of pools) console.log(`  ${k}: ${p.all.length} nomzod`);
const goals = {};
for (const c of seqPool) goals[c.goal] = (goals[c.goal] ?? 0) + 1;
console.log(`  xotira kunlari: ${seqDays}, nomzodlar: ${seqPool.length}, maqsad bo'yicha: ${JSON.stringify(goals)}`);
