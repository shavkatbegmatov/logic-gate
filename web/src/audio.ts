// Ovoz effektlari WebAudio bilan kodda yaratiladi — fayllar yuklanmaydi.
// Bu yerda — bosh yuklamadagi oddiy tovushlar. Boy effektlar va fon musiqasi (audio-rich.ts) birinchi
// foydalanuvchi harakatidan keyin alohida bo'lak sifatida yuklanadi; u kelguncha shu tovushlar chalinadi.
import { effect, type ReadonlySignal } from '@preact/signals';
import type { Route } from './router';
import { settings } from './state';
import { haptic } from './telegram';

type Rich = typeof import('./audio-rich');

let ctx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;
let rich: Rich | null = null;
let richLoading = false;

function audio(): AudioContext | null {
  if (!settings.value.sound) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    loadRich();
    return ctx;
  } catch {
    return null;
  }
}

function loadRich() {
  if (rich || richLoading || !ctx) return;
  richLoading = true;
  const ac = ctx;
  import('./audio-rich').then(
    (m) => {
      m.init(ac);
      rich = m;
      syncMusic();
    },
    () => (richLoading = false), // Tarmoq xatosi: keyingi tovushda yana urinadi.
  );
}

const musicOn = () => settings.value.sound && settings.value.music !== false;
let current: ReadonlySignal<Route> | null = null;

/** Marshrut yoki sozlama o'zgarsa — musiqa sahnasi almashadi yoki o'chadi. */
function syncMusic() {
  const r = musicOn() && current ? current.value : null; // Signallar effect ichida o'qiladi (rich yo'q bo'lsa ham).
  rich?.music(r);
}

/**
 * Fon musiqasini marshrutga bog'laydi (main.tsx). Router bu yerda import qilinmaydi: u `location`ni
 * talab qiladi, audio.ts esa testlarda ham yuklanadi. Brauzer ovozni faqat foydalanuvchi harakatidan
 * keyin ruxsat etadi: birinchi bosish yoki tugmada kontekst ochiladi va boy bo'lak yuklanadi.
 */
export function startMusic(r: ReadonlySignal<Route>) {
  current = r;
  effect(syncMusic);
  const unlock = () => {
    if (!musicOn() || !audio()) return;
    removeEventListener('pointerdown', unlock, true);
    removeEventListener('keydown', unlock, true);
  };
  addEventListener('pointerdown', unlock, true);
  addEventListener('keydown', unlock, true);
}

/** Boy bo'lak yuklangan bo'lsa — uning effekti (true); ovoz o'chiq bo'lsa ham true (oddiysi chalinmasin). */
function viaRich(play: (r: Rich) => void): boolean {
  if (!audio()) return true;
  if (!rich) return false;
  play(rich);
  return true;
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
  g.gain.linearRampToValueAtTime(gain, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Qisqa mexanik "chertish" (tumbler, chip o'rnatish) uchun filtrlangan shovqin impulsi. */
function snap(freq: number, q: number, dur: number, gain = 0.045, delay = 0) {
  const ac = audio();
  if (!ac) return;
  if (!noiseBuf || noiseBuf.sampleRate !== ac.sampleRate) {
    const len = Math.max(1, Math.floor(ac.sampleRate * 0.06));
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.35));
  }
  const t0 = ac.currentTime + delay;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(freq, t0);
  filter.Q.setValueAtTime(q, t0);
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.01);
}

// Telegram ichida asosiy amallar telefon tebranishi bilan ham seziladi (ovoz o'chirilgan bo'lsa ham).
export const sfx = {
  place: () => {
    haptic('light');
    if (viaRich((r) => r.sfx.place())) return;
    snap(1800, 2.2, 0.032, 0.055);
    tone(420, 0.075, { type: 'triangle', gain: 0.065, to: 210 });
    tone(920, 0.03, { type: 'sine', gain: 0.025, delay: 0.015 });
  },
  connect: () => {
    haptic('light');
    if (viaRich((r) => r.sfx.connect())) return;
    snap(2600, 3.0, 0.02, 0.03);
    tone(660, 0.055, { type: 'triangle', gain: 0.045 });
    tone(1040, 0.08, { type: 'sine', gain: 0.045, delay: 0.042 });
  },
  toggle: (on?: boolean) => {
    haptic('select');
    if (viaRich((r) => r.sfx.toggle(on))) return;
    snap(on === false ? 1550 : 2300, 2.6, 0.026, 0.05);
    tone(on === false ? 640 : 940, 0.04, { type: 'triangle', gain: 0.03 });
  },
  remove: () => {
    haptic('light');
    if (viaRich((r) => r.sfx.remove())) return;
    snap(950, 1.8, 0.035, 0.035);
    tone(250, 0.12, { type: 'triangle', gain: 0.055, to: 115 });
  },
  mode: () => {
    haptic('select');
    if (viaRich((r) => r.sfx.mode())) return;
    snap(2900, 3.4, 0.02, 0.03);
    tone(740, 0.045, { type: 'sine', gain: 0.03, to: 980 });
  },
  error: () => {
    haptic('error');
    if (viaRich((r) => r.sfx.error())) return;
    tone(150, 0.16, { type: 'sawtooth', gain: 0.04 });
    tone(110, 0.2, { type: 'sawtooth', gain: 0.04, delay: 0.12 });
  },
  success: () => {
    haptic('success');
    if (viaRich((r) => r.sfx.success())) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      tone(f, 0.28, { type: 'triangle', gain: 0.065, delay: i * 0.085 });
      tone(f * 2, 0.22, { type: 'sine', gain: 0.02, delay: i * 0.085 + 0.02 });
    });
  },
  star: (i: number) => viaRich((r) => r.sfx.star(i)) || tone(880 + i * 220, 0.18, { type: 'sine', gain: 0.06 }),
  achievement: () => viaRich((r) => r.sfx.achievement()) || [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.16, { type: 'sine', gain: 0.05, delay: 0.6 + i * 0.07 })),
  click: () => viaRich((r) => r.sfx.click()) || tone(760, 0.028, { type: 'sine', gain: 0.03 }),
  /** Tekshiruvda to'g'ri chiqqan qator: har qatorda biroz balandroq. */
  tick: (i: number) => viaRich((r) => r.sfx.tick(i)) || tone(520 * 2 ** (Math.min(i, 24) / 24), 0.05, { type: 'sine', gain: 0.035 }),
  /** Sim toki: tekshiruv to'lqini yurganda (p = 0..1). Faqat boy bo'lakda — oddiy rejimda jim. */
  flow: (p: number) => void viaRich((r) => r.sfx.flow(p)),
};
