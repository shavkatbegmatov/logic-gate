import type { GateType } from '../sim/types';
import { DFF_BODY, inputLeads, leadEnd, outputY, SHAPE_H, SHAPE_W, SHAPES } from './shapes';

/** D-trigger: to'rtburchak, takt belgisi (uchburchak) chap qirraning pastida. Takt hamma triggerlar uchun umumiy. */
function FlipFlop() {
  const d = DFF_BODY;
  return (
    <g class="gate-shape">
      <line class="lead" x1={0} y1={inputLeads('DFF')[0]} x2={d.x} y2={inputLeads('DFF')[0]} />
      <line class="lead" x1={d.out} y1={outputY('DFF')} x2={SHAPE_W} y2={outputY('DFF')} />
      <rect class="gate-body" x={d.x} y={d.y} width={d.w} height={d.h} rx={d.rx} />
      <path class="gate-back" d={d.clock} />
    </g>
  );
}

export function GateShape({ type }: { type: GateType }) {
  if (type === 'DFF') return <FlipFlop />;
  const s = SHAPES[type];
  const leadStart = s.bubble ? s.tip + 8 : s.tip;
  return (
    <g class="gate-shape">
      {inputLeads(type).map((y) => (
        <line key={y} class="lead" x1={0} y1={y} x2={leadEnd(type)} y2={y} />
      ))}
      <line class="lead" x1={leadStart} y1={24} x2={SHAPE_W} y2={24} />
      {s.back && <path class="gate-back" d={s.back} />}
      <path class="gate-body" d={s.body} />
      {s.bubble && <circle class="gate-body" cx={s.tip + 4} cy={24} r={4} />}
    </g>
  );
}

/** Palitra va yordam oynalari uchun kichik belgi. */
export function GateIcon({ type, size = 40 }: { type: GateType; size?: number }) {
  return (
    <svg class="gate-icon" width={size} height={(size * SHAPE_H) / SHAPE_W} viewBox={`0 0 ${SHAPE_W} ${SHAPE_H}`} aria-hidden="true">
      <GateShape type={type} />
    </svg>
  );
}
