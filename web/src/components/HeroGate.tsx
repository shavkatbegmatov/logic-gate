import { useSignal } from '@preact/signals';
import { sfx } from '../audio';
import { GateShape } from '../board/GateShape';
import { t } from '../i18n';

/**
 * Bosh sahifadagi ishlaydigan sxema: ikki kalit, AND elementi va chiroq — o'yinning belgisi ham, birinchi
 * tajribasi ham. Ikkala kalit yoqilsa chiroq yonadi. Hech narsa saqlanmaydi: har ochilishda o'chiq holatda.
 * Maydondagi elementlarning o'zi (klasslari ham): tumbler, GateShape, yo'l, chiroq — shuning uchun ikkala
 * mavzuda maydon bilan bir xil ko'rinadi va alohida uslub deyarli kerak emas (styles.css: .hero).
 */
export function HeroGate() {
  const bits = useSignal([0, 0]);
  const [a, b] = bits.value;
  const on = a + b === 2;

  const toggle = (i: number) => {
    bits.value = bits.value.map((v, k) => (k === i ? 1 - v : v));
    sfx.toggle();
  };

  const wire = (d: string, lit: number | boolean) => (
    <g class={`wire${lit ? ' on' : ''}`}>
      {lit ? <path class="wire-glow" d={d} /> : null}
      <path class="wire-line" d={d} />
    </g>
  );

  const pad = (x: number, y: number, lit: number | boolean) => (
    <g class={`port${lit ? ' on' : ''}`}>
      <circle class="port-dot" cx={x} cy={y} r={4} />
    </g>
  );

  return (
    <div class="hero">
      <svg class="hero-svg" viewBox="0 0 210 60" role="group" aria-label={t.home.heroLabel}>
        {/* Yo'llar: kalitlardan elementga 45° burilish bilan (maydondagi kabi), elementdan chiroqqa. */}
        {wire('M52,14 H62 L66,18 H84', a)}
        {wire('M52,46 H62 L66,42 H84', b)}
        {wire('M156,30 H172', on)}
        <g class={`gate${on ? ' on' : ''}`} transform="translate(84,6)">
          <GateShape type="AND" />
          <text class="gate-label" x={32} y={24}>
            AND
          </text>
          {/* Kontaktlar: sim element uchiga ulangan joy (maydondagi nuqtalar). */}
          {pad(0, 12, a)}
          {pad(0, 36, b)}
          {pad(72, 24, on)}
        </g>
        <g class={`pin-out${on ? ' on' : ''}`} transform="translate(186,30) scale(1.4)">
          <circle class="lamp-halo" r={15} />
          <path class="lamp-rays" d="M-9,-11 l-3,-4 M0,-13 v-5 M9,-11 l3,-4" />
          <circle class="lamp-bezel" r={10} />
          <circle class="lamp" r={7} />
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
              <text class="gate-label" x={6} y={0}>
                {name}
              </text>
              <g class="switch" transform="translate(34,0) scale(1.25)">
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
