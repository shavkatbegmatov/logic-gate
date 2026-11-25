// source.mjs → levels.json (o'yin uchun) va solutions.json (faqat testlar uchun).
// Ishga tushirish: node levels/build.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blockOutputs, blocks, lutsOf } from './blocks.mjs';
import * as ru from './i18n.ru.mjs';
import { machineOf as buildMachine, rowsOf } from './machine.mjs';
import { chapters, levels } from './source.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ONE_INPUT = new Set(['NOT', 'DFF']);
const errors = [];

const OPS = {
  NOT: (a) => a ^ 1,
  AND: (a, b) => a & b,
  OR: (a, b) => a | b,
  XOR: (a, b) => a ^ b,
  NAND: (a, b) => (a & b) ^ 1,
  NOR: (a, b) => (a | b) ^ 1,
  XNOR: (a, b) => (a ^ b) ^ 1,
};

/** Element kirishlari soni: blokda — oyoqlari soni. */
const arityOf = (type) => (blocks[type] ? blocks[type].inputs.length : ONE_INPUT.has(type) ? 1 : 2);

/** Element chiqishlari (massiv): blokda bir nechta. */
const gateOuts = (type, ins) => (blocks[type] ? blockOutputs(type, ins) : [OPS[type](...ins)]);

/** Xotirali element: D-trigger yoki registr bloki — chiqishi saqlangan qiymat, shu taktda kirishiga bog'liq emas. */
const isStateful = (type) => type === 'DFF' || !!blocks[type]?.state;
/** Element saqlaydigan bitlar soni (holat bitmaskasida). */
const stateBits = (type) => (type === 'DFF' ? 1 : blocks[type]?.state ? blocks[type].outputs.length : 0);

