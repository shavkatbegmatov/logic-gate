// Sxema muharririning holati: sxema, tarix (undo/redo), tanlov, ko'rinish (pan/zoom).
import { computed, signal } from '@preact/signals';
import { sfx } from '../audio';
import { compile, evaluate, replay, rowBits, truthTable, wouldCycle } from '../sim/sim';
import { GATE_ARITY, type Circuit, type GateType, type Spec } from '../sim/types';
import {
  bounds,
  GATE_H,
  GATE_W,
  gateIdNumber,
  isSourcePort,
  layout,
  outputColumnFor,
  snap,
  type Layout,
} from './geometry';
import { outputY } from './shapes';
import { cleanCircuit } from '../validate';

export type Selection = { kind: 'gate'; id: string } | { kind: 'wire'; index: number } | null;

export interface View {
  tx: number;
  ty: number;
  s: number;
}

/** invalid — portlardan biri sxemada yo'q (masalan, element o'chirilgan). */
export type ConnectResult = 'ok' | 'same' | 'cycle' | 'kind' | 'invalid';

/** Tarix qadami: sxema va kirish/chiqishlar to'plami (Qum qutida u ham o'zgaradi). */
interface Snapshot {
  circuit: Circuit;
  spec: Spec;
}

const MAX_HISTORY = 100;
/** Taktlar tarixi chegarasi (holat har o'zgarishda shu tarixdan qayta hisoblanadi). */
export const MAX_TICKS = 999;
export const MIN_ZOOM = 0.35;
export const MAX_ZOOM = 2.5;
/** O'ng pastdagi zoom tugmalari ustuni kengligi (fit uni chetlab o'tadi). */
const ZOOM_TOOLS_W = 56;
/** Chap pastdagi takt tugmalari balandligi (xotirali sxemada fit uni chetlab o'tadi). */
const CLOCK_TOOLS_H = 60;

export class Editor {
  readonly spec = signal<Spec>({ inputs: [], outputs: [], gates: [] });
  readonly circuit = signal<Circuit>({ gates: [], wires: [] });
  readonly bits = signal<number[]>([]);
  readonly selection = signal<Selection>(null);
  /** Ikki bosish bilan ulash rejimida tanlangan port. */
  readonly pending = signal<string | null>(null);
  readonly view = signal<View>({ tx: 0, ty: 0, s: 1 });
  /** Xato ko'rsatilgan element yoki chiqish. */
  readonly highlight = signal<string | null>(null);
  readonly canUndo = signal(false);
  readonly canRedo = signal(false);
  readonly outX = signal(560);
  /**
   * Vertikal rejim (telefon, tik holat): maydon transpozitsiya qilinadi — dunyodagi x ekranda pastga,
   * y o'ngga yo'naladi. Sxema koordinatalari o'zgarmaydi, shuning uchun bir sxema ikkala holatda ham ishlaydi.
   */
  readonly vertical = signal(false);
  /**
   * Tekshiruv animatsiyasi: signal to'lqinining qadami (null — hammasi ko'rinadi).
   * Chuqurligi d bo'lgan manba 2d-qadamda, undan chiqqan simlar 2d+1-qadamda yonadi.
   */
  readonly wave = signal<number | null>(null);
  /** Tekshiruv ketmoqda — sxemani o'zgartirib bo'lmaydi. */
  readonly busy = signal(false);
  /**
   * Xotirali sxema: o'tgan taktlardagi kirishlar qatorlari. Triggerlar holati shundan qayta
   * hisoblanadi — sxema o'zgarsa ham holat shu kirishlar tarixiga mos bo'lib qoladi.
   */
  readonly history = signal<number[]>([]);

