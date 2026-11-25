// Kampaniya sahnasi: bo'lim oldidan (intro) va oxirida (outro) 4–5 kadrlik kartochkalar.
// Rasmlar — shu yerdagi SVG (fayl yo'q), ranglar — «Mis va lojuvard» (styles.css: [data-theme='minor']):
// sahna o'yinchi qaysi mavzuni tanlaganidan qat'i nazar shu palitrada chiziladi.
// Klaviatura: → / Enter / Probel — keyingi, ← — oldingi, Esc — o'tkazib yuborish.
import './StoryScene.css';
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { Modal } from '../components/ui';
import { t } from '../i18n';
import type { SceneRef } from '../story';
import { storyFor, type Art, type Frame } from '../story-texts';

export function StoryScene({ scene, onDone }: { scene: SceneRef; onDone: () => void }) {
  const story = storyFor(scene.chapter);
  const data = story?.[scene.kind];
  const i = useSignal(0);

  useEffect(() => {
    if (!data) onDone();
  }, [data]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLButtonElement && (e.key === 'Enter' || e.key === ' ')) return; // Tugmaning o'zi bosiladi.
      if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (i.value > 0) i.value--;
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [data]);

  if (!data) return null;
  const last = i.value === data.frames.length - 1;
  const frame = data.frames[i.value];
  function next() {
    if (!data) return;
    if (i.value < data.frames.length - 1) i.value++;
    else onDone();
  }

  return (
    <Modal onClose={onDone} class="story-modal">
      <div class="story" data-theme="minor">
        <header class="story-head">
          <span class="story-place">{story!.place}</span>
          <h2 class="story-title">{data.title}</h2>
          <button class="btn small ghost story-skip" onClick={onDone}>
            {t.story.skip}
          </button>
        </header>
        <div class="story-art" key={`art-${i.value}`}>
          <Picture art={frame.art} />
        </div>
        <FrameText frame={frame} key={`text-${i.value}`} />
        <footer class="story-foot">
          <div class="story-dots" aria-label={t.story.progress(i.value + 1, data.frames.length)}>
            {data.frames.map((_, k) => (
              <span key={k} class={k === i.value ? 'on' : k < i.value ? 'past' : ''} />
            ))}
          </div>
          <div class="story-nav">
            {i.value > 0 && (
              <button class="btn small" onClick={() => i.value--}>
                {t.story.back}
              </button>
            )}
            <button class="btn primary" onClick={next} autoFocus>
              {last ? t.story.done[scene.kind] : t.story.next}
            </button>
          </div>
        </footer>
      </div>
    </Modal>
  );
}

function FrameText({ frame }: { frame: Frame }) {
  const cls = `story-text${frame.note ? ' note' : ''}${frame.who === 'chiroq' ? ' machine' : ''}`;
  return (
    <div class="story-line" aria-live="polite">
      {frame.who && <span class={`story-who ${frame.who}`}>{t.story.who[frame.who]}</span>}
      <p class={cls}>{frame.text}</p>
    </div>
  );
}

// ── Rasmlar ─────────────────────────────────────────────────
// viewBox 320×180. Hammasi CSS o'zgaruvchilari bilan (mavzu ranglari), qattiq yozilgan rang yo'q.