/** Yechimdagi manba: "f" — f ning 0-chiqishi, "f.1" — 1-chiqishi (blokda). */
function splitSrc(s) {
  const i = s.lastIndexOf('.');
  return i < 0 ? [s, 0] : [s.slice(0, i), Number(s.slice(i + 1))];
}

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
  const depthOf = (src, seen = new Set()) => {
    if (isInput(src)) return 0;
    const [name] = splitSrc(src);
    if (isStateful(g[name]?.[0])) return 1;
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
      depth[name] = 1 + Math.max(0, ...srcs.map((s) => (isStateful(g[splitSrc(s)[0]]?.[0]) ? 1 : depthOf(s, seen))));
      seen.delete(name);
    }
    return depth[name];
  };
  Object.keys(g).forEach((name) => {
    if (isStateful(g[name][0])) {
      depth[name] = 1;
      g[name].slice(1).forEach((s) => depthOf(s));
    } else depthOf(name);
  });

  // Ustundagi navbatdagi bo'sh y: blok oddiy elementdan baland (oyoqlari soniga qarab) — ustma-ust tushmasin.
  const nextY = {};
  const gates = Object.entries(g).map(([id, [type, ...srcs]]) => {
    const d = depth[id];
    const y = nextY[d] ?? 40;
    const h = blocks[type] ? Math.max(blocks[type].inputs.length, blocks[type].outputs.length) * 24 : 48;
    nextY[d] = y + Math.max(90, h + 42);
    const want = arityOf(type);
    if (srcs.length !== want) fail(level.id, `${id}: ${type} uchun ${want} ta kirish kerak`);
    if (!level.gates.includes(type)) fail(level.id, `${id}: ${type} bu darajada ruxsat etilmagan`);
    return { id, type, x: 120 + (d - 1) * 140, y };
  });
  const src = (s) => {
    if (isInput(s)) return `in:${s}`;
    const [name, k] = splitSrc(s);
    const type = g[name]?.[0];
    if (k < 0 || k >= (blocks[type]?.outputs.length ?? 1) || !Number.isInteger(k)) fail(level.id, `noto'g'ri chiqish "${s}"`);
    return s;
  };
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
  for (let r = 0; r < 1 << n; r++) {
    const env = {};
    level.inputs.forEach((name, k) => (env[name] = (r >> (n - 1 - k)) & 1));
    const outs = {};
    const val = (s) => {
      if (s in env) return env[s];
      const [name, k] = splitSrc(s);
      if (!outs[name]) {
        const [type, ...srcs] = g[name];
        outs[name] = gateOuts(type, srcs.map(val));
      }
      return outs[name][k];
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
  let first = Object.values(level.sol.g).find(([, ...srcs]) => srcs.length && srcs.every((s) => level.inputs.includes(s)));
  if (!first && level.step) first = [level.gates.find(isStateful)];
  if (!first) fail(level.id, "kirishlarga ulangan element yo'q");
  return { gates, first };
}

// ── Ketma-ket masalalar ────────────────────────────────────

/** Mos yozuvdagi yechim (D-triggerlar bilan) avtomat bilan bir xil ishlaydimi — mustaqil tekshiruv. */
function checkSeqSolution(level, m) {
  const { g, out } = level.sol;
  // Xotirali elementlar: har biri holat bitmaskasida o'z joyida (D-trigger — 1 bit, registr — chiqishlari soni).
  const cells = [];
  let width = 0;
  for (const name of Object.keys(g).filter((n) => isStateful(g[n][0]))) {
    cells.push({ name, off: width, bits: stateBits(g[name][0]) });
    width += cells.at(-1).bits;
  }
  const run = (state, bits) => {
    const env = {};
    const cache = {};
    level.inputs.forEach((name, k) => (env[name] = bits[k]));
    for (const c of cells) {
      const q = Array.from({ length: c.bits }, (_, k) => (state >> (c.off + k)) & 1);
      if (g[c.name][0] === 'DFF') env[c.name] = q[0];
      else cache[c.name] = q;
    }
    const val = (s, depth = 0) => {
      if (s in env) return env[s];
      const [name, k] = splitSrc(s);
      if (!g[name] || depth > 64) {
        fail(level.id, `noma'lum manba yoki sikl: ${s}`);
        return 0;
      }
      if (!cache[name]) {
        const [type, ...srcs] = g[name];
        cache[name] = gateOuts(type, srcs.map((x) => val(x, depth + 1)));
      }
      return cache[name][k];
    };
    const outs = level.outputs.map((name) => String(val(out[name])));
    let nextState = 0;
    for (const c of cells) {
      const [type, ...srcs] = g[c.name];
      const next = type === 'DFF' ? [val(srcs[0])] : blockOutputs(type, [...srcs.map((x) => val(x)), ...cache[c.name]]);
      next.forEach((v, k) => (nextState |= v << (c.off + k)));
    }
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

// Bloklar: jadval va blok ochiladigan daraja bir xil ishlashi kerak.
const outBlocks = {};
for (const [type, b] of Object.entries(blocks)) {
  const src = levels.find((l) => l.id === b.from);
  if (b.free) {
    if (!src) fail(type, `blok manbasi ${b.from} yo'q`);
  } else if (b.state) {
    // Xotirali blok: blok (holat — chiqishlar) va ketma-ket daraja avtomatlari bir xil bo'lishi kerak.
    if (!src?.step) fail(type, `blok manbasi ${b.from} ketma-ket daraja emas`);
    else if (JSON.stringify(src.inputs) !== JSON.stringify(b.inputs) || JSON.stringify(src.outputs) !== JSON.stringify(b.outputs)) {
      fail(type, `oyoqlar ${b.from} darajasidagi kirish/chiqishlardan farq qiladi`);
    } else {
      const own = { inputs: b.inputs, outputs: b.outputs, init: b.outputs.map(() => 0), step: (q, ...ins) => [b.fn(...ins, ...q), q] };
      const want = buildMachine(src, (msg) => fail(type, msg));
      const got = buildMachine(own, (msg) => fail(type, msg));
      if (JSON.stringify(want) !== JSON.stringify(got)) fail(type, `${b.from} darajasi avtomatidan farq qiladi`);
    }
  } else if (!src || src.step) fail(type, `blok manbasi ${b.from} kombinatsion daraja emas`);
  else if (JSON.stringify(src.inputs) !== JSON.stringify(b.inputs) || JSON.stringify(src.outputs) !== JSON.stringify(b.outputs)) {
    fail(type, `oyoqlar ${b.from} darajasidagi kirish/chiqishlardan farq qiladi`);
  } else {
    const n = b.inputs.length;
    for (let r = 0; r < 1 << n; r++) {
      const bits = b.inputs.map((_, k) => (r >> (n - 1 - k)) & 1);
      if (src.fn(...bits).join() !== b.fn(...bits).join()) fail(type, `${b.from} bilan ${r}-qatorda farq`);
    }
  }
  outBlocks[type] = { inputs: b.inputs, outputs: b.outputs, luts: lutsOf(b), from: b.from, ...(b.bus && { bus: b.bus }), ...(b.state && { state: true }) };
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

  // Shina: daraja oyoqlaridan ketma-ket bo'lak (hammasi kirish yoki hammasi chiqish), eng katta bit birinchi.
  for (const [name, pins] of Object.entries(level.buses ?? {})) {
    const list = level.inputs.includes(pins[0]) ? level.inputs : level.outputs;
    const at = list.indexOf(pins[0]);
    if (pins.length < 2 || at < 0 || pins.some((p, i) => list[at + i] !== p)) fail(level.id, `${name} shinasi oyoqlari ketma-ket emas`);
  }

  const { fn, sol, step, init, example, ...rest } = level;
  const tr = ru.levels[level.id];
  if (!tr?.title || !tr.task || !tr.hint) fail(level.id, "ruscha tarjima yo'q");
  if (step) {
    // Ketma-ket masala: jadval o'rniga kerakli avtomat va vaqt diagrammasi namunasi.
    if (!level.gates.some(isStateful)) fail(level.id, 'ketma-ket masalada xotirali element (DFF yoki registr) ruxsat etilishi kerak');
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

const data = { version: 1, blocks: outBlocks, chapters: outChapters, levels: outLevels };
writeFileSync(join(here, 'levels.json'), JSON.stringify(data, null, 2) + '\n');
writeFileSync(join(here, 'solutions.json'), JSON.stringify(solutions, null, 2) + '\n');
console.log(`${outLevels.length} ta daraja, ${chapters.length} ta bo'lim yozildi.`);