  readonly layout = computed<Layout>(() => layout(this.spec.value, this.outX.value));
  /**
   * Sxema tuzilishi (elementlar turi va simlar), joylashuvsiz. Element sudralganda u o'zgarmaydi —
   * simulyatsiya, triggerlar holati va tekshiruv har kadrda qayta hisoblanmaydi.
   */
  readonly topology = computed(() => {
    const c = this.circuit.value;
    return JSON.stringify([c.gates.map((g) => [g.id, g.type]), c.wires]);
  });
  /**
   * Elementlar va simlar soni, D-trigger bormi. Ekranlar sxemaning o'zi (circuit) o'rniga shuni o'qiydi:
   * element sudralganda butun ekran (jadval, formula, vaqt diagrammasi) har kadrda qayta chizilmasin.
   */
  readonly shape = computed(() => {
    void this.topology.value;
    const c = this.circuit.peek();
    return { gates: c.gates.length, wires: c.wires.length, dff: c.gates.some((g) => g.type === 'DFF') };
  });
  readonly compiled = computed(() => {
    void this.topology.value;
    return compile(this.spec.value, this.circuit.peek());
  });
  readonly state = computed(() => replay(this.compiled.value, this.history.value));
  readonly evaluation = computed(() => evaluate(this.compiled.value, this.bits.value, this.state.value));
  readonly table = computed(() => truthTable(this.compiled.value, this.state.value));
  readonly row = computed(() => this.bits.value.reduce((r, b) => (r << 1) | b, 0));

  /** Board elementining o'lchami (fit va markazga qo'yish uchun). */
  size = { w: 800, h: 500 };
  /** Maydon tepasini yopib turgan panel balandligi (telefondagi vazifa qatori). */
  insetTop = 0;
  el: HTMLElement | null = null;
  viewTouched = false;
  onChange: ((c: Circuit) => void) | null = null;
  /** 3D rejimda ekran nuqtasini dunyo tekisligiga tushirish (Palette va markazga qo'shish uchun). */
  worldFromScreen: ((sx: number, sy: number) => { x: number; y: number } | null) | null = null;
  /** 3D rejimda kamerani sxemaga moslash (fit) va masshtablash (zoomAt). */
  fitOverride: (() => void) | null = null;
  zoomOverride: ((factor: number, sx?: number, sy?: number) => void) | null = null;

  private past: Snapshot[] = [];
  private future: Snapshot[] = [];
  private dragStart: Circuit | null = null;

  /** outX — chiqishlar ustuni (kamida); saqlangan sxema kengroq bo'lsa, unga moslanadi. */
  load(spec: Spec, circuit: Circuit, outX: number) {
    this.spec.value = spec;
    this.circuit.value = sanitize(spec, circuit);
    this.outX.value = outputColumnFor(outX, this.circuit.value);
    this.bits.value = spec.inputs.map(() => 0);
    this.history.value = [];
    this.selection.value = null;
    this.pending.value = null;
    this.highlight.value = null;
    this.past = [];
    this.future = [];
    this.syncHistory();
    this.viewTouched = false;
  }

  /** Qum qutida kirish/chiqishlar sonini o'zgartirish ("bekor qilish" spec'ni ham qaytaradi). */
  setSpec(spec: Spec) {
    if (this.locked) return;
    this.commit(sanitize(spec, this.circuit.value), spec);
  }

  private syncHistory() {
    this.canUndo.value = this.past.length > 0;
    this.canRedo.value = this.future.length > 0;
  }

  private snapshot(): Snapshot {
    return { circuit: this.circuit.value, spec: this.spec.value };
  }

  /**
   * Sxema (va kerak bo'lsa spec) ni o'rnatadi. Tanlov va "ulash" rejimidagi port yangi sxemada
   * ham bo'lsagina qoladi: o'chirilgan elementning porti tanlangan bo'lib qolsa, keyingi bosish
   * ko'rinmaydigan sim yaratib, haqiqiy simni almashtirib yuborardi.
   */
  private apply(next: Circuit, spec: Spec) {
    const prev = this.circuit.value;
    if (spec !== this.spec.value) {
      this.spec.value = spec;
      this.bits.value = spec.inputs.map((_, k) => this.bits.value[k] ?? 0);
      this.history.value = [];
    }
    this.circuit.value = next;
    // Sim tartib raqami bilan tanlanadi — sim o'chsa yoki joyi o'zgarsa, tanlov o'sha simga ergashadi.
    const sel = this.selection.value;
    if (sel?.kind === 'wire') {
      const w = prev.wires[sel.index];
      const index = w ? next.wires.findIndex((x) => x.from === w.from && x.to === w.to) : -1;
      this.selection.value = index < 0 ? null : index === sel.index ? sel : { kind: 'wire', index };
    } else if (sel?.kind === 'gate' && !next.gates.some((g) => g.id === sel.id)) {
      this.selection.value = null;
    }
    const pend = this.pending.value;
    if (pend && !this.hasPort(pend)) this.pending.value = null;
  }

