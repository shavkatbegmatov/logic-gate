// Simlarni birgalikda yo'naltirish (sxema chizmasi qoidalari):
//  - turli simlar (turli manbalar) bir chiziq ustiga tushmaydi va bir-biriga juda yaqin parallel
//    yurmaydi — har sim qiyalik (yoki vertikal) qismining joyini o'zi tanlaydi;
//  - sim boshqa element ichidan o'tmaydi (iloji bo'lsa);
//  - turli simlar kesishsa — biri ko'prikcha (yarim aylana) bilan ustidan o'tadi: ulanmagani ko'rinsin;
//  - bitta manbadan chiqqan simlar umumiy yo'ldan ayrilgan joyda — nuqta: ulangani ko'rinsin.
// Sim shakli: gorizontal → vertikal → gorizontal (burchaklari 45° bilan kesilgan — plata yo'li);
// tanlanadigani — vertikal qism ("yo'lak") joyi. Ro'para portlar orasida — to'g'ri chiziq, orqaga
// qaytuvchi sim — aylanib (geometry.wireRoute). Ochko'z usul: simlar navbat bilan, har biri avval
// joylashganlarga nisbatan eng "arzon" joyni oladi. Natija deterministik (bir xil sxema — bir xil chizma).
import { parseSource, type Gate, type Wire } from '../sim/types';
import { gateH, GATE_W, GRID, portPoint, wireRoute, type Layout, type Point } from './geometry';

/** Portdan chiqqan to'g'ri qism (geometry.ts dagi STUB bilan bir xil). */
const STUB = 12;
/** Ko'prikcha radiusi. */
export const HOP_R = 7;
/** Qiyalik joyi qadami. */
const STEP = GRID / 2;
/** Bir sim uchun ko'rib chiqiladigan joylar soni (eng yaqinlari). */
const MAX_CANDIDATES = 40;
/** Bundan yaqin parallel simlar bir chiziqdek ko'rinadi. */
const NEAR = 7;
const EPS = 0.5;

const COST = {
  overlap: 2000, // boshqa sim bilan bir chiziq ustida
  touch: 600, // boshqa simning uchi yo'lda (ulangandek ko'rinadi)
  near: 300, // boshqa simga juda yaqin parallel
  gate: 800, // boshqa element ichidan o'tadi
  cross: 40, // boshqa sim bilan kesishadi (ko'prikcha)
  sameCross: 40, // o'z tarmog'i bilan kesishadi
  sameNear: 100, // o'z tarmog'iga yaqin parallel (qo'sh chiziq)
  cramped: 25, // kesishish burchakka juda yaqin
  shift: 0.15, // markazdan siljish (birligiga)
};

export interface Routed {
  /** wires bilan bir xil tartibda; null — porti topilmagan sim. */
  routes: (Point[] | null)[];
  /** hops[sim][qism] — shu qismdagi ko'prikchalar markazlari. */
  hops: Point[][][];
  /** Tarmoqlanish nuqtalari (manba — tarmoq). */
  dots: { net: string; at: Point }[];
}

interface Seg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  net: string;
  wire: number;
  index: number;
  /** 'h' — gorizontal, 'v' — vertikal, 'd' — qiyalik. */
  kind: 'h' | 'v' | 'd';
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function seg(a: Point, b: Point, net: string, wire: number, index: number): Seg {
  const kind = Math.abs(a.y - b.y) < EPS ? 'h' : Math.abs(a.x - b.x) < EPS ? 'v' : 'd';
  return {
    ax: a.x,
    ay: a.y,
    bx: b.x,
    by: b.y,
    net,
    wire,
    index,
    kind,
    minX: Math.min(a.x, b.x),
    maxX: Math.max(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxY: Math.max(a.y, b.y),
  };
}

function segments(pts: Point[], net: string, wire: number): Seg[] {
  const out: Seg[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    if (Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y) > EPS) out.push(seg(pts[i], pts[i + 1], net, wire, i));
  }
  return out;
}

/** Qiyalik: y = slope·x + c. */
const slopeOf = (s: Seg) => (s.by - s.ay) / (s.bx - s.ax);
const interceptOf = (s: Seg) => s.ay - slopeOf(s) * s.ax;

