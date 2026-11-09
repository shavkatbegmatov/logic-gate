// Sxemani tartibga keltirish: elementlar ustunlarga — kirishdan chuqurligi bo'yicha (kirishdan
// nechanchi element), ustun ichida — manbalari ro'parasida (chiqish pin'iga ulangani — pin
// ro'parasida, sim to'g'ri bo'lsin), ustma-ust tushmaydi.
// Simlar o'zgarmaydi — faqat joylar. Formuladan sxema (formula-build.ts) ham shu joylashni ishlatadi.
// D-trigger chiqishi manba kabi hisoblanadi: teskari bog'lanish halqa bo'lib qolmasin.
import type { Circuit, Gate, Spec } from '../sim/types';
import { GATE_H, GATE_W, GRID, layout } from './geometry';
import { inputLeads, outputY } from './shapes';

/** Birinchi ustun va ustunlar orasi (o'yin darajalaridagi yechimlar kabi); sig'dirishda — eng kami. */
export const COL_X = 120;
export const COL_STEP = 144;
const MIN_STEP = 108;
const ROW_GAP = 24;
/** Oxirgi ustundan chiqishlargacha bo'sh joy. */
const OUT_GAP = 96;

const snap = (v: number) => Math.round(v / GRID) * GRID;

export interface Tidied {
  circuit: Circuit;
  /** Chiqishlar ustuni: kerak bo'lsa o'ngga suriladi (hech qachon chapga emas). */
  outX: number;
}

/**
 * fit — avval ustunlar orasini qisqartirib, mavjud outX ga sig'dirishga harakat qiladi (darajada
 * chiqishlar joyi o'zgarmasin); sig'masa yoki fit=false bo'lsa, outX o'sadi.
 */
export function tidy(spec: Spec, circuit: Circuit, outX: number, opts: { fit?: boolean } = {}): Tidied {
  const gates: Gate[] = circuit.gates.map((g) => ({ ...g }));
  const wires = circuit.wires;
  const byId = new Map(gates.map((g) => [g.id, g]));
  const original = new Map(circuit.gates.map((g) => [g.id, g.y]));
  const inputsOf = (id: string) =>
    wires
      .filter((w) => w.to.startsWith(`${id}:`))
      .sort((a, b) => a.to.localeCompare(b.to))
      .map((w) => w.from);

  // Chuqurlik: kirish va D-trigger chiqishi — 0; element — manbalari chuqurligining eng kattasi + 1.
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (id: string): number => {
    const g = byId.get(id);
    if (!g) return 0;
    const known = depth.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0; // tekshiruvdan o'tmagan sxemadagi sikl — yiqilmasin
    visiting.add(id);
    const d = 1 + Math.max(0, ...inputsOf(id).map((f) => (byId.get(f)?.type === 'DFF' ? 0 : depthOf(f))));
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };
  for (const g of gates) depthOf(g.id);
  const maxDepth = Math.max(0, ...depth.values());

  // Ustunlar orasi va chiqishlar ustuni.
  const needed = (step: number) => snap(COL_X + Math.max(0, maxDepth - 1) * step + GATE_W + OUT_GAP);
  let step = COL_STEP;
  if (opts.fit && maxDepth > 1 && needed(step) > outX) {
    step = Math.max(MIN_STEP, Math.floor((outX - OUT_GAP - GATE_W - COL_X) / (maxDepth - 1) / GRID) * GRID);
  }
  const newOutX = Math.max(outX, needed(step));

  const lay = layout(spec, newOutX);
  const placed = new Set<string>();
  // Manba porti y: kirish pin'i yoki element chiqishi (hali joylanmagan bo'lsa — eski joyi).
  const sourceY = (f: string) => {
    if (f.startsWith('in:')) return lay.inputs.get(f.slice(3))?.y ?? 0;
    const g = byId.get(f);
    if (!g) return 0;
    return (placed.has(f) ? g.y : original.get(f) ?? g.y) + outputY(g.type);
  };
  const outPull = new Map<string, number[]>();
  for (const w of wires) {
    if (!w.to.startsWith('out:')) continue;
    const pin = lay.outputs.get(w.to.slice(4));
    if (pin) outPull.set(w.from, [...(outPull.get(w.from) ?? []), pin.y]);
  }

  for (let d = 1; d <= maxDepth; d++) {
    const column = gates
      .filter((g) => depth.get(g.id) === d)
      .map((g) => {
        const leads = inputLeads(g.type);
        // Chiqish pin'iga ulangan element — aynan pin ro'parasida: chiqishga boradigan uzun sim to'g'ri
        // chiziq bo'lsin (manbalardan keladigan simlar baribir qiya). Qolganlari — manbalari ro'parasida.
        const pull = outPull.get(g.id) ?? [];
        const wants = pull.length
          ? pull.map((y) => y - outputY(g.type))
          : inputsOf(g.id).map((f, i) => sourceY(f) - (leads[i] ?? leads[0]));
        const want = wants.length ? wants.reduce((s, v) => s + v, 0) / wants.length : original.get(g.id) ?? 0;
        return { g, want };
      })
      .sort((a, b) => a.want - b.want || a.g.id.localeCompare(b.g.id));
    let next = -Infinity;
    for (const { g, want } of column) {
      g.x = COL_X + (d - 1) * step;
      g.y = snap(Math.max(want, next));
      if (g.y < next) g.y += GRID;
      next = g.y + GATE_H + ROW_GAP;
      placed.add(g.id);
    }
  }
  return { circuit: { gates, wires }, outX: newOutX };
}
