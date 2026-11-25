import type { BoardMode, Motion, Theme } from './theme';
import { computed, effect, signal } from '@preact/signals';
import { setLang, type Lang } from './i18n';
import { deviceLang, takeUrlLang } from './lang-detect';
import { chapterLevels, chapterOf, chapters, levelById, levels, newGates } from './levels';
import type { Chapter, Circuit, GateType, Level } from './sim/types';
import { load, save, saveLater } from './storage';
import { assignedLevels } from './tasks';
import { launchLanguage } from './telegram';
import { asNumber, asString, cleanCircuit, cleanList, cleanRecord, cleanResult, hasOwn, isObj } from './validate';

const KEYS = {
  progress: 'lg.progress.v1',
  profile: 'lg.profile.v1',
  settings: 'lg.settings.v1',
  drafts: 'lg.drafts.v1',
  sandbox: 'lg.sandbox.v1',
  intro: 'lg.intro.v1',
  hints: 'lg.hints.v1',
  /** Sertifikatdagi ism (bolaning haqiqiy ismi bo'lishi mumkin; serverga yuborilmaydi). */
  certName: 'lg.certName.v1',
};
export { KEYS };

export interface LevelProgress {
  stars: number;
  gates: number;
  circuit: Circuit;
  at: number;
  /** Server bu natijani biladimi. */
  synced: boolean;
}

export interface Profile {
  id: string;
  nickname: string;
  code: string;
}

export interface Settings {
  sound: boolean;
  /** Fon musiqasi (audio-rich.ts); yo'q bo'lsa — yoqilgan. Ovoz effektlari o'chiq bo'lsa, u ham jim. */
  music?: boolean;
  lang?: Lang;
  /** Rang mavzusi (theme.ts); yo'q bo'lsa — Sanoat PCB. */
  theme?: Theme;
  /** Sxema ko'rinishi (theme.ts): 2D Real, 3D Real yoki Klassik sxema; yo'q bo'lsa — 2D Real. */
  boardMode?: BoardMode;
  /** Animatsiya (theme.ts); yo'q bo'lsa — Avto. */
  motion?: Motion;
}

/**
 * Qurilmada o'yin birinchi marta ochilyapti (pastdagi effect'lar progressni darhol yozadi, shuning uchun
 * keyingi ochilishlarda false). Yangi o'yinchiga "yangi versiya" xabari kerak emas, tili esa qurilmadan olinadi.
 */
export const freshDevice = load(KEYS.progress, null) === null && load(KEYS.profile, null) === null;

// Saqlangan qiymatlar shakli (validate.ts): buzuq yozuv ilovani to'xtatmasin.
const cleanProgress = (v: unknown) => cleanRecord(v, cleanResult);
const cleanProfile = (v: unknown): Profile | null =>
  isObj(v) && typeof v.id === 'string' && typeof v.nickname === 'string' && typeof v.code === 'string'
    ? { id: v.id, nickname: v.nickname, code: v.code }
    : null;
const cleanSettings = (v: unknown): Partial<Settings> | null => {
  if (!isObj(v)) return null;
  const out: Partial<Settings> = {};
  if (typeof v.sound === 'boolean') out.sound = v.sound;
  if (typeof v.music === 'boolean') out.music = v.music;
  if (v.lang === 'uz' || v.lang === 'ru') out.lang = v.lang;
  // theme.ts dan THEMES olinmaydi: u state.ts ni import qiladi (aylana).
  if (
    v.theme === 'pcb' ||
    v.theme === 'bench' ||
    v.theme === 'breadboard' ||
    v.theme === 'scifi' ||
    v.theme === 'plata' ||
    v.theme === 'haqiqiy' ||
    v.theme === 'daftar' ||
    v.theme === 'chizma' ||
    v.theme === 'auto'
  ) {
    out.theme = v.theme;
  }
  if (v.boardMode === 'real2d' || v.boardMode === 'real3d' || v.boardMode === 'schematic') out.boardMode = v.boardMode;
  if (v.motion === 'on' || v.motion === 'off' || v.motion === 'auto') out.motion = v.motion;
  return out;
};
const loadSettings = (): Settings => ({ sound: true, ...load(KEYS.settings, {}, cleanSettings) });

export const progress = signal<Record<string, LevelProgress>>(load(KEYS.progress, {}, cleanProgress));
export const profile = signal<Profile | null>(load(KEYS.profile, null, cleanProfile));
export const settings = signal<Settings>(initialSettings());

/**
 * Til: qo'llanma sahifasidan kelgan havoladagi (?lang=) — har doim; aks holda saqlangan tanlov; birinchi
 * ochilishda — Telegram yoki brauzer tili. Avval o'ynab kelgan o'yinchining tili o'zicha o'zgarmaydi.
 */
function initialSettings(): Settings {
  const stored = loadSettings();
  const lang = takeUrlLang() ?? stored.lang ?? (freshDevice ? deviceLang(launchLanguage) : null);
  return lang ? { ...stored, lang } : stored;
}

/** Tanishtiruv kartasi ko'rsatilgan elementlar. */
export const seenIntro = signal<string[]>(load(KEYS.intro, [], (v) => cleanList(v, asString)));

