import { Fragment, type ComponentChildren } from 'preact';
import { t } from '../i18n';
import { GATE_ARITY, gateOutputs, isBlock, sourcePort, type BlockType, type GateType } from '../sim/types';
import { activeTheme, resolveRealStyle, type RealStyle } from '../theme';
import type { Editor } from './editor';
import { BusInPin, BusOutPin } from './BusPins';
import { CHIP_CODE } from './GateShape';
import { bounds, GATE_H, GATE_W, gateH, inputPortY, outputPortY, routeMid, wirePath } from './geometry';
import { routeParts } from './routing';
import { BLOCK_BODY, BLOCK_SHAPE, blockText, DFF_BODY, inputLeads, outputLeads, outputY, SHAPES } from './shapes';
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

/** Chip yuzasiga lazer bilan o'yilgan kichik ANSI mantiqiy belgi (silkscreen / OLED oyna ichida). */
function MiniSymbol({ type }: { type: GateType }) {
  if (type === 'DFF') {
    const d = DFF_BODY;
    return (
      <g class="real-ic-sym" transform="translate(22,6.5) scale(0.36)">
        <rect x={d.x} y={d.y} width={d.w} height={d.h} rx={d.rx} />
        <path d={d.clock} />
      </g>
    );
  }
  if (isBlock(type)) return null;
  const s = SHAPES[type];
  return (
    <g class="real-ic-sym" transform="translate(23,4.5) scale(0.36)">
      {s.back && <path d={s.back} />}
      <path d={s.body} />
      {s.bubble && <circle cx={s.tip + 4} cy={24} r={4} />}
    </g>
  );
}

/** Metall qalaylangan IC oyoqcha va mis/oltin kavshar maydonchasi (2.5D yaltirash bilan). */
function MetalLead({ x0, x1, y, padX, bus }: { x0: number; x1: number; y: number; padX: number; bus?: boolean }) {
  const h = bus ? 7.6 : 5.2;
  const padR = bus ? 7.4 : 5.6;
  const left = Math.min(x0, x1);
  const w = Math.abs(x1 - x0);
  const collarX = padX === left ? left + 2.5 : left + w - 4.5;
  return (
    <g>
      <circle class="real-pad-ring" cx={padX} cy={y} r={padR + 1.2} />
      <circle class="real-ic-pad" cx={padX} cy={y} r={padR} fill="url(#r-pad-grad)" />
      <rect class="real-ic-pin-shadow" x={left} y={y - h / 2 + 1.2} width={w} height={h} rx={1.1} />
      <rect class="real-ic-pin" x={left} y={y - h / 2} width={w} height={h} rx={1.1} fill="url(#r-metal-v)" />
      <rect class="real-solder-collar" x={collarX} y={y - h / 2 - 0.6} width={2.4} height={h + 1.2} rx={0.9} />
    </g>
  );
}

/** Burchakdagi kichik metall mix (Laboratoriya / Switch / Panel korpuslari uchun). */
function MicroScrew({ x, y, r = 1.8 }: { x: number; y: number; r?: number }) {
  return (
    <g transform={`translate(${x},${y})`} pointer-events="none">
      <circle class="real-micro-screw" r={r} fill="url(#r-screw-silver)" />
      <line class="real-screw-slot" x1={-r * 0.55} y1={-r * 0.55} x2={r * 0.55} y2={r * 0.55} />
    </g>
  );
}

/** Qavatli AAA apparat komponenti: 74HC DIP mikrosxema, alyuminiy laboratoriya moduli yoki Sci-Fi yadro. */
function RealGateBody({ type, style }: { type: GateType; style: RealStyle }) {
  const ins = inputLeads(type);
  const out = outputY(type);
  const isSciFi = style === 'scifi';
  const isBench = style === 'bench';
  const bx = 12;
  const by = 3;
  const bw = 48;
  const bh = 42;
  const rx = isSciFi ? 6 : isBench ? 5 : 3;
  const octPts = `${bx + 6},${by} ${bx + bw - 6},${by} ${bx + bw},${by + 6} ${bx + bw},${by + bh - 6} ${bx + bw - 6},${by + bh} ${bx + 6},${by + bh} ${bx},${by + bh - 6} ${bx},${by + 6}`;

  return (
    <g class="gate-shape">
      {/* Ikki qatlamli yumshoq tushma soya (penumbra + kontakt soyasi) */}
      <rect class="real-ic-shadow-soft" x={bx + 2.5} y={by + 4} width={bw} height={bh} rx={rx + 1} />
      <rect class="real-ic-shadow" x={bx + 1.2} y={by + 2.2} width={bw} height={bh} rx={rx} />

      {/* Oyoqchalar va mis kavshar maydonchalari */}
      {ins.map((y) => (
        <MetalLead key={`i${y}`} x0={0} x1={bx + 2.5} y={y} padX={0} />
      ))}
      <MetalLead x0={bx + bw - 2.5} x1={GATE_W} y={out} padX={GATE_W} />

      {/* Korpus asosiy shakli + 2.5D qalinlik qirrasi + studiya yorug'lik jilosi */}
      {isSciFi ? (
        <>
          <polygon class="real-ic-body" points={octPts} />
          <polygon class="real-ic-sheen" points={octPts} fill="url(#r-ic-sheen)" />
        </>
      ) : (
        <>
          <rect class="real-ic-body" x={bx} y={by} width={bw} height={bh} rx={rx} />
          <rect class="real-ic-sheen" x={bx} y={by} width={bw} height={bh} rx={rx} fill="url(#r-ic-sheen)" />
        </>
      )}

      {/* Ichki qavariq sirt (molded epoxy die table / anodlangan qirra) */}
      <rect class="real-ic-die" x={bx + 3} y={by + 3} width={bw - 6} height={bh - 6} rx={Math.max(1.5, rx - 1.5)} />
      <rect class="real-ic-bevel" x={bx + 1.4} y={by + 1.4} width={bw - 2.8} height={bh - 2.8} rx={Math.max(2, rx - 0.8)} />
      <line class="real-top-rim" x1={bx + rx + 1} y1={by + 1.2} x2={bx + bw - rx - 1} y2={by + 1.2} />

      {/* Uslubga xos apparat tafsilotlari */}
      {isBench ? (
        <>
          <MicroScrew x={bx + 4.2} y={by + 4.2} r={1.6} />
          <MicroScrew x={bx + bw - 4.2} y={by + 4.2} r={1.6} />
          <MicroScrew x={bx + 4.2} y={by + bh - 4.2} r={1.6} />
          <MicroScrew x={bx + bw - 4.2} y={by + bh - 4.2} r={1.6} />
          <rect class="real-ic-window" x={bx + 6} y={by + 4} width={bw - 12} height={21} rx={3} fill="url(#r-oled-grad)" />
          <line class="real-glass-glint" x1={bx + 8} y1={by + 6} x2={bx + 17} y2={by + 6} />
        </>
      ) : isSciFi ? (
        <>
          <rect class="real-ic-window" x={bx + 5.5} y={by + 4} width={bw - 11} height={21} rx={3.5} fill="url(#r-oled-grad)" />
          <path class="real-scifi-ticks" d={`M${bx + 4},${by + 9} v-3 h3 M${bx + bw - 4},${by + 9} v-3 h-3 M${bx + 4},${by + bh - 9} v3 h3 M${bx + bw - 4},${by + bh - 9} v3 h-3`} />
        </>
      ) : (
        <>
          {/* DIP-14 yarim doirali 1-oyoqcha kesigi va lazerli nuqta */}
          <path class="real-ic-notch" d={`M${bx},${GATE_H / 2 - 4.8} A4.8,4.8 0 0 1 ${bx},${GATE_H / 2 + 4.8} Z`} />
          <circle class="real-ic-dimple" cx={bx + 6} cy={by + 6} r={2} />
        </>
      )}

      <MiniSymbol type={type} />

      {/* Korpus ustidagi SMD holat LED chirog'i (gardi + optik linza + yorug'lik halosi) */}
      <g class="real-ic-led-g" transform={`translate(${bx + bw - 6.2},${out})`}>
        <circle class="real-ic-led-halo" r={6.5} fill="url(#r-led-halo)" />
        <circle class="real-ic-led-bezel" r={3.1} fill="url(#r-bezel-grad)" />
        <circle class="real-ic-led" r={2.2} />
        <circle class="real-ic-led-shine" cx={-0.7} cy={-0.7} r={0.75} />
      </g>
    </g>
  );
}

