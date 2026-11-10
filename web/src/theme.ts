// Rang mavzusi: Plata (qorong'i, asosiy) yoki Daftar (yorug'). "Avto" — telefon yoki Telegram'ning
// yorug'/qorong'i rejimiga qarab. Ranglar styles.css da; bu yerda faqat <html data-theme> qo'yiladi.
// Birinchi chizishdan oldin xuddi shuni public/theme.js qiladi (sahifa miltillamasin).
import { computed, effect, signal } from '@preact/signals';
import { settings } from './state';

export type Theme = 'plata' | 'daftar' | 'auto';
export type ActiveTheme = Exclude<Theme, 'auto'>;

export const THEMES: Theme[] = ['plata', 'daftar', 'auto'];

/** Mavzu foni: brauzer paneli (theme-color) va Telegram oynasi uchun. styles.css dagi --bg bilan bir xil. */
export const THEME_BG: Record<ActiveTheme, string> = { plata: '#0b1712', daftar: '#efe9dc' };

const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;
const systemLight = signal(media?.matches ?? false);
media?.addEventListener?.('change', (e) => (systemLight.value = e.matches));

/** Telegram'ning rejimi (telegram-app.ts yozadi); Telegram ichida "Avto" shunga qaraydi. */
export const telegramScheme = signal<'light' | 'dark' | null>(null);

export function resolveTheme(theme: Theme | undefined, light: boolean): ActiveTheme {
  if (theme === 'daftar' || theme === 'plata') return theme;
  if (theme === 'auto') return light ? 'daftar' : 'plata';
  return 'plata';
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

if (typeof document !== 'undefined') {
  effect(() => {
    const name = activeTheme.value;
    const root = document.documentElement;
    if (name === 'plata') delete root.dataset.theme;
    else root.dataset.theme = name;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BG[name]);
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