function Picture({ art }: { art: Art }) {
  return (
    <svg viewBox="0 0 320 180" role="img" aria-hidden="true" class={`story-svg art-${art}`}>
      <defs>
        {/* Girih: 8 burchakli yulduz (ikki kvadrat) — devor va ramka naqshi, plata yo'llari kabi. */}
        <pattern id="girih" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M10 10h20v20H10zM20 5.9 34.1 20 20 34.1 5.9 20zM0 20h5.9M34.1 20H40M20 0v5.9M20 34.1V40" class="girih-line" />
        </pattern>
        <radialGradient id="glow">
          <stop offset="0" class="glow-in" />
          <stop offset="1" class="glow-out" />
        </radialGradient>
      </defs>
      {art === 'city' && <City />}
      {art === 'workshop' && <Workshop />}
      {art === 'note' && <Note />}
      {art === 'orb' && <Orb />}
      {art === 'wake' && <Wake />}
      {(art === 'talk' || art === 'laugh') && <Talk laugh={art === 'laugh'} />}
      {art === 'window' && <Window />}
      {art === 'chest' && <Chest />}
      {art === 'chip' && <ChipClose />}
      {art === 'plan' && <Plan />}
      {art === 'bus' && <Bus />}
      {(art === 'bazaar' || art === 'bazaarlit') && <Bazaar lit={art === 'bazaarlit'} />}
      {art === 'gatelock' && <GateLock />}
      {(art === 'tower' || art === 'towerlit') && <Tower lit={art === 'towerlit'} />}
      {art === 'scales' && <Scales />}
      {art === 'vault' && <Vault />}
      {art === 'fountain' && <Fountain />}
      {(art === 'counter' || art === 'counterlit') && <Counter lit={art === 'counterlit'} />}
      {(art === 'heart' || art === 'heartlit') && <Heart lit={art === 'heartlit'} />}
      {art === 'citylit' && <City lit />}
    </svg>
  );
}

function Stars() {
  return (
    <g class="stars">
      {[[22, 18], [64, 34], [98, 12], [140, 28], [186, 16], [222, 38], [262, 14], [300, 30], [44, 52], [244, 58]].map(([x, y], k) => (
        <circle key={k} cx={x} cy={y} r={k % 3 ? 0.9 : 1.4} />
      ))}
    </g>
  );
}

/** Ko'hna Minor silueti: gumbazlar, minora, rasadxona; derazalar o'chiq (Sukunat). */
function Skyline({ lit = false }: { lit?: boolean }) {
  return (
    <g class="skyline">
      <path d="M0 180V132h26v-14q14-22 28 0v14h20V98h8V84h4v14h8v34h18v-10q24-40 48 0v10h16v-22q16-26 32 0v22h22V92q14-18 28 0v40h20v-12q14-20 28 0v60z" />
      <g class={`windows${lit ? ' lit' : ''}`}>
        <rect x="36" y="140" width="6" height="9" rx="3" />
        <rect x="82" y="108" width="4" height="8" rx="2" />
        <rect x="148" y="138" width="8" height="12" rx="4" />
        <rect x="204" y="126" width="6" height="10" rx="3" />
        <rect x="243" y="108" width="6" height="12" rx="3" />
        <rect x="292" y="142" width="6" height="9" rx="3" />
      </g>
    </g>
  );
}

/** Chiroq: mis shar, bitta ko'z, ikki antenna-sim. awake — ko'z oltin (Q = 1). */
function Chiroq({ x, y, s = 1, awake = false, reach = false }: { x: number; y: number; s?: number; awake?: boolean; reach?: boolean }) {
  return (
    <g class={`chiroq${awake ? ' awake' : ''}`} transform={`translate(${x} ${y}) scale(${s})`}>
      {awake && <circle r="34" fill="url(#glow)" class="chiroq-glow" />}
      <path class="chiroq-wire" d={reach ? 'M-6 -16Q-14 -40 -30 -52' : 'M-6 -16Q-10 -28 -18 -32'} />
      <path class="chiroq-wire" d="M6 -16Q10 -28 18 -32" />
      <circle class="chiroq-tip" cx={reach ? -30 : -18} cy={reach ? -52 : -32} r="2.4" />
      <circle class="chiroq-tip" cx="18" cy="-32" r="2.4" />
      <circle class="chiroq-body" r="18" />
      <path class="chiroq-seam" d="M-18 2h36" />
      <circle class="chiroq-eye" cy="-4" r="6.5" />
    </g>
  );
}

/** Lola: soddalashtirilgan siluet — ro'mol, yelka, qo'lida kavsharlagich. */
function Lola({ x, y, tilt = 0 }: { x: number; y: number; tilt?: number }) {
  return (
    <g class="lola" transform={`translate(${x} ${y}) rotate(${tilt})`}>
      <path class="lola-body" d="M-26 60q2-34 26-38q24 4 26 38z" />
      <circle class="lola-face" cy="0" r="14" />
      <path class="lola-scarf" d="M-16 2q-2-22 16-22q18 0 16 22q-4-12-16-12t-16 12zM12 6q10 8 6 24l-6-4z" />
      <path class="lola-tool" d="M22 44l16-20" />
    </g>
  );
}