/** Ikki qism bir to'g'ri chiziqda bo'lsa — umumiy qismi uzunligi (0 — yo'q); aks holda -1. */
function collinear(s: Seg, q: Seg): number {
  if (s.kind !== q.kind) return -1;
  if (s.kind === 'h') return Math.abs(s.ay - q.ay) < EPS ? Math.min(s.maxX, q.maxX) - Math.max(s.minX, q.minX) : -1;
  if (s.kind === 'v') return Math.abs(s.ax - q.ax) < EPS ? Math.min(s.maxY, q.maxY) - Math.max(s.minY, q.minY) : -1;
  if (Math.sign(slopeOf(s)) !== Math.sign(slopeOf(q))) return -1;
  if (Math.abs(interceptOf(s) - interceptOf(q)) > EPS) return -1;
  return (Math.min(s.maxX, q.maxX) - Math.max(s.minX, q.minX)) * Math.SQRT2;
}

/** Parallel, lekin bir chiziqda emas: oradagi masofa (bir-birining ro'parasida bo'lsa), aks holda Infinity. */
function parallelGap(s: Seg, q: Seg): number {
  if (s.kind !== q.kind) return Infinity;
  if (s.kind === 'h') {
    return Math.min(s.maxX, q.maxX) - Math.max(s.minX, q.minX) > 2 ? Math.abs(s.ay - q.ay) : Infinity;
  }
  if (s.kind === 'v') {
    return Math.min(s.maxY, q.maxY) - Math.max(s.minY, q.minY) > 2 ? Math.abs(s.ax - q.ax) : Infinity;
  }
  if (Math.sign(slopeOf(s)) !== Math.sign(slopeOf(q))) return Infinity;
  return Math.min(s.maxX, q.maxX) - Math.max(s.minX, q.minX) > 2 ? Math.abs(interceptOf(s) - interceptOf(q)) / Math.SQRT2 : Infinity;
}

/** Ikki qism ichki nuqtada kesishadimi (uchlari emas) — kesishish nuqtasi yoki null. */
export function crossing(s: Seg, q: Seg): Point | null {
  const rx = s.bx - s.ax;
  const ry = s.by - s.ay;
  const sx = q.bx - q.ax;
  const sy = q.by - q.ay;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((q.ax - s.ax) * sy - (q.ay - s.ay) * sx) / den;
  const u = ((q.ax - s.ax) * ry - (q.ay - s.ay) * rx) / den;
  const ls = Math.hypot(rx, ry);
  const lq = Math.hypot(sx, sy);
  // Uchlariga EPS dan yaqin kesishish — kesishish emas, tegish (touch).
  if (t * ls <= EPS || (1 - t) * ls <= EPS || u * lq <= EPS || (1 - u) * lq <= EPS) return null;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: s.ax + t * rx, y: s.ay + t * ry };
}

/** Nuqtadan qismning yaqinroq uchigacha masofa. */
const endDist = (s: Seg, p: Point) => Math.min(Math.hypot(p.x - s.ax, p.y - s.ay), Math.hypot(p.x - s.bx, p.y - s.by));

/** p nuqta s qismning ichida (uchlaridan uzoqda) yotadimi. */
function onInterior(s: Seg, x: number, y: number): boolean {
  if (x < s.minX - EPS || x > s.maxX + EPS || y < s.minY - EPS || y > s.maxY + EPS) return false;
  const cross = (s.bx - s.ax) * (y - s.ay) - (s.by - s.ay) * (x - s.ax);
  if (Math.abs(cross) / Math.hypot(s.bx - s.ax, s.by - s.ay) > EPS) return false;
  return Math.hypot(x - s.ax, y - s.ay) > EPS && Math.hypot(x - s.bx, y - s.by) > EPS;
}

/** Biri ikkinchisining ichiga uchi bilan tegadimi (T shaklida — ulangandek ko'rinadi). */
function touches(s: Seg, q: Seg): boolean {
  return onInterior(s, q.ax, q.ay) || onInterior(s, q.bx, q.by) || onInterior(q, s.ax, s.ay) || onInterior(q, s.bx, s.by);
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  id: string;
}

