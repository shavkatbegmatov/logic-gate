import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { sfx } from '../audio';
import { showToast } from '../components/Toast';
import { t } from '../i18n';
import { GATE_ARITY, type Gate } from '../sim/types';
import type { Editor } from './editor';
import { GATE_H, GATE_W, inputPortY, isSourcePort, portPoint, wirePath, type Point } from './geometry';
import { GateShape } from './GateShape';

type Drag =
  | { kind: 'pan'; sx: number; sy: number; lx: number; ly: number; moved: boolean }
  | { kind: 'pinch'; dist: number; cx: number; cy: number }
  | { kind: 'gate'; id: string; ox: number; oy: number; sx: number; sy: number; moved: boolean }
  | { kind: 'wire'; port: string; sx: number; sy: number; moved: boolean }
  | { kind: 'tap'; el: Element; sx: number; sy: number; moved: boolean };

const MOVE_THRESHOLD = 6;

/** Ko'rsatkichni ushlab qolish; ba'zi brauzerlar allaqachon qo'yib yuborilgan ko'rsatkichda xato beradi. */
export function capture(el: Element, pointerId: number) {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    // Ushlab bo'lmasa ham hodisalar odatdagidek keladi.
  }
}

interface Props {
  editor: Editor;
  /** Joriy qator uchun kutilgan chiqishlar (darajada); qum qutida yo'q. */
  expected?: number[] | null;
}