function City({ lit = false }: { lit?: boolean }) {
  return (
    <>
      <rect width="320" height="180" class="sky" />
      <Stars />
      <circle cx="262" cy="40" r="11" class="moon" />
      <Skyline lit={lit} />
    </>
  );
}

function Workshop() {
  return (
    <>
      <rect width="320" height="180" class="wall" />
      <rect width="320" height="118" fill="url(#girih)" class="girih" />
      <path class="arch" d="M228 118V54q0-30 30-30t30 30v64z" />
      <path class="lamp-cord" d="M90 0v34" />
      <path class="lamp-shade" d="M76 46l14-12 14 12z" />
      <rect y="118" width="320" height="8" class="table-top" />
      <rect y="126" width="320" height="54" class="table" />
      <Chiroq x={120} y={100} s={0.8} />
      <path class="paper" d="M170 112l42-6 4 10-42 6z" />
    </>
  );
}

function Note() {
  return (
    <>
      <rect width="320" height="180" class="wall" />
      <rect width="320" height="180" fill="url(#girih)" class="girih" />
      <g transform="rotate(-3 160 90)">
        <rect x="70" y="22" width="180" height="136" rx="4" class="paper" />
        {[44, 62, 80, 98, 116].map((y, k) => (
          <path key={y} class="ink" d={`M88 ${y}h${k === 4 ? 70 : 144}`} />
        ))}
        <path class="ink sign" d="M196 136q6-14 10 0q4-14 10 0" />
      </g>
    </>
  );
}

function Orb() {
  return (
    <>
      <rect width="320" height="180" class="wall" />
      <rect width="320" height="180" fill="url(#girih)" class="girih" />
      <circle cx="160" cy="92" r="64" class="orb-shell" />
      <circle cx="160" cy="92" r="54" class="orb-inside" />
      {/* Uzilgan simlar va kalitlar — 1-bo'limda o'yinchi ularni ulaydi. */}
      <path class="trace" d="M120 70h22M178 70h22M120 112h14M150 112h50M160 50v14M160 120v14" />
      <rect x="138" y="64" width="12" height="12" rx="2" class="switch" />
      <rect x="170" y="64" width="12" height="12" rx="2" class="switch" />
      <rect x="148" y="104" width="24" height="16" rx="3" class="chip" />
      <circle cx="134" cy="112" r="2.6" class="spark" />
    </>
  );
}

function Wake() {
  return (
    <>
      <rect width="320" height="180" class="wall" />
      <rect width="320" height="180" fill="url(#girih)" class="girih lit" />
      <rect y="132" width="320" height="48" class="table" />
      <Chiroq x={160} y={100} s={1.6} awake />
    </>
  );
}

function Talk({ laugh }: { laugh: boolean }) {
  return (
    <>
      <rect width="320" height="180" class="wall" />
      <rect width="320" height="180" fill="url(#girih)" class="girih lit" />
      <rect y="140" width="320" height="40" class="table" />
      <Lola x={96} y={86} tilt={laugh ? -6 : 0} />
      <Chiroq x={220} y={110} s={1.1} awake />
    </>
  );
}

function Window() {
  return (
    <>
      <rect width="320" height="180" class="wall" />
      <rect width="320" height="180" fill="url(#girih)" class="girih lit" />
      <clipPath id="win">
        <path d="M80 150V70q0-50 80-50t80 50v80z" />
      </clipPath>
      <g clip-path="url(#win)">
        <rect width="320" height="180" class="sky" />
        <Stars />
        {/* Bozor darvozalari — keyingi bo'lim. */}
        <path class="skyline" d="M80 150v-40h20v-14q14-24 28 0v14h12v-24q20-30 40 0v24h12v-14q14-24 28 0v14h20v40z" />
        <path class="gate-door" d="M110 150v-26q8-12 16 0v26zM152 150v-32q8-14 16 0v32zM194 150v-26q8-12 16 0v26z" />
      </g>
      <path class="arch-frame" d="M80 150V70q0-50 80-50t80 50v80z" />
      <rect x="64" y="150" width="192" height="10" class="table-top" />
      <Chiroq x={226} y={132} s={0.7} awake reach />
    </>
  );
}

