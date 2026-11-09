import { describe, expect, it } from 'vitest';
import md from '../../CHANGELOG.md?raw';
import pkg from '../package.json';
import { CHANGELOG } from './changelog';
import { APP_VERSION, hasNews, markNewsSeen, newsFor, seenVersion } from './version';

const semver = (v: string) => v.split('.').map(Number);
const newer = (a: string, b: string) => {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

describe('versiya va yangiliklar', () => {
  it("package.json versiyasi — yangiliklardagi eng so'nggisi", () => {
    expect(pkg.version).toBe(CHANGELOG[0].version);
    expect(APP_VERSION).toBe(pkg.version);
  });

  it("versiyalar kamayib boradi, sanalar to'g'ri, uz va ru qatorlari teng", () => {
    for (let i = 0; i < CHANGELOG.length; i++) {
      const r = CHANGELOG[i];
      expect(r.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.uz.length, r.version).toBe(r.ru.length);
      expect(r.uz.length).toBeGreaterThan(0);
      if (i > 0) {
        expect(newer(CHANGELOG[i - 1].version, r.version), r.version).toBe(true);
        expect(CHANGELOG[i - 1].date >= r.date).toBe(true);
      }
    }
  });

  it("CHANGELOG.md o'yindagi ro'yxat bilan bir xil", () => {
    for (const r of CHANGELOG) {
      expect(md).toContain(`## ${r.version} — ${r.date}`);
      for (const line of r.uz) expect(md).toContain(`- ${line}`);
    }
  });

  it("yangi o'yinchiga xabar chiqmaydi, qaytgan o'yinchiga — bir marta", () => {
    seenVersion.value = null;
    expect(newsFor(false)).toBe(false);
    expect(hasNews.value).toBe(false);
    seenVersion.value = '1.3.0';
    expect(newsFor(true)).toBe(true);
    markNewsSeen();
    expect(newsFor(true)).toBe(false);
  });
});
