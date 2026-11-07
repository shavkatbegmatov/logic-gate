import type { GateType } from '../sim/types';
import { GATE_W } from './geometry';

// ANSI ko'rinishidagi element belgilari, 72×48 maydonda. Kirish uchlari x=0 da, chiqish x=72 da.
const AND_BODY = 'M14,4 H34 A20,20 0 0 1 34,44 H14 Z';
const OR_BODY = 'M10,4 Q24,24 10,44 Q40,44 56,24 Q40,4 10,4 Z';
const XOR_BODY = 'M16,4 Q30,24 16,44 Q44,44 58,24 Q44,4 16,4 Z';
const XOR_BACK = 'M8,4 Q22,24 8,44';
const NOT_BODY = 'M16,6 L50,24 L16,42 Z';

interface ShapeInfo {
  body: string;
  /** Tananing o'ng uchi (chiqish yoki inversiya doirachasi shu yerdan boshlanadi). */
  tip: number;
  bubble: boolean;
  back?: string;
}

const SHAPES: Record<Exclude<GateType, 'DFF'>, ShapeInfo> = {
  NOT: { body: NOT_BODY, tip: 50, bubble: true },
  AND: { body: AND_BODY, tip: 54, bubble: false },
  NAND: { body: AND_BODY, tip: 54, bubble: true },
  OR: { body: OR_BODY, tip: 56, bubble: false },
  NOR: { body: OR_BODY, tip: 56, bubble: true },
  XOR: { body: XOR_BODY, tip: 58, bubble: false, back: XOR_BACK },
  XNOR: { body: XOR_BODY, tip: 58, bubble: true, back: XOR_BACK },
};

/** D-trigger: to'rtburchak, kirish tomonida takt belgisi (uchburchak). Takt hamma triggerlar uchun umumiy. */
function FlipFlop() {
  return (
    <g class="gate-shape">
      <line class="lead" x1={0} y1={24} x2={14} y2={24} />
      <line class="lead" x1={58} y1={24} x2={GATE_W} y2={24} />
      <rect class="gate-body" x={14} y={4} width={44} height={40} rx={5} />
      <path class="gate-back" d="M14,33 L22,38 L14,43" />
    </g>
  );
}

export function GateShape({ type }: { type: GateType }) {
  if (type === 'DFF') return <FlipFlop />;
  const s = SHAPES[type];
  const leadStart = s.bubble ? s.tip + 8 : s.tip;
  const one = type === 'NOT';
  return (
    <g class="gate-shape">
      {one ? (
        <line class="lead" x1={0} y1={24} x2={18} y2={24} />
      ) : (
        <>
          <line class="lead" x1={0} y1={14} x2={20} y2={14} />
          <line class="lead" x1={0} y1={34} x2={20} y2={34} />
        </>
      )}
      <line class="lead" x1={leadStart} y1={24} x2={GATE_W} y2={24} />
      {s.back && <path class="gate-back" d={s.back} />}
      <path class="gate-body" d={s.body} />
      {s.bubble && <circle class="gate-body" cx={s.tip + 4} cy={24} r={4} />}
    </g>
  );
}

/** Palitra va yordam oynalari uchun kichik belgi. */
export function GateIcon({ type, size = 40 }: { type: GateType; size?: number }) {
  return (
    <svg class="gate-icon" width={size} height={(size * 48) / 72} viewBox="0 0 72 48" aria-hidden="true">
      <GateShape type={type} />
    </svg>
  );
}
