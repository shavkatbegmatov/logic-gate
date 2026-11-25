import { isBlock, type BlockType, type GateType } from '../sim/types';
import { BLOCK_BODY, BLOCK_SHAPE, DFF_BODY, gateHeight, inputLeads, leadEnd, outputLeads, outputY, SHAPE_H, SHAPE_W, SHAPES } from './shapes';

/** Blok (mikrosxema): to'rtburchak korpus, chap tomonda kirish, o'ngda chiqish oyoqlari, burchakda kesik. */
function BlockBody({ type }: { type: BlockType }) {
  const b = BLOCK_BODY;
  const h = BLOCK_SHAPE[type].h;
  return (
    <g class="gate-shape block-shape">
      {inputLeads(type).map((y) => (
        <line key={`i${y}`} class="lead" x1={0} y1={y} x2={b.x} y2={y} />
      ))}
      {outputLeads(type).map((y) => (
        <line key={`o${y}`} class="lead" x1={b.x + b.w} y1={y} x2={SHAPE_W} y2={y} />
      ))}
      <rect class="gate-body" x={b.x} y={2} width={b.w} height={h - 4} rx={b.rx} />
      <path class="gate-back" d={`M${b.x + 18},2 A6,6 0 0 0 ${b.x + 30},2`} />
    </g>
  );
}

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

/** «Haqiqiy plata» mavzusidagi korpus (72×48 maydonda) va mikrosxema markasi — shu elementli haqiqiy 74HC seriyasi. */
const CHIP = { x: 14, y: 3, w: 44, h: 42 };
export const CHIP_CODE: Record<GateType, string> = {
  HA: '74HC183',
  FA: '74HC183',
  MUX: '74HC157',
  DEC: '74HC139',
  NOT: '74HC04',
  AND: '74HC08',
  OR: '74HC32',
  XOR: '74HC86',
  NAND: '74HC00',
  NOR: '74HC02',
  XNOR: '74HC7266',
  DFF: '74HC74',
};

/** Mikrosxema: qora korpus, kirish va chiqish uchlari o'rnida oyoqchalar, burchakda 1-oyoq belgisi. */
function Chip({ type }: { type: GateType }) {
  return (
    <g class="gate-shape">
      {inputLeads(type).map((y) => (
        <rect key={y} class="chip-pin" x={0} y={y - 2.5} width={CHIP.x + 1} height={5} />
      ))}
      <rect class="chip-pin" x={CHIP.x + CHIP.w - 1} y={outputY(type) - 2.5} width={SHAPE_W - CHIP.x - CHIP.w + 1} height={5} />
      <rect class="chip-body" x={CHIP.x} y={CHIP.y} width={CHIP.w} height={CHIP.h} rx={2.5} />
      <circle class="chip-dot" cx={CHIP.x + 5} cy={CHIP.y + 5} r={1.6} />
    </g>
  );
}

/** chip — «Haqiqiy plata» mavzusida maydondagi element (palitra va yordam oynalarida har doim belgi). */
export function GateShape({ type, chip }: { type: GateType; chip?: boolean }) {
  if (isBlock(type)) return <BlockBody type={type} />;
  if (chip) return <Chip type={type} />;
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
  // Baland blok kichik belgida ham bir xil balandlikda: ko'rinish maydoni kengayadi, nomi o'rtada.
  const h = Math.max(SHAPE_H, gateHeight(type));
  const w = (SHAPE_W * h) / SHAPE_H;
  return (
    <svg
      class="gate-icon"
      width={size}
      height={(size * SHAPE_H) / SHAPE_W}
      viewBox={`${(SHAPE_W - w) / 2} 0 ${w} ${h}`}
      aria-hidden="true"
    >
      <GateShape type={type} />
      {isBlock(type) && (
        <text class="block-icon-label" x={SHAPE_W / 2} y={h / 2 + 7}>
          {type}
        </text>
      )}
    </svg>
  );
}
