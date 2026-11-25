import { useSignal } from '@preact/signals';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import { sfx } from '../audio';
import { showToast } from '../components/Toast';
import { t } from '../i18n';
import { stateNames } from '../sim/formula';
import { depths } from '../sim/sim';
import { GATE_ARITY, gateOutputs, isBlock, sourcePort, type Gate } from '../sim/types';
import { blockPinLabels, blockPortNames, bundles, busValue, isHiddenBit, pinGroups, portGroup } from './bus';
import type { Editor } from './editor';
import { gateH, GATE_W, GRID, inputPortY, isSourcePort, outputPortY, portPoint, type Point } from './geometry';
import { routeAll } from './routing';

type Drag =
  | { kind: 'pan'; sx: number; sy: number; lx: number; ly: number; moved: boolean }
  | { kind: 'pinch'; dist: number; cx: number; cy: number }
  | { kind: 'gate'; id: string; ox: number; oy: number; sx: number; sy: number; moved: boolean }
  | { kind: 'wire'; port: string; sx: number; sy: number; moved: boolean }
  | { kind: 'tap'; el: Element; sx: number; sy: number; moved: boolean };

const MOVE_THRESHOLD = 6;
export const TRANSPOSE = 'matrix(0,1,1,0,0,0)';
const isVertical = (w: number, h: number) => h > w * 1.1 && w < 700;

/** Ko'rsatkichni ushlab qolish; ba'zi brauzerlar allaqachon qo'yib yuborilgan ko'rsatkichda xato beradi. */
export function capture(el: Element, pointerId: number) {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    // Ushlab bo'lmasa ham hodisalar odatdagidek keladi.
  }
}

