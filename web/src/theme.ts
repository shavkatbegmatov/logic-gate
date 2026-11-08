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

export const activeTheme = computed(() =>
  resolveTheme(settings.value.theme, telegramScheme.value ? telegramScheme.value === 'light' : systemLight.value),
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
