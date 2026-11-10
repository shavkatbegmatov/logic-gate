import { describe, expect, it } from 'vitest';
import { settings } from './state';
import css from './styles.css?raw';
import { instantCheck, resolveTheme, THEME_BG } from './theme';

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
    expect(css.match(/prefers-reduced-motion/g)).toHaveLength(1);
  });
});

const block = (selector: string) => {
  const start = css.indexOf(`${selector} {`);
  return css.slice(start, css.indexOf('\n}', start));
};
const vars = (text: string) => new Map([...text.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

describe('mavzular', () => {
  it("Avto telefon/Telegram rejimiga qaraydi, sukut bo'yicha — Plata", () => {
    expect(resolveTheme(undefined, true)).toBe('plata');
    expect(resolveTheme('plata', true)).toBe('plata');
    expect(resolveTheme('daftar', false)).toBe('daftar');
    expect(resolveTheme('auto', true)).toBe('daftar');
    expect(resolveTheme('auto', false)).toBe('plata');
  });

  it("Daftar Plata'dagi har bir rangni qayta belgilaydi, fon THEME_BG bilan bir xil", () => {
    const plata = vars(block(':root'));
    const daftar = vars(block(":root[data-theme='daftar']"));
    const colors = [...plata.keys()].filter((k) => k !== '--mono' && k !== '--sans');
    expect(colors.filter((k) => !daftar.has(k))).toEqual([]);
    expect(plata.get('--bg')).toBe(THEME_BG.plata);
    expect(daftar.get('--bg')).toBe(THEME_BG.daftar);
  });

  it("mavzulardan tashqarida qattiq yozilgan rang yo'q (o'chirish tugmasidagi oq rangdan tashqari)", () => {
    const rest = css.slice(css.indexOf('\n}', css.indexOf(":root[data-theme='daftar']")));
    const found = [...rest.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(\d[^)]*\)/g)].map((m) => m[0]);
    expect(found.sort()).toEqual(['#fff', 'rgba(255, 255, 255, 0.25)']);
  });
});
