// Shinalar (ko'p bitli simlar). Sxemada shina — bir nechta oddiy sim (har bit alohida): simulyator, server va
// saqlash o'zgarmaydi. Shina faqat ko'rinish va ulashda: blokning shina oyoqlari (BLOCKS[t].bus) va darajaning
// shina pinlari (spec.buses) maydonda bitta nuqtada turadi, bitta keng port bo'lib chiziladi, ulanganda hamma
// bitlari birga ulanadi, to'liq shina simi esa bitta qalin chiziq bo'lib chiziladi va ustida son yoziladi.
import { gateOutputValues } from '../sim/sim';
import {
  BLOCKS,
  isBlock,
  parseSource,
  sourcePort,
  type BlockType,
  type BusSpan,
  type Gate,
  type GateType,
  type Spec,
  type Wire,
} from '../sim/types';

export interface PortGroup {
  /** Shina kaliti: `in:A`, `out:Q`, `g1:0` (blok kirishi, boshlang'ich oyoq), `g1.0` (blok chiqishi). */
  key: string;
  /** Shina bitlari portlari, eng katta bit birinchi. */
  ports: string[];
  /** Shu port shinaning nechanchi oyog'i (0 — eng katta bit). */
  bit: number;
}

const range = (n: number) => Array.from({ length: n }, (_, k) => k);

/** Port shinaga tegishli bo'lsa — o'sha shina, aks holda null. */
export function portGroup(port: string, gates: Map<string, Gate>, buses?: Spec['buses']): PortGroup | null {
  const pre = port.startsWith('in:') ? 'in:' : port.startsWith('out:') ? 'out:' : null;
  if (pre) {
    const pin = port.slice(pre.length);
    for (const [name, pins] of Object.entries(buses ?? {})) {
      const bit = pins.indexOf(pin);
      if (bit >= 0) return { key: pre + name, ports: pins.map((p) => pre + p), bit };
    }
    return null;
  }
  const c = port.lastIndexOf(':');
  if (c >= 0) {
    const id = port.slice(0, c);
    const i = Number(port.slice(c + 1));
    const g = gates.get(id);
    if (!g || !isBlock(g.type)) return null;
    for (const [s, w] of BLOCKS[g.type].bus?.in ?? []) {
      if (i >= s && i < s + w) return { key: `${id}:${s}`, ports: range(w).map((k) => `${id}:${s + k}`), bit: i - s };
    }
    return null;
  }
  const { id, k } = parseSource(port);
  const g = gates.get(id);
  if (!g || !isBlock(g.type)) return null;
  for (const [s, w] of BLOCKS[g.type].bus?.out ?? []) {
    if (k >= s && k < s + w) return { key: `${id}.${s}`, ports: range(w).map((j) => sourcePort(id, s + j)), bit: k - s };
  }
  return null;
}

/** Shinaning birinchi (eng katta) bitidan boshqa oyoqlari: maydonda alohida port chizilmaydi. */
export function isHiddenBit(port: string, gates: Map<string, Gate>, buses?: Spec['buses']): boolean {
  const g = portGroup(port, gates, buses);
  return !!g && g.bit > 0;
}

export interface Bundles {
  /** rep[i] — i-sim chiziladigan sim: o'zi (oddiy sim, shina boshi) yoki shina boshi (qolgan bitlar). */
  rep: number[];
  /** Shina boshi → kengligi va bitlar simlari (eng katta bit birinchi). */
  bus: Map<number, number[]>;
}

/**
 * To'liq shina simlari: ikki shina orasida hamma bitlar bir xil tartibda ulangan bo'lsa, ular bitta qalin sim.
 * Qisman ulangan bo'lsa (masalan, eski yoki qo'lda yozilgan sxema) — simlar alohida chiziladi.
 */