export function Board({ editor, expected }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const ghost = useSignal<{ a: Point; b: Point } | null>(null);
  const wiring = useSignal<string | null>(null);

  useEffect(() => {
    const el = wrapRef.current!;
    editor.el = el;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width < 10 || height < 10) return;
      const big = Math.abs(width - editor.size.w) > 40 || Math.abs(height - editor.size.h) > 40;
      editor.size = { w: width, h: height };
      if (!editor.viewTouched || big) editor.fit();
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (editor.el === el) editor.el = null;
    };
  }, [editor]);

  const local = (e: PointerEvent | WheelEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  /**
   * Ekrandagi nuqtaga eng yaqin port. Barmoq uchun radius kattaroq: kichik masshtabda ham
   * portni topish oson bo'ladi. Element tanasi ustida faqat juda yaqin port olinadi,
   * aks holda element sudraladi.
   */
  const nearestPort = (p: Point, e: PointerEvent, onGateBody: boolean): string | null => {
    const radius = onGateBody ? 10 : e.pointerType === 'mouse' ? 12 : 24;
    const { tx, ty, s } = editor.view.value;
    const lay = editor.layout.value;
    let best: string | null = null;
    let bestD = radius;
    const consider = (id: string, w: Point) => {
      const d = Math.hypot(w.x * s + tx - p.x, w.y * s + ty - p.y);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    };
    for (const [name, w] of lay.inputs) consider(`in:${name}`, w);
    for (const [name, w] of lay.outputs) consider(`out:${name}`, w);
    for (const g of editor.circuit.value.gates) {
      consider(g.id, { x: g.x + GATE_W, y: g.y + GATE_H / 2 });
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
      // Bir xil turdagi portni bossa — tanlov yangi portga o'tadi.
      editor.pending.value = res === 'kind' ? port : null;
    }
  };

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    capture(svgRef.current!, e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);

    if (pointers.current.size === 2) {
      // Ikkinchi barmoq: boshlangan amal bekor bo'lib, masshtablash boshlanadi.
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
    const port = kind === 'delete' ? null : nearestPort(p, e, kind === 'gate');
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
    const d = drag.current;
    if (!d) return;
    if (d.kind === 'pinch') {
      // Barcha barmoqlar ko'tarilguncha boshqa amal boshlanmaydi.
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

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const p = local(e);
    editor.zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), p.x, p.y);
  };

  // ── Chizish ───────────────────────────────────────────────
  const { gates, wires } = editor.circuit.value;
  const lay = editor.layout.value;
  const spec = editor.spec.value;
  const gmap = new Map<string, Gate>(gates.map((g) => [g.id, g]));
  const { values, outputs } = editor.evaluation.value;
  const bits = editor.bits.value;
  const view = editor.view.value;
  const sel = editor.selection.value;
  const pending = editor.pending.value;
  const highlight = editor.highlight.value;
  const active = wiring.value ?? pending;
  // Ulanayotgan port turiga mos keladigan portlar yoritiladi.
  const targetClass = active ? (isSourcePort(active) ? 'want-sink' : 'want-src') : '';

  let deleteAt: Point | null = null;
  if (sel?.kind === 'gate') {
    const g = gmap.get(sel.id);
    if (g) deleteAt = { x: g.x + GATE_W - 2, y: g.y - 12 };
  }

  const wireEls = wires.map((w, i) => {
    const a = portPoint(w.from, gmap, lay);
    const b = portPoint(w.to, gmap, lay);
    if (!a || !b) return null;
    const d = wirePath(a, b);
    const on = values.get(w.from) === 1;
    const selected = sel?.kind === 'wire' && sel.index === i;
    if (selected) {
      // Simmetrik boshqaruv nuqtalari tufayli Bezier o'rtasi aynan a va b ning o'rtasi.
      deleteAt = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 14 };
    }
    return (
      <g key={`${w.from}>${w.to}`} class={`wire${on ? ' on' : ''}${selected ? ' sel' : ''}`} data-kind="wire" data-index={i}>
        <path class="wire-hit" d={d} />
        {on && <path class="wire-glow" d={d} />}
        <path class="wire-line" d={d} />
      </g>
    );
  });

  const port = (id: string, x: number, y: number, src: boolean, connected: boolean, on: boolean) => (
    <g
      class={`port ${src ? 'src' : 'sink'}${connected ? ' linked' : ''}${on ? ' on' : ''}${active === id ? ' active' : ''}`}
      data-kind="port"
      data-port={id}
      transform={`translate(${x},${y})`}
    >
      <circle class="port-hit" r={15} />
      <circle class="port-dot" r={5.5} />
    </g>
  );

  const driven = new Set(wires.map((w) => w.to));
  const usedSources = new Set(wires.map((w) => w.from));

  return (
    <div class="board" ref={wrapRef}>
      <svg
        ref={svgRef}
        class={`board-svg ${targetClass}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          <pattern id="grid" width={24} height={24} patternUnits="userSpaceOnUse">
            <circle cx={12} cy={12} r={1.1} class="grid-dot" />
          </pattern>
        </defs>
        <g transform={`translate(${view.tx},${view.ty}) scale(${view.s})`}>
          <rect class="board-bg" x={-5000} y={-5000} width={10000} height={10000} fill="url(#grid)" />

          <g class="wires">{wireEls}</g>

          {gates.map((g) => {
            const on = values.get(g.id) === 1;
            const selected = sel?.kind === 'gate' && sel.id === g.id;
            return (
              <g
                key={g.id}
                class={`gate${on ? ' on' : ''}${selected ? ' sel' : ''}${highlight === g.id ? ' err' : ''}`}
                transform={`translate(${g.x},${g.y})`}
              >
                <g data-kind="gate" data-id={g.id}>
                  <rect class="gate-hit" x={4} y={-2} width={GATE_W - 8} height={GATE_H + 4} rx={8} />
                  <GateShape type={g.type} />
                  <text class="gate-label" x={g.type === 'NOT' ? 28 : 32} y={GATE_H / 2 + 4}>
                    {g.type}
                  </text>
                </g>
                {Array.from({ length: GATE_ARITY[g.type] }, (_, i) =>
                  port(`${g.id}:${i}`, 0, inputPortY(g, i), false, driven.has(`${g.id}:${i}`), false),
                )}
                {port(g.id, GATE_W, GATE_H / 2, true, usedSources.has(g.id), on)}
              </g>
            );
          })}

          {spec.inputs.map((name, k) => {
            const p = lay.inputs.get(name)!;
            const on = bits[k] === 1;
            return (
              <g key={`in:${name}`} class={`pin pin-in${on ? ' on' : ''}`} transform={`translate(${p.x},${p.y})`}>
                <g data-kind="pin" data-pin={k} class="pin-body">
                  <rect x={-70} y={-20} width={56} height={40} rx={9} />
                  <text class="pin-name" x={-56} y={5}>
                    {name}
                  </text>
                  <text class="pin-val" x={-30} y={6}>
                    {on ? 1 : 0}
                  </text>
                </g>
                <line class="lead" x1={-14} y1={0} x2={0} y2={0} />
                {port(`in:${name}`, 0, 0, true, usedSources.has(`in:${name}`), on)}
              </g>
            );
          })}

          {spec.outputs.map((name, i) => {
            const p = lay.outputs.get(name)!;
            const v = outputs[i];
            const exp = expected?.[i];
            // Ulanmagan chiqish neytral ko'rinadi — o'yin boshida hammasi qizil bo'lmasin.
            const state = exp === undefined || v === null ? '' : v === exp ? ' good' : ' bad';
            return (
              <g
                key={`out:${name}`}
                class={`pin pin-out${v === 1 ? ' on' : ''}${state}${highlight === name ? ' err' : ''}`}
                transform={`translate(${p.x},${p.y})`}
              >
                <line class="lead" x1={0} y1={0} x2={14} y2={0} />
                <rect class="pin-box" x={14} y={-20} width={60} height={40} rx={9} />
                <text class="pin-name" x={24} y={5}>
                  {name}
                </text>
                <circle class="lamp" cx={58} cy={0} r={8} />
                {exp !== undefined && (
                  <text class="pin-exp" x={44} y={36}>
                    {t.play.expected.toLowerCase()}: {exp}
                  </text>
                )}
                {port(`out:${name}`, 0, 0, false, driven.has(`out:${name}`), v === 1)}
              </g>
            );
          })}

          {ghost.value && <path class="wire-ghost" d={wirePath(ghost.value.a, ghost.value.b)} />}

          {deleteAt && (
            <g class="delete-btn" data-kind="delete" transform={`translate(${deleteAt.x},${deleteAt.y})`}>
              <title>{t.play.remove}</title>
              <circle r={13} />
              <path d="M-4.5,-4.5 L4.5,4.5 M4.5,-4.5 L-4.5,4.5" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
