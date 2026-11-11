import { describe, expect, it } from 'vitest';

// Brauzerning o'z oynalari (confirm, alert, prompt) mavzuga mos emas, tugmalari brauzer tilida, Telegram
// ichida esa ishonchsiz. O'rniga — components/Dialogs.tsx: askConfirm (tasdiqlash), showCopy (nusxalab
// bo'lmagan matn). Testlar o'zi tekshirilmaydi.
const sources = import.meta.glob(['./**/*.ts', './**/*.tsx', '!./**/*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Izohlarsiz kod (`https://` dagi `//` izoh emas). */
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** `confirm('…')`, `window.prompt(x, y)`, `alert(t.x)` — argumentli chaqiruv; `e.prompt()` (o'rnatish so'rovi) emas. */
const NATIVE = /(?<![\w.$])(?:window\.)?(?:confirm|alert|prompt)\s*\(\s*[^)\s]/g;

describe('brauzer oynalari', () => {
  it("andoza chaqiruvlarni topadi, o'xshashlarini emas", () => {
    const hits = (text: string) => [...code(text).matchAll(NATIVE)].length;
    expect(hits("if (!confirm(t.x)) return;")).toBe(1);
    expect(hits('else window.prompt(t.share.copyManual, text);')).toBe(1);
    expect(hits("alert('salom')")).toBe(1);
    expect(hits('await e.prompt();')).toBe(0);
    expect(hits('  prompt(): Promise<void>;')).toBe(0);
    expect(hits('// confirm(t.x) — eski usul')).toBe(0);
    expect(hits('const askConfirm = (opts) => open(opts);')).toBe(0);
  });

  it("o'yin kodida confirm/alert/prompt yo'q — o'rniga components/Dialogs.tsx", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
    const found = Object.entries(sources).flatMap(([file, text]) => [...code(text).matchAll(NATIVE)].map((m) => `${file}: ${m[0]}`));
    expect(found).toEqual([]);
  });
});