export function useBoard2D(editor: Editor, expected?: number[] | null, topInset = 0) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const ghost = useSignal<{ a: Point; b: Point } | null>(null);
  const moving = useSignal(false);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wiring = useSignal<string | null>(null);

  useEffect(() => {
    const el = wrapRef.current!;
    editor.el = el;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width < 10 || height < 10) return;
      const big = Math.abs(width - editor.size.w) > 40 || Math.abs(height - editor.size.h) > 40;
      const vertical = isVertical(width, height);
      const insetTop = width <= 820 ? topInset : 0;
      const changed = vertical !== editor.vertical.value || insetTop !== editor.insetTop;
      editor.size = { w: width, h: height };
      editor.vertical.value = vertical;
      editor.insetTop = insetTop;
      if (!editor.viewTouched || big || changed) editor.fit();
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (editor.el === el) editor.el = null;
      // Element sudralayotganda maydon almashsa (sekin yuklangan 2D Real sxema o'rniga chiqdi, chop etish,
      // ikkinchi barmoq bilan 3D tugmasi): sudrash yakunlanadi — aks holda joy to'rga tushmay, tarixga
      // yozilmay qolardi va keyingi sudrash uni ustidan yozib, «bekor qilish» qaytara olmasdi.
      if (drag.current?.kind === 'gate') editor.endDrag();
      drag.current = null;
    };
  }, [editor, topInset]);

  const local = (e: PointerEvent | WheelEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const nearestPort = (p: Point, e: PointerEvent, onBody: boolean): string | null => {
    const radius = onBody ? 10 : e.pointerType === 'mouse' ? 12 : 24;
    const lay = editor.layout.value;
    let best: string | null = null;
    let bestD = radius;
    const buses = editor.spec.value.buses;
    const gates = new Map(editor.circuit.value.gates.map((g) => [g.id, g]));
    const consider = (id: string, w: Point) => {
      // Shinaning qolgan bitlari boshi bilan bir nuqtada: tanlanadigani — boshi (ulash hammasini ulaydi).
      if (isHiddenBit(id, gates, buses)) return;
      const sp = editor.toScreen(w.x, w.y);
      const d = Math.hypot(sp.x - p.x, sp.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    };
    for (const [name, w] of lay.inputs) consider(`in:${name}`, w);
    for (const [name, w] of lay.outputs) consider(`out:${name}`, w);
    for (const g of editor.circuit.value.gates) {
      for (let k = 0; k < gateOutputs(g.type); k++) consider(sourcePort(g.id, k), { x: g.x + GATE_W, y: g.y + outputPortY(g, k) });
      for (let i = 0; i < GATE_ARITY[g.type]; i++) consider(`${g.id}:${i}`, { x: g.x, y: g.y + inputPortY(g, i) });
    }
    return best;
  };

  const targetOf = (e: PointerEvent) => (e.target as Element).closest('[data-kind]');

  const connect = (a: string, b: string, fromDrag: boolean) => {
    const res = editor.connect(a, b);
    if (res === 'cycle') {
      sfx.error();
      showToast(t.play.cycle, 'error');
    } else if (res === 'kind' && fromDrag) {
      showToast(t.play.sameKind, 'error');
    } else if (res === 'width') {
      sfx.error();
      showToast(t.play.busWidth, 'error');
    }
    return res;
  };

  const tapPort = (port: string) => {
    const pend = editor.pending.value;
    if (!pend) {
      editor.pending.value = port;
      sfx.click();
    } else if (pend === port) {
      editor.pending.value = null;
    } else {
      const res = connect(pend, port, false);
      editor.pending.value = res === 'kind' ? port : null;
    }
  };

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (editor.busy.value) return;
    capture(svgRef.current!, e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    moving.value = true;

    if (pointers.current.size === 2) {
      if (drag.current?.kind === 'gate') editor.endDrag();
      ghost.value = null;
      wiring.value = null;
      const [a, b] = [...pointers.current.values()];
      drag.current = { kind: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      return;
    }
    if (pointers.current.size > 2) return;

    const el = targetOf(e);
    const kind = el?.getAttribute('data-kind');
    const port = kind === 'delete' ? null : nearestPort(p, e, kind === 'gate' || kind === 'pin');
    if (port) {
      drag.current = { kind: 'wire', port, sx: p.x, sy: p.y, moved: false };
    } else if (kind === 'gate') {
      const id = el!.getAttribute('data-id')!;
      const g = editor.circuit.value.gates.find((g) => g.id === id)!;
      const w = editor.toWorld(p.x, p.y);
      editor.beginDrag();
      drag.current = { kind: 'gate', id, ox: w.x - g.x, oy: w.y - g.y, sx: p.x, sy: p.y, moved: false };
    } else if (kind) {
      drag.current = { kind: 'tap', el: el!, sx: p.x, sy: p.y, moved: false };
    } else {
      drag.current = { kind: 'pan', sx: p.x, sy: p.y, lx: p.x, ly: p.y, moved: false };
    }
  };

  const onMove = (e: PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const d = drag.current;
    if (!d) return;

    if (d.kind === 'pinch') {
      if (pointers.current.size !== 2) return;
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      if (d.dist > 0) editor.zoomAt(dist / d.dist, cx, cy);
      editor.pan(cx - d.cx, cy - d.cy);
      drag.current = { kind: 'pinch', dist, cx, cy };
      return;
    }

    if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) > MOVE_THRESHOLD) d.moved = true;
    if (!d.moved) return;

    if (d.kind === 'gate') {
      const w = editor.toWorld(p.x, p.y);
      editor.dragGate(d.id, w.x - d.ox, w.y - d.oy);
    } else if (d.kind === 'wire') {
      const gates = new Map(editor.circuit.value.gates.map((g) => [g.id, g]));
      const a = portPoint(d.port, gates, editor.layout.value);
      if (a) ghost.value = { a, b: editor.toWorld(p.x, p.y) };
      wiring.value = d.port;
    } else if (d.kind === 'pan') {
      editor.pan(p.x - d.lx, p.y - d.ly);
      d.lx = p.x;
      d.ly = p.y;
    }
  };

  const onUp = (e: PointerEvent) => {
    if (!pointers.current.delete(e.pointerId)) return;
    if (pointers.current.size === 0) moving.value = false;
    const d = drag.current;
    if (!d) return;
    if (d.kind === 'pinch') {
      if (pointers.current.size === 0) drag.current = null;
      return;
    }
    drag.current = null;

    if (d.kind === 'gate') {
      editor.endDrag();
      if (!d.moved) {
        const sel = editor.selection.value;
        editor.selection.value = sel?.kind === 'gate' && sel.id === d.id ? null : { kind: 'gate', id: d.id };
        editor.pending.value = null;
      }
    } else if (d.kind === 'wire') {
      ghost.value = null;
      wiring.value = null;
      if (!d.moved) {
        tapPort(d.port);
      } else {
        const target = e.type === 'pointerup' ? nearestPort(local(e), e, false) : null;
        if (target && target !== d.port) connect(d.port, target, true);
        editor.pending.value = null;
      }
    } else if (d.kind === 'tap') {
      if (d.moved || e.type !== 'pointerup') return;
      const kind = d.el.getAttribute('data-kind');
      if (kind === 'wire') {
        const index = Number(d.el.getAttribute('data-index'));
        const sel = editor.selection.value;
        editor.selection.value = sel?.kind === 'wire' && sel.index === index ? null : { kind: 'wire', index };
        editor.pending.value = null;
      } else if (kind === 'pin') {
        editor.toggleInput(Number(d.el.getAttribute('data-pin')));
      } else if (kind === 'delete') {
        editor.removeSelection();
      }
    } else if (d.kind === 'pan' && !d.moved) {
      editor.selection.value = null;
      editor.pending.value = null;
    }
  };

  const plain = (e: KeyboardEvent) => !e.ctrlKey && !e.metaKey && !e.altKey;
  const activates = (e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && plain(e);
  const deletes = (e: KeyboardEvent) => (e.key === 'Delete' || e.key === 'Backspace') && plain(e);
  const handled = (e: KeyboardEvent) => {
    if (editor.busy.value) return false;
    e.preventDefault();
    e.stopPropagation();
    return true;
  };

  const onPortKey = (e: KeyboardEvent, id: string) => {
    if (activates(e)) {
      if (handled(e)) tapPort(id);
    } else if (deletes(e) && !isSourcePort(id)) {
      const index = editor.circuit.value.wires.findIndex((w) => w.to === id);
      if (index < 0 || !handled(e)) return;
      editor.selection.value = { kind: 'wire', index };
      editor.removeSelection();
    }
  };

  const ARROWS: Record<string, [number, number]> = {
    ArrowLeft: [-GRID, 0],
    ArrowRight: [GRID, 0],
    ArrowUp: [0, -GRID],
    ArrowDown: [0, GRID],
  };

  const onGateKey = (e: KeyboardEvent, g: Gate) => {
    const arrow = ARROWS[e.key];
    if (activates(e)) {
      if (!handled(e)) return;
      const sel = editor.selection.value;
      editor.selection.value = sel?.kind === 'gate' && sel.id === g.id ? null : { kind: 'gate', id: g.id };
      editor.pending.value = null;
    } else if (deletes(e)) {
      if (!handled(e)) return;
      editor.selection.value = { kind: 'gate', id: g.id };
      editor.removeSelection();
      svgRef.current?.focus();
    } else if (arrow && plain(e)) {
      if (!handled(e)) return;
      const [dx, dy] = editor.vertical.value ? [arrow[1], arrow[0]] : arrow;
      editor.beginDrag();
      editor.dragGate(g.id, g.x + dx, g.y + dy);
      editor.endDrag();
    }
  };

  const onPinKey = (e: KeyboardEvent, k: number) => {
    if (activates(e) && handled(e)) editor.toggleInput(k);
  };

  const onDeleteKey = (e: KeyboardEvent) => {
    if (activates(e) && handled(e)) {
      editor.removeSelection();
      svgRef.current?.focus();
    }
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    moving.value = true;
    clearTimeout(wheelTimer.current);
    wheelTimer.current = setTimeout(() => (moving.value = false), 200);
    const p = local(e);
    editor.zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), p.x, p.y);
  };

  // ── Umumiy chizish ma'lumotlari ────────────────────────────
  const { gates, wires } = editor.circuit.value;
  const lay = editor.layout.value;
  const spec = editor.spec.value;
  const gmap = new Map<string, Gate>(gates.map((g) => [g.id, g]));
  const { values, outputs } = editor.evaluation.value;
  const bits = editor.bits.value;
  const view = editor.view.value;
  const vertical = editor.vertical.value;
  const sel = editor.selection.value;
  const pending = editor.pending.value;
  const highlight = editor.highlight.value;
  const active = wiring.value ?? pending;
  const targetClass = active ? (isSourcePort(active) ? 'want-sink' : 'want-src') : '';

  const wave = editor.wave.value;
  const depth = wave === null ? null : depths(editor.compiled.value);
  const stepOf = (src: string, extra: number) => 2 * (depth?.get(src) ?? 0) + extra;
  const reached = (src: string, extra: number) => wave === null || stepOf(src, extra) <= wave;
  const drivers = editor.compiled.value.drivers;

  let gateDeleteAt: Point | null = null;
  if (sel?.kind === 'gate') {
    const g = gmap.get(sel.id);
    if (g) gateDeleteAt = vertical ? { x: g.x + 2, y: g.y + gateH(g) + 12 } : { x: g.x + GATE_W - 2, y: g.y - 12 };
  }

  const quick = moving.value && wires.length > 40;
  const busKey = spec.buses ? JSON.stringify(spec.buses) : '';
  const geomKey = `${quick}|${lay.outX}|${spec.inputs.join()}|${spec.outputs.join()}|${busKey}|${JSON.stringify(gates)}|${JSON.stringify(wires)}`;
  // Shina simlari: to'liq ulangan shina — bitta qalin sim (boshi chiziladi, qolgan bitlari uning yo'lida).
  const bund = useMemo(() => bundles(wires, gmap, spec.buses), [geomKey]);
  const routed = useMemo(() => routeAll(wires, gmap, lay, quick, bund.rep), [geomKey]);
  const junctions = useMemo(() => new Set(routed.dots.map(({ at }) => `${at.x},${at.y}`)), [routed]);
  const sharp = (p: Point) => junctions.has(`${p.x},${p.y}`);

  const driven = new Set(wires.map((w) => w.to));
  const states = stateNames({ gates, wires });
  const usedSources = new Set(wires.map((w) => w.from));
  const seen = new Map<string, number>();
  const gateName = new Map(
    gates.map((g) => {
      const n = (seen.get(g.type) ?? 0) + 1;
      seen.set(g.type, n);
      return [g.id, `${g.type} ${n}`];
    }),
  );

  // ── Shinalar ─────────────────────────────────────────────
  const inGroups = pinGroups(spec.inputs, spec.buses);
  const outGroups = pinGroups(spec.outputs, spec.buses);
  /** Shinaning boshidan boshqa biti: alohida port chizilmaydi. */
  const hidden = (port: string) => isHiddenBit(port, gmap, spec.buses);
  /** Shina boshi porti: keng port bo'lib chiziladi. */
  const busPort = (port: string) => portGroup(port, gmap, spec.buses)?.bit === 0;
  /** Blok oyoqlari yozuvlari (shina — bitta nom). */
  const blockLabels = (g: Gate) => (isBlock(g.type) ? blockPinLabels(g.type) : { ins: [], outs: [] });
  /** Blok chiqishi nomi (ekran o'quvchi uchun): shina — shina nomi. */
  const blockOutName = (g: Gate, k: number) => (isBlock(g.type) ? (blockPortNames(g.type).outs[k] ?? '') : '');
  /** Shina simi boshi bo'lsa — shina qiymati (son yoki null), oddiy sim — undefined. */
  const busWireValue = (i: number): number | null | undefined => {
    const members = bund.bus.get(i);
    return members ? busValue(members.map((m) => wires[m].from), values) : undefined;
  };

  return {
    wrapRef,
    svgRef,
    ghost,
    moving,
    active,
    targetClass,
    gates,
    wires,
    lay,
    spec,
    gmap,
    values,
    outputs,
    bits,
    view,
    vertical,
    sel,
    pending,
    highlight,
    wave,
    stepOf,
    reached,
    drivers,
    gateDeleteAt,
    routed,
    sharp,
    driven,
    states,
    usedSources,
    gateName,
    expected,
    bund,
    inGroups,
    outGroups,
    hidden,
    busPort,
    blockLabels,
    blockOutName,
    busWireValue,
    onDown,
    onMove,
    onUp,
    onWheel,
    onPortKey,
    onGateKey,
    onPinKey,
    onDeleteKey,
  };
}
