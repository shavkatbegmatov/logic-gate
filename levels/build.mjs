// source.mjs → levels.json (o'yin uchun) va solutions.json (faqat testlar uchun).
// Ishga tushirish: node levels/build.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chapters, levels } from './source.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ONE_INPUT = new Set(['NOT']);
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
function toCircuit(level) {
  const { g, out } = level.sol;
  const isInput = (s) => level.inputs.includes(s);
  const depth = {};
  const depthOf = (name, seen = new Set()) => {
    if (isInput(name)) return 0;
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
      depth[name] = 1 + Math.max(...srcs.map((s) => depthOf(s, seen)));
      seen.delete(name);
    }
    return depth[name];
  };
  Object.keys(g).forEach((name) => depthOf(name));

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

  const target = targetTable(level);
  const got = evalSolution(level);
  for (const name of level.outputs) {
    if (got[name] !== target[name]) fail(level.id, `${name}: kutilgan ${target[name]}, yechim ${got[name]}`);
  }

  const { fn, sol, ...rest } = level;
  outLevels.push({ ...rest, target });
  solutions[level.id] = toCircuit(level);
}

if (errors.length) {
  console.error('Darajalarda xatolar:\n' + errors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
}

const data = { version: 1, chapters, levels: outLevels };
writeFileSync(join(here, 'levels.json'), JSON.stringify(data, null, 2) + '\n');
writeFileSync(join(here, 'solutions.json'), JSON.stringify(solutions, null, 2) + '\n');
console.log(`${outLevels.length} ta daraja, ${chapters.length} ta bo'lim yozildi.`);