/** Ko'p oyoqli AAA blok moduli (HA, FA, MUX, DEC, ADD4, ALU4, REG4, PC4 va h.k.). */
function RealBlockBody({ type, style, isBusPort }: { type: BlockType; style: RealStyle; isBusPort: (idx: number, out: boolean) => boolean }) {
  const b = BLOCK_BODY;
  const h = BLOCK_SHAPE[type].h;
  const isSciFi = style === 'scifi';
  const isBench = style === 'bench';
  const bx = b.x;
  const by = 2;
  const bw = b.w;
  const bh = h - 4;
  const rx = isSciFi ? 6 : isBench ? 5 : 3.5;

  return (
    <g class="gate-shape block-shape">
      <rect class="real-ic-shadow-soft" x={bx + 2.5} y={by + 4} width={bw} height={bh} rx={rx + 1} />
      <rect class="real-ic-shadow" x={bx + 1.2} y={by + 2.2} width={bw} height={bh} rx={rx} />

      {inputLeads(type).map((y, i) => (
        <MetalLead key={`i${i}`} x0={0} x1={bx + 2} y={y} padX={0} bus={isBusPort(i, false)} />
      ))}
      {outputLeads(type).map((y, k) => (
        <MetalLead key={`o${k}`} x0={bx + bw - 2} x1={GATE_W} y={y} padX={GATE_W} bus={isBusPort(k, true)} />
      ))}

      <rect class="real-ic-body" x={bx} y={by} width={bw} height={bh} rx={rx} />
      <rect class="real-ic-sheen" x={bx} y={by} width={bw} height={bh} rx={rx} fill="url(#r-ic-sheen)" />
      <rect class="real-ic-die" x={bx + 3} y={by + 3} width={bw - 6} height={bh - 6} rx={Math.max(1.5, rx - 1.5)} />
      <rect class="real-ic-bevel" x={bx + 1.4} y={by + 1.4} width={bw - 2.8} height={bh - 2.8} rx={Math.max(2, rx - 0.8)} />
      <line class="real-top-rim" x1={bx + rx + 1} y1={by + 1.2} x2={bx + bw - rx - 1} y2={by + 1.2} />

      {isBench ? (
        <>
          <MicroScrew x={bx + 4.2} y={by + 4.2} r={1.6} />
          <MicroScrew x={bx + bw - 4.2} y={by + 4.2} r={1.6} />
          <MicroScrew x={bx + 4.2} y={by + bh - 4.2} r={1.6} />
          <MicroScrew x={bx + bw - 4.2} y={by + bh - 4.2} r={1.6} />
        </>
      ) : (
        <>
          <path class="real-ic-notch" d={`M${bx + bw / 2 - 5},${by} A5,5 0 0 0 ${bx + bw / 2 + 5},${by} Z`} />
          <circle class="real-ic-dimple" cx={bx + 6} cy={by + 6} r={1.9} />
        </>
      )}

      {/* Yuqori chetda holat LED indikatori */}
      <g class="real-ic-led-g" transform={`translate(${bx + bw - 6.5},${by + 6.5})`}>
        <circle class="real-ic-led-halo" r={6} fill="url(#r-led-halo)" />
        <circle class="real-ic-led-bezel" r={2.9} fill="url(#r-bezel-grad)" />
        <circle class="real-ic-led" r={2} />
        <circle class="real-ic-led-shine" cx={-0.6} cy={-0.6} r={0.7} />
      </g>
    </g>
  );
}

