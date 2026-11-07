// Ovoz effektlari WebAudio bilan kodda yaratiladi — fayllar yuklanmaydi.
import { settings } from './state';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!settings.value.sound) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; delay?: number; to?: number } = {}) {
  const ac = audio();
  if (!ac) return;
  const { type = 'sine', gain = 0.06, delay = 0, to } = opts;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  place: () => tone(520, 0.08, { type: 'triangle', to: 380 }),
  connect: () => {
    tone(660, 0.06, { type: 'square', gain: 0.03 });
    tone(990, 0.08, { type: 'square', gain: 0.03, delay: 0.05 });
  },
  toggle: () => tone(880, 0.04, { type: 'square', gain: 0.025 }),
  remove: () => tone(240, 0.12, { type: 'triangle', to: 120 }),
  error: () => {
    tone(150, 0.16, { type: 'sawtooth', gain: 0.04 });
    tone(110, 0.2, { type: 'sawtooth', gain: 0.04, delay: 0.12 });
  },
  success: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: 'triangle', gain: 0.07, delay: i * 0.09 })),
  star: (i: number) => tone(880 + i * 220, 0.18, { type: 'sine', gain: 0.06 }),
  click: () => tone(700, 0.03, { type: 'sine', gain: 0.03 }),
  /** Tekshiruvda to'g'ri chiqqan qator: har qatorda biroz balandroq. */
  tick: (i: number) => tone(520 * 2 ** (Math.min(i, 24) / 24), 0.05, { type: 'sine', gain: 0.035 }),
};
