// Shina pinlari (maydonda bitta keng pin): kirish — bitlar tugmalari va son, chiqish — son oynasi va kutilgani.
// Sxema va Real 2D maydonlari uchun umumiy; real — Real 2D qatlami (soya va korpus).
import type { ComponentChildren } from 'preact';
import { t } from '../i18n';
import { groupValue, type PinGroup } from './bus';
import { BUS_IN_X, BUS_OUT_X, busBitX } from './geometry';
import { TRANSPOSE, type useBoard2D } from './useBoard2D';

type Board = ReturnType<typeof useBoard2D>;

interface PinProps {
  b: Board;
  group: PinGroup;
  real?: boolean;
  port: (id: string, x: number, y: number, src: boolean, connected: boolean, on: boolean, name: string) => ComponentChildren;
}

function text(b: Board, cls: string, x: number, y: number, body: ComponentChildren, vx = x, vy = y) {
  return b.vertical ? (
    <text class={cls} transform={`translate(${vx},${vy}) ${TRANSPOSE}`}>
      {body}
    </text>
  ) : (
    <text class={cls} x={x} y={y}>
      {body}
    </text>
  );
}

export function BusInPin({ b, group, real, port }: PinProps) {
  const p = b.lay.inputs.get(group.pins[0])!;
  const value = groupValue(b.bits, group.idx) ?? 0;
  const n = group.pins.length;
  const x0 = BUS_IN_X;
  const w = -14 - x0;
  const head = `in:${group.pins[0]}`;
  return (
    <g class="pin pin-in pin-bus" transform={`translate(${p.x},${p.y})`}>
      {real && <rect class="real-ic-shadow" x={x0 + 2} y={-20} width={w} height={44} rx={9} />}
      <rect class={real ? 'pin-box real-sw-housing' : 'pin-box'} x={x0} y={-22} width={w} height={44} rx={9} />
      {text(b, 'pin-name', x0 + 15, -8, group.name, x0 + 11, 0)}
      {text(b, 'bus-val', x0 + 15, 11, value, x0 + 27, 0)}
      {group.pins.map((name, j) => {
        const k = group.idx[j];
        const on = b.bits[k] === 1;
        const cx = busBitX(j, n);
        return (
          <g
            key={name}
            data-kind="pin"
            data-pin={k}
            class={`pin-body bus-bit${on ? ' on' : ''}`}
            tabindex={0}
            role="switch"
            aria-checked={on}
            aria-label={name}
            onKeyDown={(e) => b.onPinKey(e, k)}
          >
            <title>{name}</title>
            <rect x={cx - 10} y={-14} width={20} height={28} rx={5} />
            {text(b, 'bus-bit-val', cx, 0, on ? 1 : 0)}
          </g>
        );
      })}
      <line class="lead bus-lead" x1={-14} y1={0} x2={0} y2={0} />
      {port(head, 0, 0, true, b.usedSources.has(head), value > 0, t.play.a11y.source(group.name))}
    </g>
  );
}

export function BusOutPin({ b, group, real, port }: PinProps) {
  const p = b.lay.outputs.get(group.pins[0])!;
  // Chiqish qiymati — signal to'lqini yetib kelgan bitlardan (pin-out dagi kabi); biror biti noma'lum — «–».
  const got = b.outputs.map((o, i) => {
    const src = b.drivers.get(`out:${b.spec.outputs[i]}`);
    return src === undefined || b.reached(src, 2) ? o : null;
  });
  const v = groupValue(got, group.idx);
  const exp = b.expected ? groupValue(b.expected, group.idx) : null;
  const state = exp === null || v === null ? '' : v === exp ? ' good' : ' bad';
  const err = group.pins.some((n) => b.highlight === n);
  const w = BUS_OUT_X - 14;
  const head = `out:${group.pins[0]}`;
  return (
    <g class={`pin pin-out pin-bus${v ? ' on' : ''}${state}${err ? ' err' : ''}`} transform={`translate(${p.x},${p.y})`}>
      <line class="lead bus-lead" x1={0} y1={0} x2={14} y2={0} />
      {real && <rect class="real-ic-shadow" x={16} y={-20} width={w} height={44} rx={9} />}
      <rect class="pin-box" x={14} y={-22} width={w} height={44} rx={9} />
      {text(b, 'pin-name', 30, 0, group.name, 30, 0)}
      <rect class="bus-screen" x={44} y={-14} width={BUS_OUT_X - 52} height={28} rx={5} />
      {text(b, 'bus-num', 44 + (BUS_OUT_X - 52) / 2, 0, v === null ? '–' : v)}
      {exp !== null && text(b, 'pin-exp', 53, 34, `${t.play.expected.toLowerCase()}: ${exp}`, BUS_OUT_X + 16, 0)}
      {port(head, 0, 0, false, b.driven.has(head), !!v, t.play.a11y.output(group.name))}
    </g>
  );
}