/** 4 burchakdagi realist Phillips montaj vinti (mis halqa + yaltiroq qalpoqcha + xoch kesik). */
function Screw({ x, y, brass }: { x: number; y: number; brass?: boolean }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle class="real-screw-pad" r={7.2} fill="url(#r-pad-grad)" />
      <circle class="real-screw-ring" r={5.2} fill={brass ? 'url(#r-screw-brass)' : 'url(#r-screw-silver)'} />
      <g transform="rotate(32)">
        <line class="real-screw-slot" x1={-2.9} y1={0} x2={2.9} y2={0} />
        <line class="real-screw-slot" x1={0} y1={-2.9} x2={0} y2={2.9} />
        <line class="real-screw-catch" x1={-2.4} y1={-0.7} x2={2.4} y2={-0.7} />
      </g>
    </g>
  );
}

/** PCB optik fidyusial belgisi (haqiqiy zavod platasidagi oltin nishon). */
function Fiducial({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`} opacity={0.75}>
      <circle class="real-fid-ring" r={3.6} />
      <circle class="real-fid-dot" r={1.5} fill="url(#r-pad-grad)" />
    </g>
  );
}

export function BoardReal2D({ editor, expected, topInset = 0 }: Props) {
  const b = useBoard2D(editor, expected, topInset);
  const theme = activeTheme.value;
  const style = resolveRealStyle(theme);
  const isMinor = theme === 'minor';
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
  const sx = slab.minX - 24;
  const sy = slab.minY - 26;
  const sw = slab.maxX - slab.minX + 48;
  const sh = slab.maxY - slab.minY + 52;
  const edgeFingers = Math.min(12, Math.max(4, Math.floor((sw - 120) / 14)));
  const fingerStart = sx + (sw - edgeFingers * 10) / 2;

  let deleteAt = b.gateDeleteAt;
  const tags: ComponentChildren[] = [];
  const bridgeOverpasses: ComponentChildren[] = [];
  const dotPts = b.routed.dots.map((d) => d.at);
  const wireEls = b.wires.map((w, i) => {
    const route = b.routed.routes[i];
    // Shinaning qolgan bitlari — boshi bilan bitta qalin sim (lenta kabel).
    if (!route || b.bund.rep[i] !== i) return null;
    // PCB rejimida kesishish ustiga SMD 000 ko'prik qo'yiladi; boshqa uslublarda — ko'tarilgan yoy.
    const hops = style === 'pcb' ? [] : b.routed.hops[i];
    const { d, hopD, hopArcD } = routeParts(route, hops, b.sharp, 10, dotPts);
    const live = b.reached(w.from, 1);
    const bus = b.busWireValue(i);
    const on = live && (bus === undefined ? b.values.get(w.from) === 1 : !!bus);
    if (bus !== undefined) {
      const m = routeMid(route);
      tags.push(
        <g key={`tag${i}`} class={`bus-tag${on ? ' on' : ''}${live ? '' : ' idle'}`} transform={`translate(${m.x},${m.y})`}>
          <rect class="real-ic-shadow" x={-11} y={-7.5} width={24} height={18} rx={9} />
          <rect x={-12} y={-9} width={24} height={18} rx={9} />
          {upright(0, 0, <text>{live && bus !== null ? bus : '–'}</text>)}
        </g>,
      );
    }
    const front = b.wave !== null && b.stepOf(w.from, 1) === b.wave;
    const selected = b.sel?.kind === 'wire' && b.sel.index === i;
    if (selected) {
      const m = routeMid(route);
      // Shina simida o'rtada son turadi — o'chirish tugmasi undan nariroqda.
      const off = bus === undefined ? 14 : 26;
      deleteAt = { x: m.x, y: m.y + (b.vertical ? off : -off) };
    }
    const insulated = style === 'breadboard' || style === 'bench';
    const offStroke = insulated ? netColor(w.from) : undefined;
    const wireCls = `wire${bus !== undefined ? ' bus' : ''}${on ? ' on' : ''}${selected ? ' sel' : ''}${live ? '' : ' idle'}${front ? ' front' : ''}`;
    if (style === 'pcb') {
      // Barcha SMD 000 ko'priklar hamma simlardan keyin ustki qatlamda chiziladi — hech bir sim ustidan kesib o'tmaydi.
      b.routed.hops[i].forEach((pts, segIdx) => {
        if (!pts.length || segIdx >= route.length - 1) return;
        const p0 = route[segIdx];
        const p1 = route[segIdx + 1];
        const deg = (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI;
        for (const h of pts) {
          bridgeOverpasses.push(
            <g key={`smd-${i}-${segIdx}-${h.x},${h.y}`} transform={`translate(${h.x},${h.y}) rotate(${deg})`} pointer-events="none">
              <rect class="real-ic-shadow" x={-9} y={-3.5} width={19} height={9.5} rx={1.4} />
              <rect class="real-smd-pad" x={-9.6} y={-4.4} width={4.2} height={8.8} rx={1} fill="url(#r-metal-v)" />
              <rect class="real-smd-pad" x={5.4} y={-4.4} width={4.2} height={8.8} rx={1} fill="url(#r-metal-v)" />
              <rect class="real-smd-body" x={-5.8} y={-4.8} width={11.6} height={9.6} rx={1.1} />
              <rect class="real-ic-sheen" x={-5.8} y={-4.8} width={11.6} height={9.6} rx={1.1} fill="url(#r-ic-sheen)" />
              {/* Tik ekranda sahna akslangan — markazlashgan belgi o'z joyida to'g'rilanadi (silk() ga qarang). */}
              <text class="real-smd-mark" x={0} y={0} transform={b.vertical ? 'scale(1,-1)' : undefined}>
                000
              </text>
            </g>,
          );
        }
      });
    } else if (hopD) {
      // Ko'prik yoylari hamma simlardan ustda chiziladi — chizilish tartibidan qat'i nazar ko'prik kesishgan sim ustidan o'tadi.
      bridgeOverpasses.push(
        <g key={`hop-${w.from}>${w.to}`} class={`${wireCls} wire-overpass`} pointer-events="none">
          <path class="real-hop-shadow" d={hopArcD} transform="translate(1.5,2.8)" />
          <path class="real-hop-rim" d={hopArcD} />
          <path class="real-wire-base" d={hopD} />
          {on && <path class="wire-glow" d={hopD} />}
          <path
            class="wire-line"
            d={hopD}
            style={!on && !selected && offStroke ? { stroke: offStroke, opacity: 1 } : undefined}
          />
          <path class="real-wire-spec" d={hopD} />
          {on && !selected && <path class="real-wire-pulse" d={hopD} />}
        </g>,
      );
    }
    return (
      <g
        key={`${w.from}>${w.to}`}
        class={wireCls}
        data-kind="wire"
        data-index={i}
      >
        <path class="wire-hit" d={d} />
        <path class="real-wire-base" d={d} />
        {on && <path class="wire-glow" d={d} />}
        <path
          class="wire-line"
          d={d}
          style={!on && !selected && offStroke ? { stroke: offStroke, opacity: 0.9 } : undefined}
        />
        <path class="real-wire-spec" d={d} />
        {on && !selected && <path class="real-wire-pulse" d={d} />}
      </g>
    );
  });

  const boardTitle = isMinor
    ? 'SAMARQAND // MINOR-IV'
    : style === 'pcb'
      ? 'LOGIC-GATE // FR-4 REV-4'
      : style === 'scifi'
        ? 'NEXUS-DECK // MK-IV'
        : 'BENCH // CH-01';

  return (
    <div class={`board board-real style-${style}${isMinor ? ' style-minor' : ''}`} ref={b.wrapRef}>
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
          {/* Studiya yoritilishi: plata ustidagi yumshoq diagonal yorug'lik gradienti */}
          <linearGradient id="r-slab-sheen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'var(--shine)', stopOpacity: 0.08 }} />
            <stop offset="45%" style={{ stopColor: 'var(--shine)', stopOpacity: 0.015 }} />
            <stop offset="100%" style={{ stopColor: 'var(--shadow)', stopOpacity: 0.34 }} />
          </linearGradient>

          {/* Epoksid chip / anodlangan korpus ustidagi 2.5D yorug'lik jilosi */}
          <linearGradient id="r-ic-sheen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'var(--shine)', stopOpacity: 0.16 }} />
            <stop offset="38%" style={{ stopColor: 'var(--shine)', stopOpacity: 0.04 }} />
            <stop offset="62%" style={{ stopColor: 'var(--shadow)', stopOpacity: 0.0 }} />
            <stop offset="100%" style={{ stopColor: 'var(--shadow)', stopOpacity: 0.34 }} />
          </linearGradient>

          {/* Qalaylangan metall oyoqchalar va SMD kontaktlar uchun silindrik yaltirash */}
          <linearGradient id="r-metal-v" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'var(--bezel)', stopOpacity: 0.92 }} />
            <stop offset="22%" style={{ stopColor: 'var(--lead)', stopOpacity: 1 }} />
            <stop offset="46%" style={{ stopColor: 'var(--shine)', stopOpacity: 0.94 }} />
            <stop offset="74%" style={{ stopColor: 'var(--lead)', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: 'var(--knob-ink)', stopOpacity: 0.85 }} />
          </linearGradient>

          {/* Oltin/mis ENIG kavshar maydonchasi */}
          <radialGradient id="r-pad-grad" cx="35%" cy="32%" r="70%">
            <stop offset="0%" style={{ stopColor: 'var(--shine)', stopOpacity: 0.65 }} />
            <stop offset="36%" style={{ stopColor: 'var(--copper)', stopOpacity: 1 }} />
            <stop offset="82%" style={{ stopColor: 'var(--bronze)', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: 'var(--bezel)', stopOpacity: 0.95 }} />
          </radialGradient>

          {/* Jez va zanglamas po'lat montaj vintlari */}
          <radialGradient id="r-screw-brass" cx="34%" cy="30%" r="70%">
            <stop offset="0%" style={{ stopColor: 'var(--shine)', stopOpacity: 0.85 }} />
            <stop offset="34%" style={{ stopColor: 'var(--copper)', stopOpacity: 1 }} />
            <stop offset="78%" style={{ stopColor: 'var(--bronze)', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: 'var(--knob-ink)', stopOpacity: 0.95 }} />
          </radialGradient>
          <radialGradient id="r-screw-silver" cx="34%" cy="30%" r="70%">
            <stop offset="0%" style={{ stopColor: 'var(--shine)', stopOpacity: 0.9 }} />
            <stop offset="34%" style={{ stopColor: 'var(--silver)', stopOpacity: 1 }} />
            <stop offset="78%" style={{ stopColor: 'var(--lead)', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: 'var(--knob-ink)', stopOpacity: 0.92 }} />
          </radialGradient>

          {/* Panel LED va tumbler xrom/jez gardishi (yorug' maketda ham yuqori kontrastli metall jilo) */}
          <linearGradient id="r-bezel-grad" x1="12%" y1="10%" x2="88%" y2="90%">
            <stop offset="0%" style={{ stopColor: 'var(--shine)', stopOpacity: 0.96 }} />
            <stop offset="26%" style={{ stopColor: 'var(--lead)', stopOpacity: 1 }} />
            <stop offset="56%" style={{ stopColor: 'var(--knob-ink)', stopOpacity: 0.92 }} />
            <stop offset="82%" style={{ stopColor: 'var(--silver)', stopOpacity: 0.95 }} />
            <stop offset="100%" style={{ stopColor: 'var(--knob-ink)', stopOpacity: 0.96 }} />
          </linearGradient>

          {/* Olti qirrali metall gayka va SPDT tumbler dastasi (silindrik xrom va sharsimon uchi) */}
          <linearGradient id="r-hex-nut" x1="10%" y1="8%" x2="90%" y2="92%">
            <stop offset="0%" style={{ stopColor: 'var(--shine)', stopOpacity: 0.95 }} />
            <stop offset="24%" style={{ stopColor: 'var(--knob)', stopOpacity: 0.95 }} />
            <stop offset="50%" style={{ stopColor: 'var(--lead)', stopOpacity: 1 }} />
            <stop offset="76%" style={{ stopColor: 'var(--silver)', stopOpacity: 0.92 }} />
            <stop offset="100%" style={{ stopColor: 'var(--knob-ink)', stopOpacity: 0.94 }} />
          </linearGradient>
          <linearGradient id="r-bat-shaft" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'var(--lead)', stopOpacity: 1 }} />
            <stop offset="26%" style={{ stopColor: 'var(--shine)', stopOpacity: 1 }} />
            <stop offset="52%" style={{ stopColor: 'var(--knob)', stopOpacity: 0.96 }} />
            <stop offset="78%" style={{ stopColor: 'var(--silver)', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: 'var(--knob-ink)', stopOpacity: 0.96 }} />
          </linearGradient>
          <radialGradient id="r-bat-tip" cx="32%" cy="28%" r="68%">
            <stop offset="0%" style={{ stopColor: 'var(--shine)', stopOpacity: 1 }} />
            <stop offset="28%" style={{ stopColor: 'var(--knob)', stopOpacity: 1 }} />
            <stop offset="65%" style={{ stopColor: 'var(--lead)', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: 'var(--knob-ink)', stopOpacity: 0.96 }} />
          </radialGradient>
          <radialGradient id="r-cavity" cx="62%" cy="64%" r="66%">
            <stop offset="0%" style={{ stopColor: 'var(--gate-fill)', stopOpacity: 1 }} />
            <stop offset="65%" style={{ stopColor: 'var(--knob-ink)', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: 'var(--knob-ink)', stopOpacity: 1 }} />
          </radialGradient>

          {/* Optik 5mm LED epoksid gumbaz linzasi (o'chiq shaffof shisha + yoniq kristal yadro) + yumshoq halo */}
          <radialGradient id="r-led-off" cx="35%" cy="32%" r="72%">
            <stop offset="0%" style={{ stopColor: 'var(--lead)', stopOpacity: 0.36 }} />
            <stop offset="38%" style={{ stopColor: 'var(--gate-on-fill)', stopOpacity: 0.9 }} />
            <stop offset="80%" style={{ stopColor: 'var(--gate-fill)', stopOpacity: 0.98 }} />
            <stop offset="100%" style={{ stopColor: 'var(--knob-ink)', stopOpacity: 1 }} />
          </radialGradient>
          <radialGradient id="r-led-on" cx="44%" cy="42%" r="62%">
            <stop offset="0%" style={{ stopColor: 'var(--shine)', stopOpacity: 1 }} />
            <stop offset="22%" style={{ stopColor: 'var(--pulse)', stopOpacity: 1 }} />
            <stop offset="56%" style={{ stopColor: 'var(--lamp-on)', stopOpacity: 1 }} />
            <stop offset="86%" style={{ stopColor: 'var(--on)', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: 'var(--gate-on-fill)', stopOpacity: 0.9 }} />
          </radialGradient>
          <radialGradient id="r-led-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" style={{ stopColor: 'var(--lamp-on)', stopOpacity: 0.68 }} />
            <stop offset="28%" style={{ stopColor: 'var(--on)', stopOpacity: 0.3 }} />
            <stop offset="56%" style={{ stopColor: 'var(--on)', stopOpacity: 0.08 }} />
            <stop offset="82%" style={{ stopColor: 'var(--on)', stopOpacity: 0.015 }} />
            <stop offset="100%" style={{ stopColor: 'var(--on)', stopOpacity: 0 }} />
          </radialGradient>

          {/* Chuqur qoraytirilgan OLED oynasi (barcha mavzularda bir xil to'q shisha) */}
          <linearGradient id="r-oled-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'var(--knob-ink)', stopOpacity: 0.98 }} />
            <stop offset="50%" style={{ stopColor: 'var(--gate-fill)', stopOpacity: 0.94 }} />
            <stop offset="100%" style={{ stopColor: 'var(--knob-ink)', stopOpacity: 1 }} />
          </linearGradient>

          {/* Plata sirti teksturasi (FR-4 via teshiklar, Samarqand girih, maket uyachalari, ESD, Sci-Fi) */}
          <pattern id="real-grid" width={24} height={24} patternUnits="userSpaceOnUse">
            {style === 'breadboard' ? (
              <>
                {[
                  [4.5, 4.5],
                  [16.5, 4.5],
                  [4.5, 16.5],
                  [16.5, 16.5],
                ].map(([hx, hy]) => (
                  <g key={`${hx},${hy}`}>
                    <rect x={hx - 0.6} y={hy - 0.6} width={4.2} height={4.2} rx={0.8} fill="var(--bevel-top)" opacity={0.9} />
                    <rect x={hx} y={hy} width={3.2} height={3.2} rx={0.5} fill="var(--knob-ink)" opacity={0.52} />
                    <rect x={hx + 0.6} y={hy + 0.6} width={2} height={2} rx={0.3} fill="var(--bezel)" opacity={0.55} />
                  </g>
                ))}
              </>
            ) : isMinor ? (
              <>
                <path d="M24,0 H0 V24" fill="none" stroke="var(--grid)" stroke-width={0.8} opacity={0.42} />
                <path d="M12,9.2 L14.8,12 L12,14.8 L9.2,12 Z" fill="none" stroke="var(--copper)" stroke-width={0.65} opacity={0.35} />
                <circle cx={12} cy={12} r={1.8} fill="var(--copper)" opacity={0.32} />
                <circle cx={12} cy={12} r={0.85} fill="var(--board)" />
              </>
            ) : style === 'pcb' ? (
              <>
                <path d="M24,0 H0 V24" fill="none" stroke="var(--grid)" stroke-width={0.75} opacity={0.35} />
                <circle cx={12} cy={12} r={2.3} fill="var(--copper)" opacity={0.34} />
                <circle cx={12} cy={12} r={1.05} fill="var(--board)" />
              </>
            ) : style === 'scifi' ? (
              <>
                <path d="M24,0 H0 V24" fill="none" stroke="var(--grid)" stroke-width={0.8} opacity={0.48} />
                <path d="M9.5,12 H14.5 M12,9.5 V14.5" fill="none" stroke="var(--pin-stroke)" stroke-width={0.85} opacity={0.42} />
                <circle cx={12} cy={12} r={0.9} fill="var(--accent)" opacity={0.28} />
              </>
            ) : (
              <>
                <path d="M24,0 H0 V24" fill="none" stroke="var(--grid)" stroke-width={0.85} opacity={0.5} />
                <path d="M10.5,12 H13.5 M12,10.5 V13.5" fill="none" stroke="var(--muted)" stroke-width={0.7} opacity={0.25} />
              </>
            )}
          </pattern>
        </defs>

        <g transform={`translate(${b.view.tx},${b.view.ty}) scale(${b.view.s})${b.vertical ? ` ${TRANSPOSE}` : ''}`}>
          <rect class="board-bg" x={-5000} y={-5000} width={10000} height={10000} fill="url(#real-grid)" opacity={0.28} />

          {/* Asosiy 2.5D plata korpusi / maket asos */}
          <g class="real-substrate" pointer-events="none">
            {/* Plata ostidagi chuqur stol soyasi va 2.5D qalinlik cheti */}
            <rect class="real-slab-shadow" x={sx + 4} y={sy + 7} width={sw} height={sh} rx={13} />
            <rect class="real-slab-edge" x={sx} y={sy + 4} width={sw} height={sh} rx={12} />
            <rect class="real-slab" x={sx} y={sy} width={sw} height={sh} rx={12} />
            <rect class="real-slab-tex" x={sx} y={sy} width={sw} height={sh} rx={12} fill="url(#real-grid)" opacity={0.9} />
            <rect class="real-slab-tex" x={sx} y={sy} width={sw} height={sh} rx={12} fill="url(#r-slab-sheen)" />
            <rect class="real-slab-bevel" x={sx + 2} y={sy + 2} width={sw - 4} height={sh - 4} rx={10} />
            <rect class="real-slab-inner-frame" x={sx + 7} y={sy + 7} width={sw - 14} height={sh - 14} rx={7} />

            {style === 'breadboard' ? (
              <>
                <line class="real-rail-pos" x1={sx + 18} y1={sy + 11} x2={sx + sw - 18} y2={sy + 11} />
                <line class="real-rail-gnd" x1={sx + 18} y1={sy + sh - 11} x2={sx + sw - 18} y2={sy + sh - 11} />
                <rect class="real-rail-groove-shadow" x={sx + 10} y={(sy + sy + sh) / 2 - 4.5} width={sw - 20} height={9.5} rx={3.5} />
                <rect class="real-rail-groove" x={sx + 10} y={(sy + sy + sh) / 2 - 4} width={sw - 20} height={8} rx={3} />
                {silk(sx + 20, sy + 21, '+5V DC')}
                {silk(sx + 20, sy + sh - 16, 'GND 0V')}
              </>
            ) : (
              <>
                <Screw x={sx + 14} y={sy + 14} brass={style === 'pcb'} />
                <Screw x={sx + sw - 14} y={sy + 14} brass={style === 'pcb'} />
                <Screw x={sx + 14} y={sy + sh - 14} brass={style === 'pcb'} />
                <Screw x={sx + sw - 14} y={sy + sh - 14} brass={style === 'pcb'} />
                {style === 'pcb' && (
                  <>
                    <Fiducial x={sx + 30} y={sy + sh - 14} />
                    <Fiducial x={sx + sw - 30} y={sy + 14} />
                    {/* Pastki chetdagi oltin kontakt tishchalari (PCI / ENIG edge connector) */}
                    {Array.from({ length: edgeFingers }, (_, fi) => (
                      <rect
                        key={fi}
                        class="real-edge-finger"
                        x={fingerStart + fi * 10}
                        y={sy + sh - 6.5}
                        width={6}
                        height={6.5}
                        rx={1}
                        fill="url(#r-pad-grad)"
                      />
                    ))}
                  </>
                )}
                {style === 'scifi' && (
                  <path
                    class="real-scifi-corners"
                    d={`M${sx + 26},${sy + 6} h14 M${sx + sw - 40},${sy + 6} h14 M${sx + 26},${sy + sh - 6} h14 M${sx + sw - 40},${sy + sh - 6} h14`}
                  />
                )}
                {silk(sx + 28, sy + 16, boardTitle)}
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
                  <circle class="real-pad-ring" cx={at.x} cy={at.y} r={6.6} />
                  <circle class="real-ic-pad" cx={at.x} cy={at.y} r={5.4} fill="url(#r-pad-grad)" />
                  <circle class={`wire-dot${on ? ' on' : ''}${live ? '' : ' idle'}`} cx={at.x} cy={at.y} r={3.5} />
                  <circle class="real-dot-shine" cx={at.x - 1.1} cy={at.y - 1.1} r={1.1} />
                </g>
              );
            })}
            {bridgeOverpasses}
            {tags}
          </g>

          {b.gates.map((g) => {
            const live = b.reached(g.id, 0);
            const on = live && b.values.get(g.id) === 1;
            const selected = b.sel?.kind === 'gate' && b.sel.id === g.id;
            const blk = isBlock(g.type);
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
                  {isBlock(g.type) ? (
                    <RealBlockBody
                      type={g.type}
                      style={style}
                      isBusPort={(idx, isOut) => b.busPort(isOut ? sourcePort(g.id, idx) : `${g.id}:${idx}`)}
                    />
                  ) : (
                    <RealGateBody type={g.type} style={style} />
                  )}
                  {blk ? (
                    <>
                      {label('gate-label block-label', 36, gateH(g) / 2 - 4, blockText(g.type))}
                      {label('chip-code', 36, gateH(g) / 2 + 8, CHIP_CODE[g.type])}
                      {b.blockLabels(g).ins.map((n, i) => n && <Fragment key={`i${i}`}>{label('block-pin', 14.5, inputPortY(g, i), n)}</Fragment>)}
                      {b.blockLabels(g).outs.map(
                        (n, k) => n && <Fragment key={`o${k}`}>{label('block-pin block-pin-out', 57.5, outputPortY(g, k), n)}</Fragment>,
                      )}
                    </>
                  ) : g.type === 'DFF' ? (
                    <>
                      {label('gate-label', 35, 31.5, 'DFF', 28, GATE_H / 2)}
                      {label('gate-sub', 35, 39.5, b.states.get(g.id), 44, GATE_H / 2)}
                    </>
                  ) : (
                    <>
                      {label('gate-label', 35, 31.5, g.type, 29, GATE_H / 2)}
                      {label('chip-code', 35, 39.5, CHIP_CODE[g.type], 43, GATE_H / 2)}
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
                  const name = blk ? `${b.gateName.get(g.id)!} ${b.blockOutName(g, k)}` : b.gateName.get(g.id)!;
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
            const modRx = style === 'scifi' ? 5 : style === 'bench' ? 4.5 : 3.5;
            const dir = on ? 1 : -1;
            const tipX = dir * 10.2;
            return (
              <g key={`in:${name}`} class={`pin pin-in${on ? ' on' : ''}`} transform={`translate(${p.x},${p.y})`}>
                <MetalLead x0={-15} x1={0} y={0} padX={0} />
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
                  <rect class="real-ic-shadow-soft real-deco" x={-75.5} y={-15.5} width={64} height={40} rx={modRx + 1} />
                  <rect class="real-ic-shadow real-deco" x={-76.8} y={-17.2} width={64} height={40} rx={modRx} />
                  <rect class="real-mod-edge real-deco" x={-78} y={-17.8} width={64} height={40} rx={modRx} />
                  <rect class="real-sw-housing" x={-78} y={-20} width={64} height={40} rx={modRx} />
                  <g pointer-events="none">
                    <rect class="real-ic-sheen" x={-78} y={-20} width={64} height={40} rx={modRx} fill="url(#r-ic-sheen)" />
                    <rect class="real-ic-die" x={-75} y={-17} width={58} height={34} rx={Math.max(1.8, modRx - 1.2)} />
                    <rect class="real-ic-bevel" x={-76.6} y={-18.6} width={61.2} height={37.2} rx={Math.max(2.2, modRx - 0.5)} />
                    <line class="real-top-rim" x1={-73} y1={-18.8} x2={-19} y2={-18.8} />
                    <rect class="real-in-bar" x={-76.6} y={-10} width={2.2} height={20} rx={1.1} />
                    <line class="real-mod-div" x1={-51.5} y1={-14} x2={-51.5} y2={14} />
                    <MicroScrew x={-73.6} y={-15.6} r={1.4} />
                    <MicroScrew x={-73.6} y={15.6} r={1.4} />
                    {/* Pilot SMD LED indikatori (A/B yoqilganligini bir qarashda ko'rsatadi) */}
                    <g class="real-sw-led-g" transform="translate(-63,-11.5)">
                      <circle class="real-ic-led-halo" r={6.5} fill="url(#r-led-halo)" />
                      <circle class="real-ic-led-bezel" r={2.8} fill="url(#r-bezel-grad)" />
                      <circle class="real-sw-led" r={2} />
                      <circle class="real-ic-led-shine" cx={-0.65} cy={-0.65} r={0.65} />
                    </g>
                  </g>
                  {label('pin-name real-pin-name', -63, 0.5, name)}
                  {label('sw-val real-sw-state', -63, 12.4, on ? 1 : 0)}
                  {/* Haqiqiy mexanik SPDT metall richagli tumbler (olti qirrali gayka + konus dasta + tushma soya) */}
                  {upright(
                    -33,
                    0,
                    <g class="switch real-tog">
                      <circle class="real-tog-well" r={12.4} />
                      <circle class="real-tog-washer" r={11.2} fill="url(#r-bezel-grad)" />
                      <rect class="real-tog-keyway" x={-1.3} y={-12.1} width={2.6} height={2.4} rx={0.5} />
                      <circle class="real-tog-pip-off" cx={-14.2} cy={0} r={1.25} />
                      <circle class="real-tog-pip-on" cx={14.2} cy={0} r={1.4} />
                      <polygon
                        class="real-tog-nut-shadow"
                        points="10.4,1.2 5.6,9.5 -4.0,9.5 -8.8,1.2 -4.0,-7.1 5.6,-7.1"
                      />
                      <polygon
                        class="real-tog-nut"
                        points="9.6,0 4.8,8.31 -4.8,8.31 -9.6,0 -4.8,-8.31 4.8,-8.31"
                        fill={isMinor ? 'url(#r-screw-brass)' : 'url(#r-hex-nut)'}
                      />
                      <circle class="real-tog-chamfer" r={7.3} />
                      <circle class="real-tog-bushing" r={6.1} fill="url(#r-bezel-grad)" />
                      <circle class="real-tog-thread" r={5.0} />
                      <circle class="real-tog-cavity" r={4.0} fill="url(#r-cavity)" />
                      {/* Dasta soyasi — yuqori chap studiya nuri bo'yicha past-o'ngga tushadi */}
                      <g class="real-tog-shadow-g" transform="translate(2.1,3.1)">
                        <polygon points={`0,-2.2 ${tipX},-3.7 ${tipX},3.7 0,2.2`} />
                        <circle cx={tipX} cy={0} r={4.1} />
                        <circle cx={0} cy={0} r={2.4} />
                      </g>
                      {/* Silindrik xrom richag va sharsimon uchi (0 — chapga, 1 — o'ngga) */}
                      <circle class="real-tog-pivot" cx={0} cy={0} r={2.5} fill="url(#r-bat-tip)" />
                      <polygon
                        class="real-tog-shaft"
                        points={`0,-2.3 ${tipX},-3.8 ${tipX},3.8 0,2.3`}
                        fill="url(#r-bat-shaft)"
                      />
                      <line class="real-tog-glint" x1={dir * 1.4} y1={-1.35} x2={dir * 8.2} y2={-1.85} />
                      <circle class="real-tog-tip" cx={tipX} cy={0} r={4.1} fill="url(#r-bat-tip)" />
                      <ellipse
                        class="real-tog-spec"
                        cx={tipX - 1.3}
                        cy={-1.4}
                        rx={1.35}
                        ry={0.85}
                        transform={`rotate(-32 ${tipX - 1.3} -1.4)`}
                      />
                      {on && <path class="real-tog-bounce" d={`M${tipX + 1.1},2.6 A3.2,3.2 0 0 0 ${tipX + 2.8},0.5`} />}
                    </g>,
                  )}
                </g>
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
            const modRx = style === 'scifi' ? 5 : style === 'bench' ? 4.5 : 3.5;
            const isSciFi = style === 'scifi';
            const isBreadboard = style === 'breadboard';
            return (
              <g
                key={`out:${name}`}
                class={`pin pin-out${v === 1 ? ' on' : ''}${state}${b.highlight === name ? ' err' : ''}`}
                transform={`translate(${p.x},${p.y})`}
              >
                <MetalLead x0={0} x1={15} y={0} padX={0} />
                <rect class="real-ic-shadow-soft" x={16.5} y={-15.5} width={62} height={40} rx={modRx + 1} />
                <rect class="real-ic-shadow" x={15.2} y={-17.2} width={62} height={40} rx={modRx} />
                <rect class="real-mod-edge" x={14} y={-17.8} width={62} height={40} rx={modRx} />
                <rect class="pin-box real-out-housing" x={14} y={-20} width={62} height={40} rx={modRx} />
                <g pointer-events="none">
                  <rect class="real-ic-sheen" x={14} y={-20} width={62} height={40} rx={modRx} fill="url(#r-ic-sheen)" />
                  <rect class="real-ic-die" x={17} y={-17} width={56} height={34} rx={Math.max(1.8, modRx - 1.2)} />
                  <rect class="real-ic-bevel" x={15.4} y={-18.6} width={59.2} height={37.2} rx={Math.max(2.2, modRx - 0.5)} />
                  <line class="real-top-rim" x1={19} y1={-18.8} x2={71} y2={-18.8} />
                  <rect class="real-out-status-bar" x={72.4} y={-10} width={2.2} height={20} rx={1.1} />
                  <line class="real-mod-div" x1={37.5} y1={-14} x2={37.5} y2={14} />
                  <MicroScrew x={71.6} y={-15.6} r={1.4} />
                  <MicroScrew x={71.6} y={15.6} r={1.4} />
                  {/* SMD 0603 tok cheklovchi rezistor (haqiqiy LED modul platasi detali) */}
                  <g class="real-smd-res" transform="translate(27.5,11.2)">
                    <rect class="real-smd-pad" x={-6.2} y={-2.4} width={2.7} height={4.8} rx={0.6} fill="url(#r-metal-v)" />
                    <rect class="real-smd-pad" x={3.5} y={-2.4} width={2.7} height={4.8} rx={0.6} fill="url(#r-metal-v)" />
                    <rect class="real-smd-res-body" x={-3.8} y={-2.5} width={7.6} height={5} rx={0.6} />
                    <line class="real-smd-res-mark" x1={-2} y1={0} x2={2} y2={0} />
                  </g>
                </g>
                {label('pin-name real-pin-name', 27.5, -3.5, name)}
                {/* Haqiqiy 5mm optik LED diod (ichki katod/anod elektrodlar + kristal yadro + xrom gardish) */}
                {upright(
                  53.5,
                  0,
                  <g class="lamp-g real-led-assy">
                    <circle class="lamp-halo real-lamp-halo" r={24} fill="url(#r-led-halo)" />
                    <circle class="real-led-well-shadow" cx={1.1} cy={1.5} r={12.3} />
                    {isSciFi ? (
                      <polygon
                        class="lamp-bezel real-lamp-bezel"
                        points="5.1,-11.5 11.5,-5.1 11.5,5.1 5.1,11.5 -5.1,11.5 -11.5,5.1 -11.5,-5.1 -5.1,-11.5"
                        fill="url(#r-bezel-grad)"
                      />
                    ) : isBreadboard ? (
                      <>
                        {/* 5mm through-hole svetodiodning tekis katod kesikli epoksid gardishi */}
                        <path
                          class="real-led-flange"
                          d="M-9.8,-6.2 A11.6,11.6 0 1 1 -9.8,6.2 Z"
                          fill="url(#r-bezel-grad)"
                        />
                        <circle class="real-lamp-bezel-inner" r={10.2} />
                      </>
                    ) : (
                      <>
                        <circle
                          class="lamp-bezel real-lamp-bezel"
                          r={12.1}
                          fill={isMinor ? 'url(#r-screw-brass)' : 'url(#r-bezel-grad)'}
                        />
                        <circle class="real-lamp-knurl" r={11.1} />
                        <circle class="real-lamp-bezel-inner" r={10.1} />
                      </>
                    )}
                    <circle class="real-lamp-cup" r={9.2} fill="url(#r-cavity)" />
                    <circle class="real-lamp-rim-glow" r={8.9} />
                    <circle class="lamp real-lamp-dome" r={8.2} />
                    <circle class="real-lamp-tint" r={7.9} />
                    {/* Ichki metall elektrodlar (katod kosasi va anod ustunchasi) — shaffof shisha ostida ko'rinadi */}
                    <g class="real-led-internals">
                      <path class="real-led-anvil" d="M-5.1,-2.1 L-1.2,-2.5 L-0.4,-1.2 L-0.4,1.2 L-1.2,2.5 L-5.1,2.1 Z" />
                      <path class="real-led-post" d="M1.3,-1.7 L4.9,-1.4 L4.9,1.4 L1.3,1.7 Z" />
                      <line class="real-led-bond" x1={-0.6} y1={0} x2={1.5} y2={0} />
                    </g>
                    <circle class="real-led-die" cx={0} cy={0} r={2.2} />
                    <path class="real-lamp-crescent" d="M-5.3,-2.2 A5.8,5.8 0 0 1 2.2,-5.3" />
                    <ellipse
                      class="real-lamp-spec"
                      cx={-2.8}
                      cy={-3.1}
                      rx={2.2}
                      ry={1.2}
                      transform="rotate(-38 -2.8 -3.1)"
                    />
                    <path class="real-lamp-caustic" d="M1.8,5.4 A5.8,5.8 0 0 0 5.4,1.8" />
                  </g>,
                )}
                {exp !== undefined && label('pin-exp', 45, 32, `${t.play.expected.toLowerCase()}: ${exp}`, 90, 0)}
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
