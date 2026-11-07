// Ketma-ket sxemalar uchun to'liq qidiruv: berilgan avtomatni k ta D-trigger va m ta element bilan
// beradigan sxema bormi. levels/seq-min.mjs (darajalar minimumi) va levels/daily.mjs (xotirali
// kunlik masalalar) ishlatadi.
import { machineOf } from './machine.mjs';

export const OPS = {
  NOT: (a) => ~a,
  AND: (a, b) => a & b,
  OR: (a, b) => a | b,
  XOR: (a, b) => a ^ b,
  NAND: (a, b) => ~(a & b),
  NOR: (a, b) => ~(a | b),
  XNOR: (a, b) => ~(a ^ b),
};

/**
 * k trigger va gatesN element bilan m avtomatni beradigan sxema bormi; bo'lsa — tavsifi:
 * { gates: [[tur, a, b]…], outputs: [signal…], dffInputs: [signal…] }. Signal raqamlari: avval kirishlar,
 * keyin triggerlar, keyin elementlar (qo'shilish tartibida).
 */
export function search(level, m, k, gatesN) {
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

/**
 * Qidiruv tavsifidagi (yoki xuddi shu shakldagi tasodifiy) sxemaning eng kichik avtomati.
 * w = { gates, outputs, dffInputs }, signal raqamlari search dagidek.
 */
export function machineOfWitness(inputs, outputs, k, w) {
  const step = (state, ...bits) => {
    const sig = [...bits];
    for (let i = 0; i < k; i++) sig.push((state >> i) & 1);
    for (const [type, a, b] of w.gates) sig.push(OPS[type](sig[a], sig[b]) & 1);
    let next = 0;
    w.dffInputs.forEach((s, i) => (next |= sig[s] << i));
    return [next, w.outputs.map((s) => sig[s])];
  };
  return machineOf({ inputs, outputs, init: 0, step }, (msg) => {
    throw new Error(msg);
  });
}

/** Qidiruv tavsifidan o'yin sxemasi (D-triggerlar d1…, elementlar g1…). */
export function circuitOfWitness(inputs, outputs, k, w) {
  const names = [...inputs.map((n) => `in:${n}`), ...Array.from({ length: k }, (_, i) => `d${i + 1}`)];
  const gates = Array.from({ length: k }, (_, i) => ({ id: `d${i + 1}`, type: 'DFF', x: 120, y: 40 + i * 90 }));
  w.gates.forEach(([type], i) => {
    gates.push({ id: `g${i + 1}`, type, x: 260 + i * 140, y: 40 + (i % 2) * 90 });
    names.push(`g${i + 1}`);
  });
  const wires = [];
  w.gates.forEach(([type, a, b], i) => {
    wires.push({ from: names[a], to: `g${i + 1}:0` });
    if (type !== 'NOT') wires.push({ from: names[b], to: `g${i + 1}:1` });
  });
  w.dffInputs.forEach((s, i) => wires.push({ from: names[s], to: `d${i + 1}:0` }));
  outputs.forEach((o, i) => wires.push({ from: names[w.outputs[i]], to: `out:${o}` }));
  return { gates, wires };
}

/** Bosqichli maslahat: tarkib va kirishlarga ulangan birinchi element (bo'lmasa — bo'sh D-trigger). */
export function hintOfWitness(inputs, k, w) {
  const gates = {};
  for (const [type] of w.gates) gates[type] = (gates[type] ?? 0) + 1;
  if (k) gates.DFF = k;
  const n = inputs.length;
  const first = w.gates.find(([type, a, b]) => a < n && (type === 'NOT' || b < n));
  if (!first) return { gates, first: ['DFF'] };
  const [type, a, b] = first;
  return { gates, first: type === 'NOT' ? [type, inputs[a]] : [type, inputs[a], inputs[b]] };
}

/** web/src/sim/sim.ts dagi exampleFor bilan aynan bir xil (o'yin namunani shu yo'l bilan quradi). */
export function exampleFor(m, length = 10) {
  const rows = m.next[0].length;
  const used = new Set();
  const seq = [];
  let s = 0;
  for (let i = 0; i < length; i++) {
    let r = -1;
    for (let k = 0; k < rows && r < 0; k++) {
      const cand = (k + i) % rows;
      if (!used.has(s * rows + cand)) r = cand;
    }
    if (r < 0) r = (i * 5 + 1) % rows;
    used.add(s * rows + r);
    seq.push(r);
    s = m.next[s][r];
  }
  return seq;
}
