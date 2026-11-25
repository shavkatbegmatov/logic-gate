// Boy ovoz dizayni va bo'limlarga mos fon musiqasi. Bu bo'lak kech yuklanadi (audio.ts → import()):
// bosh yuklamaga (compress.mjs byudjeti) kirmaydi. Fayl yuklanmaydi — hammasi WebAudio'da sintez
// qilinadi, shuning uchun oflayn (service worker) ham ishlaydi va trafik sarflanmaydi.
import { levelById } from './levels';
import type { Route } from './router';

/** Bo'lim musiqasi: tonika (MIDI), lad, temp, akkordlar ketma-ketligi (lad pog'onalari) va qatlamlar. */
export interface Scene {
  root: number;
  mode: readonly number[];
  bpm: number;
  prog: readonly number[];
  /** Arpedjio zichligi: 8-ulushda nota chalinish ehtimoli. */
  density: number;
  /** Pad filtrining ochiqligi (Gs): yuqori — yorqinroq. */
  bright: number;
  /** Yengil «hi-hat» (ritmli bo'limlar). */
  hat?: boolean;
  /** Takt soati chiqillashi (Xotira, Avtomatlar — takt signali mavzusi). */
  clock?: boolean;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const MIXO = [0, 2, 4, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];

export const SCENES: Record<string, Scene> = {
  menu: { root: 62, mode: MAJOR, bpm: 72, prog: [0, 3, 5, 4], density: 0.25, bright: 900 },
  basics: { root: 60, mode: MAJOR, bpm: 84, prog: [0, 4, 5, 3], density: 0.4, bright: 1300 },
  xor: { root: 57, mode: DORIAN, bpm: 90, prog: [0, 3, 0, 6], density: 0.45, bright: 1200, hat: true },
  circuits: { root: 65, mode: LYDIAN, bpm: 96, prog: [0, 1, 4, 0], density: 0.55, bright: 1600, hat: true },
  nand: { root: 52, mode: PHRYGIAN, bpm: 78, prog: [0, 1, 0, 6], density: 0.35, bright: 800 },
  master: { root: 62, mode: MINOR, bpm: 100, prog: [0, 5, 2, 6], density: 0.6, bright: 1500, hat: true },
  memory: { root: 55, mode: MIXO, bpm: 92, prog: [0, 6, 3, 0], density: 0.45, bright: 1100, clock: true },
  automata: { root: 59, mode: MINOR, bpm: 104, prog: [0, 5, 3, 4], density: 0.55, bright: 1400, hat: true, clock: true },
  nor: { root: 61, mode: MINOR, bpm: 88, prog: [0, 3, 5, 4], density: 0.4, bright: 1000 },
  daily: { root: 64, mode: MAJOR, bpm: 96, prog: [0, 5, 3, 4], density: 0.5, bright: 1700, hat: true },
  sandbox: { root: 60, mode: LYDIAN, bpm: 66, prog: [0, 4], density: 0.2, bright: 700 },
};

/** Marshrut → musiqa sahnasi. Menyu ekranlari bitta sahnada: o'tishda musiqa qayta boshlanmaydi. */
export function sceneKey(r: Route): string {
  const levelId = r.name === 'level' ? r.id : r.name === 'contest' ? r.level : undefined;
  if (levelId) {
    const ch = levelById(levelId)?.chapter;
    return ch && ch in SCENES ? ch : 'menu';
  }
  if (r.name === 'lesson') return r.id in SCENES ? r.id : 'menu';
  if (r.name === 'daily') return 'daily';
  if (r.name === 'sandbox') return 'sandbox';
  return 'menu';
}

export const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** Lad pog'onasi (manfiy va oktavadan oshganlari ham) → MIDI. */
export function degree(s: Scene, d: number): number {
  const n = s.mode.length;
  const oct = Math.floor(d / n);
  return s.root + oct * 12 + s.mode[((d % n) + n) % n];
}

/** Takrorlanuvchi tasodif: bir sahna har safar bir xil «kuy xarakteri»ga ega bo'ladi. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ——— Audio grafi ———

let ac: AudioContext;
let sfxBus: GainNode;
let musicBus: GainNode;
let duck: GainNode;
let reverb: ConvolverNode;
let noise: AudioBuffer;

export function init(ctx: AudioContext) {
  ac = ctx;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 4;
  comp.connect(ac.destination);

  reverb = ac.createConvolver();
  reverb.buffer = impulse(2.4);
  const wet = gain(0.28);
  reverb.connect(wet).connect(comp);

  sfxBus = gain(1);
  sfxBus.connect(comp);
  musicBus = gain(0);
  duck = gain(1);
  musicBus.connect(duck).connect(comp);

  const len = Math.floor(ac.sampleRate * 0.5);
  noise = ac.createBuffer(1, len, ac.sampleRate);
  const ch = noise.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;

  document.addEventListener('visibilitychange', () => (document.hidden ? stopLoop(0.3) : startLoop()));
}

function gain(v: number) {
  const g = ac.createGain();
  g.gain.value = v;
  return g;
}

/** Sun'iy xona aks-sadosi: so'nuvchi stereo shovqin (fayl o'rniga). */
function impulse(sec: number) {
  const len = Math.floor(ac.sampleRate * sec);
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  return buf;
}

interface Voice {
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  /** Chastota sirpanishi (Gs). */
  to?: number;
  detune?: number;
  /** Aks-sadoga yuboriladigan ulush. */
  send?: number;
  /** Past chastotali filtr (Gs). */
  cut?: number;
  bus?: AudioNode;
}

function osc(freq: number, t0: number, dur: number, v: Voice = {}) {
  const { type = 'sine', gain: peak = 0.05, attack = 0.005, to, detune = 0, send = 0, cut, bus = sfxBus } = v;
  const o = ac.createOscillator();
  o.type = type;
  o.detune.value = detune;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(dur, attack + 0.01));
  let head: AudioNode = o;
  if (cut) {
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cut;
    head = o.connect(f);
  }
  head.connect(g).connect(bus);
  if (send) g.connect(gain(send)).connect(reverb);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function burst(t0: number, dur: number, v: { freq: number; q?: number; gain?: number; type?: BiquadFilterType; to?: number; send?: number; bus?: AudioNode }) {
  const s = ac.createBufferSource();
  s.buffer = noise;
  s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ac.createBiquadFilter();
  f.type = v.type ?? 'bandpass';
  f.Q.value = v.q ?? 1.5;
  f.frequency.setValueAtTime(v.freq, t0);
  if (v.to) f.frequency.exponentialRampToValueAtTime(v.to, t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(v.gain ?? 0.05, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f).connect(g).connect(v.bus ?? sfxBus);
  if (v.send) g.connect(gain(v.send)).connect(reverb);
  s.start(t0, Math.random() * 0.3);
  s.stop(t0 + dur + 0.02);
}

/** Effekt eshitilganda musiqa qisqa vaqtga pasayadi (ducking). */
function duckMusic(depth = 0.55, hold = 0.25) {
  const t = ac.currentTime;
  duck.gain.cancelScheduledValues(t);
  duck.gain.setValueAtTime(duck.gain.value, t);
  duck.gain.linearRampToValueAtTime(depth, t + 0.03);
  duck.gain.setTargetAtTime(1, t + hold, 0.25);
}

// ——— Effektlar ———

const now = () => ac.currentTime + 0.005;
let lastFlow = 0;

export const sfx = {
  place() {
    const t = now();
    osc(150, t, 0.11, { gain: 0.11, to: 55 });
    burst(t, 0.035, { freq: 2400, q: 2.5, gain: 0.07 });
    osc(degreeHz(9), t + 0.01, 0.12, { type: 'triangle', gain: 0.025, send: 0.4 });
  },
  connect() {
    const t = now();
    osc(1800, t, 0.07, { type: 'sawtooth', gain: 0.025, to: 500, cut: 3500 });
    burst(t, 0.05, { freq: 4000, to: 1200, q: 4, gain: 0.04 });
    osc(degreeHz(11), t + 0.04, 0.16, { gain: 0.04, send: 0.5 });
  },
  toggle(on?: boolean) {
    const t = now();
    burst(t, 0.018, { freq: on === false ? 1500 : 2600, q: 3, gain: 0.07 });
    burst(t + 0.014, 0.015, { freq: on === false ? 1100 : 2000, q: 3, gain: 0.04 });
    osc(on === false ? 200 : 260, t, 0.05, { type: 'triangle', gain: 0.05 });
  },
  remove() {
    const t = now();
    burst(t, 0.16, { freq: 2600, to: 300, q: 1.2, gain: 0.05, send: 0.2 });
    osc(220, t, 0.16, { type: 'triangle', gain: 0.05, to: 90 });
  },
  mode() {
    const t = now();
    burst(t, 0.02, { freq: 3200, q: 4, gain: 0.03 });
    osc(degreeHz(7), t, 0.09, { gain: 0.03, send: 0.3 });
  },
  click() {
    osc(degreeHz(14), now(), 0.04, { gain: 0.025 });
  },
  error() {
    const t = now();
    duckMusic(0.35, 0.4);
    osc(155, t, 0.2, { type: 'sawtooth', gain: 0.045, cut: 900 });
    osc(158, t, 0.2, { type: 'sawtooth', gain: 0.035, cut: 900 });
    osc(116, t + 0.13, 0.26, { type: 'sawtooth', gain: 0.045, cut: 700 });
  },
  /** Sim toki: tekshiruv to'lqini kirishlardan chiqishlarga yurganda (p = 0..1) — yengil uchqun va ko'tariluvchi ton. */
  flow(p: number) {
    if (ac.currentTime - lastFlow < 0.04) return;
    lastFlow = ac.currentTime;
    const t = now();
    burst(t, 0.03, { freq: 3000 + p * 3000, q: 6, gain: 0.012 });
    osc(degreeHz(7 + Math.round(p * 7)), t, 0.06, { type: 'triangle', gain: 0.012, cut: 4000 });
  },
  tick(i: number) {
    osc(degreeHz(7 + (Math.min(i, 21) % 15)), now(), 0.12, { gain: 0.035, send: 0.35 });
  },
  /** Yechim: sahna tonalligidagi akkord, yuqoriga arpedjio va «yaltirash». */
  success() {
    const t = now();
    duckMusic(0.25, 1.4);
    osc(midiHz(scene.root - 24), t, 0.9, { gain: 0.08, to: midiHz(scene.root - 25) });
    [0, 2, 4, 7, 9, 11, 14].forEach((d, i) => {
      const f = degreeHz(7 + d);
      osc(f, t + i * 0.07, 0.6, { type: 'triangle', gain: 0.05, send: 0.5 });
      osc(f * 2.01, t + i * 0.07 + 0.01, 0.4, { gain: 0.015, send: 0.6 });
    });
    [0, 2, 4].forEach((d) => osc(degreeHz(7 + d), t + 0.45, 1.4, { type: 'sawtooth', gain: 0.018, attack: 0.08, cut: 2200, send: 0.6 }));
    burst(t + 0.45, 1.2, { freq: 7000, type: 'highpass', gain: 0.012, send: 0.8 });
  },
  star(i: number) {
    const t = now();
    const f = degreeHz(14 + i * 2);
    osc(f, t, 0.35, { gain: 0.05, send: 0.5 });
    osc(f * 2.76, t, 0.2, { gain: 0.012, send: 0.5 });
  },
  achievement() {
    const t = now() + 0.6;
    duckMusic(0.3, 1);
    [0, 2, 4, 7].forEach((d, i) => {
      osc(degreeHz(14 + d), t + i * 0.08, 0.35, { type: 'triangle', gain: 0.045, send: 0.5 });
      osc(degreeHz(14 + d) * 2.76, t + i * 0.08, 0.15, { gain: 0.01, send: 0.5 });
    });
  },
};

/** Sahna ladidagi pog'ona chastotasi: effektlar musiqa bilan bir tonallikda eshitiladi. */
const degreeHz = (d: number) => midiHz(degree(scene, d));

// ——— Musiqa ———

let scene: Scene = SCENES.menu;
let key = '';
let wanted: string | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
let step = 0;
let nextAt = 0;
let rand = rng(1);
let walk = 0;

const MUSIC_LEVEL = 0.45;

/** null — musiqa o'chadi; aks holda marshrutga mos sahna (o'zgarsa — almashinadi). */
export function music(r: Route | null) {
  wanted = r ? sceneKey(r) : null;
  if (!wanted) return stopLoop(0.8);
  if (wanted === key && timer) return;
  if (key && timer) {
    // Sahnalar orasida qisqa so'nish: eski notalar dumi yangisi bilan aralashmaydi.
    stopLoop(0.6);
    setTimeout(startLoop, 700);
  } else startLoop();
}

function startLoop() {
  if (!wanted || timer || document.hidden) return;
  if (wanted !== key) {
    key = wanted;
    scene = SCENES[key];
    rand = rng([...key].reduce((h, c) => h * 31 + c.charCodeAt(0), 7));
    step = 0;
    walk = 0;
  }
  if (ac.state === 'suspended') void ac.resume();
  nextAt = ac.currentTime + 0.1;
  const t = ac.currentTime;
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setValueAtTime(musicBus.gain.value, t);
  musicBus.gain.linearRampToValueAtTime(MUSIC_LEVEL, t + 2.5);
  timer = setInterval(schedule, 25);
}

function stopLoop(fade: number) {
  if (!ac) return;
  clearInterval(timer);
  timer = undefined;
  const t = ac.currentTime;
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setValueAtTime(musicBus.gain.value, t);
  musicBus.gain.linearRampToValueAtTime(0, t + fade);
}

/** Oldindan rejalashtirish (lookahead): setInterval aniq emas, notalar audio soatiga qo'yiladi. */
function schedule() {
  const sixteenth = 60 / scene.bpm / 4;
  while (nextAt < ac.currentTime + 0.15) {
    playStep(step, nextAt, sixteenth);
    step++;
    nextAt += sixteenth;
  }
}

function playStep(s: number, t: number, q: number) {
  const bar = Math.floor(s / 16);
  const chord = scene.prog[Math.floor(bar / 2) % scene.prog.length];
  const bus = musicBus;

  if (s % 32 === 0) {
    // Pad: ikki bar davom etadigan, sekin ochiladigan akkord (ikki xil sozlangan arra to'lqin).
    for (const d of [0, 2, 4]) {
      const f = midiHz(degree(scene, chord + d) - 12);
      for (const det of [-7, 7]) osc(f, t, q * 32, { type: 'sawtooth', gain: 0.02, attack: q * 10, detune: det, cut: scene.bright, send: 0.5, bus });
    }
  }
  if (s % 8 === 0) osc(midiHz(degree(scene, chord) - 24), t, q * 6, { type: 'triangle', gain: 0.09, attack: 0.02, cut: 600, bus });
  if (s % 2 === 0 && rand() < scene.density) {
    // Arpedjio: akkord tovushlari atrofida «tasodifiy yurish» — kuy takrorlansa ham zerikarli emas.
    walk = Math.max(-3, Math.min(6, walk + Math.round((rand() - 0.5) * 4)));
    const d = rand() < 0.6 ? chord + [0, 2, 4][Math.floor(rand() * 3)] : chord + walk;
    osc(midiHz(degree(scene, d) + 12), t, q * 3, { type: 'triangle', gain: 0.03, cut: scene.bright * 3, send: 0.45, bus });
  }
  if (scene.hat && s % 4 === 2) burst(t, 0.03, { freq: 8000, type: 'highpass', gain: 0.012, bus });
  if (scene.clock && s % 4 === 0) osc(s % 16 === 0 ? 2400 : 1800, t, 0.02, { gain: 0.012, bus });
}
