import { useSignal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import { sfx } from '../audio';
import { showToast } from '../components/Toast';
import { t } from '../i18n';
import { stateNames } from '../sim/formula';
import { depths } from '../sim/sim';
import { GATE_ARITY, type Gate } from '../sim/types';
import type { Editor } from './editor';
import { GATE_H, GATE_W, GRID, inputPortY, isSourcePort, outputPortY, portPoint, routeMid, wirePath, type Point } from './geometry';
import { GateShape } from './GateShape';
import { routeAll, routeD } from './routing';

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
  /** Telefonda maydon tepasini yopadigan panellar balandligi (vazifa qatori, o'quv banneri). */
  topInset?: number;
}

// Tik ekran va tor maydonda vertikal rejim: kirishlar tepada, chiqishlar pastda.
const isVertical = (w: number, h: number) => h > w * 1.1 && w < 700;
const TRANSPOSE = 'matrix(0,1,1,0,0,0)';

export function Board({ editor, expected, topInset = 0 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const ghost = useSignal<{ a: Point; b: Point } | null>(null);
  // Sudrash, surish va masshtab paytida Daftar'ning "qo'lda chizilgan" filtri o'chadi (har kadrda qayta
  // hisoblash telefonni sekinlashtiradi); maydon to'xtagach qaytadi.
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
    };
  }, [editor, topInset]);

  const local = (e: PointerEvent | WheelEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  /**
   * Ekrandagi nuqtaga eng yaqin port. Barmoq uchun radius kattaroq: kichik masshtabda ham
   * portni topish oson bo'ladi. Element yoki kirish tumbleri ustida faqat juda yaqin port olinadi,
   * aks holda element sudraladi yoki tumbler bosiladi (telefonda tumbler portdan ~20 px uzoqda).
   */
  const nearestPort = (p: Point, e: PointerEvent, onBody: boolean): string | null => {
    const radius = onBody ? 10 : e.pointerType === 'mouse' ? 12 : 24;
    const lay = editor.layout.value;
    let best: string | null = null;
    let bestD = radius;
    const consider = (id: string, w: Point) => {
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
      consider(g.id, { x: g.x + GATE_W, y: g.y + outputPortY(g) });
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
    if (editor.busy.value) return;
    capture(svgRef.current!, e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    moving.value = true;

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

  // ── Klaviatura ─────────────────────────────────────────────
  // Nuqtalar, elementlar va kirish tumblerlari Tab bilan tanlanadi. Nuqtada Enter/Probel — bosish bilan
  // bir xil (birinchisi simni boshlaydi, ikkinchisi ulaydi), Delete — kirishga kelgan simni o'chiradi.
  // Elementda Enter — belgilash, strelkalar — surish, Delete — o'chirish.
  // Ctrl+Enter — «Tekshirish», Ctrl+Z — bekor qilish: modifikatorli tugmalar umumiy ishlovchilarga qoladi.
  const plain = (e: KeyboardEvent) => !e.ctrlKey && !e.metaKey && !e.altKey;
  const activates = (e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && plain(e);
  const deletes = (e: KeyboardEvent) => (e.key === 'Delete' || e.key === 'Backspace') && plain(e);
  /**
   * Tugma shu yerda bajariladi: sahifa aylanmasin va umumiy tugmalar (useEditorKeys) qaytarmasin.
   * Tekshiruv paytida — hech narsa (Probel tekshiruv animatsiyasini o'tkazib yuboradi, Workbench).
   */
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
      // Element yo'qoldi — fokus maydonda qoladi (keyingi Tab — maydondagi birinchi nuqta).
      svgRef.current?.focus();
    } else if (arrow && plain(e)) {
      if (!handled(e)) return;
      // Vertikal rejimda o'qlar almashgan: ekrandagi "o'ngga" — dunyoda pastga.
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

  // ── Chizish ───────────────────────────────────────────────
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
  // Ulanayotgan port turiga mos keladigan portlar yoritiladi.
  const targetClass = active ? (isSourcePort(active) ? 'want-sink' : 'want-src') : '';

  // Tekshiruv to'lqini: manba (extra=0) yoki undan chiqqan sim (extra=1) shu qadamda yetib kelganmi.
  const wave = editor.wave.value;
  const depth = wave === null ? null : depths(editor.compiled.value);
  const stepOf = (src: string, extra: number) => 2 * (depth?.get(src) ?? 0) + extra;
  const reached = (src: string, extra: number) => wave === null || stepOf(src, extra) <= wave;
  const drivers = editor.compiled.value.drivers;

  let deleteAt: Point | null = null;
  if (sel?.kind === 'gate') {
    const g = gmap.get(sel.id);
    // Ekranda elementning o'ng-yuqori burchagi (vertikal rejimda o'qlar almashgan).
    if (g) deleteAt = vertical ? { x: g.x + 2, y: g.y + GATE_H + 12 } : { x: g.x + GATE_W - 2, y: g.y - 12 };
  }

  // Simlar birgalikda yo'naltiriladi (routing.ts): faqat geometriya o'zgarganda — kirishlarni almashtirish
  // yoki tekshiruv animatsiyasi har kadrda qayta hisoblatmaydi.
  // Katta sxemada (40+ sim) element sudralayotganda har kadrda joy tanlanmaydi — qo'yib yuborilgach.
  const quick = moving.value && wires.length > 40;
  const geomKey = `${quick}|${lay.outX}|${spec.inputs.length}|${spec.outputs.length}|${JSON.stringify(gates)}|${JSON.stringify(wires)}`;
  const routed = useMemo(() => routeAll(wires, gmap, lay, quick), [geomKey]);
  const junctions = useMemo(() => new Set(routed.dots.map(({ at }) => `${at.x},${at.y}`)), [routed]);
  const sharp = (p: Point) => junctions.has(`${p.x},${p.y}`);

  const wireEls = wires.map((w, i) => {
    const route = routed.routes[i];
    if (!route) return null;
    const d = routeD(route, routed.hops[i], sharp);
    const live = reached(w.from, 1);
    const on = live && values.get(w.from) === 1;
    const front = wave !== null && stepOf(w.from, 1) === wave;
    const selected = sel?.kind === 'wire' && sel.index === i;
    if (selected) {
      const m = routeMid(route);
      deleteAt = { x: m.x, y: m.y + (vertical ? 14 : -14) };
    }
    return (
      <g
        key={`${w.from}>${w.to}`}
        class={`wire${on ? ' on' : ''}${selected ? ' sel' : ''}${live ? '' : ' idle'}${front ? ' front' : ''}`}
        data-kind="wire"
        data-index={i}
      >
        <path class="wire-hit" d={d} />
        {on && <path class="wire-glow" d={d} />}
        <path class="wire-line" d={d} />
      </g>
    );
  });

  const a11y = t.play.a11y;
  const port = (id: string, x: number, y: number, src: boolean, connected: boolean, on: boolean, name: string) => (
    <g
      class={`port ${src ? 'src' : 'sink'}${connected ? ' linked' : ''}${on ? ' on' : ''}${active === id ? ' active' : ''}`}
      data-kind="port"
      data-port={id}
      transform={`translate(${x},${y})`}
      tabindex={0}
      role="button"
      aria-pressed={pending === id}
      aria-label={`${name}${connected ? `, ${a11y.linked}` : ''}${pending === id ? `. ${a11y.wiring}` : ''}`}
      onKeyDown={(e) => onPortKey(e, id)}
    >
      <circle class="port-hit" r={15} />
      <circle class="port-dot" r={5.5} />
    </g>
  );

  // Tumbler va chiroq vertikal rejimda ham ekranda bir xil ko'rinadi (matn kabi teskari buriladi).
  const upright = (x: number, y: number, children: ComponentChildren, vx = x, vy = y) => (
    <g transform={vertical ? `translate(${vx},${vy}) ${TRANSPOSE}` : `translate(${x},${y})`}>{children}</g>
  );

  // Matn vertikal rejimda ham to'g'ri o'qilishi uchun transpozitsiyaga teskari buriladi.
  const label = (cls: string, x: number, y: number, text: ComponentChildren, vx = x, vy = y) =>
    vertical ? (
      <text class={cls} transform={`translate(${vx},${vy}) ${TRANSPOSE}`}>
        {text}
      </text>
    ) : (
      <text class={cls} x={x} y={y}>
        {text}
      </text>
    );

  const driven = new Set(wires.map((w) => w.to));
  const states = stateNames({ gates, wires });
  const usedSources = new Set(wires.map((w) => w.from));
  // Ekran o'quvchi uchun nom: bir xil elementlar raqamlanadi (AND 1, AND 2).
  const seen = new Map<string, number>();
  const gateName = new Map(
    gates.map((g) => {
      const n = (seen.get(g.type) ?? 0) + 1;
      seen.set(g.type, n);
      return [g.id, `${g.type} ${n}`];
    }),
  );

  return (
    <div class="board" ref={wrapRef}>
      <svg
        ref={svgRef}
        class={`board-svg ${targetClass}${moving.value ? ' moving' : ''}`}
        role="group"
        aria-label={a11y.board}
        // SVG'da atribut kichik harf bilan (Preact SVG prop'larini atribut sifatida o'zgarishsiz yozadi).
        tabindex={-1}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          <pattern id="grid" width={24} height={24} patternUnits="userSpaceOnUse">
            {/* Plata — teshikchalar, Daftar — katak chiziqlari (mavzuga qarab CSS ko'rsatadi). */}
            <circle cx={12} cy={12} r={1.1} class="grid-dot" />
            <path d="M24,0 H0 V24" class="grid-line" />
          </pattern>
          {/* Daftar: chiziqlar biroz notekis — qo'lda chizilgandek. */}
          <filter id="sketch" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves={1} seed={7} />
            <feDisplacementMap in="SourceGraphic" scale={2.6} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <g transform={`translate(${view.tx},${view.ty}) scale(${view.s})${vertical ? ` ${TRANSPOSE}` : ''}`}>
          <rect class="board-bg" x={-5000} y={-5000} width={10000} height={10000} fill="url(#grid)" />

          <g class="wires">
            {wireEls}
            {/* Tarmoqlanish nuqtalari: bitta manbadan ketgan simlar shu yerda ayriladi (ulangan). */}
            {routed.dots.map(({ net, at }) => {
              const live = reached(net, 1);
              const on = live && values.get(net) === 1;
              return <circle key={`${net}@${at.x},${at.y}`} class={`wire-dot${on ? ' on' : ''}${live ? '' : ' idle'}`} cx={at.x} cy={at.y} r={4} />;
            })}
          </g>

          {gates.map((g) => {
            const live = reached(g.id, 0);
            const on = live && values.get(g.id) === 1;
            const selected = sel?.kind === 'gate' && sel.id === g.id;
            return (
              <g
                key={g.id}
                class={`gate${on ? ' on' : ''}${selected ? ' sel' : ''}${highlight === g.id ? ' err' : ''}${live ? '' : ' idle'}`}
                transform={`translate(${g.x},${g.y})`}
              >
                <g
                  data-kind="gate"
                  data-id={g.id}
                  tabindex={0}
                  role="button"
                  aria-pressed={selected}
                  aria-label={a11y.gate(gateName.get(g.id)!)}
                  onKeyDown={(e) => onGateKey(e, g)}
                >
                  <rect class="gate-hit" x={4} y={-2} width={GATE_W - 8} height={GATE_H + 4} rx={8} />
                  <GateShape type={g.type} />
                  {g.type === 'DFF' ? (
                    <>
                      {/* Vertikal rejimda (telefon) ham ekranda ustma-ust: DFF tepada, q1 pastda. */}
                      {label('gate-label', 36, GATE_H / 2 - 6, g.type, 29, GATE_H / 2)}
                      {label('gate-sub', 36, GATE_H / 2 + 9, states.get(g.id), 45, GATE_H / 2)}
                    </>
                  ) : (
                    label('gate-label', g.type === 'NOT' ? 28 : 32, GATE_H / 2, g.type)
                  )}
                </g>
                {Array.from({ length: GATE_ARITY[g.type] }, (_, i) =>
                  port(`${g.id}:${i}`, 0, inputPortY(g, i), false, driven.has(`${g.id}:${i}`), false, a11y.gateIn(gateName.get(g.id)!, i)),
                )}
                {port(g.id, GATE_W, outputPortY(g), true, usedSources.has(g.id), on, a11y.gateOut(gateName.get(g.id)!))}
              </g>
            );
          })}

          {spec.inputs.map((name, k) => {
            const p = lay.inputs.get(name)!;
            const on = bits[k] === 1;
            return (
              <g key={`in:${name}`} class={`pin pin-in${on ? ' on' : ''}`} transform={`translate(${p.x},${p.y})`}>
                <g
                  data-kind="pin"
                  data-pin={k}
                  class="pin-body"
                  tabindex={0}
                  role="switch"
                  aria-checked={on}
                  aria-label={name}
                  onKeyDown={(e) => onPinKey(e, k)}
                >
                  <rect x={-78} y={-20} width={64} height={40} rx={9} />
                  {label('pin-name', -64, 0, name)}
                  {/* Tumbler: dastagi 1 da o'ngda; qiymat dasta ichida yozilgan. */}
                  {upright(
                    -34,
                    0,
                    <g class="switch">
                      <rect class="sw-track" x={-14} y={-8} width={28} height={16} rx={8} />
                      <g class="sw-knob" style={{ transform: `translateX(${on ? 6 : -6}px)` }}>
                        <circle r={7} />
                        <text class="sw-val">{on ? 1 : 0}</text>
                      </g>
                    </g>,
                  )}
                </g>
                <line class="lead" x1={-14} y1={0} x2={0} y2={0} />
                {port(`in:${name}`, 0, 0, true, usedSources.has(`in:${name}`), on, a11y.source(name))}
              </g>
            );
          })}

          {spec.outputs.map((name, i) => {
            const p = lay.outputs.get(name)!;
            // Signal hali yetib kelmagan chiqish bo'sh ko'rinadi.
            const src = drivers.get(`out:${name}`);
            const v = src === undefined || reached(src, 2) ? outputs[i] : null;
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
                {label('pin-name', 30, 0, name)}
                {/* Chiroq: gardish, shisha, yonganda — yorug'lik (Plata) yoki chiziqlar (Daftar). */}
                {upright(
                  56,
                  0,
                  <g class="lamp-g">
                    <circle class="lamp-halo" r={15} />
                    <path class="lamp-rays" d="M-9,-11 l-3,-4 M0,-13 v-5 M9,-11 l3,-4" />
                    <circle class="lamp-bezel" r={10} />
                    <circle class="lamp" r={7} />
                    <circle class="lamp-shine" cx={-2.5} cy={-2.5} r={2} />
                  </g>,
                )}
                {exp !== undefined && label('pin-exp', 44, 32, `${t.play.expected.toLowerCase()}: ${exp}`, 90, 0)}
                {port(`out:${name}`, 0, 0, false, driven.has(`out:${name}`), v === 1, a11y.output(name))}
              </g>
            );
          })}

          {ghost.value && <path class="wire-ghost" d={wirePath(ghost.value.a, ghost.value.b)} />}

          {deleteAt && (
            <g
              class="delete-btn"
              data-kind="delete"
              transform={`translate(${deleteAt.x},${deleteAt.y})`}
              tabindex={0}
              role="button"
              aria-label={t.play.remove}
              onKeyDown={onDeleteKey}
            >
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