/** Qism to'rtburchakni kesib o'tadimi (Liang–Barsky). */
function hitsBox(s: Seg, b: Box): boolean {
  if (s.maxX < b.x0 || s.minX > b.x1 || s.maxY < b.y0 || s.minY > b.y1) return false;
  const dx = s.bx - s.ax;
  const dy = s.by - s.ay;
  let t0 = 0;
  let t1 = 1;
  const clip = (p: number, q: number) => {
    if (Math.abs(p) < 1e-12) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  return clip(-dx, s.ax - b.x0) && clip(dx, b.x1 - s.ax) && clip(-dy, s.ay - b.y0) && clip(dy, b.y1 - s.ay) && t1 - t0 > 1e-6;
}

const gateOf = (port: string) => {
  if (port.startsWith('in:') || port.startsWith('out:')) return null;
  const i = port.lastIndexOf(':');
  return i < 0 ? parseSource(port).id : port.slice(0, i);
};

interface Candidate {
  pts: Point[];
  penalty: number;
}

/** O'z tarmog'i bilan umumiy yo'l uchun eng katta chegirma: 3 qism × 30 × 0.1. */
const MAX_BONUS = 9;

/**
 * Sim uchun yo'l variantlari: gorizontal → vertikal → gorizontal, vertikal qism ("yo'lak") har xil x da.
 * Burchaklar chizishda 45° bilan kesiladi (routeD) — plata yo'li ko'rinishi. Uzun 45° qiyaliklar
 * ishlatilmaydi: ular bir-birini qiya kesib o'tadi (ko'prikcha noaniq) va keng joy egallaydi — yo'laklarga
 * ajratib bo'lmaydi.
 */
function candidates(a: Point, b: Point): Candidate[] {
  const ady = Math.abs(b.y - a.y);
  const dx = b.x - a.x;
  if ((ady < EPS && dx >= 0) || dx < 2 * STUB) return [{ pts: wireRoute(a, b), penalty: 0 }];
  const lo = a.x + STUB;
  const hi = b.x - STUB;
  const t0 = Math.round((a.x + b.x) / 2 / STEP) * STEP;
  const ts = new Set<number>([Math.min(hi, Math.max(lo, t0))]);
  for (let t = Math.ceil(lo / STEP) * STEP; t <= hi + EPS; t += STEP) ts.add(t);
  return [...ts]
    .sort((p, q) => Math.abs(p - t0) - Math.abs(q - t0) || p - q)
    .slice(0, MAX_CANDIDATES)
    .map((t) => ({ pts: [a, { x: t, y: a.y }, { x: t, y: b.y }, b], penalty: Math.abs(t - t0) * COST.shift }));
}

/**
 * Barcha simlar yo'li, ko'prikchalar va tarmoqlanish nuqtalari. gates — id → element; lay — pinlar joyi.
 * quick — joy tanlamasdan (har sim markazda): katta sxemada element sudralayotgan paytda, har kadrda;
 * qo'yib yuborilgach to'liq hisoblanadi.
 */
/**
 * rep — shinalar (bus.ts bundles): rep[i] !== i bo'lgan sim alohida yo'naltirilmaydi, shina boshi (rep[i])
 * yo'lini oladi — hamma bitlar bitta qalin sim bo'lib chiziladi.
 */
export function routeAll(wires: Wire[], gates: Map<string, Gate>, lay: Layout, quick = false, rep?: number[]): Routed {
  const ends = wires.map((w) => {
    const a = portPoint(w.from, gates, lay);
    const b = portPoint(w.to, gates, lay);
    return a && b ? { a, b } : null;
  });
  const boxes: Box[] = [...gates.values()].map((g) => ({ x0: g.x - 2, y0: g.y - 2, x1: g.x + GATE_W + 2, y1: g.y + gateH(g) + 2, id: g.id }));

  // Avval tanlovi kam (tor joydagi) simlar; teng bo'lsa — chapdan o'ngga, yuqoridan pastga.
  const order = wires
    .map((_, i) => i)
    .filter((i) => ends[i] && (!rep || rep[i] === i))
    .sort((i, j) => {
      const a = ends[i]!;
      const b = ends[j]!;
      return a.b.x - a.a.x - (b.b.x - b.a.x) || a.a.x - b.a.x || a.a.y - b.a.y || a.b.y - b.b.y || i - j;
    });

  const routes: (Point[] | null)[] = wires.map(() => null);
  const placed: Seg[] = [];
  for (const i of order) {
    const { a, b } = ends[i]!;
    const net = wires[i].from;
    const own = new Set([gateOf(wires[i].from), gateOf(wires[i].to)]);
    let best: Candidate | null = null;
    let bestCost = Infinity;
    // Nomzodlar markazdan uzoqlashish tartibida — siljish jarimasi faqat o'sadi. Eng katta mumkin bo'lgan
    // chegirmani (o'z tarmog'i bilan umumiy yo'l) hisobga olib ham yutib bo'lmasa — qolganlari ko'rilmaydi.
    const list = candidates(a, b);
    for (const c of quick ? list.slice(0, 1) : list) {
      if (c.penalty - MAX_BONUS >= bestCost) break;
      let cost = c.penalty;
      const mine = segments(c.pts, net, i);
      for (const s of mine) {
        for (const box of boxes) if (!own.has(box.id) && hitsBox(s, box)) cost += COST.gate;
        for (const q of placed) {
          if (q.maxX < s.minX - NEAR || q.minX > s.maxX + NEAR || q.maxY < s.minY - NEAR || q.minY > s.maxY + NEAR) continue;
          const same = q.net === net;
          const lap = collinear(s, q);
          if (lap > EPS) {
            // O'z tarmog'i bilan umumiy yo'l — yaxshi (chiziqlar kamroq); boshqasi bilan — eng yomoni.
            cost += same ? -Math.min(lap, 30) * 0.1 : COST.overlap + lap * 5;
            continue;
          }
          if (lap > -EPS) continue; // bir chiziqda, uchma-uch
          const gap = parallelGap(s, q);
          if (gap < NEAR) cost += same ? COST.sameNear : COST.near;
          const x = crossing(s, q);
          if (x) {
            cost += same ? COST.sameCross : COST.cross;
            // Burchakka yaqin kesishish: ko'prikcha burchak bilan siqilib qoladi.
            if (!same && Math.min(endDist(s, x), endDist(q, x)) < HOP_R + 12) cost += COST.cramped;
          } else if (!same && touches(s, q)) cost += COST.touch;
        }
        if (cost >= bestCost) break;
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = c;
      }
    }
    routes[i] = best!.pts;
    placed.push(...segments(best!.pts, net, i));
  }

  const hops = hopsFor(wires, routes);
  const dots = dotsFor(wires, routes);
  if (rep) {
    rep.forEach((r, i) => {
      if (r !== i) {
        routes[i] = routes[r];
        hops[i] = hops[r];
      }
    });
  }
  return { routes, hops, dots };
}

/**
 * Ko'prikchalar: turli tarmoqlarning kesishishida biri ustidan o'tadi — gorizontal qism vertikal va
 * qiyalik ustidan, qiyalik vertikal ustidan; ikki qiyalikdan — keyin chizilgani. Qismning uchiga (burchak)
 * juda yaqin kesishish ko'prikchasiz qoladi — kesilgan burchak bilan ustma-ust tushardi.
 */
function hopsFor(wires: Wire[], routes: (Point[] | null)[]): Point[][][] {
  const hops: Point[][][] = routes.map((r) => (r ? r.slice(1).map(() => []) : []));
  const all: Seg[] = [];
  routes.forEach((r, i) => r && all.push(...segments(r, wires[i].from, i)));
  const rank = { h: 2, d: 1, v: 0 };
  for (let x = 0; x < all.length; x++) {
    for (let y = x + 1; y < all.length; y++) {
      const s = all[x];
      const q = all[y];
      if (s.net === q.net || s.maxX < q.minX || s.minX > q.maxX || s.maxY < q.minY || s.minY > q.maxY) continue;
      const p = crossing(s, q);
      if (!p) continue;
      const top = rank[s.kind] > rank[q.kind] ? s : rank[q.kind] > rank[s.kind] ? q : s.wire > q.wire ? s : q;
      // Yoy qism ichiga sig'sin (yonidagi burchak kesigi routeD da kichraytiriladi).
      const room = Math.min(Math.hypot(p.x - top.ax, p.y - top.ay), Math.hypot(p.x - top.bx, p.y - top.by));
      if (room < HOP_R + 2) continue;
      const list = hops[top.wire][top.index];
      // Juda yaqin ikki ko'prikcha bitta bo'lib ko'rinadi — ikkinchisi tashlanadi.
      if (list.some((h) => Math.hypot(h.x - p.x, h.y - p.y) < 2 * HOP_R + 2)) continue;
      list.push(p);
    }
  }
  return hops;
}

/** Ikki yo'l (bir manbadan) qayerda ayriladi: umumiy boshlanishining oxiri; boshidanoq ayrilsa — null. */
export function divergence(p: Point[], q: Point[]): Point | null {
  let i = 0;
  let j = 0;
  let cur = p[0];
  const unit = (from: Point, to: Point) => {
    const l = Math.hypot(to.x - from.x, to.y - from.y);
    return l < EPS ? null : { x: (to.x - from.x) / l, y: (to.y - from.y) / l, l };
  };
  for (let guard = 0; guard < 64; guard++) {
    if (i >= p.length - 1 || j >= q.length - 1) return null;
    const u = unit(cur, p[i + 1]);
    const v = unit(cur, q[j + 1]);
    if (!u) {
      i++;
      continue;
    }
    if (!v) {
      j++;
      continue;
    }
    if (Math.abs(u.x - v.x) > 1e-6 || Math.abs(u.y - v.y) > 1e-6) {
      return cur === p[0] || Math.hypot(cur.x - p[0].x, cur.y - p[0].y) < EPS ? null : cur;
    }
    const step = Math.min(u.l, v.l);
    cur = { x: cur.x + u.x * step, y: cur.y + u.y * step };
    if (u.l - step < EPS) i++;
    if (v.l - step < EPS) j++;
  }
  return null;
}

function dotsFor(wires: Wire[], routes: (Point[] | null)[]): { net: string; at: Point }[] {
  const byNet = new Map<string, Point[][]>();
  routes.forEach((r, i) => {
    if (!r) return;
    const list = byNet.get(wires[i].from) ?? [];
    list.push(r);
    byNet.set(wires[i].from, list);
  });
  const dots: { net: string; at: Point }[] = [];
  for (const [net, list] of byNet) {
    if (list.length < 2) continue;
    const seen = new Set<string>();
    for (let x = 0; x < list.length; x++) {
      for (let y = x + 1; y < list.length; y++) {
        const at = divergence(list[x], list[y]);
        if (!at) continue;
        const key = `${Math.round(at.x)},${Math.round(at.y)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        dots.push({ net, at });
      }
    }
  }
  return dots;
}

const n = (v: number) => Math.round(v * 100) / 100;

/**
 * Yo'l chizig'i: perpendikulyar burchaklar 45° bilan kesiladi (geometry.routePath kabi), ko'prikcha
 * nuqtalarida — yarim aylana. Ko'prikcha "yuqoriga" (y kamayadigan tomonga) bo'rtadi. sharp — kesilmaydigan
 * burchaklar (tarmoqlanish nuqtasi: u yerda toza "T" va nuqta). Ko'prikcha burchakka yaqin bo'lsa, burchak
 * kesigi kichrayadi — yoy bilan ustma-ust tushmaydi.
 */
export function routeD(pts: Point[], hops: Point[][] = [], sharp: (p: Point) => boolean = () => false, r = 10): string {
  const last = pts.length - 1;
  const before: Point[] = pts.slice();
  const after: Point[] = pts.slice();
  const near = (k: number, c: Point) =>
    Math.min(Infinity, ...(hops[k] ?? []).map((h) => Math.hypot(h.x - c.x, h.y - c.y) - HOP_R - 1));
  for (let i = 1; i < last; i++) {
    const p = pts[i - 1];
    const c = pts[i];
    const nx = pts[i + 1];
    const inH = p.y === c.y;
    const outH = c.y === nx.y;
    const inV = p.x === c.x;
    const outV = c.x === nx.x;
    if (((inH && outV) || (inV && outH)) && !sharp(c)) {
      const cut = Math.max(
        0,
        Math.min(r, Math.hypot(c.x - p.x, c.y - p.y) / 2, Math.hypot(nx.x - c.x, nx.y - c.y) / 2, near(i - 1, c), near(i, c)),
      );
      before[i] = { x: c.x - Math.sign(c.x - p.x) * cut, y: c.y - Math.sign(c.y - p.y) * cut };
      after[i] = { x: c.x + Math.sign(nx.x - c.x) * cut, y: c.y + Math.sign(nx.y - c.y) * cut };
    }
  }
  let d = `M${n(pts[0].x)},${n(pts[0].y)}`;
  for (let k = 0; k < last; k++) {
    const s = k === 0 ? pts[0] : after[k];
    const e = k + 1 === last ? pts[last] : before[k + 1];
    if (k > 0 && (s.x !== before[k].x || s.y !== before[k].y)) d += ` L${n(s.x)},${n(s.y)}`;
    const len = Math.hypot(e.x - s.x, e.y - s.y);
    const list = (hops[k] ?? [])
      .map((h) => ({ h, at: Math.hypot(h.x - s.x, h.y - s.y) }))
      .filter((x) => x.at >= HOP_R && len - x.at >= HOP_R)
      .sort((x, y) => x.at - y.at);
    if (list.length && len > 0) {
      const ux = (e.x - s.x) / len;
      const uy = (e.y - s.y) / len;
      // sweep 1 — yoy harakat yo'nalishining chap tomoniga bo'rtadi (ekranda y pastga): o'ngga ketayotganda
      // bu — yuqori; chapga ketayotganda yuqori o'ng tomonda (sweep 0). Vertikal qism — chapga bo'rtadi.
      const sweep = ux > 1e-9 || (Math.abs(ux) < 1e-9 && uy < 0) ? 1 : 0;
      for (const { h } of list) {
        d += ` L${n(h.x - ux * HOP_R)},${n(h.y - uy * HOP_R)} A${HOP_R},${HOP_R} 0 0 ${sweep} ${n(h.x + ux * HOP_R)},${n(h.y + uy * HOP_R)}`;
      }
    }
    d += ` L${n(e.x)},${n(e.y)}`;
  }
  return d;
}
