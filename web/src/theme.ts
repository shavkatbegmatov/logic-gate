// Rang mavzusi va sxema ko'rinishi:
// 4 ta AAA studiya uslubi (Sanoat PCB, Laboratoriya stoli, Maket platasi, Kiber Sci-Fi) hamda
// 4 ta klassik o'quv mavzusi (Plata, Haqiqiy plata, Daftar, Chizma) + Avto.
// Sxema ko'rinishi (boardMode): 2D Real (sukut bo'yicha), 3D Real (WebGL) va Klassik sxema.
// Ranglar styles.css da; bu yerda <html data-theme> va <html data-board> qo'yiladi.
// Birinchi chizishdan oldin xuddi shuni public/theme.js qiladi (sahifa miltillamasin).
import { computed, effect, signal } from '@preact/signals';
import { settings } from './state';

export type ActiveTheme = 'pcb' | 'bench' | 'breadboard' | 'scifi' | 'plata' | 'haqiqiy' | 'daftar' | 'chizma';
export type Theme = ActiveTheme | 'auto';

export const AAA_THEMES: ActiveTheme[] = ['pcb', 'bench', 'breadboard', 'scifi'];
export const CLASSIC_THEMES: Theme[] = ['plata', 'haqiqiy', 'daftar', 'chizma', 'auto'];
export const THEMES: Theme[] = [...AAA_THEMES, ...CLASSIC_THEMES];

/** Mavzu foni: brauzer paneli (theme-color) va Telegram oynasi uchun. styles.css dagi --bg bilan bir xil. */
export const THEME_BG: Record<ActiveTheme, string> = {
  pcb: '#07130f',
  bench: '#101418',
  breadboard: '#ebe6da',
  scifi: '#060b16',
  plata: '#0b1712',
  haqiqiy: '#062a1c',
  daftar: '#efe9dc',
  chizma: '#f3f0e7',
};

export type BoardMode = 'real2d' | 'real3d' | 'schematic';
export const BOARD_MODES: BoardMode[] = ['real2d', 'real3d', 'schematic'];
export type RealStyle = 'pcb' | 'bench' | 'breadboard' | 'scifi';

export function resolveBoardMode(mode: BoardMode | undefined): BoardMode {
  return mode === 'real2d' || mode === 'real3d' || mode === 'schematic' ? mode : 'real2d';
}

export function resolveRealStyle(theme: ActiveTheme): RealStyle {
  if (theme === 'bench' || theme === 'chizma') return 'bench';
  if (theme === 'breadboard' || theme === 'daftar') return 'breadboard';
  if (theme === 'scifi') return 'scifi';
  return 'pcb';
}

export function isAaaTheme(theme: ActiveTheme): boolean {
  return theme === 'pcb' || theme === 'bench' || theme === 'breadboard' || theme === 'scifi';
}

/**
 * Mavzu tanlanganda sxema ko'rinishi ham almashadimi: klassik o'quv mavzusi (Plata, Daftar…) — klassik
 * sxema; AAA uslubi klassik sxemadan tanlansa — 2D Real; qolgan hollarda (Avto ham) — o'zgarmaydi
 * (undefined). Sozlamalar va maydondagi uslub menyusi (ViewTools) bir xil ishlashi uchun bitta joyda.
 */
export function boardModeForTheme(next: Theme, mode: BoardMode): BoardMode | undefined {
  if (next === 'auto') return undefined;
  if (!isAaaTheme(next)) return 'schematic';
  return mode === 'schematic' ? 'real2d' : undefined;
}

const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;
const systemLight = signal(media?.matches ?? false);
media?.addEventListener?.('change', (e) => (systemLight.value = e.matches));

/** Telegram'ning rejimi (telegram-app.ts yozadi); Telegram ichida "Avto" shunga qaraydi. */
export const telegramScheme = signal<'light' | 'dark' | null>(null);

export function resolveTheme(theme: Theme | undefined, light: boolean): ActiveTheme {
  if (theme === 'auto') return light ? 'daftar' : 'pcb';
  return theme && Object.prototype.hasOwnProperty.call(THEME_BG, theme) ? theme : 'pcb';
}

/** Chop etilayotganda (Ctrl+P yoki "Chop etish") — har doim Daftar: qorong'i fon qog'ozga chiqmasin. */
const printing = signal(false);
if (typeof window !== 'undefined') {
  addEventListener('beforeprint', () => (printing.value = true));
  addEventListener('afterprint', () => (printing.value = false));
}

export const activeTheme = computed(() =>
  printing.value
    ? 'daftar'
    : resolveTheme(settings.value.theme, telegramScheme.value ? telegramScheme.value === 'light' : systemLight.value),
);

export const activeBoardMode = computed<BoardMode>(() =>
  printing.value ? 'schematic' : resolveBoardMode(settings.value.boardMode),
);

if (typeof document !== 'undefined') {
  effect(() => {
    const name = activeTheme.value;
    const root = document.documentElement;
    if (name === 'pcb') delete root.dataset.theme;
    else root.dataset.theme = name;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BG[name]);
  });
  effect(() => {
    document.documentElement.dataset.board = activeBoardMode.value;
  });
}

/**
 * Animatsiya. "Avto": qurilma "kamroq harakat" desa (Windows'da "Animatsiya effektlari" o'chiq — ishxona
 * va maktab kompyuterlarida ko'pincha tizim siyosati bilan; telefonda "Harakatni kamaytirish"), bezak
 * harakatlari (CSS) o'chadi, tekshiruv esa qatorma-qator o'ynayveradi: u bezak emas — natijani ko'rsatadi,
 * va unda siljish yo'q, faqat rang almashadi. "Yoqilgan" — qurilma sozlamasidan qat'i nazar hammasi,
 * "O'chirilgan" — hech narsa, tekshiruv natijasi darhol. CSS: <html data-motion> (styles.css oxiri).
 */
export type Motion = 'on' | 'off' | 'auto';
export const MOTIONS: Motion[] = ['on', 'off', 'auto'];

const motionMedia = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
/** Qurilmada animatsiya kamaytirilgan (Sozlamalarda izoh uchun). */
export const systemReducedMotion = signal(motionMedia?.matches ?? false);
motionMedia?.addEventListener?.('change', (e) => (systemReducedMotion.value = e.matches));

/** Tekshiruv animatsiyasiz — natija darhol. */
export const instantCheck = () => settings.peek().motion === 'off';

if (typeof document !== 'undefined') {
  effect(() => {
    const m = settings.value.motion;
    if (m === 'on' || m === 'off') document.documentElement.dataset.motion = m;
    else delete document.documentElement.dataset.motion;
  });
}