/** Buvining sandig'i: ochiq qopqoq, ichida oyoqchali qutichalar; Chiroq bittasini ko'taradi. */
function Chest() {
  return (
    <>
      <rect width="320" height="180" class="wall" />
      <rect width="320" height="118" fill="url(#girih)" class="girih" />
      <rect y="138" width="320" height="42" class="table" />
      <path class="chest-lid" d="M92 92l-8-40h152l-8 40z" />
      <rect x="92" y="92" width="136" height="54" rx="3" class="chest-box" />
      <path class="chest-band" d="M92 108h136M160 92v54" />
      {[106, 132, 178, 204].map((x) => (
        <MiniChip key={x} x={x} y={96} />
      ))}
      <Chiroq x={254} y={104} s={0.75} awake reach />
      <MiniChip x={216} y={44} />
    </>
  );
}

/** Kichik mikrosxema: qora quti, ikki yonida oyoqchalar. */
function MiniChip({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path class="chip-leg" d="M2 2v-4M8 2v-4M14 2v-4M2 12v4M8 12v4M14 12v4" />
      <rect width="16" height="14" rx="2" class="chip-body" />
    </g>
  );
}

/** Yaqindan: «To'liq summator» qutichasi — uchta kiruvchi, ikkita chiquvchi oyoq. */
function ChipClose() {
  return (
    <>
      <rect width="320" height="180" class="wall" />
      <rect width="320" height="180" fill="url(#girih)" class="girih" />
      <path class="chip-leg big" d="M86 56h30M86 90h30M86 124h30M204 70h30M204 110h30" />
      <rect x="116" y="36" width="88" height="108" rx="6" class="chip-body" />
      <circle cx="130" cy="50" r="4" class="chip-dot" />
      <text x="160" y="96" class="chip-name">FA</text>
      {[56, 90, 124].map((y) => (
        <circle key={y} cx="86" cy={y} r="3" class="spark" />
      ))}
    </>
  );
}

/** Buvining chizmasi: hisob xonasi — bo'sh uyalar, ular orasida to'rttalik simlar (shina). */
function Plan() {
  return (
    <>
      <rect width="320" height="180" class="wall" />
      <rect x="34" y="18" width="252" height="146" rx="4" class="paper" transform="rotate(-1.5 160 90)" />
      <g class="plan" transform="rotate(-1.5 160 90)">
        {[[64, 44], [64, 112], [212, 44], [212, 112]].map(([x, y], k) => (
          <rect key={k} x={x} y={y} width="44" height="30" rx="3" class="socket" />
        ))}
        <rect x="136" y="74" width="48" height="36" rx="3" class="socket core" />
        {[0, 4, 8, 12].map((d) => (
          <path key={d} class="plan-wire" d={`M108 ${54 + d}H136M184 ${54 + d}H212M108 ${120 + d}H136M184 ${120 + d}H212M${150 + d} 74V${64 + d}M${150 + d} 110V${120 + d}`} />
        ))}
        <path class="ink sign" d="M236 150q6-14 10 0q4-14 10 0" />
      </g>
    </>
  );
}

/** Shina: to'rt parallel sim bo'ylab to'rt bit bir ustunda, birga oqadi, oxirida — Ustozning hisoblagichi. */
function Bus() {
  return (
    <>
      <rect width="320" height="180" class="wall" />
      <rect width="320" height="180" fill="url(#girih)" class="girih lit" />
      {[66, 82, 98, 114].map((y, k) => (
        <g key={y}>
          <path class="bus-line" d={`M20 ${y}H236`} />
          <circle class={`bus-bit${k % 2 ? ' one' : ''}`} cx={60} cy={y} r="4" />
        </g>
      ))}
      <rect x="236" y="54" width="60" height="72" rx="6" class="chip-body" />
      <text x="266" y="96" class="chip-name small">Σ</text>
      <Chiroq x={40} y={150} s={0.6} awake />
    </>
  );
}

// ── 2-bo'lim: Bozor darvozalari ─────────────────────────────