export function bundles(wires: Wire[], gates: Map<string, Gate>, buses?: Spec['buses']): Bundles {
  const rep = wires.map((_, i) => i);
  const bus = new Map<number, number[]>();
  const groups = new Map<string, (number | undefined)[]>();
  wires.forEach((w, i) => {
    const a = portGroup(w.from, gates, buses);
    const b = portGroup(w.to, gates, buses);
    if (!a || !b || a.ports.length !== b.ports.length || a.bit !== b.bit) return;
    const key = `${a.key}>${b.key}`;
    // Bo'sh (undefined) qiymatlar bilan: siyrak massivda some() teshiklarni o'tkazib yuborardi.
    const list = groups.get(key) ?? Array.from({ length: a.ports.length }, (): number | undefined => undefined);
    list[a.bit] = i;
    groups.set(key, list);
  });
  for (const list of groups.values()) {
    if (list.some((i) => i === undefined)) continue;
    const members = list as number[];
    for (const i of members) rep[i] = members[0];
    bus.set(members[0], members);
  }
  return { rep, bus };
}

/** Shina qiymati (son): bitlar manbalari qiymatlaridan, eng katta bit birinchi. Biror biti noma'lum — null. */
export function busValue(sources: string[], values: Map<string, number>): number | null {
  let v = 0;
  for (const s of sources) {
    const b = values.get(s);
    if (b === undefined) return null;
    v = v * 2 + b;
  }
  return v;
}

/** Daraja pinlari guruhi: oddiy pin (bitta) yoki shina (bir nechta, eng katta bit birinchi). */
export interface PinGroup {
  /** Maydondagi nom: pin nomi yoki shina nomi. */
  name: string;
  pins: string[];
  /** spec.inputs / spec.outputs dagi o'rinlari (pins bilan bir tartibda). */
  idx: number[];
  bus: boolean;
}

/** Pinlarni maydondagi tartibda guruhlaydi: shina bitlari bitta guruh (birinchi biti turgan joyda). */
export function pinGroups(pins: string[], buses?: Spec['buses']): PinGroup[] {
  const owner = new Map<string, string>();
  for (const [name, bits] of Object.entries(buses ?? {})) for (const p of bits) owner.set(p, name);
  const list: PinGroup[] = [];
  const open = new Map<string, PinGroup>();
  pins.forEach((p, k) => {
    const name = owner.get(p);
    if (name === undefined) {
      list.push({ name: p, pins: [p], idx: [k], bus: false });
      return;
    }
    let g = open.get(name);
    if (!g) {
      g = { name, pins: [], idx: [], bus: true };
      open.set(name, g);
      list.push(g);
    }
    g.pins.push(p);
    g.idx.push(k);
  });
  return list;
}

/** Guruh qiymati (son) bitlar qatoridan; biror biti noma'lum (null) — null. */
export function groupValue(bits: readonly (number | null | undefined)[], idx: number[]): number | null {
  let v = 0;
  for (const i of idx) {
    const b = bits[i];
    if (b === null || b === undefined) return null;
    v = v * 2 + b;
  }
  return v;
}

/** Shina nomi oyoq nomidan: «A3» → «A» (raqamsiz bo'lsa — o'zi). */
const busName = (pin: string) => pin.replace(/\d+$/, '') || pin;

/** Blok oyoqlari nomlari: shina boshi — shina nomi (A), qolgan bitlari — null, oddiy oyoq — o'z nomi. */
export function blockPortNames(type: BlockType): { ins: (string | null)[]; outs: (string | null)[] } {
  const d = BLOCKS[type];
  const mark = (names: string[], spans: BusSpan[] = []) =>
    names.map((n, i) => {
      const span = spans.find(([s, w]) => i >= s && i < s + w);
      return !span ? n : i === span[0] ? busName(n) : null;
    });
  return { ins: mark(d.inputs, d.bus?.in), outs: mark(d.outputs, d.bus?.out) };
}

/**
 * Korpusdagi oyoq yozuvlari: blokPortNames kabi, lekin bir tomonida yagona port bo'lsa (SPLIT kirishi, JOIN
 * chiqishi, NOT4, NOR4 va doimiy manba chiqishi) — u tomonda yozuv yo'q: adashib bo'lmaydi, korpus o'rtasidagi
 * nom esa ustiga tushardi. Ko'p bitli shina tomonida ham faqat shina boshida yozuv bor.
 */
