// Sxemani tartibga keltirish (Sugiyama / ALAP usuli):
//  1. Ustunlar: chiqishlarga bog'langan elementlar o'ngga (ALAP) tortiladi — barcha chiqish elementlari
//     chiqish pinlari ro'parasida oxirgi ustunda, ularning kirish zanjirlari esa yonma-yon ustunlarda turadi.
//  2. Tartib: ikki tomonlama barycenter va qo'shni almashtirish orqali sim kesishishlari kamaytiriladi.
//  3. Y koordinata: chiqish pinlariga va to'g'ri gorizontal simlarga tekislanadi, PAVA blokli zichlash
//     bilan ustma-ust tushmaydi va o'tuvchi to'g'ri sim yo'laklari bo'sh qoladi.
// Simlar o'zgarmaydi — faqat joylar. Formuladan sxema (formula-build.ts) ham shu joylashni ishlatadi.
// Xotirali elementlar (D-trigger, registr) chiqishi manba kabi hisoblanadi: teskari bog'lanish halqa bo'lmasin.
import { isStateful, parseSource, type Circuit, type Gate, type Spec } from '../sim/types';
import { GATE_W, GRID, layout } from './geometry';
import { gateHeight, inputLeads, outputLeads } from './shapes';

/** Birinchi ustun va ustunlar orasi (o'yin darajalaridagi yechimlar kabi); sig'dirishda — eng kami. */
export const COL_X = 120;
export const COL_STEP = 144;
const MIN_STEP = 108;
/** Kengaygan maydonda ustunlar siqilib qolmasligi uchun qulay oraliq (60 birlik sim yo'lagi). */
const EXPAND_STEP = 132;
const ROW_GAP = 24;
/** Oxirgi ustundan chiqishlargacha bo'sh joy. */
const OUT_GAP = 96;

const snap = (v: number) => Math.round(v / GRID) * GRID;

export interface Tidied {
  circuit: Circuit;
  /** Chiqishlar ustuni: kerak bo'lsa o'ngga suriladi (hech qachon chapga emas). */
  outX: number;
}

interface OutEdge {
  toGate: string | null;
  toPin: string | null;
  toIdx: number;
  fromK: number;
}

interface InEdge {
  from: string;
  fromGate: string | null;
  fromK: number;
  toIdx: number;
}

/**
 * fit — avval ustunlar orasini qisqartirib, mavjud outX ga sig'dirishga harakat qiladi (darajada
 * chiqishlar joyi o'zgarmasin); sig'masa yoki fit=false bo'lsa, outX o'sadi.
 */
