import { describe, expect, it } from 'vitest';
import { settings } from './state';
import css from './styles.css?raw';
import {
  AAA_THEMES,
  BOARD_MODES,
  CLASSIC_THEMES,
  instantCheck,
  resolveBoardMode,
  resolveRealStyle,
  resolveTheme,
  THEME_BG,
  THEMES,
} from './theme';

// Kam ochiladigan ekranlarning uslublari o'z fayllarida (ekran bilan birga yuklanadi) — ular ham tekshiriladi.
const screenCss = Object.values(import.meta.glob('./screens/*.css', { query: '?raw', import: 'default', eager: true }) as Record<string, string>);
const allCss = [css, ...screenCss].join('\n');

describe('animatsiya', () => {
  it("tekshiruv faqat «O'chirilgan» da darhol; Avto (qurilma «kamroq harakat» desa ham) — o'ynaydi", () => {
    for (const [motion, instant] of [[undefined, false], ['auto', false], ['on', false], ['off', true]] as const) {
      settings.value = { ...settings.value, motion };
      expect(instantCheck()).toBe(instant);
    }
  });

  it("qurilma sozlamasi bezaklarni o'chiradi, «Yoqilgan» buni bekor qiladi, «O'chirilgan» — har doim", () => {
    const media = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(media.slice(0, media.indexOf('\n}'))).toContain(":root:not([data-motion='on']) *");
    const off = css.slice(css.indexOf(":root[data-motion='off'] *"));
    expect(off.slice(0, off.indexOf('}'))).toContain('animation: none !important');
    // Boshqa joyda qurilma sozlamasiga to'g'ridan-to'g'ri qaralmaydi — aks holda «Yoqilgan» ishlamay qoladi.
    expect(allCss.match(/prefers-reduced-motion/g)).toHaveLength(1);
  });
});

const block = (selector: string) => {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, selector).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('\n}', start));
};
/** Sanoat PCB — asosiy blok (:root), qolganlari — atribut bo'yicha. */
const selectorOf = (name: string) => (name === 'pcb' ? ":root,\n[data-theme='pcb']" : `[data-theme='${name}']`);
const NAMES = Object.keys(THEME_BG);
const vars = (text: string) => new Map([...text.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

describe('mavzular va ko\'rinish rejimlari', () => {
  it("Avto telefon/Telegram rejimiga qaraydi, sukut bo'yicha — Sanoat PCB", () => {
    expect(resolveTheme(undefined, true)).toBe('pcb');
    expect(resolveTheme('pcb', true)).toBe('pcb');
    expect(resolveTheme('bench', false)).toBe('bench');
    expect(resolveTheme('breadboard', true)).toBe('breadboard');
    expect(resolveTheme('scifi', false)).toBe('scifi');
    expect(resolveTheme('plata', true)).toBe('plata');
    expect(resolveTheme('daftar', false)).toBe('daftar');
    expect(resolveTheme('auto', true)).toBe('daftar');
    expect(resolveTheme('auto', false)).toBe('pcb');
    expect(resolveTheme('haqiqiy', true)).toBe('haqiqiy');
    expect(resolveTheme('chizma', false)).toBe('chizma');
    // Saqlangan sozlamada noma'lum (yoki meros) nom — Sanoat PCB.
    expect(resolveTheme('constructor' as never, false)).toBe('pcb');
  });

  it("sxema ko'rinishi va real uslub xaritasi to'g'ri", () => {
    expect(BOARD_MODES).toEqual(['real2d', 'real3d', 'schematic']);
    expect(resolveBoardMode(undefined)).toBe('real2d');
    expect(resolveBoardMode('real3d')).toBe('real3d');
    expect(resolveBoardMode('schematic')).toBe('schematic');
    expect(resolveBoardMode('unknown' as never)).toBe('real2d');
    expect(resolveRealStyle('pcb')).toBe('pcb');
    expect(resolveRealStyle('bench')).toBe('bench');
    expect(resolveRealStyle('breadboard')).toBe('breadboard');
    expect(resolveRealStyle('scifi')).toBe('scifi');
    expect(resolveRealStyle('daftar')).toBe('breadboard');
    expect(resolveRealStyle('chizma')).toBe('bench');
  });

  it("Sozlamalardagi ro'yxat: 4 ta AAA + klassik mavzular va Avto", () => {
    expect(AAA_THEMES).toEqual(['pcb', 'bench', 'breadboard', 'scifi']);
    expect(CLASSIC_THEMES).toEqual(['plata', 'haqiqiy', 'daftar', 'chizma', 'auto']);
    expect([...THEMES].sort()).toEqual([...NAMES, 'auto'].sort());
  });

  it("har bir mavzu PCB'dagi har bir rangni qayta belgilaydi (ortiqchasi ham yo'q), fon THEME_BG bilan bir xil", () => {
    const base = vars(block(selectorOf('pcb')));
    const colors = [...base.keys()].filter((k) => k !== '--mono' && k !== '--sans').sort();
    expect(NAMES).toEqual(['pcb', 'bench', 'breadboard', 'scifi', 'plata', 'haqiqiy', 'daftar', 'chizma']);
    for (const name of NAMES) {
      const own = vars(block(selectorOf(name)));
      if (name !== 'pcb') expect([...own.keys()].sort(), name).toEqual(colors);
      expect(own.get('--bg'), name).toBe(THEME_BG[name as keyof typeof THEME_BG]);
    }
  });

  it("mavzulardan tashqarida qattiq yozilgan rang yo'q (o'chirish tugmasidagi oq rangdan tashqari)", () => {
    // Oxirgi mavzu blokidan keyingi hamma narsa.
    const last = Math.max(...NAMES.map((name) => css.indexOf(`\n${selectorOf(name)} {`)));
    expect(screenCss.length).toBeGreaterThan(0);
    expect(screenCss.every((text) => text.length > 100)).toBe(true);
    const rest = css.slice(css.indexOf('\n}', last)) + screenCss.join('\n');
    const found = [...rest.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(\d[^)]*\)/g)].map((m) => m[0]);
    expect(found.sort()).toEqual(['#fff', 'rgba(255, 255, 255, 0.25)']);
  });
});