  /** Port joriy sxemada va spec'da bormi. */
  hasPort(p: string): boolean {
    const spec = this.spec.value;
    if (p.startsWith('in:')) return spec.inputs.includes(p.slice(3));
    if (p.startsWith('out:')) return spec.outputs.includes(p.slice(4));
    const i = p.lastIndexOf(':');
    const id = i < 0 ? p : p.slice(0, i);
    const g = this.circuit.value.gates.find((g) => g.id === id);
    if (!g) return false;
    if (i < 0) return true;
    const k = Number(p.slice(i + 1));
    return Number.isInteger(k) && k >= 0 && k < GATE_ARITY[g.type];
  }

  /**
   * Tekshiruv ketmoqda: sxema, kirishlar va takt o'zgarmaydi. Tugmalar CSS bilan bosilmaydi, lekin
   * klaviatura (palitra, «bekor qilish») ham shu yerda to'xtaydi — maydonda tekshirilgani qolsin.
   */
  private get locked() {
    return this.busy.peek();
  }

  private commit(next: Circuit, spec = this.spec.value) {
    this.past.push(this.snapshot());
    if (this.past.length > MAX_HISTORY) this.past.shift();
    this.future = [];
    this.apply(next, spec);
    this.highlight.value = null;
    this.syncHistory();
    this.onChange?.(next);
  }

  undo() {
    if (this.locked) return;
    const prev = this.past.pop();
    if (!prev) return;
    this.future.push(this.snapshot());
    this.selection.value = null;
    this.apply(prev.circuit, prev.spec);
    this.highlight.value = null;
    this.syncHistory();
    this.onChange?.(prev.circuit);
  }

