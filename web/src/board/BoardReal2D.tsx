import { Fragment, type ComponentChildren } from 'preact';
import { t } from '../i18n';
import { GATE_ARITY, gateOutputs, isBlock, sourcePort, type GateType } from '../sim/types';
import { activeTheme, resolveRealStyle, type RealStyle } from '../theme';
import type { Editor } from './editor';
import { BusInPin, BusOutPin } from './BusPins';
import { CHIP_CODE, GateShape } from './GateShape';
import { bounds, GATE_H, GATE_W, gateH, inputPortY, outputPortY, routeMid, wirePath } from './geometry';
import { routeD } from './routing';
import { DFF_BODY, inputLeads, outputY, SHAPES } from './shapes';
import { TRANSPOSE, useBoard2D } from './useBoard2D';

interface Props {
  editor: Editor;
  expected?: number[] | null;
  topInset?: number;
}

const JUMPER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899'];

function netColor(net: string): string {
  let h = 0;
  for (let i = 0; i < net.length; i++) h = (h * 31 + net.charCodeAt(i)) | 0;
  return JUMPER_COLORS[Math.abs(h) % JUMPER_COLORS.length];
}

/** Chip yuzasiga bosilgan kichik ANSI mantiqiy belgi (silkscreen / OLED oyna ichida). */
function MiniSymbol({ type }: { type: GateType }) {
  if (type === 'DFF') {
    const d = DFF_BODY;
    return (
      <g class="real-ic-sym" transform="translate(22,7) scale(0.36)">
        <rect x={d.x} y={d.y} width={d.w} height={d.h} rx={d.rx} />
        <path d={d.clock} />
      </g>
    );
  }
  if (isBlock(type)) return null;
  const s = SHAPES[type];
  return (
    <g class="real-ic-sym" transform="translate(23,5) scale(0.36)">
      {s.back && <path d={s.back} />}
      <path d={s.body} />
      {s.bubble && <circle cx={s.tip + 4} cy={24} r={4} />}
    </g>
  );
}

/** Qavatli apparat komponenti: DIP mikrosxema, laboratoriya moduli yoki Sci-Fi yadro. */
function RealGateBody({ type, style }: { type: GateType; style: RealStyle }) {
  const ins = inputLeads(type);
  const out = outputY(type);
  const isSciFi = style === 'scifi';
  const isBench = style === 'bench';
  const bx = 12;
  const by = 3;
  const bw = 48;
  const bh = 42;

  return (
    <g class="gate-shape">
      <rect class="real-ic-shadow" x={bx + 2} y={by + 3} width={bw} height={bh} rx={isSciFi ? 7 : 4} />
      {/* Kontakt maydonchalari va oyoqchalar */}
      {ins.map((y) => (
        <g key={y}>
          <circle class="real-ic-pad" cx={0} cy={y} r={5.5} />
          <rect class="real-ic-pin" x={0} y={y - 2.6} width={bx + 2} height={5.2} rx={1} />
        </g>
      ))}
      <circle class="real-ic-pad" cx={GATE_W} cy={out} r={5.5} />
      <rect class="real-ic-pin" x={bx + bw - 2} y={out - 2.6} width={GATE_W - bx - bw + 2} height={5.2} rx={1} />

      {/* Korpus */}
      {isSciFi ? (
        <polygon
          class="real-ic-body"
          points={`${bx + 6},${by} ${bx + bw - 6},${by} ${bx + bw},${by + 6} ${bx + bw},${by + bh - 6} ${bx + bw - 6},${by + bh} ${bx + 6},${by + bh} ${bx},${by + bh - 6} ${bx},${by + 6}`}
        />
      ) : (
        <rect class="real-ic-body" x={bx} y={by} width={bw} height={bh} rx={isBench ? 5 : 3} />
      )}
      <rect class="real-ic-bevel" x={bx + 1.5} y={by + 1.5} width={bw - 3} height={bh - 3} rx={isSciFi ? 5 : 2.5} />

      {/* 1-oyoqcha chuqurchasi / burchak mixlari */}
      {isBench ? (
        <>
          <circle class="real-ic-pad" cx={bx + 4} cy={by + 4} r={1.4} />
          <circle class="real-ic-pad" cx={bx + bw - 4} cy={by + 4} r={1.4} />
          <circle class="real-ic-pad" cx={bx + 4} cy={by + bh - 4} r={1.4} />
          <circle class="real-ic-pad" cx={bx + bw - 4} cy={by + bh - 4} r={1.4} />
          <rect class="real-ic-window" x={bx + 6} y={by + 4} width={bw - 12} height={22} rx={3} />
        </>
      ) : isSciFi ? (
        <rect class="real-ic-window" x={bx + 5} y={by + 4} width={bw - 10} height={22} rx={4} />
      ) : (
        <>
          <path class="real-ic-notch" d={`M${bx},${GATE_H / 2 - 4.5} A4.5,4.5 0 0 1 ${bx},${GATE_H / 2 + 4.5}`} />
          <circle class="chip-dot" cx={bx + 5.5} cy={by + 5.5} r={1.7} />
        </>
      )}

      <MiniSymbol type={type} />
      {/* Korpus ustidagi holat LED chirog'i */}
      <circle class="real-ic-led" cx={bx + bw - 6} cy={out} r={2.4} />
    </g>
  );
}

