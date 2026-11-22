import { describe, expect, it } from 'vitest';
import md from '../../CHANGELOG.md?raw';
import pkg from '../package.json';
import { CHANGELOG, headline, type Release } from './changelog';
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

describe("bosh sahifadagi xabar: ko'rilmaganlar orasidagi eng muhim yangilik", () => {
  const r = (version: string): Release => ({ version, date: '2026-11-23', uz: [version], ru: [version] });
  const list = [r('2.19.1'), r('2.19.0'), r('2.18.13'), r('2.18.0'), r('2.17.5')];

  it("kichik tuzatish undan oldingi yangi imkoniyatni yashirmaydi", () => {
    expect(headline('2.18.13', list).version).toBe('2.19.0');
    expect(headline('2.17.5', list).version).toBe('2.19.0'); // ikkita yangi imkoniyat — eng yangisi
  });

  it("ko'rilmaganlar faqat tuzatish bo'lsa — eng so'nggisi", () => {
    expect(headline('2.19.0', list).version).toBe('2.19.1');
  });

  it("noma'lum yoki kelajakdagi versiya — eng so'nggisi", () => {
    expect(headline(null, list).version).toBe('2.19.1');
    expect(headline('9.9.9', list).version).toBe('2.19.1');
  });

  it("versiyalar son sifatida solishtiriladi (2.10.0 > 2.9.3)", () => {
    expect(headline('2.9.3', [r('2.10.1'), r('2.10.0'), r('2.9.3')]).version).toBe('2.10.0');
  });
});
