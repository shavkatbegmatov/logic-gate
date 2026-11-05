// Sxema muharririning holati: sxema, tarix (undo/redo), tanlov, ko'rinish (pan/zoom).
import { computed, signal } from '@preact/signals';
import { sfx } from '../audio';
import { compile, evaluate, rowBits, truthTable, wouldCycle } from '../sim/sim';
import { GATE_ARITY, type Circuit, type GateType, type Spec } from '../sim/types';
import {
  bounds,
  GATE_H,
  GATE_W,
  gateIdNumber,
  isSourcePort,
  layout,
  snap,
  type Layout,
} from './geometry';

export type Selection = { kind: 'gate'; id: string } | { kind: 'wire'; index: number } | null;

export interface View {
  tx: number;
  ty: number;
  s: number;
}

export type ConnectResult = 'ok' | 'same' | 'cycle' | 'kind';

const MAX_HISTORY = 100;
export const MIN_ZOOM = 0.35;
export const MAX_ZOOM = 2.5;

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

  readonly layout = computed<Layout>(() => layout(this.spec.value, this.outX.value));
  readonly compiled = computed(() => compile(this.spec.value, this.circuit.value));
  readonly evaluation = computed(() => evaluate(this.compiled.value, this.bits.value));
  readonly table = computed(() => truthTable(this.compiled.value));
  readonly row = computed(() => this.bits.value.reduce((r, b) => (r << 1) | b, 0));

  /** Board elementining o'lchami (fit va markazga qo'yish uchun). */
  size = { w: 800, h: 500 };
  el: HTMLElement | null = null;
  viewTouched = false;
  onChange: ((c: Circuit) => void) | null = null;

  private past: Circuit[] = [];
  private future: Circuit[] = [];
  private dragStart: Circuit | null = null;

  load(spec: Spec, circuit: Circuit, outX: number) {
    this.spec.value = spec;
    this.outX.value = outX;
    this.circuit.value = sanitize(spec, circuit);
    this.bits.value = spec.inputs.map(() => 0);
    this.selection.value = null;
    this.pending.value = null;
    this.highlight.value = null;
    this.past = [];
    this.future = [];
    this.syncHistory();
    this.viewTouched = false;
  }

  /** Qum qutida kirish/chiqishlar sonini o'zgartirish. */
  setSpec(spec: Spec) {
    this.spec.value = spec;
    this.bits.value = spec.inputs.map((_, k) => this.bits.value[k] ?? 0);
    this.commit(sanitize(spec, this.circuit.value));
  }

  private syncHistory() {
    this.canUndo.value = this.past.length > 0;
    this.canRedo.value = this.future.length > 0;
  }

  private commit(next: Circuit) {
    this.past.push(this.circuit.value);
    if (this.past.length > MAX_HISTORY) this.past.shift();
    this.future = [];
    this.circuit.value = next;
    this.highlight.value = null;
    this.syncHistory();
    this.onChange?.(next);
  }

  undo() {
    const prev = this.past.pop();
    if (!prev) return;
    this.future.push(this.circuit.value);
    this.circuit.value = prev;
    this.selection.value = null;
    this.syncHistory();
    this.onChange?.(prev);
  }

  redo() {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.circuit.value);
    this.circuit.value = next;
    this.selection.value = null;
    this.syncHistory();
    this.onChange?.(next);
  }

  clear() {
    if (!this.circuit.value.gates.length && !this.circuit.value.wires.length) return;
    this.commit({ gates: [], wires: [] });
    this.selection.value = null;
  }

  private nextId(): string {
    const max = this.circuit.value.gates.reduce((m, g) => Math.max(m, gateIdNumber(g.id)), 0);
    return `g${max + 1}`;
  }

  /** Elementni markazi (x, y) nuqtada bo'ladigan qilib qo'shadi; joy band bo'lsa pastroqqa suradi. */
  addGate(type: GateType, cx: number, cy: number) {
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
    const gate = { id: this.nextId(), type, x, y };
    this.commit({ ...this.circuit.value, gates: [...this.circuit.value.gates, gate] });
    this.selection.value = { kind: 'gate', id: gate.id };
    sfx.place();
  }

  /** Ekrandagi ko'rinish markaziga element qo'shish. */
  addGateAtCenter(type: GateType) {
    const { tx, ty, s } = this.view.value;
    this.addGate(type, (this.size.w / 2 - tx) / s, (this.size.h / 2 - ty) / s);
  }

  toWorld(sx: number, sy: number) {
    const { tx, ty, s } = this.view.value;
    return { x: (sx - tx) / s, y: (sy - ty) / s };
  }

  beginDrag() {
    this.dragStart = this.circuit.value;
  }

  dragGate(id: string, x: number, y: number) {
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
    if (!sel) return;
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
    sfx.remove();
  }

  toggleInput(k: number) {
    this.bits.value = this.bits.value.map((b, i) => (i === k ? b ^ 1 : b));
    sfx.toggle();
  }

  setRow(r: number) {
    this.bits.value = rowBits(this.spec.value.inputs.length, r);
  }

  fit() {
    const b = bounds(this.circuit.value, this.layout.value);
    const pad = 24;
    const s = Math.max(
      MIN_ZOOM,
      Math.min(1.35, (this.size.w - pad * 2) / (b.maxX - b.minX), (this.size.h - pad * 2) / (b.maxY - b.minY)),
    );
    this.view.value = {
      s,
      tx: (this.size.w - (b.maxX - b.minX) * s) / 2 - b.minX * s,
      ty: (this.size.h - (b.maxY - b.minY) * s) / 2 - b.minY * s,
    };
  }

  /** Ekrandagi (sx, sy) nuqta atrofida masshtablash. */
  zoomAt(factor: number, sx = this.size.w / 2, sy = this.size.h / 2) {
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
function sanitize(spec: Spec, c: Circuit): Circuit {
  const gates = (c.gates ?? []).filter((g) => g && g.type in GATE_ARITY && Number.isFinite(g.x) && Number.isFinite(g.y));
  const ids = new Set(gates.map((g) => g.id));
  const valid = (p: string) => {
    if (p.startsWith('in:')) return spec.inputs.includes(p.slice(3));
    if (p.startsWith('out:')) return spec.outputs.includes(p.slice(4));
    const i = p.lastIndexOf(':');
    return ids.has(i < 0 ? p : p.slice(0, i));
  };
  const seen = new Set<string>();
  const wires = (c.wires ?? []).filter((w) => {
    if (!w || !valid(w.from) || !valid(w.to) || seen.has(w.to)) return false;
    seen.add(w.to);
    return true;
  });
  return { gates, wires };
}