/** 4 burchakdagi montaj vinti (PCB / Laboratoriya / Sci-Fi). */
function Screw({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle class="real-screw-ring" r={5} />
      <line class="real-screw-slot" x1={-2.6} y1={-2.6} x2={2.6} y2={2.6} />
    </g>
  );
}

export function BoardReal2D({ editor, expected, topInset = 0 }: Props) {
  const b = useBoard2D(editor, expected, topInset);
  const style = resolveRealStyle(activeTheme.value);
  const a11y = t.play.a11y;

  const upright = (x: number, y: number, children: ComponentChildren, vx = x, vy = y) => (
    <g transform={b.vertical ? `translate(${vx},${vy}) ${TRANSPOSE}` : `translate(${x},${y})`}>{children}</g>
  );

  /**
   * Plata yozuvi (ipak bosma). Tik ekranda butun sahna TRANSPOSE bilan akslanadi — oddiy <text> oynadagi aksdek
   * teskari chiqardi. scale(1,-1) akslantirishni burilishga aylantiradi: yozuv chekka bo'ylab yuqoridan pastga
   * o'qiladi. -6 — 8 px shriftning bosh harf balandligi: harflar avvalgidek chekka tomonda qoladi.
   */
  const silk = (x: number, y: number, text: string) =>
    b.vertical ? (
      <text class="real-silk" transform={`translate(${x},${y - 6}) scale(1,-1)`}>
        {text}
      </text>
    ) : (
      <text class="real-silk" x={x} y={y}>
        {text}
      </text>
    );

  const label = (cls: string, x: number, y: number, text: ComponentChildren, vx = x, vy = y) =>
    b.vertical ? (
      <text class={cls} transform={`translate(${vx},${vy}) ${TRANSPOSE}`}>
        {text}
      </text>
    ) : (
      <text class={cls} x={x} y={y}>
        {text}
      </text>
    );

  const port = (id: string, x: number, y: number, src: boolean, connected: boolean, on: boolean, name: string) => (
    <g
      class={`port ${src ? 'src' : 'sink'}${b.busPort(id) ? ' bus' : ''}${connected ? ' linked' : ''}${on ? ' on' : ''}${b.active === id ? ' active' : ''}`}
      data-kind="port"
      data-port={id}
      transform={`translate(${x},${y})`}
      tabindex={0}
      role="button"
      aria-pressed={b.pending === id}
      aria-label={`${name}${connected ? `, ${a11y.linked}` : ''}${b.pending === id ? `. ${a11y.wiring}` : ''}`}
      onKeyDown={(e) => b.onPortKey(e, id)}
    >
      <circle class="port-hit" r={15} />
      <circle class="port-dot" r={b.busPort(id) ? 7.5 : 5.5} />
    </g>
  );

  const slab = bounds(editor.circuit.value, b.lay, b.vertical);
  const sx = slab.minX - 20;
  const sy = slab.minY - 22;
  const sw = slab.maxX - slab.minX + 40;
  const sh = slab.maxY - slab.minY + 44;

  let deleteAt = b.gateDeleteAt;
  const tags: ComponentChildren[] = [];
  const wireEls = b.wires.map((w, i) => {
    const route = b.routed.routes[i];
    // Shinaning qolgan bitlari — boshi bilan bitta qalin sim (lenta kabel).
    if (!route || b.bund.rep[i] !== i) return null;
    // PCB rejimida kesishish ustiga SMD 000 ko'prik qo'yiladi; boshqa uslublarda — ko'tarilgan yoy.
    const hops = style === 'pcb' ? [] : b.routed.hops[i];
    const d = routeD(route, hops, b.sharp);
    const live = b.reached(w.from, 1);
    const bus = b.busWireValue(i);
    const on = live && (bus === undefined ? b.values.get(w.from) === 1 : !!bus);
    if (bus !== undefined) {
      const m = routeMid(route);
      tags.push(
        <g key={`tag${i}`} class={`bus-tag${on ? ' on' : ''}${live ? '' : ' idle'}`} transform={`translate(${m.x},${m.y})`}>
          <rect x={-12} y={-9} width={24} height={18} rx={9} />
          {upright(0, 0, <text>{live && bus !== null ? bus : '–'}</text>)}
        </g>,
      );
    }
    const front = b.wave !== null && b.stepOf(w.from, 1) === b.wave;
    const selected = b.sel?.kind === 'wire' && b.sel.index === i;
    if (selected) {
      const m = routeMid(route);
      deleteAt = { x: m.x, y: m.y + (b.vertical ? 14 : -14) };
    }
    const insulated = style === 'breadboard' || style === 'bench';
    const offStroke = insulated ? netColor(w.from) : undefined;
    const smdBridges: ComponentChildren[] = [];
    if (style === 'pcb') {
      b.routed.hops[i].forEach((pts, segIdx) => {
        if (!pts.length || segIdx >= route.length - 1) return;
        const p0 = route[segIdx];
        const p1 = route[segIdx + 1];
        const deg = (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI;
        for (const h of pts) {
          smdBridges.push(
            <g key={`${i}-${segIdx}-${h.x},${h.y}`} transform={`translate(${h.x},${h.y}) rotate(${deg})`} pointer-events="none">
              <rect class="real-smd-pad" x={-9} y={-4} width={4} height={8} rx={0.8} />
              <rect class="real-smd-pad" x={5} y={-4} width={4} height={8} rx={0.8} />
              <rect class="real-smd-body" x={-5.5} y={-4.5} width={11} height={9} rx={1} />
              {/* Tik ekranda sahna akslangan — markazlashgan belgi o'z joyida to'g'rilanadi (silk() ga qarang). */}
              <text class="real-smd-mark" x={0} y={0} transform={b.vertical ? 'scale(1,-1)' : undefined}>
                000
              </text>
            </g>,
          );
        }
      });
    }
    return (
      <g
        key={`${w.from}>${w.to}`}
        class={`wire${bus !== undefined ? ' bus' : ''}${on ? ' on' : ''}${selected ? ' sel' : ''}${live ? '' : ' idle'}${front ? ' front' : ''}`}
        data-kind="wire"
        data-index={i}
      >
        <path class="wire-hit" d={d} />
        <path class="real-wire-base" d={d} />
        {on && <path class="wire-glow" d={d} />}
        <path
          class="wire-line"
          d={d}
          style={!on && !selected && offStroke ? { stroke: offStroke, opacity: 0.85 } : undefined}
        />
        {on && !selected && <path class="real-wire-pulse" d={d} />}
        {smdBridges}
      </g>
    );
  });

  return (
    <div class={`board board-real style-${style}`} ref={b.wrapRef}>
      <svg
        ref={b.svgRef}
        class={`board-svg ${b.targetClass}${b.moving.value ? ' moving' : ''}`}
        role="group"
        aria-label={a11y.board}
        tabindex={-1}
        onPointerDown={b.onDown}
        onPointerMove={b.onMove}
        onPointerUp={b.onUp}
        onPointerCancel={b.onUp}
        onWheel={b.onWheel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          <pattern id="real-grid" width={24} height={24} patternUnits="userSpaceOnUse">
            {style === 'breadboard' ? (
              <>
                <rect x={4.5} y={4.5} width={3} height={3} rx={0.5} fill="var(--grid)" />
                <rect x={16.5} y={4.5} width={3} height={3} rx={0.5} fill="var(--grid)" />
                <rect x={4.5} y={16.5} width={3} height={3} rx={0.5} fill="var(--grid)" />
                <rect x={16.5} y={16.5} width={3} height={3} rx={0.5} fill="var(--grid)" />
              </>
            ) : style === 'pcb' ? (
              <>
                <path d="M24,0 H0 V24" fill="none" stroke="var(--grid)" stroke-width={0.8} opacity={0.35} />
                <circle cx={12} cy={12} r={1.3} fill="var(--grid)" />
              </>
            ) : style === 'scifi' ? (
              <>
                <path d="M24,0 H0 V24" fill="none" stroke="var(--grid)" stroke-width={0.8} opacity={0.45} />
                <path d="M10,12 H14 M12,10 V14" fill="none" stroke="var(--grid)" stroke-width={0.9} opacity={0.75} />
              </>
            ) : (
              <>
                <path d="M24,0 H0 V24" fill="none" stroke="var(--grid)" stroke-width={0.8} opacity={0.45} />
                <circle cx={12} cy={12} r={0.9} fill="var(--grid)" />
              </>
            )}
          </pattern>
        </defs>

        <g transform={`translate(${b.view.tx},${b.view.ty}) scale(${b.view.s})${b.vertical ? ` ${TRANSPOSE}` : ''}`}>
          <rect class="board-bg" x={-5000} y={-5000} width={10000} height={10000} fill="url(#real-grid)" opacity={0.45} />

          {/* Asosiy plata korpusi / maket asos */}
          <g class="real-substrate" pointer-events="none">
            <rect class="real-slab" x={sx} y={sy} width={sw} height={sh} rx={12} />
            <rect class="real-slab" x={sx} y={sy} width={sw} height={sh} rx={12} fill="url(#real-grid)" opacity={0.8} />
            <rect class="real-slab-bevel" x={sx + 2} y={sy + 2} width={sw - 4} height={sh - 4} rx={10} />
            {style === 'breadboard' ? (
              <>
                <line class="real-rail-pos" x1={sx + 16} y1={sy + 10} x2={sx + sw - 16} y2={sy + 10} />
                <line class="real-rail-gnd" x1={sx + 16} y1={sy + sh - 10} x2={sx + sw - 16} y2={sy + sh - 10} />
                <rect class="real-rail-groove" x={sx + 10} y={(sy + sy + sh) / 2 - 4} width={sw - 20} height={8} rx={3} />
                {silk(sx + 20, sy + 20, '+5V DC')}
                {silk(sx + 20, sy + sh - 16, 'GND 0V')}
              </>
            ) : (
              <>
                <Screw x={sx + 12} y={sy + 12} />
                <Screw x={sx + sw - 12} y={sy + 12} />
                <Screw x={sx + 12} y={sy + sh - 12} />
                <Screw x={sx + sw - 12} y={sy + sh - 12} />
                {silk(sx + 24, sy + 14, style === 'pcb' ? 'LOGIC-GATE // FR4 REV-3' : style === 'scifi' ? 'NEXUS-DECK // MK-IV' : 'BENCH // CH-01')}
              </>
            )}
          </g>

          <g class="wires">
            {wireEls}
            {b.routed.dots.map(({ net, at }) => {
              const live = b.reached(net, 1);
              const on = live && b.values.get(net) === 1;
              return (
                <g key={`${net}@${at.x},${at.y}`} pointer-events="none">
                  <circle class="real-ic-pad" cx={at.x} cy={at.y} r={5.4} />
                  <circle class={`wire-dot${on ? ' on' : ''}${live ? '' : ' idle'}`} cx={at.x} cy={at.y} r={3.4} />
                </g>
              );
            })}
            {tags}
          </g>

          {b.gates.map((g) => {
            const live = b.reached(g.id, 0);
            const on = live && b.values.get(g.id) === 1;
            const selected = b.sel?.kind === 'gate' && b.sel.id === g.id;
            return (
              <g
                key={g.id}
                class={`gate${on ? ' on' : ''}${selected ? ' sel' : ''}${b.highlight === g.id ? ' err' : ''}${live ? '' : ' idle'}`}
                transform={`translate(${g.x},${g.y})`}
              >
                <g
                  data-kind="gate"
                  data-id={g.id}
                  tabindex={0}
                  role="button"
                  aria-pressed={selected}
                  aria-label={a11y.gate(b.gateName.get(g.id)!)}
                  onKeyDown={(e) => b.onGateKey(e, g)}
                >
                  <rect class="gate-hit" x={4} y={-2} width={GATE_W - 8} height={gateH(g) + 4} rx={8} />
                  {isBlock(g.type) ? <GateShape type={g.type} /> : <RealGateBody type={g.type} style={style} />}
                  {isBlock(g.type) ? (
                    <>
                      {label('gate-label block-label', 36, gateH(g) / 2, g.type)}
                      {b.blockLabels(g).ins.map((n, i) => n && <Fragment key={`i${i}`}>{label('block-pin', 15, inputPortY(g, i), n)}</Fragment>)}
                      {b.blockLabels(g).outs.map(
                        (n, k) => n && <Fragment key={`o${k}`}>{label('block-pin block-pin-out', 57, outputPortY(g, k), n)}</Fragment>,
                      )}
                    </>
                  ) : g.type === 'DFF' ? (
                    <>
                      {label('gate-label', 35, 32, 'DFF', 28, GATE_H / 2)}
                      {label('gate-sub', 35, 40, b.states.get(g.id), 44, GATE_H / 2)}
                    </>
                  ) : (
                    <>
                      {label('gate-label', 35, 32, g.type, 29, GATE_H / 2)}
                      {label('chip-code', 35, 40, CHIP_CODE[g.type], 43, GATE_H / 2)}
                    </>
                  )}
                </g>
                {Array.from({ length: GATE_ARITY[g.type] }, (_, i) =>
                  b.hidden(`${g.id}:${i}`)
                    ? null
                    : port(`${g.id}:${i}`, 0, inputPortY(g, i), false, b.driven.has(`${g.id}:${i}`), false, a11y.gateIn(b.gateName.get(g.id)!, i)),
                )}
                {Array.from({ length: gateOutputs(g.type) }, (_, k) => {
                  const id = sourcePort(g.id, k);
                  if (b.hidden(id)) return null;
                  const outOn = b.reached(id, 0) && b.values.get(id) === 1;
                  const name = isBlock(g.type) ? `${b.gateName.get(g.id)!} ${b.blockOutName(g, k)}` : b.gateName.get(g.id)!;
                  return port(id, GATE_W, outputPortY(g, k), true, b.usedSources.has(id), outOn, a11y.gateOut(name));
                })}
              </g>
            );
          })}

          {b.inGroups.map((group) => {
            if (group.bus) return <BusInPin key={`in:${group.name}`} b={b} group={group} port={port} real />;
            const name = group.name;
            const k = group.idx[0];
            const p = b.lay.inputs.get(name)!;
            const on = b.bits[k] === 1;
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
                  onKeyDown={(e) => b.onPinKey(e, k)}
                >
                  <rect class="real-ic-shadow" x={-76} y={-18} width={64} height={40} rx={9} />
                  <rect class="real-sw-housing" x={-78} y={-20} width={64} height={40} rx={9} />
                  <circle class="real-ic-pad" cx={-73} cy={-15} r={1.3} />
                  <circle class="real-ic-pad" cx={-73} cy={15} r={1.3} />
                  {label('pin-name', -64, 0, name)}
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
                {port(`in:${name}`, 0, 0, true, b.usedSources.has(`in:${name}`), on, a11y.source(name))}
              </g>
            );
          })}

          {b.outGroups.map((group) => {
            if (group.bus) return <BusOutPin key={`out:${group.name}`} b={b} group={group} port={port} real />;
            const name = group.name;
            const i = group.idx[0];
            const p = b.lay.outputs.get(name)!;
            const src = b.drivers.get(`out:${name}`);
            const v = src === undefined || b.reached(src, 2) ? b.outputs[i] : null;
            const exp = expected?.[i];
            const state = exp === undefined || v === null ? '' : v === exp ? ' good' : ' bad';
            return (
              <g
                key={`out:${name}`}
                class={`pin pin-out${v === 1 ? ' on' : ''}${state}${b.highlight === name ? ' err' : ''}`}
                transform={`translate(${p.x},${p.y})`}
              >
                <line class="lead" x1={0} y1={0} x2={14} y2={0} />
                <rect class="real-ic-shadow" x={16} y={-18} width={60} height={40} rx={9} />
                <rect class="pin-box" x={14} y={-20} width={60} height={40} rx={9} />
                {label('pin-name', 30, 0, name)}
                {upright(
                  56,
                  0,
                  <g class="lamp-g">
                    <circle class="lamp-halo" r={16} />
                    <circle class="real-led-outer" r={12.5} />
                    <circle class="lamp-bezel" r={10} />
                    <circle class="lamp" r={7.2} />
                    <circle class="lamp-shine" cx={-2.5} cy={-2.5} r={2.2} />
                  </g>,
                )}
                {exp !== undefined && label('pin-exp', 44, 32, `${t.play.expected.toLowerCase()}: ${exp}`, 90, 0)}
                {port(`out:${name}`, 0, 0, false, b.driven.has(`out:${name}`), v === 1, a11y.output(name))}
              </g>
            );
          })}

          {b.ghost.value && <path class="wire-ghost" d={wirePath(b.ghost.value.a, b.ghost.value.b)} />}

          {deleteAt && (
            <g
              class="delete-btn"
              data-kind="delete"
              transform={`translate(${deleteAt.x},${deleteAt.y})`}
              tabindex={0}
              role="button"
              aria-label={t.play.remove}
              onKeyDown={b.onDeleteKey}
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
