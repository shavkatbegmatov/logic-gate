import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ru, uz } from '../src/i18n';
import { applyGate } from '../src/sim/sim';
import { GATE_ARITY, GATE_TYPES } from '../src/sim/types';
import { CONTENT } from './pages-content.mjs';
import { buildPages, gateOut } from './pages.mjs';

const pack = JSON.parse(readFileSync(new URL('../../levels/levels.json', import.meta.url), 'utf8'));
const files = buildPages({ site: 'https://example.uz/', tgApp: 'https://t.me/Bot/play', pack });

describe("qo'llanma sahifalari", () => {
  it("haqiqat jadvallari o'yin simulyatori bilan bir xil", () => {
    for (const type of GATE_TYPES)
      for (let a = 0; a < 2; a++)
        for (let b = 0; b < (GATE_ARITY[type] === 2 ? 2 : 1); b++) expect(gateOut(type, a, b), `${type} ${a}${b}`).toBe(applyGate(type, a, b));
  });

  it('har ikki tilda hamma element, sarlavha, canonical va hreflang', () => {
    expect(Object.keys(files).sort()).toEqual(['mantiqiy-elementlar/index.html', 'robots.txt', 'ru/logicheskie-elementy/index.html', 'sitemap.xml']);
    for (const c of Object.values(CONTENT)) {
      const html = files[c.path.slice(1) + 'index.html'];
      expect(c.gates.map((g) => g.type)).toEqual(GATE_TYPES);
      expect(html).toContain(`<html lang="${c.lang}">`);
      expect(html).toContain(`<link rel="canonical" href="https://example.uz${c.path}">`);
      expect(html).toContain('hreflang="uz" href="https://example.uz/mantiqiy-elementlar/"');
      expect(html).toContain('hreflang="ru" href="https://example.uz/ru/logicheskie-elementy/"');
      for (const g of c.gates) expect(html).toContain(`<section id="${g.type.toLowerCase()}">`);
      // Har bir element uchun jadval va belgi; D-trigger alohida.
      expect(html.match(/<table class="truth">/g)).toHaveLength(GATE_TYPES.length);
      expect(html.match(/<svg class="gate"/g)).toHaveLength(GATE_TYPES.length + 1);
      expect(html.match(/<section/g)?.length).toBe(html.match(/<\/section>/g)?.length);
      expect(html).toContain('href="https://t.me/Bot/play"');
      expect(html).not.toMatch(/undefined|NaN|\[object/);
      expect(c.title.length).toBeLessThanOrEqual(60);
      expect(c.description.length).toBeLessThanOrEqual(200);
      // Bo'limlar ro'yxati darajalar faylidan.
      expect(html.match(/<li><b>/g)).toHaveLength(pack.chapters.length);
      const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
      expect(ld['@graph'][0].inLanguage).toBe(c.lang);
    }
    expect(files['ru/logicheskie-elementy/index.html']).toContain(`${pack.chapters.length} глав, ${pack.levels.length} уровня:`);
  });

  it("robots.txt, sitemap va o'yindagi havolalar", () => {
    expect(files['robots.txt']).toContain('Sitemap: https://example.uz/sitemap.xml');
    expect(files['robots.txt']).toContain('Disallow: /api/');
    expect(files['sitemap.xml'].match(/<loc>/g)).toHaveLength(3);
    expect(files['sitemap.xml']).toContain('<loc>https://example.uz/</loc>');
    expect(uz.home.guideUrl).toBe(CONTENT.uz.path);
    expect(ru.home.guideUrl).toBe(CONTENT.ru.path);
  });
});
