import type { ComponentChildren, ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { showToast } from '../components/Toast';
import { t } from '../i18n';
import { GATE_ARITY } from '../sim/types';
import { settings } from '../state';
import { activeBoardMode, activeTheme } from '../theme';
import type { Editor } from './editor';
import { CHIP_CODE, GateShape } from './GateShape';
import { GATE_H, GATE_W, inputPortY, outputPortY, routeMid, wirePath } from './geometry';
import { routeD } from './routing';
import { capture, TRANSPOSE, useBoard2D } from './useBoard2D';

export { capture };

export interface BoardProps {
  editor: Editor;
  /** Joriy qator uchun kutilgan chiqishlar (darajada); qum qutida yo'q. */
  expected?: number[] | null;
  /** Telefonda maydon tepasini yopadigan panellar balandligi (vazifa qatori, o'quv banneri). */
  topInset?: number;
}

type Board3DProps = BoardProps & { onUnsupported?: () => void };

let LoadedReal2D: ComponentType<BoardProps> | null = null;
let Loaded3D: ComponentType<Board3DProps> | null = null;

export function Board(props: BoardProps) {
  const mode = activeBoardMode.value;
  const [, bump] = useState(0);

  useEffect(() => {
    let alive = true;
    if (mode === 'real2d' && !LoadedReal2D) {
      import('./BoardReal2D')
        .then((m) => {
          LoadedReal2D = m.BoardReal2D;
          if (alive) bump((n) => n + 1);
        })
        .catch(() => {});
    } else if (mode === 'real3d' && !Loaded3D) {
      import('./three/Board3D')
        .then((m) => {
          Loaded3D = m.Board3D;
          if (alive) bump((n) => n + 1);
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [mode]);

  if (mode === 'real3d' && Loaded3D) {
    return (
      <Loaded3D
        {...props}
        onUnsupported={() => {
          showToast(t.play.view.noWebgl, 'info', 4500);
          settings.value = { ...settings.value, boardMode: 'real2d' };
        }}
      />
    );
  }
  if ((mode === 'real2d' || mode === 'real3d') && LoadedReal2D) {
    return <LoadedReal2D {...props} />;
  }
  return <BoardSchematic {...props} />;
}

/** Klassik yengil chizma muharriri (Daftar/Chizma va tezkor boshlanish uchun). */
function BoardSchematic({ editor, expected, topInset = 0 }: BoardProps) {
  const b = useBoard2D(editor, expected, topInset);
  const a11y = t.play.a11y;
  const chip = activeTheme.value === 'haqiqiy';
  const cut = activeTheme.value === 'chizma' ? 0 : undefined;

  let deleteAt = b.gateDeleteAt;
  const wireEls = b.wires.map((w, i) => {
    const route = b.routed.routes[i];
    if (!route) return null;
    const d = routeD(route, b.routed.hops[i], b.sharp, cut);
    const live = b.reached(w.from, 1);
    const on = live && b.values.get(w.from) === 1;
    const front = b.wave !== null && b.stepOf(w.from, 1) === b.wave;
    const selected = b.sel?.kind === 'wire' && b.sel.index === i;
    if (selected) {
      const m = routeMid(route);
      deleteAt = { x: m.x, y: m.y + (b.vertical ? 14 : -14) };
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

  const port = (id: string, x: number, y: number, src: boolean, connected: boolean, on: boolean, name: string) => (
    <g
      class={`port ${src ? 'src' : 'sink'}${connected ? ' linked' : ''}${on ? ' on' : ''}${b.active === id ? ' active' : ''}`}
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
      <circle class="port-dot" r={5.5} />
    </g>
  );

  const upright = (x: number, y: number, children: ComponentChildren, vx = x, vy = y) => (
    <g transform={b.vertical ? `translate(${vx},${vy}) ${TRANSPOSE}` : `translate(${x},${y})`}>{children}</g>
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

  return (
    <div class="board" ref={b.wrapRef}>
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
          <pattern id="grid" width={24} height={24} patternUnits="userSpaceOnUse">
            <circle cx={12} cy={12} r={1.1} class="grid-dot" />
            <path d="M24,0 H0 V24" class="grid-line" />
          </pattern>
          <filter id="sketch" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves={1} seed={7} />
            <feDisplacementMap in="SourceGraphic" scale={2.6} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <g transform={`translate(${b.view.tx},${b.view.ty}) scale(${b.view.s})${b.vertical ? ` ${TRANSPOSE}` : ''}`}>
          <rect class="board-bg" x={-5000} y={-5000} width={10000} height={10000} fill="url(#grid)" />

          <g class="wires">
            {wireEls}
            {b.routed.dots.map(({ net, at }) => {
              const live = b.reached(net, 1);
              const on = live && b.values.get(net) === 1;
              return <circle key={`${net}@${at.x},${at.y}`} class={`wire-dot${on ? ' on' : ''}${live ? '' : ' idle'}`} cx={at.x} cy={at.y} r={4} />;
            })}
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
                  <rect class="gate-hit" x={4} y={-2} width={GATE_W - 8} height={GATE_H + 4} rx={8} />
                  <GateShape type={g.type} chip={chip} />
                  {g.type === 'DFF' ? (
                    <>
                      {label('gate-label', 36, GATE_H / 2 - 6, g.type, 29, GATE_H / 2)}
                      {label('gate-sub', 36, GATE_H / 2 + 9, b.states.get(g.id), 45, GATE_H / 2)}
                    </>
                  ) : chip ? (
                    <>
                      {label('gate-label', 36, 19, g.type, 30, GATE_H / 2)}
                      {label('chip-code', 36, 33, CHIP_CODE[g.type], 44, GATE_H / 2)}
                    </>
                  ) : (
                    label('gate-label', g.type === 'NOT' ? 28 : 32, GATE_H / 2, g.type)
                  )}
                </g>
                {Array.from({ length: GATE_ARITY[g.type] }, (_, i) =>
                  port(`${g.id}:${i}`, 0, inputPortY(g, i), false, b.driven.has(`${g.id}:${i}`), false, a11y.gateIn(b.gateName.get(g.id)!, i)),
                )}
                {port(g.id, GATE_W, outputPortY(g), true, b.usedSources.has(g.id), on, a11y.gateOut(b.gateName.get(g.id)!))}
              </g>
            );
          })}

          {b.spec.inputs.map((name, k) => {
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
                  <rect x={-78} y={-20} width={64} height={40} rx={9} />
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

          {b.spec.outputs.map((name, i) => {
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
                <rect class="pin-box" x={14} y={-20} width={60} height={40} rx={9} />
                {label('pin-name', 30, 0, name)}
                {upright(
                  56,
                  0,
                  <g class="lamp-g">
                    <circle class="lamp-halo" r={15} />
                    <path class="lamp-rays" d="M-9,-11 l-3,-4 M0,-13 v-5 M9,-11 l3,-4" />
                    <circle class="lamp-bezel" r={10} />
                    <circle class="lamp" r={7} />
                    <path class="lamp-x" d="M-7,-7 L7,7 M7,-7 L-7,7" />
                    <circle class="lamp-shine" cx={-2.5} cy={-2.5} r={2} />
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
