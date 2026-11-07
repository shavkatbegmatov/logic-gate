// source.mjs → levels.json (o'yin uchun) va solutions.json (faqat testlar uchun).
// Ishga tushirish: node levels/build.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ru from './i18n.ru.mjs';
import { machineOf as buildMachine, rowsOf } from './machine.mjs';
import { chapters, levels } from './source.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ONE_INPUT = new Set(['NOT', 'DFF']);
const errors = [];

function fail(id, msg) {
  errors.push(`${id}: ${msg}`);
}

function targetTable(level) {
  const n = level.inputs.length;
  const cols = level.outputs.map(() => []);
  for (let r = 0; r < 1 << n; r++) {
    const bits = level.inputs.map((_, k) => (r >> (n - 1 - k)) & 1);
    const out = level.fn(...bits);
    if (out.length !== level.outputs.length) fail(level.id, `fn ${out.length} ta qiymat qaytardi`);
    out.forEach((v, i) => cols[i].push(v ? '1' : '0'));
  }
  return Object.fromEntries(level.outputs.map((name, i) => [name, cols[i].join('')]));
}

// Mos yozuvdagi yechimni o'yin formatidagi sxemaga aylantiradi va chuqurlik bo'yicha joylaydi.
// D-trigger birinchi ustunda turadi va manba hisoblanadi: u orqali o'tgan aylana sikl emas.
function toCircuit(level) {
  const { g, out } = level.sol;
  const isInput = (s) => level.inputs.includes(s);
  const depth = {};
  const depthOf = (name, seen = new Set()) => {
    if (isInput(name)) return 0;
    if (g[name]?.[0] === 'DFF') return 1;
    if (!(name in g)) {
      fail(level.id, `noma'lum manba "${name}"`);
      return 0;
    }
    if (seen.has(name)) {
      fail(level.id, `sikl: ${name}`);
      return 0;
    }
    if (depth[name] === undefined) {
      seen.add(name);
      const [, ...srcs] = g[name];
      depth[name] = 1 + Math.max(...srcs.map((s) => (g[s]?.[0] === 'DFF' ? 1 : depthOf(s, seen))));
      seen.delete(name);
    }
    return depth[name];
  };
  Object.keys(g).forEach((name) => {
    if (g[name][0] === 'DFF') {
      depth[name] = 1;
      g[name].slice(1).forEach((s) => depthOf(s));
    } else depthOf(name);
  });

  const rowAt = {};
  const gates = Object.entries(g).map(([id, [type, ...srcs]]) => {
    const d = depth[id];
    rowAt[d] = (rowAt[d] ?? 0) + 1;
    const want = ONE_INPUT.has(type) ? 1 : 2;
    if (srcs.length !== want) fail(level.id, `${id}: ${type} uchun ${want} ta kirish kerak`);
    if (!level.gates.includes(type)) fail(level.id, `${id}: ${type} bu darajada ruxsat etilmagan`);
    return { id, type, x: 120 + (d - 1) * 140, y: 40 + (rowAt[d] - 1) * 90 };
  });
  const src = (s) => (isInput(s) ? `in:${s}` : s);
  const wires = [];
  for (const [id, [, ...srcs]] of Object.entries(g)) {
    srcs.forEach((s, i) => wires.push({ from: src(s), to: `${id}:${i}` }));
  }
  for (const name of level.outputs) {
    if (!out[name]) fail(level.id, `${name} chiqishi ulanmagan`);
    else wires.push({ from: src(out[name]), to: `out:${name}` });
  }
  return { gates, wires };
}

// Mustaqil, juda oddiy baholovchi — build vaqtidagi tez tekshiruv uchun.
function evalSolution(level) {
  const { g, out } = level.sol;
  const n = level.inputs.length;
  const cols = level.outputs.map(() => []);
  const ops = {
    NOT: (a) => a ^ 1,
    AND: (a, b) => a & b,
    OR: (a, b) => a | b,
    XOR: (a, b) => a ^ b,
    NAND: (a, b) => (a & b) ^ 1,
    NOR: (a, b) => (a | b) ^ 1,
    XNOR: (a, b) => (a ^ b) ^ 1,
  };
  for (let r = 0; r < 1 << n; r++) {
    const env = {};
    level.inputs.forEach((name, k) => (env[name] = (r >> (n - 1 - k)) & 1));
    const val = (s) => {
      if (s in env) return env[s];
      const [type, ...srcs] = g[s];
      return (env[s] = ops[type](...srcs.map(val)));
    };
    level.outputs.forEach((name, i) => cols[i].push(String(val(out[name]))));
  }
  return Object.fromEntries(level.outputs.map((name, i) => [name, cols[i].join('')]));
}

// Bosqichli maslahat: 3 ★ yechim tarkibi va kirishlarga to'g'ridan-to'g'ri ulangan birinchi element.
// To'liq yechim brauzerga yuborilmaydi — faqat shu ikki ishora. Xotirali sxemada bunday element
// bo'lmasligi mumkin (hamma narsa D-trigger orqali aylanadi) — unda bo'sh D-trigger taklif qilinadi.
function hintsFor(level) {
  const gates = {};
  for (const [type] of Object.values(level.sol.g)) gates[type] = (gates[type] ?? 0) + 1;
  let first = Object.values(level.sol.g).find(([, ...srcs]) => srcs.every((s) => level.inputs.includes(s)));
  if (!first && level.step) first = ['DFF'];
  if (!first) fail(level.id, "kirishlarga ulangan element yo'q");
  return { gates, first };
}

// ── Ketma-ket masalalar ────────────────────────────────────