  redo() {
    if (this.locked) return;
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.snapshot());
    this.selection.value = null;
    this.apply(next.circuit, next.spec);
    this.highlight.value = null;
    this.syncHistory();
    this.onChange?.(next.circuit);
  }

  /**
   * Butun sxemani almashtiradi (formuladan yig'ilgan); "bekor qilish" bilan bitta qadamda qaytariladi.
   * spec — kirishlar ko'paygan bo'lsa (kamaymaydi: eski sxema yangi spec'da ham yaroqli).
   */
  replace(circuit: Circuit, spec?: Spec) {
    if (this.locked) return;
    this.selection.value = null;
    this.pending.value = null;
    const s = spec ?? this.spec.value;
    this.commit(sanitize(s, circuit), s);
  }

  clear() {
    if (this.locked || (!this.circuit.value.gates.length && !this.circuit.value.wires.length)) return;
    this.selection.value = null;
    this.pending.value = null;
    this.commit({ gates: [], wires: [] });
  }

  private nextId(): string {
    const max = this.circuit.value.gates.reduce((m, g) => Math.max(m, gateIdNumber(g.id)), 0);
    return `g${max + 1}`;
  }

  /** Markazi (cx, cy) bo'lgan bo'sh joy; band bo'lsa pastroqqa, keyin o'ngga suriladi. */
  private freeSpot(cx: number, cy: number) {
    let x = snap(cx - GATE_W / 2);
    let y = snap(cy - GATE_H / 2);
    const busy = (x: number, y: number) =>
      this.circuit.value.gates.some((g) => Math.abs(g.x - x) < GATE_W && Math.abs(g.y - y) < GATE_H);
    for (let i = 0; i < 12 && busy(x, y); i++) {
      y += GATE_H + 12;
      if (i === 5) {
        x += GATE_W + 24;
        y = snap(cy - GATE_H / 2);
      }
    }
    return { x, y };
  }

  /** Elementni markazi (x, y) nuqtada bo'ladigan qilib qo'shadi; joy band bo'lsa pastroqqa suradi. */
  addGate(type: GateType, cx: number, cy: number) {
    if (this.locked) return;
    const gate = { id: this.nextId(), type, ...this.freeSpot(cx, cy) };
    this.commit({ ...this.circuit.value, gates: [...this.circuit.value.gates, gate] });
    this.selection.value = { kind: 'gate', id: gate.id };
    sfx.place();
  }

  /**
   * Elementni kirishlarga ulangan holda kirishlar yoniga qo'yadi (maslahat uchun).
   * Element va simlar bitta qadam: bir marta "bekor qilish" ularni birga olib tashlaydi.
   */
  placeGate(type: GateType, sources: string[]): string {
    if (this.locked) return '';
    const lay = this.layout.value;
    const pts = sources.map((s) => lay.inputs.get(s)).filter((p) => p !== undefined);
    const cx = (pts.length ? Math.max(...pts.map((p) => p.x)) : 0) + 150;
    const cy = pts.length ? pts.reduce((sum, p) => sum + p.y, 0) / pts.length : 0;
    const gate = { id: this.nextId(), type, ...this.freeSpot(cx, cy) };
    const c = this.circuit.value;
    const wires = sources.slice(0, GATE_ARITY[type]).map((s, i) => ({ from: `in:${s}`, to: `${gate.id}:${i}` }));
    this.commit({ gates: [...c.gates, gate], wires: [...c.wires, ...wires] });
    this.selection.value = { kind: 'gate', id: gate.id };
    sfx.place();
    return gate.id;
  }

  /**
   * Ekrandagi ko'rinish markaziga element qo'shish. Markaz biror pin qatoriga yaqin bo'lsa, element
   * o'sha qatorga qo'yiladi: chiqishi (va NOT/DFF da kirishi ham) pin ro'parasida — sim to'g'ri chiziq.
   */
  addGateAtCenter(type: GateType) {
    const c = this.toWorld(this.size.w / 2, (this.size.h + this.insetTop) / 2);
    const lay = this.layout.value;
    let near: number | null = null;
    for (const p of [...lay.outputs.values(), ...lay.inputs.values()]) {
      const d = Math.abs(p.y - c.y);
      if (d < GATE_H && (near === null || d < Math.abs(near - c.y))) near = p.y;
    }
    // Element markazi (cy) dan freeSpot y = snap(cy - GATE_H/2) ni oladi; chiqish shundan outputY pastda.
    const cy = near === null ? c.y : near - outputY(type) + GATE_H / 2;
    this.addGate(type, c.x, cy);
  }

  /** Ekran (board ichidagi px) → dunyo koordinatasi. */
  toWorld(sx: number, sy: number) {
    if (this.worldFromScreen) {
      const hit = this.worldFromScreen(sx, sy);
      if (hit) return hit;
    }
    const { tx, ty, s } = this.view.value;
    const a = (sx - tx) / s;
    const b = (sy - ty) / s;
    return this.vertical.value ? { x: b, y: a } : { x: a, y: b };
  }

  /** Dunyo → ekran koordinatasi. */
  toScreen(wx: number, wy: number) {
    const { tx, ty, s } = this.view.value;
    const [a, b] = this.vertical.value ? [wy, wx] : [wx, wy];
    return { x: tx + a * s, y: ty + b * s };
  }

  beginDrag() {
    if (this.locked) return;
    this.dragStart = this.circuit.value;
  }

  dragGate(id: string, x: number, y: number) {
    if (this.locked) return;
    const c = this.circuit.value;
    this.circuit.value = { ...c, gates: c.gates.map((g) => (g.id === id ? { ...g, x, y } : g)) };
  }

  endDrag() {
    const start = this.dragStart;
    this.dragStart = null;
    if (!start || start === this.circuit.value) return;
    const now = this.circuit.value;
    const snapped = { ...now, gates: now.gates.map((g) => ({ ...g, x: snap(g.x), y: snap(g.y) })) };
    this.circuit.value = start;
    this.commit(snapped);
  }

  /** Ikki portni ulaydi (tartib ahamiyatsiz). Band kirish bo'lsa, eski sim almashtiriladi. */
  connect(a: string, b: string): ConnectResult {
    if (this.locked) return 'same';
    if (!this.hasPort(a) || !this.hasPort(b)) return 'invalid';
    const aSrc = isSourcePort(a);
    if (aSrc === isSourcePort(b)) return a === b ? 'same' : 'kind';
    const [from, to] = aSrc ? [a, b] : [b, a];
    const c = this.circuit.value;
    if (c.wires.some((w) => w.from === from && w.to === to)) return 'same';
    const rest = c.wires.filter((w) => w.to !== to);
    if (wouldCycle({ ...c, wires: rest }, from, to)) return 'cycle';
    this.commit({ ...c, wires: [...rest, { from, to }] });
    sfx.connect();
    return 'ok';
  }

  removeSelection() {
    const sel = this.selection.value;
    if (!sel || this.locked) return;
    const c = this.circuit.value;
    if (sel.kind === 'gate') {
      const prefix = `${sel.id}:`;
      this.commit({
        gates: c.gates.filter((g) => g.id !== sel.id),
        wires: c.wires.filter((w) => w.from !== sel.id && !w.to.startsWith(prefix)),
      });
    } else {
      this.commit({ ...c, wires: c.wires.filter((_, i) => i !== sel.index) });
    }
    this.selection.value = null;
    this.pending.value = null;
    sfx.remove();
  }

  toggleInput(k: number) {
    if (this.locked) return;
    const next = this.bits.value.map((b, i) => (i === k ? b ^ 1 : b));
    this.bits.value = next;
    sfx.toggle(next[k] === 1);
  }

  setRow(r: number) {
    this.bits.value = rowBits(this.spec.value.inputs.length, r);
  }

  /** Takt: joriy kirishlar tarixga yoziladi, triggerlar kirishidagi qiymatlarni eslab qoladi. */
  tick() {
    if (this.locked || this.history.value.length >= MAX_TICKS) return;
    this.history.value = [...this.history.value, this.row.value];
    sfx.tick(this.history.value.length % 8);
  }

  /** Vaqtni boshiga qaytarish: barcha triggerlar 0. */
  resetClock() {
    if (this.locked) return;
    this.history.value = [];
  }

  fit() {
    const vertical = this.vertical.value;
    const b = bounds(this.circuit.value, this.layout.value, vertical);
    // Ekranning gorizontal (a) va vertikal (b) o'qlariga dunyoning qaysi o'qi to'g'ri kelishi.
    const [minA, maxA, minB, maxB] = vertical ? [b.minY, b.maxY, b.minX, b.maxX] : [b.minX, b.maxX, b.minY, b.maxY];
    const pad = this.size.w < 500 ? 8 : 24;
    const top = this.insetTop;
    // Gorizontal rejimda chiqishlar o'ngda — zoom tugmalari ularni yopmasin.
    const availW = this.size.w - (vertical ? 0 : ZOOM_TOOLS_W);
    // Xotirali sxemada chap pastda takt tugmalari — pastki pinlarni yopmasin.
    const availH = this.size.h - top - (this.spec.value.gates.includes('DFF') ? CLOCK_TOOLS_H : 0);
    const s = Math.max(
      MIN_ZOOM,
      Math.min(1.35, (availW - pad * 2) / (maxA - minA), (availH - pad * 2) / (maxB - minB)),
    );
    this.view.value = {
      s,
      tx: (availW - (maxA - minA) * s) / 2 - minA * s,
      ty: top + (availH - (maxB - minB) * s) / 2 - minB * s,
    };
    this.fitOverride?.();
  }

  /** Ekrandagi (sx, sy) nuqta atrofida masshtablash. */
  zoomAt(factor: number, sx = this.size.w / 2, sy = this.size.h / 2) {
    if (this.zoomOverride) {
      this.zoomOverride(factor, sx, sy);
      this.viewTouched = true;
      return;
    }
    const { tx, ty, s } = this.view.value;
    const ns = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s * factor));
    const k = ns / s;
    this.view.value = { s: ns, tx: sx - (sx - tx) * k, ty: sy - (sy - ty) * k };
    this.viewTouched = true;
  }

  pan(dx: number, dy: number) {
    const v = this.view.value;
    this.view.value = { ...v, tx: v.tx + dx, ty: v.ty + dy };
    this.viewTouched = true;
  }
}

/** Saqlangan sxemadan joriy spec ga mos kelmaydigan qismlarni olib tashlaydi. */
function sanitize(spec: Spec, raw: Circuit): Circuit {
  // Shakli buzuq yozuv (eski versiya, ko'chirish havolasi) ham muharrirni to'xtatmasin.
  const c = cleanCircuit(raw) ?? { gates: [], wires: [] };
  const gates = c.gates;
  const ids = new Set(gates.map((g) => g.id));
  const valid = (p: string) => {
    if (p.startsWith('in:')) return spec.inputs.includes(p.slice(3));
    if (p.startsWith('out:')) return spec.outputs.includes(p.slice(4));
    const i = p.lastIndexOf(':');
    return ids.has(i < 0 ? p : p.slice(0, i));
  };
  const seen = new Set<string>();
  const wires = c.wires.filter((w) => {
    if (!valid(w.from) || !valid(w.to) || seen.has(w.to)) return false;
    seen.add(w.to);
    return true;
  });
  return { gates, wires };
}