export function blockPinLabels(type: BlockType): { ins: (string | null)[]; outs: (string | null)[] } {
  const d = BLOCKS[type];
  const names = blockPortNames(type);
  const single = (spans: BusSpan[] | undefined, n: number) =>
    (n === 1 && !spans?.length) || (spans?.length === 1 && spans[0][0] === 0 && spans[0][1] === n);
  // Bitli bloklar (HA, FA, MUX, DEC) yozuvlari o'zgarmaydi: qoida shinali bloklar va doimiy manbalar uchun.
  const plain = !d.bus && d.inputs.length > 0;
  return {
    ins: !plain && single(d.bus?.in, d.inputs.length) ? names.ins.map(() => null) : names.ins,
    outs: !plain && single(d.bus?.out, d.outputs.length) ? names.outs.map(() => null) : names.outs,
  };
}

/** Blok kirish/chiqishlari guruhlari: shina — bitta ustun (son), oddiy oyoq — bit. */
function blockGroups(names: string[], spans: BusSpan[] = []): { name: string; start: number; width: number }[] {
  const list: { name: string; start: number; width: number }[] = [];
  for (let i = 0; i < names.length; ) {
    const span = spans.find(([s]) => s === i);
    const width = span ? span[1] : 1;
    list.push({ name: span ? busName(names[i]) : names[i], start: i, width });
    i += width;
  }
  return list;
}

/** Shinali bloklar uchun misol kirishlar (shina — son, oddiy oyoq — bit): to'liq jadval juda uzun. */
const EXAMPLES: Partial<Record<BlockType, number[][]>> = {
  SPLIT: [[5], [12], [15]],
  JOIN: [
    [0, 1, 0, 1],
    [1, 1, 0, 0],
    [1, 1, 1, 1],
  ],
  NOT4: [[0], [5], [12]],
  ADD4: [
    [3, 4, 0],
    [9, 8, 1],
    [15, 1, 0],
  ],
  MUX4: [
    [3, 9, 0],
    [3, 9, 1],
  ],
  INC4: [[7], [9], [15]],
  NOR4: [[0], [5], [8]],
  SUB4: [
    [7, 3],
    [3, 7],
    [9, 9],
  ],
  AND4: [
    [12, 10],
    [5, 3],
  ],
  OR4: [
    [12, 10],
    [5, 3],
  ],
  XOR4: [
    [12, 10],
    [5, 5],
  ],
  // A B F1 F0: qo'shish (toshib ketish bilan), ayirish (qarz bilan va nol natija), AND, OR.
  ALU4: [
    [9, 8, 0, 0],
    [3, 7, 0, 1],
    [6, 6, 0, 1],
    [12, 10, 1, 0],
    [12, 10, 1, 1],
  ],
  // Xotirali bloklar: oxirgi ustun — joriy Q (holat), natija — keyingi taktdagi Q⁺.
  // D LD Q: yozish va saqlash.
  REG4: [
    [5, 1, 9],
    [5, 0, 9],
    [0, 1, 7],
  ],
  // D J Q: sanash, 15 dan keyin 0, o'tish.
  PC4: [
    [9, 0, 3],
    [9, 0, 15],
    [9, 1, 3],
  ],
};

export interface BusExamples {
  ins: string[];
  outs: string[];
  rows: { ins: number[]; outs: number[] }[];
}

/** Shinali blokning misollar jadvali (sonlarda); shinasiz blok yoki element — null. */
export function busExamples(type: GateType): BusExamples | null {
  if (!isBlock(type) || !BLOCKS[type].bus) return null;
  const d = BLOCKS[type];
  const go = blockGroups(d.outputs, d.bus?.out);
  // Xotirali blok: joriy chiqishlar (Q) ham kirish ustuni, natija — keyingi taktdagi qiymat (Q⁺).
  const gi = [...blockGroups(d.inputs, d.bus?.in), ...(d.state ? go : [])];
  const toBits = (v: number, w: number) => Array.from({ length: w }, (_, j) => (v >> (w - 1 - j)) & 1);
  const rows = (EXAMPLES[type] ?? []).map((vals) => {
    const bits = gi.flatMap((g, j) => toBits(vals[j], g.width));
    const out = gateOutputValues(type, bits);
    return { ins: vals, outs: go.map((g) => out.slice(g.start, g.start + g.width).reduce((v, b) => v * 2 + b, 0)) };
  });
  return { ins: gi.map((g) => g.name), outs: go.map((g) => (d.state ? `${g.name}⁺` : g.name)), rows };
}
