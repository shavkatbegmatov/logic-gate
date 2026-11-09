import { describe, expect, it } from 'vitest';
import { routeName, shouldReport } from './errors';

describe('brauzer xatolari', () => {
  it("faqat o'yin bundle'idagi xatolar, shovqinsiz", () => {
    const site = 'https://logic.noesis.uz';
    const ours = 'TypeError: x\n    at f (https://logic.noesis.uz/assets/index-AbC123.js:1:200)';
    const report = (msg: string, stack: string, file = '') => shouldReport(msg, stack, file, site);
    expect(report('TypeError: x', ours)).toBe(true);
    expect(report('TypeError: x', '', 'https://logic.noesis.uz/assets/index-AbC123.js')).toBe(true);
    // Vite bilan yig'ilgan kengaytma ham /assets/ ishlatadi — lekin bu bizning sayt emas.
    expect(report('TypeError: x', 'at x (chrome-extension://abc/assets/content.js:1:1)')).toBe(false);
    // Kengaytma, Telegram skripti, tarmoq va ma'lum shovqinlar — yo'q.
    expect(report('TypeError: x', 'at chrome-extension://abc/content.js:1:1')).toBe(false);
    expect(report('TypeError: x', 'at https://telegram.org/js/telegram-web-app.js:1:1')).toBe(false);
    expect(report('Script error.', '')).toBe(false);
    expect(report('ResizeObserver loop completed with undelivered notifications.', ours)).toBe(false);
    expect(report('TypeError: Failed to fetch', ours)).toBe(false);
    expect(report('', ours)).toBe(false);
    expect(shouldReport('TypeError: x', ours, '', '')).toBe(false);
  });

  it('ekran nomi — kodlarsiz', () => {
    expect(routeName('#/class/ABC123')).toBe('class');
    expect(routeName('#/sandbox/%C2%AC(A)')).toBe('sandbox');
    expect(routeName('#/')).toBe('home');
    expect(routeName('')).toBe('home');
    expect(routeName('#/p/eyJ0IjoiMSJ9')).toBe('p');
  });
});
