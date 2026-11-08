import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ru, uz } from '../src/i18n';
import { applyGate } from '../src/sim/sim';
import { GATE_ARITY, GATE_TYPES } from '../src/sim/types';
import { BINARY, binaryAdd, divisionSteps } from './pages-binary.mjs';
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
    expect(Object.keys(files).sort()).toEqual([
      'ikkilik-sanoq-sistemasi/index.html',
      'mantiqiy-elementlar/index.html',
      'robots.txt',
      'ru/dvoichnaya-sistema/index.html',
      'ru/logicheskie-elementy/index.html',
      'sitemap.xml',
    ]);
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
    expect(files['sitemap.xml'].match(/<loc>/g)).toHaveLength(5);
    expect(files['sitemap.xml']).toContain('<loc>https://example.uz/</loc>');
    expect(uz.home.guideUrl).toBe(CONTENT.uz.path);
    expect(ru.home.guideUrl).toBe(CONTENT.ru.path);
  });

  it("ikkilik sanoq sistemasi: misollar to'g'ri, sahifalar bir-biriga havola", () => {
    for (let n = 0; n < 300; n++) expect(divisionSteps(n).bin).toBe(n.toString(2));
    for (const [a, b] of [['0110', '0111'], ['1', '1'], ['1111', '1'], ['101', '11']]) {
      expect(parseInt(binaryAdd(a, b).sum, 2)).toBe(parseInt(a, 2) + parseInt(b, 2));
    }
    for (const lang of ['uz', 'ru']) {
      const html = files[BINARY[lang].path.slice(1) + 'index.html'];
      expect(html).toContain('<strong>13 = 1101₂</strong>');
      expect(html).toContain('<strong>101101₂ = 32 + 8 + 4 + 1 = 45</strong>');
      expect(html).toContain('<td class="dec">13</td>');
      expect(html).toContain('<script src="/guide-binary.js" defer></script>');
      expect(html.match(/class="bit"/g)).toHaveLength(8);
      expect(html).toContain(`href="${CONTENT[lang].path}"`);
      expect(html).not.toMatch(/undefined|NaN|\[object/);
      expect(BINARY[lang].title.length).toBeLessThanOrEqual(60);
      // Elementlar qo'llanmasidan ham bu sahifaga havola bor.
      expect(files[CONTENT[lang].path.slice(1) + 'index.html']).toContain(`href="${BINARY[lang].path}"`);
    }
  });
});