/** Bozor: uchta pishtoq-darvoza, rastalar soyabonlari va fonarlar. lit — darvozalar ochilgan, fonarlar yonadi. */
function Bazaar({ lit }: { lit: boolean }) {
  const gates = [56, 160, 264];
  return (
    <>
      <rect width="320" height="180" class="sky" />
      <Stars />
      <Skyline lit={lit} />
      <rect y="150" width="320" height="30" class="table" />
      {gates.map((x) => (
        <g key={x}>
          <rect x={x - 38} y="66" width="76" height="86" class="pishtoq" />
          <rect x={x - 38} y="66" width="76" height="86" fill="url(#girih)" class="girih" />
          <path class={lit ? 'gate-open' : 'gate-door'} d={`M${x - 20} 152V100q0-22 20-22t20 22v52z`} />
          {!lit && <circle cx={x} cy="122" r="3.4" class="gate-lock" />}
        </g>
      ))}
      {[108, 212].map((x) => (
        <g key={x}>
          <path class="lantern-cord" d={`M${x} 66v14`} />
          <circle cx={x} cy="86" r="6" class={lit ? 'lantern lit' : 'lantern'} />
          {lit && <circle cx={x} cy="86" r="18" fill="url(#glow)" class="chiroq-glow" />}
        </g>
      ))}
    </>
  );
}

/** Darvoza qulfi yaqindan: ikki kalit teshigi, ulardan yuqoridagi chiroqqa mis yo'l — qulf ham sxema. */
function GateLock() {
  return (
    <>
      <rect width="320" height="180" class="wall" />
      <rect width="320" height="180" fill="url(#girih)" class="girih" />
      <path class="arch-frame" d="M70 180V80q0-62 90-62t90 62v100z" />
      <path class="gate-door" d="M86 180V84q0-50 74-50t74 50v96z" />
      <path class="trace" d="M128 122V96h64v26M160 96V70" />
      <circle cx="160" cy="62" r="8" class="lantern" />
      <g class="keyhole">
        <circle cx="128" cy="130" r="6" />
        <path d="M125 134h6l2 12h-10z" />
        <circle cx="192" cy="130" r="6" />
        <path d="M189 134h6l2 12h-10z" />
      </g>
      <Chiroq x={268} y={150} s={0.6} awake />
    </>
  );
}

/** Tarozi minorasi: bozor o'rtasida, tepasida tarozi pallalari. lit — minora hisoblayapti, derazasi yoniq. */
function Tower({ lit = false }: { lit?: boolean }) {
  return (
    <>
      <rect width="320" height="180" class="sky" />
      <Stars />
      <Skyline lit />
      {lit && <circle cx="160" cy="70" r="46" fill="url(#glow)" class="chiroq-glow" />}
      <path class="tower" d="M142 180V60l18-14 18 14v120z" />
      <path class="scale-beam" d={lit ? 'M118 44l84-8M160 46V30M118 44l-10 18h20zM202 36l-10 18h20z' : 'M118 40h84M160 46V30M118 40l-10 18h20zM202 40l-10 18h20z'} />
      <rect x="152" y="96" width="16" height="22" rx="8" class={lit ? 'tower-window lit' : 'tower-window'} />
      <g class="crowd">
        <circle cx="104" cy="150" r="6" />
        <path d="M96 172q8-18 16 0z" />
        <circle cx="216" cy="150" r="6" />
        <path d="M208 172q8-18 16 0z" />
      </g>
    </>
  );
}

// ── 3-bo'lim: Tarozi minorasi ───────────────────────────────

/** Minora ichida: katta tarozi, pallalarida bit-toshlar «1» va «1» — tarozi ularni qo'shadi. */
function Scales() {
  return (
    <>
      <rect width="320" height="180" class="wall" />
      <rect width="320" height="180" fill="url(#girih)" class="girih" />
      <path class="scale-beam big" d="M160 160V40M140 160h40M88 50l144-10" />
      <path class="scale-beam" d="M88 50l-22 46M88 50l22 46M232 40l-22 46M232 40l22 46" />
      <path class="pan" d="M62 96q26 16 52 0zM206 86q26 16 52 0z" />
      {[[78, 82], [222, 72]].map(([x, y]) => (
        <g key={x}>
          <rect x={x} y={y} width="20" height="16" rx="2" class="weight" />
          <text x={x + 10} y={y + 8} class="weight-bit">1</text>
        </g>
      ))}
      <circle cx="160" cy="44" r="5" class="chiroq-tip" />
      <Chiroq x={276} y={150} s={0.55} awake />
    </>
  );
}

