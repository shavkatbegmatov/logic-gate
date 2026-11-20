import { useSignal } from '@preact/signals';
import { sfx } from '../audio';
import { CHIP_CODE, GateShape } from '../board/GateShape';
import { SHAPES } from '../board/shapes';
import { t } from '../i18n';
import { activeBoardMode, activeTheme, isAaaTheme } from '../theme';

/**
 * Bosh sahifadagi ishlaydigan sxema: ikki kalit, AND elementi va chiroq — o'yinning belgisi ham, birinchi
 * tajribasi ham. Ikkala kalit yoqilsa chiroq yonadi. Hech narsa saqlanmaydi: har ochilishda o'chiq holatda.
 * AAA uslublarda haqiqiy plata, 74HC08 mikrosxemasi va yuguruvchi tok to'lqini bilan chiziladi.
 */
export function HeroGate() {
  const bits = useSignal([0, 0]);
  const [a, b] = bits.value;
  const on = a + b === 2;
  const theme = activeTheme.value;
  const realLook = activeBoardMode.value !== 'schematic' && (isAaaTheme(theme) || theme === 'haqiqiy');
  const chip = theme === 'haqiqiy' || realLook;
  const square = theme === 'chizma';

  const toggle = (i: number) => {
    const next = 1 - bits.value[i];
    bits.value = bits.value.map((v, k) => (k === i ? next : v));
    sfx.toggle(next === 1);
  };

  const wire = (d: string, lit: number | boolean) => (
    <g class={`wire${lit ? ' on' : ''}`}>
      {realLook && <path class="real-wire-base" d={d} />}
      {lit ? <path class="wire-glow" d={d} /> : null}
      <path class="wire-line" d={d} />
      {realLook && lit ? <path class="real-wire-pulse" d={d} /> : null}
    </g>
  );

  const pad = (x: number, y: number, lit: number | boolean) => (
    <g class={`port${lit ? ' on' : ''}`}>
      {realLook && <circle class="real-ic-pad" cx={x} cy={y} r={5} />}
      <circle class="port-dot" cx={x} cy={y} r={4} />
    </g>
  );

  return (
    <div class="hero">
      <svg class="hero-svg" viewBox="0 0 210 60" role="group" aria-label={t.home.heroLabel}>
        {realLook && (
          <g pointer-events="none">
            <rect class="real-slab" x={2} y={2} width={206} height={56} rx={10} />
            <rect class="real-slab-bevel" x={3.5} y={3.5} width={203} height={53} rx={8.5} />
            <circle class="real-screw-ring" cx={6.5} cy={6.5} r={1.8} />
            <circle class="real-screw-ring" cx={203.5} cy={6.5} r={1.8} />
            <circle class="real-screw-ring" cx={6.5} cy={53.5} r={1.8} />
            <circle class="real-screw-ring" cx={203.5} cy={53.5} r={1.8} />
          </g>
        )}
        {/* Yo'llar: kalitlardan elementga 45° burilish bilan (maydondagi kabi), elementdan chiroqqa. */}
        {wire(square ? 'M52,14 H66 V18 H84' : 'M52,14 H62 L66,18 H84', a)}
        {wire(square ? 'M52,46 H66 V42 H84' : 'M52,46 H62 L66,42 H84', b)}
        {wire('M156,30 H172', on)}
        <g class={`gate${on ? ' on' : ''}`} transform="translate(84,6)">
          <GateShape type="AND" chip={chip} />
          {realLook ? (
            <>
              <g class="real-ic-sym" transform="translate(24,5) scale(0.32)">
                <path d={SHAPES.AND.body} />
              </g>
              <text class="gate-label" x={36} y={29}>
                AND
              </text>
              <text class="chip-code" x={36} y={39}>
                {CHIP_CODE.AND}
              </text>
              <circle class="real-ic-led" cx={53} cy={24} r={2} />
            </>
          ) : (
            <text class="gate-label" x={chip ? 36 : 32} y={24}>
              AND
            </text>
          )}
          {/* Kontaktlar: sim element uchiga ulangan joy (maydondagi nuqtalar). */}
          {pad(0, 12, a)}
          {pad(0, 36, b)}
          {pad(72, 24, on)}
        </g>
        <g class={`pin-out${on ? ' on' : ''}`} transform="translate(186,30) scale(1.35)">
          <circle class="lamp-halo" r={15} />
          {realLook && <circle class="real-led-outer" r={12} />}
          <path class="lamp-rays" d="M-9,-11 l-3,-4 M0,-13 v-5 M9,-11 l3,-4" />
          <circle class="lamp-bezel" r={10} />
          <circle class="lamp" r={7} />
          <path class="lamp-x" d="M-7,-7 L7,7 M7,-7 L-7,7" />
          <circle class="lamp-shine" cx={-2.5} cy={-2.5} r={2} />
        </g>
        {['A', 'B'].map((name, i) => {
          const v = bits.value[i];
          return (
            <g
              key={name}
              class={`hero-switch pin-in${v ? ' on' : ''}`}
              transform={`translate(0,${14 + i * 32})`}
              role="switch"
              // SVG'da atribut kichik harf bilan (Board.tsx dagi kabi).
              tabindex={0}
              aria-checked={v === 1}
              aria-label={name}
              onClick={() => toggle(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggle(i);
                }
              }}
            >
              {/* Barmoq uchun kattaroq bosish maydoni. */}
              <rect y={-15} width={58} height={30} fill="transparent" />
              <text class="gate-label" x={11} y={0}>
                {name}
              </text>
              <g class="switch" transform="translate(36,0) scale(1.22)">
                <rect class="sw-track" x={-14} y={-8} width={28} height={16} rx={8} />
                <g class="sw-knob" style={{ transform: `translateX(${v ? 6 : -6}px)` }}>
                  <circle r={7} />
                  <text class="sw-val">{v}</text>
                </g>
              </g>
            </g>
          );
        })}
      </svg>
      <p class="hero-hint" aria-live="polite">
        {on ? t.home.heroOn : t.home.heroHint}
      </p>
    </div>
  );
}