/** Mos yozuvdagi yechim (D-triggerlar bilan) avtomat bilan bir xil ishlaydimi — mustaqil tekshiruv. */
function checkSeqSolution(level, m) {
  const { g, out } = level.sol;
  const dffs = Object.keys(g).filter((name) => g[name][0] === 'DFF');
  const ops = {
    NOT: (a) => a ^ 1,
    AND: (a, b) => a & b,
    OR: (a, b) => a | b,
    XOR: (a, b) => a ^ b,
    NAND: (a, b) => (a & b) ^ 1,
    NOR: (a, b) => (a | b) ^ 1,
    XNOR: (a, b) => (a ^ b) ^ 1,
  };
  const run = (state, bits) => {
    const env = {};
    level.inputs.forEach((name, k) => (env[name] = bits[k]));
    dffs.forEach((name, i) => (env[name] = (state >> i) & 1));
    const val = (s, depth = 0) => {
      if (s in env) return env[s];
      if (!g[s] || depth > 64) {
        fail(level.id, `noma'lum manba yoki sikl: ${s}`);
        return 0;
      }
      const [type, ...srcs] = g[s];
      return (env[s] = ops[type](...srcs.map((x) => val(x, depth + 1))));
    };
    const outs = level.outputs.map((name) => String(val(out[name])));
    const nextState = dffs.reduce((acc, name, i) => acc | (val(g[name][1]) << i), 0);
    return [outs.join(''), nextState];
  };
  const rows = rowsOf(level.inputs.length);
  const seen = new Set(['0,0']);
  const queue = [[0, 0, []]];
  for (let qi = 0; qi < queue.length; qi++) {
    const [state, s, path] = queue[qi];
    for (let r = 0; r < rows.length; r++) {
      const [got, ns] = run(state, rows[r]);
      if (got !== m.out[s][r]) {
        fail(level.id, `yechim mos emas: qatorlar ${[...path, r].join(' ')} — kutilgan ${m.out[s][r]}, yechim ${got}`);
        return;
      }
      const key = `${ns},${m.next[s][r]}`;
      if (!seen.has(key)) {
        seen.add(key);
        queue.push([ns, m.next[s][r], [...path, r]]);
      }
    }
  }
}

/** Namuna: har takt uchun kirish bitlari ("0110…" — bitta kirish, yoki ['10', '01', …]). */
function exampleRows(level) {
  const n = level.inputs.length;
  const steps = typeof level.example === 'string' && n === 1 ? [...level.example] : level.example;
  if (!Array.isArray(steps) || steps.length < 4 || steps.length > 12) {
    fail(level.id, 'namuna 4–12 taktdan iborat bo\'lishi kerak');
    return [];
  }
  return steps.map((bits) => {
    if (typeof bits !== 'string' || bits.length !== n || /[^01]/.test(bits)) fail(level.id, `noto'g'ri namuna qadami "${bits}"`);
    return parseInt(bits, 2);
  });
}

const ids = new Set();
const chapterIds = new Set(chapters.map((c) => c.id));
const outLevels = [];
const solutions = {};

for (const level of levels) {
  if (ids.has(level.id)) fail(level.id, 'takroriy id');
  ids.add(level.id);
  if (!chapterIds.has(level.chapter)) fail(level.id, `noma'lum bo'lim ${level.chapter}`);
  const gateCount = Object.keys(level.sol.g).length;
  if (gateCount !== level.goal) fail(level.id, `maqsad ${level.goal}, yechimda ${gateCount} element`);

  const { fn, sol, step, init, example, ...rest } = level;
  const tr = ru.levels[level.id];
  if (!tr?.title || !tr.task || !tr.hint) fail(level.id, "ruscha tarjima yo'q");
  if (step) {
    // Ketma-ket masala: jadval o'rniga kerakli avtomat va vaqt diagrammasi namunasi.
    if (!level.gates.includes('DFF')) fail(level.id, 'ketma-ket masalada DFF ruxsat etilishi kerak');
    const m = buildMachine(level, (msg) => fail(level.id, msg));
    if (m) {
      checkSeqSolution(level, m);
      outLevels.push({ ...rest, seq: { ...m, example: exampleRows(level) }, hints: hintsFor(level), i18n: { ru: tr } });
    }
  } else {
    const target = targetTable(level);
    const got = evalSolution(level);
    for (const name of level.outputs) {
      if (got[name] !== target[name]) fail(level.id, `${name}: kutilgan ${target[name]}, yechim ${got[name]}`);
    }
    outLevels.push({ ...rest, target, hints: hintsFor(level), i18n: { ru: tr } });
  }
  solutions[level.id] = toCircuit(level);
}

if (errors.length) {
  console.error('Darajalarda xatolar:\n' + errors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
}

const outChapters = chapters.map((ch) => {
  const tr = ru.chapters[ch.id];
  if (!tr?.title || !tr.description) fail(ch.id, "bo'lim uchun ruscha tarjima yo'q");
  return { ...ch, i18n: { ru: tr } };
});
for (const id of Object.keys(ru.levels)) if (!ids.has(id)) fail(id, "tarjimada ortiqcha daraja");
if (errors.length) {
  console.error('Tarjimalarda xatolar:\n' + errors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
}

const data = { version: 1, chapters: outChapters, levels: outLevels };
writeFileSync(join(here, 'levels.json'), JSON.stringify(data, null, 2) + '\n');
writeFileSync(join(here, 'solutions.json'), JSON.stringify(solutions, null, 2) + '\n');
console.log(`${outLevels.length} ta daraja, ${chapters.length} ta bo'lim yozildi.`);