effect(() => save(KEYS.progress, progress.value));
effect(() => save(KEYS.intro, seenIntro.value));
effect(() => save(KEYS.profile, profile.value));
effect(() => save(KEYS.settings, settings.value));

/**
 * Ochilish tilining lug'ati (alohida bo'lak — i18n.ts): main.tsx ilovani shu tayyor bo'lgach chizadi.
 * false — lug'at yuklanmadi.
 */
export const langReady: Promise<boolean> = setLang(settings.value.lang ?? 'uz');
// Keyin til sozlamasi o'zgarsa (tugma — lang-switch.ts, yoki boshqa tab) — lug'ati yuklangach til almashadi.
effect(() => void setLang(settings.value.lang ?? 'uz'));

/**
 * Ikki natijalar to'plamini birlashtiradi: har darajada kamroq elementli yechim; teng bo'lsa — a
 * (server biladigani ustun: ikkinchisi qayta yuborilmasin). O'zgarish bo'lmasa, a ning o'zi qaytadi.
 */
export function mergeProgress(
  a: Record<string, LevelProgress>,
  b: Record<string, LevelProgress>,
): Record<string, LevelProgress> {
  let out = a;
  for (const [id, p] of Object.entries(b ?? {})) {
    if (!p || typeof p.gates !== 'number') continue;
    const mine = out[id];
    const better = !mine || p.gates < mine.gates || (p.gates === mine.gates && p.synced && !mine.synced);
    if (better) out = { ...out, [id]: p };
  }
  return out;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Boshqa tabda (yoki oynada) o'zgargan natijalarni olish. Har tab butun progress'ni yozadi — busiz
 * oldin ochilgan tab yangi yechimni eski holati bilan ustidan yozib, natijani o'chirib yuborardi.
 */
function adoptFromStorage(key: string | null) {
  if (key === null || key === KEYS.progress) {
    const merged = mergeProgress(progress.value, load(KEYS.progress, {}, cleanProgress));
    if (merged !== progress.value) progress.value = merged;
  }
  if (key === null || key === KEYS.profile) {
    const p = load(KEYS.profile, null, cleanProfile);
    if (!same(p, profile.value)) profile.value = p;
  }
  if (key === null || key === KEYS.settings) {
    const s = loadSettings();
    if (!same(s, settings.value)) settings.value = s;
  }
  if (key === null || key === KEYS.drafts) {
    // Boshqa tabdagi qoralamalar qo'shiladi; shu tabdagisi (bir xil daraja) o'zgarmaydi.
    const stored = load(KEYS.drafts, {}, cleanDrafts);
    let added = false;
    for (const [id, c] of Object.entries(stored)) {
      if (!hasOwn(drafts, id)) {
        drafts[id] = c;
        added = true;
      }
    }
    if (added) saveLater(KEYS.drafts, drafts);
  }
}

if (typeof addEventListener === 'function') {
  addEventListener('storage', (e) => {
    if (e.storageArea === localStorage) adoptFromStorage(e.key);
  });
  // Orqa fonda muzlatilgan yoki keshdan (bfcache) qaytgan sahifa hodisalarni o'tkazib yuborgan bo'lishi mumkin.
  addEventListener('pageshow', (e) => e.persisted && adoptFromStorage(null));
  addEventListener('visibilitychange', () => document.visibilityState === 'visible' && adoptFromStorage(null));
}

export const totalStars = computed(() =>
  Object.entries(progress.value).reduce((sum, [id, p]) => sum + (levelById(id) ? p.stars : 0), 0),
);
export const solvedCount = computed(() => levels.filter((l) => progress.value[l.id]).length);

export function chapterUnlocked(ch: Chapter): boolean {
  return totalStars.value >= ch.unlockStars;
}

export function chapterStars(ch: Chapter): number {
  return chapterLevels(ch.id).reduce((s, l) => s + (progress.value[l.id]?.stars ?? 0), 0);
}

export function levelUnlocked(level: Level): boolean {
  // Yechilgan daraja doim ochiq: vazifa orqali yechilgan bo'lsa ham, vazifa o'chirilgandan
  // yoki sinfdan chiqilgandan keyin uni qayta o'ynab, natijani yaxshilash mumkin.
  if (progress.value[level.id]) return true;
  // O'qituvchi bergan vazifadagi daraja yulduzlar yetmasa ham ochiq.
  if (assignedLevels.value.has(level.id)) return true;
  if (!chapterUnlocked(chapterOf(level))) return false;
  const list = chapterLevels(level.chapter);
  const i = list.indexOf(level);
  return i === 0 || !!progress.value[list[i - 1].id];
}

export function nextLevel(level: Level): Level | undefined {
  return levels[levels.indexOf(level) + 1];
}

/**
 * "O'ynash" tugmasi uchun: birinchi ochiq, lekin yechilmagan daraja. Bunday daraja qolmagan bo'lsa
 * (keyingi bo'limga yulduz yetmaydi) — yulduzini oshirsa bo'ladigan birinchi yechilgan daraja.
 */
export function continueLevel(): Level {
  return (
    levels.find((l) => levelUnlocked(l) && !progress.value[l.id]) ??
    levels.find((l) => (progress.value[l.id]?.stars ?? 3) < 3) ??
    levels[0]
  );
}

/** Ochiq yechilmagan daraja qolmagan, keyingi bo'lim esa yopiq: qaysi bo'lim va yana nechta yulduz kerak. */
export function starsShortfall(): { chapter: Chapter; need: number } | null {
  if (levels.some((l) => levelUnlocked(l) && !progress.value[l.id])) return null;
  const ch = chapters.find((c) => !chapterUnlocked(c));
  return ch ? { chapter: ch, need: ch.unlockStars - totalStars.value } : null;
}

/**
 * Darajadagi hali tanishtirilmagan elementlar. Odatda — shu daraja kiritgan yangilari; o'qituvchi vazifasi
 * orqali oldingi darajalar o'tkazib yuborilgan bo'lsa, ularniki ham. Yechilgan darajada kiritilgan element
 * tanish hisoblanadi (tanishtiruv kartalaridan oldingi o'yinchilarga hammasi birdan chiqmasin).
 */
export function unseenGates(level: Level): GateType[] {
  const known = new Set<string>(seenIntro.value);
  for (const l of levels) if (progress.value[l.id]) for (const g of newGates(l)) known.add(g);
  return level.gates.filter((g) => !known.has(g));
}

/** Yechimni saqlaydi, agar u avvalgisidan yaxshiroq bo'lsa. */
export function recordSolve(levelId: string, circuit: Circuit, gates: number, stars: number) {
  const prev = progress.value[levelId];
  const improved = !prev || gates < prev.gates;
  if (improved) {
    progress.value = {
      ...progress.value,
      [levelId]: { stars, gates, circuit, at: Date.now(), synced: false },
    };
  }
  return { improved, prev };
}

export function markSynced(levelId: string) {
  const p = progress.value[levelId];
  if (p && !p.synced) progress.value = { ...progress.value, [levelId]: { ...p, synced: true } };
}

// Har bir daraja uchun tugallanmagan sxema (qoralama).
function cleanDrafts(v: unknown): Record<string, Circuit> | null {
  return cleanRecord(v, cleanCircuit);
}
const drafts: Record<string, Circuit> = load(KEYS.drafts, {}, cleanDrafts);

export function getDraft(levelId: string): Circuit | undefined {
  return drafts[levelId];
}

const MAX_CUSTOM_DRAFTS = 40;

export function setDraft(levelId: string, circuit: Circuit) {
  // Kalit oxiriga o'tadi: obyekt tartibi = oxirgi foydalanish tartibi.
  delete drafts[levelId];
  drafts[levelId] = circuit;
  // Do'stlar masalalari cheksiz ko'payishi mumkin — eng eskilari o'chiriladi.
  const custom = Object.keys(drafts).filter((k) => k.startsWith('custom-'));
  for (const k of custom.slice(0, Math.max(0, custom.length - MAX_CUSTOM_DRAFTS))) delete drafts[k];
  saveLater(KEYS.drafts, drafts);
}

const KEEP_OLD_DAILY = 3;

/**
 * Eski kunlik masalalar qoralamalari va maslahatlarini o'chiradi: bugungi, kechagi, ochilayotgan (keep)
 * va arxivdan oxirgi ishlatilgan 3 tasi qoladi.
 */
export function pruneDailyDrafts(today: number, keep?: string) {
  const prune = (store: Record<string, unknown>) => {
    const old = Object.keys(store).filter((k) => {
      const m = /^daily-(\d+)$/.exec(k);
      return m && Number(m[1]) < today - 1 && k !== keep;
    });
    // Qoralamalarda tartib = oxirgi foydalanish tartibi (setDraft kalitni oxiriga o'tkazadi).
    const drop = old.slice(0, Math.max(0, old.length - KEEP_OLD_DAILY));
    for (const k of drop) delete store[k];
    return drop.length > 0;
  };
  if (prune(drafts)) saveLater(KEYS.drafts, drafts);
  if (prune(hintSteps)) saveLater(KEYS.hints, hintSteps);
}

// Har bir daraja uchun ochilgan maslahatlar soni.
const hintSteps: Record<string, number> = load(KEYS.hints, {}, (v) => cleanRecord(v, asNumber));

export function hintStep(levelId: string): number {
  return hintSteps[levelId] ?? 0;
}

export function allHintSteps(): Record<string, number> {
  return { ...hintSteps };
}

export function setHintStep(levelId: string, n: number) {
  hintSteps[levelId] = n;
  saveLater(KEYS.hints, hintSteps);
}

export function markIntroSeen(types: string[]) {
  seenIntro.value = [...new Set([...seenIntro.value, ...types])];
}

export function resetLocalProgress() {
  progress.value = {};
  seenIntro.value = [];
  for (const k of Object.keys(drafts)) delete drafts[k];
  for (const k of Object.keys(hintSteps)) delete hintSteps[k];
  save(KEYS.drafts, null);
  save(KEYS.hints, null);
  save(KEYS.sandbox, null);
}

export { chapters };