export function tidy(spec: Spec, circuit: Circuit, outX: number, opts: { fit?: boolean } = {}): Tidied {
  const gates: Gate[] = circuit.gates.map((g) => ({ ...g }));
  const wires = circuit.wires;
  if (!gates.length) return { circuit: { gates, wires }, outX };

  const byId = new Map(gates.map((g) => [g.id, g]));
  const original = new Map(circuit.gates.map((g) => [g.id, g.y]));
  const srcId = (f: string) => parseSource(f).id;
  const isFeedbackSrc = (id: string) => {
    const g = byId.get(id);
    return !!g && isStateful(g.type);
  };

  const inEdges = new Map<string, InEdge[]>();
  const outEdges = new Map<string, OutEdge[]>();
  for (const g of gates) {
    inEdges.set(g.id, []);
    outEdges.set(g.id, []);
  }
  for (const w of wires) {
    const isOutPin = w.to.startsWith('out:');
    const colon = w.to.lastIndexOf(':');
    const toGate = !isOutPin && colon >= 0 ? w.to.slice(0, colon) : null;
    const toIdx = toGate ? Number(w.to.slice(colon + 1)) : 0;
    const isInPin = w.from.startsWith('in:');
    const parsed = isInPin ? { id: '', k: 0 } : parseSource(w.from);
    const fromGate = !isInPin && byId.has(parsed.id) ? parsed.id : null;

    if (toGate && inEdges.has(toGate)) {
      inEdges.get(toGate)!.push({ from: w.from, fromGate, fromK: parsed.k, toIdx });
    }
    if (fromGate && outEdges.has(fromGate)) {
      outEdges.get(fromGate)!.push({
        toGate: toGate && byId.has(toGate) ? toGate : null,
        toPin: isOutPin ? w.to.slice(4) : null,
        toIdx,
        fromK: parsed.k,
      });
    }
  }
  for (const list of inEdges.values()) list.sort((a, b) => a.toIdx - b.toIdx);

  // 1. ASAP chuqurlik (kirish va D-trigger chiqishi — 0; element — manbalari chuqurligining eng kattasi + 1).
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (id: string): number => {
    const g = byId.get(id);
    if (!g) return 0;
    const known = depth.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0; // tekshiruvdan o'tmagan sxemadagi sikl — yiqilmasin
    visiting.add(id);
    const ins = inEdges.get(id) ?? [];
    const d = 1 + Math.max(0, ...ins.map((e) => (e.fromGate && !isFeedbackSrc(e.fromGate) ? depthOf(e.fromGate) : 0)));
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };
  for (const g of gates) depthOf(g.id);
  const maxDepth = Math.max(0, ...depth.values());

  // 2. ALAP ustun (chiqishga yo'naltirilgan): chiqish elementlari oxirgi ustunda, zanjirlar esa
  //    bevosita iste'molchisining chap ustunida turadi. Ulanmagan (chiqishsiz) element ASAP joyida qoladi.
  const col = new Map<string, number>();
  const visitingBack = new Set<string>();
  const colOf = (id: string): number => {
    const known = col.get(id);
    if (known !== undefined) return known;
    if (visitingBack.has(id)) return depth.get(id) ?? 1;
    const outs = outEdges.get(id) ?? [];
    if (!outs.length) {
      const d = depth.get(id) ?? 1;
      col.set(id, d);
      return d;
    }
    visitingBack.add(id);
    let limit = maxDepth;
    const myDepth = depth.get(id) ?? 1;
    if (!isFeedbackSrc(id)) {
      for (const e of outs) {
        if (e.toGate && (depth.get(e.toGate) ?? 0) > myDepth) {
          limit = Math.min(limit, colOf(e.toGate) - 1);
        }
      }
    }
    visitingBack.delete(id);
    const c = Math.max(myDepth, limit);
    col.set(id, c);
    return c;
  };
  for (const g of gates) colOf(g.id);

  // Ustunlar orasi va chiqishlar ustuni.
  const needed = (s: number) => snap(COL_X + Math.max(0, maxDepth - 1) * s + GATE_W + OUT_GAP);
  let step = COL_STEP;
  if (opts.fit && maxDepth > 1 && needed(step) > outX) {
    if (needed(MIN_STEP) <= outX) {
      step = Math.max(MIN_STEP, Math.floor((outX - OUT_GAP - GATE_W - COL_X) / (maxDepth - 1) / GRID) * GRID);
    } else {
      // Baribir maydon kengayishi kerak — ustunlarni siqmasdan qulay sim yo'laklari qoldiramiz.
      step = EXPAND_STEP;
    }
  }
  const newOutX = Math.max(outX, needed(step));
  const lay = layout(spec, newOutX);

  const outPull = new Map<string, number[]>();
  for (const w of wires) {
    if (!w.to.startsWith('out:')) continue;
    const pin = lay.outputs.get(w.to.slice(4));
    if (!pin) continue;
    const { id, k } = parseSource(w.from);
    const g = byId.get(id);
    const off = g ? (outputLeads(g.type)[k] ?? 0) : 0;
    outPull.set(id, [...(outPull.get(id) ?? []), pin.y - off]);
  }

  // Ustunlar ro'yxati (1..maxDepth) va har elementga X ni berish.
  const cols: Gate[][] = Array.from({ length: maxDepth + 1 }, () => []);
  for (const g of gates) {
    const c = col.get(g.id) ?? 1;
    g.x = COL_X + (c - 1) * step;
    cols[c].push(g);
  }

  // Yordamchi: portlarning joriy Y koordinatasi.
  const outLeadY = (g: Gate, k = 0) => g.y + (outputLeads(g.type)[k] ?? outputLeads(g.type)[0]);
  const inLeadY = (g: Gate, idx = 0) => g.y + (inputLeads(g.type)[idx] ?? inputLeads(g.type)[0]);
  const srcPortY = (e: InEdge): number => {
    if (e.from.startsWith('in:')) return lay.inputs.get(e.from.slice(3))?.y ?? 0;
    const g = e.fromGate ? byId.get(e.fromGate) : undefined;
    return g ? outLeadY(g, e.fromK) : 0;
  };
  const dstPortY = (e: OutEdge): number => {
    if (e.toPin) return lay.outputs.get(e.toPin)?.y ?? 0;
    const g = e.toGate ? byId.get(e.toGate) : undefined;
    return g ? inLeadY(g, e.toIdx) : 0;
  };
  const srcCol = (e: InEdge) => (e.fromGate ? (col.get(e.fromGate) ?? 0) : 0);
  const dstCol = (e: OutEdge) => (e.toGate ? (col.get(e.toGate) ?? maxDepth + 1) : maxDepth + 1);

  // 3. Boshlang'ich Y (chiqish pinlaridan chapga va kirishlardan o'ngga) — tartibni topish uchun.
  for (const g of gates) {
    const pull = outPull.get(g.id);
    if (pull?.length) {
      g.y = pull.reduce((s, v) => s + v, 0) / pull.length;
    } else {
      const ins = inEdges.get(g.id) ?? [];
      const inPinYs = ins
        .filter((e) => e.from.startsWith('in:'))
        .map((e) => srcPortY(e) - (inputLeads(g.type)[e.toIdx] ?? inputLeads(g.type)[0]));
      g.y = inPinYs.length ? inPinYs.reduce((s, v) => s + v, 0) / inPinYs.length : (original.get(g.id) ?? 0);
    }
  }

  /**
   * Elementning maqsad Y koordinatasi: chiqish piniga ulangan element pin ro'parasida qoladi;
   * qolganlari qo'shni ustundagi iste'molchi va manbalarga kuchliroq, uzoq kirishlarga yengilroq tortiladi.
   */
  const desiredY = (g: Gate, dir: 'back' | 'fwd' | 'both'): number => {
    const pull = outPull.get(g.id);
    if (pull?.length) return pull.reduce((s, v) => s + v, 0) / pull.length;
    const myCol = col.get(g.id) ?? 1;
    const ins = (inEdges.get(g.id) ?? []).filter((e) => !e.fromGate || srcCol(e) < myCol);
    const outs = (outEdges.get(g.id) ?? []).filter((e) => e.toPin !== null || (e.toGate !== null && dstCol(e) > myCol));
    const inLeads = inputLeads(g.type);
    const outLeads = outputLeads(g.type);

    // 1 kirishli element (NOT) o'ngdagi bitta qo'shni elementga kirsa:
    // - 1-ustunda to'g'ridan-to'g'ri kirish pinidan kelsa, kirish pini bilan tekis (A → NOT);
    // - ichki ustunlarda (NOT2 → AND2, NOT3 → AND1) bevosita iste'molchi oyog'i ro'parasida tekis.
    if (dir === 'both' && inLeads.length === 1 && outs.length === 1 && outs[0].toGate && dstCol(outs[0]) === myCol + 1) {
      const targetY = dstPortY(outs[0]) - (outLeads[outs[0].fromK] ?? outLeads[0]);
      if (myCol === 1 && ins.length === 1 && ins[0].from.startsWith('in:')) {
        const pinY = srcPortY(ins[0]) - inLeads[0];
        return Math.abs(pinY - targetY) <= 24 ? pinY : (pinY * 2 + targetY) / 3;
      }
      return targetY;
    }

    let sum = 0;
    let wSum = 0;
    const fanout = outs.length > 1;
    if (dir !== 'fwd' || !ins.length) {
      for (const e of outs) {
        const span = Math.max(1, dstCol(e) - myCol);
        // Yagona iste'molchili element bevosita o'shanga tekislanadi; tarmoqlanuvchi (fanout)
        // element esa asosiy chiqish yo'liga (chiqish piniga ulanadigan elementga) ustuvorlik beradi.
        const toOutGate = e.toGate !== null && outPull.has(e.toGate);
        const w = e.toPin ? 6 : fanout ? (toOutGate ? 3.2 : 1.0) : span === 1 ? 3.2 : 1.6 / span;
        const y = dstPortY(e) - (outLeads[e.fromK] ?? outLeads[0]);
        sum += y * w;
        wSum += w;
      }
    } else if (dir === 'fwd') {
      // Oldinga yurishda ham iste'molchilar yengil tortib tursin — qo'shni ustun tartibi buzilmasin.
      for (const e of outs) {
        const span = Math.max(1, dstCol(e) - myCol);
        const w = e.toPin ? 4 : span === 1 ? 1.8 : 0.7 / span;
        const y = dstPortY(e) - (outLeads[e.fromK] ?? outLeads[0]);
        sum += y * w;
        wSum += w;
      }
    }
    if (dir !== 'back' || !outs.length) {
      for (const e of ins) {
        const span = Math.max(1, myCol - srcCol(e));
        const w = fanout ? (span === 1 ? 2.4 : 1.2 / span) : span === 1 ? 2.0 : 0.5 / span;
        const y = srcPortY(e) - (inLeads[e.toIdx] ?? inLeads[0]);
        sum += y * w;
        wSum += w;
      }
    } else if (dir === 'back') {
      // Orqaga yurishda ham kirish pinlari yengil (0.2) bog'lovchi sifatida tenglikni hal qiladi.
      for (const e of ins) {
        if (!e.from.startsWith('in:')) continue;
        const w = fanout ? 0.8 : 0.2;
        const y = srcPortY(e) - (inLeads[e.toIdx] ?? inLeads[0]);
        sum += y * w;
        wSum += w;
      }
    }
    return wSum > 0 ? sum / wSum : (original.get(g.id) ?? 0);
  };

  /**
   * Ustunni berilgan tartibda PAVA (Pool Adjacent Violators) usuli bilan zichlash:
   * ustma-ust tushmaydi, chiqish elementlari o'z pinidan iloji boricha siljimaydi.
   */
  const packColumn = (column: Gate[], wants: Map<string, number>, doSnap: boolean) => {
    if (!column.length) return;
    interface Block {
      items: Gate[];
      offsets: number[];
      height: number;
      wSum: number;
      wySum: number;
      y: number;
    }
    const blocks: Block[] = [];
    for (const g of column) {
      const h = gateHeight(g.type);
      const w = outPull.has(g.id) ? 10 : 1;
      const want = wants.get(g.id) ?? g.y;
      const b: Block = { items: [g], offsets: [0], height: h, wSum: w, wySum: want * w, y: want };
      blocks.push(b);
      while (blocks.length >= 2) {
        const prev = blocks[blocks.length - 2];
        const cur = blocks[blocks.length - 1];
        if (prev.y + prev.height + ROW_GAP <= cur.y + 0.01) break;
        const shift = prev.height + ROW_GAP;
        for (let i = 0; i < cur.items.length; i++) {
          const off = shift + cur.offsets[i];
          const gw = outPull.has(cur.items[i].id) ? 10 : 1;
          const gwant = wants.get(cur.items[i].id) ?? cur.items[i].y;
          prev.items.push(cur.items[i]);
          prev.offsets.push(off);
          prev.wSum += gw;
          prev.wySum += (gwant - off) * gw;
        }
        prev.height = shift + cur.height;
        prev.y = prev.wySum / prev.wSum;
        blocks.pop();
      }
    }
    let nextMin = -Infinity;
    for (const b of blocks) {
      let base = doSnap ? snap(b.y) : b.y;
      if (base < nextMin) base = doSnap ? Math.ceil(nextMin / GRID) * GRID : nextMin;
      for (let i = 0; i < b.items.length; i++) {
        const g = b.items[i];
        let gy = base + b.offsets[i];
        if (doSnap) gy = snap(gy);
        if (gy < nextMin) gy = doSnap ? Math.ceil(nextMin / GRID) * GRID : nextMin;
        g.y = gy;
        nextMin = gy + gateHeight(g.type) + ROW_GAP;
      }
    }
  };

  /** Ikki qo'shni element (top ustida, bot ostida) uchun kesishishlar va vertikal masofa bahosi. */
  const pairScore = (top: Gate, bot: Gate, c: number): [number, number] => {
    const crossCost = (a: { y: number; adj: boolean }[], b: { y: number; adj: boolean }[]) => {
      let cr = 0;
      for (const ae of a) {
        for (const be of b) {
          if (ae.y > be.y + 0.5) {
            // Qo'shni ustunlar orasidagi qisqa simlar kesishishi uzoq kirish simidan ko'ra yomonroq.
            cr += ae.adj && be.adj ? 3 : ae.adj || be.adj ? 2 : 1;
          }
        }
      }
      return cr;
    };
    const leftE = (g: Gate) =>
      (inEdges.get(g.id) ?? [])
        .filter((e) => !e.fromGate || srcCol(e) < c)
        .map((e) => ({ y: srcPortY(e), adj: srcCol(e) === c - 1 }));
    const rightE = (g: Gate) =>
      (outEdges.get(g.id) ?? [])
        .filter((e) => e.toPin !== null || (e.toGate !== null && dstCol(e) > c))
        .map((e) => ({ y: dstPortY(e), adj: dstCol(e) === c + 1 }));
    const cr = crossCost(leftE(top), leftE(bot)) + crossCost(rightE(top), rightE(bot));

    // Ikkinchi mezon: vertikal sim uzunligi (qo'shni ulanishlarga kattaroq og'irlik bilan).
    const topY = Math.min(top.y, bot.y);
    const botY = topY + gateHeight(top.type) + ROW_GAP;
    const spanOf = (g: Gate, gy: number) => {
      let d = 0;
      const inL = inputLeads(g.type);
      const outL = outputLeads(g.type);
      for (const e of inEdges.get(g.id) ?? []) {
        if (e.fromGate && srcCol(e) >= c) continue;
        const w = srcCol(e) === c - 1 ? 2 : 0.6;
        d += Math.abs(srcPortY(e) - (gy + (inL[e.toIdx] ?? inL[0]))) * w;
      }
      for (const e of outEdges.get(g.id) ?? []) {
        if (e.toGate && dstCol(e) <= c) continue;
        const w = dstCol(e) === c + 1 ? 3 : 1;
        d += Math.abs(dstPortY(e) - (gy + (outL[e.fromK] ?? outL[0]))) * w;
      }
      return d;
    };
    return [cr, spanOf(top, topY) + spanOf(bot, botY)];
  };

  // 4. Ikki tomonlama Sugiyama tartiblash (o'ng→chap, chap→o'ng, o'ng→chap) + qo'shni almashtirish.
  const applyColumn = (c: number, dir: 'back' | 'fwd' | 'both', reorder: boolean, doSnap: boolean) => {
    const column = cols[c];
    if (!column.length) return;
    const wants = new Map<string, number>();
    for (const g of column) wants.set(g.id, desiredY(g, dir));
    if (reorder) {
      column.sort((a, b) => (wants.get(a.id)! - wants.get(b.id)!) || a.id.localeCompare(b.id));
    }
    packColumn(column, wants, doSnap);
    if (reorder && column.length > 1) {
      for (let pass = 0; pass < 3; pass++) {
        let changed = false;
        for (let i = 0; i < column.length - 1; i++) {
          const u = column[i];
          const v = column[i + 1];
          // Ikkala chiqish elementining pin tartibini buzmaymiz.
          if (outPull.has(u.id) && outPull.has(v.id)) continue;
          const [cKeep, sKeep] = pairScore(u, v, c);
          const [cSwap, sSwap] = pairScore(v, u, c);
          if (cSwap < cKeep || (cSwap === cKeep && sSwap + 1 < sKeep)) {
            column[i] = v;
            column[i + 1] = u;
            changed = true;
          }
        }
        if (!changed) break;
        packColumn(column, wants, doSnap);
      }
    }
  };

  for (let iter = 0; iter < 2; iter++) {
    for (let c = maxDepth; c >= 1; c--) applyColumn(c, 'back', true, false);
    for (let c = 1; c <= maxDepth; c++) applyColumn(c, 'fwd', true, false);
  }
  // Oxirgi tartiblash o'ngdan chapga — iste'molchi pinlari tartibi ustun tursin.
  for (let c = maxDepth; c >= 1; c--) applyColumn(c, 'back', true, false);

  // 5. Yakuniy tekislash (tartib qotirilgan): o'ngdan chapga chiqishlarga va to'g'ri gorizontal
  //    yo'llarga moslab, panjaraga (GRID) tushiramiz.
  for (let c = maxDepth; c >= 1; c--) applyColumn(c, 'both', false, true);
  for (let c = 1; c <= maxDepth; c++) applyColumn(c, 'both', false, true);
  for (let c = maxDepth; c >= 1; c--) applyColumn(c, 'both', false, true);

  // 6. Uzun to'g'ri gorizontal sim yo'laklarini tozalash: agar oraliq ustundagi biror element
  //    o'zidan o'tib ketuvchi to'g'ri gorizontal sim (y_src === y_dst) ustiga tushib qolsa,
  //    yaqin tomonga siljitamiz (tartib va qo'shni masofani buzmasdan).
  const highways: { y: number; c0: number; c1: number }[] = [];
  for (const w of wires) {
    const isIn = w.from.startsWith('in:');
    const isOut = w.to.startsWith('out:');
    const c0 = isIn ? 0 : (col.get(srcId(w.from)) ?? 0);
    const toGate = !isOut && w.to.includes(':') ? w.to.slice(0, w.to.lastIndexOf(':')) : null;
    const c1 = isOut ? maxDepth + 1 : toGate ? (col.get(toGate) ?? 0) : 0;
    if (c1 - c0 < 2) continue;
    const y0 = isIn
      ? (lay.inputs.get(w.from.slice(3))?.y ?? NaN)
      : (() => {
          const { id, k } = parseSource(w.from);
          const g = byId.get(id);
          return g ? outLeadY(g, k) : NaN;
        })();
    const y1 = isOut
      ? (lay.outputs.get(w.to.slice(4))?.y ?? NaN)
      : (() => {
          const g = toGate ? byId.get(toGate) : undefined;
          const idx = toGate ? Number(w.to.slice(w.to.lastIndexOf(':') + 1)) : 0;
          return g ? inLeadY(g, idx) : NaN;
        })();
    if (Number.isFinite(y0) && Number.isFinite(y1) && Math.abs(y0 - y1) <= GRID) {
      highways.push({ y: Math.abs(y0 - y1) < 1 ? y0 : y1, c0, c1 });
    }
  }
  if (highways.length) {
    for (let c = 1; c <= maxDepth; c++) {
      const column = cols[c];
      const lanes = highways.filter((h) => h.c0 < c && c < h.c1);
      if (!lanes.length || !column.length) continue;
      let touched = false;
      const wants = new Map(column.map((g) => [g.id, g.y]));
      for (const g of column) {
        if (outPull.has(g.id)) continue;
        const h = gateHeight(g.type);
        for (const lane of lanes) {
          if (lane.y >= g.y - 4 && lane.y <= g.y + h + 4) {
            const up = snap(lane.y - h - GRID);
            const down = snap(lane.y + GRID);
            wants.set(g.id, Math.abs(up - g.y) <= Math.abs(down - g.y) ? up : down);
            touched = true;
          }
        }
      }
      if (touched) packColumn(column, wants, true);
    }
  }

  return { circuit: { gates, wires }, outX: newOutX };
}