// ── 4-bo'lim: Kumush ombor ─────────────────────────────────

/** Ombor javonlari: bir xil kumush quymalar, oldinda bittasi yaqindan — ustida NAND. */
function Vault() {
  return (
    <>
      <rect width="320" height="180" class="wall" />
      <rect width="320" height="180" fill="url(#girih)" class="girih" />
      {[44, 86, 128].map((y) => (
        <g key={y}>
          <rect x="20" y={y} width="280" height="5" class="shelf" />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => (
            <path key={k} class="ingot" d={`M${30 + k * 27} ${y}l4-14h14l4 14z`} />
          ))}
        </g>
      ))}
      <path class="ingot big" d="M110 180l12-34h76l12 34z" />
      <text x="160" y="166" class="ingot-name">NAND</text>
    </>
  );
}

/** Shahar hovuzi: favvora yana otiladi (nasoslar ishlayapti). */
function Fountain() {
  return (
    <>
      <rect width="320" height="180" class="sky" />
      <Stars />
      <Skyline lit />
      <rect x="60" y="160" width="200" height="20" class="pool" />
      <path class="pool-rim" d="M54 160h212" />
      <path class="water-jet" d="M160 160V108M160 108q-30 0-46 48M160 108q30 0 46 48" />
      {[[120, 128], [200, 128], [160, 98]].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="3" class="drop" />
      ))}
      <path class="water" d="M66 172q14-6 28 0t28 0t28 0t28 0t28 0t28 0t28 0" />
    </>
  );
}

// ── Shinalar: hisob xonasi ─────────────────────────────────

/** Ustozning hisoblagichi: to'rt bit-chiroq va raqam; pastdan shina kiradi. lit — son yetib keldi (0101 = 5). */
function Counter({ lit }: { lit: boolean }) {
  const bits = [0, 1, 0, 1];
  return (
    <>
      <rect width="320" height="180" class="wall" />
      <rect width="320" height="180" fill="url(#girih)" class={lit ? 'girih lit' : 'girih'} />
      {lit && <circle cx="160" cy="88" r="80" fill="url(#glow)" class="chiroq-glow" />}
      {bits.map((_, k) => (
        <path key={k} class="bus-line" d={`M${112 + k * 32} 136V180`} />
      ))}
      <rect x="80" y="36" width="160" height="100" rx="8" class="chip-body" />
      {bits.map((b, k) => (
        <circle key={k} cx={112 + k * 32} cy="66" r="9" class={lit && b ? 'lantern lit' : 'lantern'} />
      ))}
      <text x="160" y="108" class="chip-name">{lit ? '5' : '·'}</text>
    </>
  );
}

// ── ALU: Ustozning yuragi ──────────────────────────────────

/** ALU belgisi: tepadan ikki shina (A, B), pastdan natija, chapda F1 F0 amal kalitlari. lit — yurak uradi. */
function Heart({ lit }: { lit: boolean }) {
  return (
    <>
      <rect width="320" height="180" class="wall" />
      <rect width="320" height="180" fill="url(#girih)" class={lit ? 'girih lit' : 'girih'} />
      {lit && <circle cx="160" cy="90" r="76" fill="url(#glow)" class="chiroq-glow" />}
      {[0, 4, 8, 12].map((d) => (
        <path key={d} class="bus-line thin" d={`M${116 + d} 0V40M${192 + d} 0V40M${154 + d} 140V180`} />
      ))}
      <path class={lit ? 'alu lit' : 'alu'} d="M98 40h52l10 20 10-20h52l-26 100h-72z" />
      <text x="160" y="102" class="chip-name small">ALU</text>
      <path class="chip-leg" d="M58 84h51M58 100h55" />
      <rect x="44" y="78" width="14" height="12" rx="2" class="switch" />
      <rect x="44" y="94" width="14" height="12" rx="2" class="switch" />
      <Chiroq x={270} y={150} s={0.55} awake={lit} />
    </>
  );
}
