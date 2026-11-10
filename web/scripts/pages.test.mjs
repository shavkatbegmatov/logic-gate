import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ru, uz } from '../src/i18n';
import { applyGate } from '../src/sim/sim';
import { GATE_ARITY, GATE_TYPES } from '../src/sim/types';
import { compareExprs, parseExpr, truthTableOf } from '../src/boolexpr.ts';
import { convert } from './numbase.mjs';
import { BASE_EXAMPLES, BASES } from './pages-base.mjs';
import { BINARY, binaryAdd, divisionSteps } from './pages-binary.mjs';
import { TEACHERS } from './pages-teachers.mjs';
import { BOOL, KMAP_COLS, KMAP_GROUPS, SOP_EXAMPLE, SOP_FACTORED, SOP_SIMPLIFIED, sopTerms } from './pages-bool.mjs';
import { CONTENT } from './pages-content.mjs';
import { buildPages, CALC_DEFAULT, gateOut } from './pages.mjs';

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
      'bul-algebrasi/index.html',
      'guide-base.js',
      'guide-bool.js',
      'ikkilik-sanoq-sistemasi/index.html',
      'mantiqiy-elementlar/index.html',
      'oqituvchilar/index.html',
      'robots.txt',
      'ru/algebra-logiki/index.html',
      'ru/dvoichnaya-sistema/index.html',
      'ru/logicheskie-elementy/index.html',
      'ru/sistemy-schisleniya/index.html',
      'ru/uchitelyam/index.html',
      'sanoq-sistemalari/index.html',
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
    expect(files['sitemap.xml'].match(/<loc>/g)).toHaveLength(11);
    expect(files['sitemap.xml']).toContain('<loc>https://example.uz/</loc>');
    expect(uz.home.guideUrl).toBe(CONTENT.uz.path);
    expect(ru.home.guideUrl).toBe(CONTENT.ru.path);
    // O'yindagi "Qo'llanmalar" ro'yxati — har biri haqiqiy sahifa, har til o'z sahifalariga.
    for (const [lang, t] of [['uz', uz], ['ru', ru]]) {
      for (const g of t.guides.items) {
        expect(files[g.url.slice(1) + 'index.html'], g.url).toContain(`<html lang="${lang}">`);
      }
      expect(t.guides.items.length).toBe(4);
    }
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

  it("Bul algebrasi: har bir formula to'g'ri, misollar darajalarning yechimi emas", () => {
    // Qonunlar: har ikki tomoni teng (uz va ru jadvali bir xil formulalar).
    for (const lang of ['uz', 'ru']) {
      const b = BOOL[lang];
      for (const [, and, or] of b.laws.rows)
        for (const law of [and, or]) {
          const [l, r] = law.split(' = ');
          expect(compareExprs(l, r).equal, law).toBe(true);
        }
      // Soddalashtirish: har bir qadam oldingisiga teng.
      for (const steps of b.simplify.steps)
        for (let i = 1; i < steps.length; i++) expect(compareExprs(steps[i - 1][0], steps[i][0]).equal, steps[i][0]).toBe(true);
      expect(b.simplify.steps.map((s) => s.map((x) => x[0]))).toEqual(BOOL.uz.simplify.steps.map((s) => s.map((x) => x[0])));
      expect(b.laws.rows.map((r) => r.slice(1))).toEqual(BOOL.uz.laws.rows.map((r) => r.slice(1)));
      expect(b.title.length).toBeLessThanOrEqual(60);
      expect(b.description.length).toBeLessThanOrEqual(200);
      expect(b.calc.errors).toHaveProperty('unexpected');
    }
    expect(compareExprs(...CALC_DEFAULT).equal).toBe(true);

    // Jadvaldan formula: MDNSh, soddalashtirilgani va Karno guruhlari — misol funksiyasining o'zi.
    const fn = (src) => truthTableOf(src).rows.map((r) => r.q).join('');
    const sop = sopTerms(SOP_EXAMPLE).map((t) => `(${t.term})`).join(' ∨ ');
    expect(fn(sop)).toBe(SOP_EXAMPLE);
    expect(fn(SOP_SIMPLIFIED)).toBe(SOP_EXAMPLE);
    expect(fn(SOP_FACTORED)).toBe(SOP_EXAMPLE);
    expect(fn(KMAP_GROUPS.map((g) => `(${g.term})`).join(' ∨ '))).toBe(SOP_EXAMPLE);
    for (const g of KMAP_GROUPS) {
      const term = parseExpr(g.term);
      for (const cell of g.cells) {
        const [a, bc] = cell.split(',');
        expect(KMAP_COLS).toContain(bc);
        expect(SOP_EXAMPLE[parseInt(a + bc, 2)]).toBe('1');
        expect(truthTableOf(g.term).rows.find((r) => r.env.B === +bc[0] && (r.env.A ?? +a) === +a && (r.env.C ?? +bc[1]) === +bc[1])?.q).toBe(1);
      }
      expect(term.vars.length).toBe(2);
    }
    // Misol o'yindagi birorta darajaning jadvali emas.
    for (const l of pack.levels) for (const t of Object.values(l.target ?? {})) expect(t).not.toBe(SOP_EXAMPLE);

    for (const lang of ['uz', 'ru']) {
      const html = files[BOOL[lang].path.slice(1) + 'index.html'];
      expect(html).toContain('<script src="/guide-bool.js" defer></script>');
      expect(html).toContain('id="bool-calc"');
      expect(html).toContain(`href="/?lang=${lang}#/sandbox/${encodeURIComponent(CALC_DEFAULT[0])}"`);
      expect(html.match(/class="sym"/g)).toHaveLength(9);
      expect(html.match(/<section/g)?.length).toBe(html.match(/<\/section>/g)?.length);
      // Shablonlar ({n}, {row}) faqat skript uchun data-* atributlarida, ko'rinadigan matnda emas.
      expect(html.replace(/data-[a-z-]+="[^"]*"/g, '')).not.toMatch(/undefined|NaN|\[object|\{n\}|\{row\}/);
      expect(html).toContain(`href="${CONTENT[lang].path}"`);
      expect(files[CONTENT[lang].path.slice(1) + 'index.html']).toContain(`href="${BOOL[lang].path}"`);
    }
    // Brauzer skripti: kutubxona va interfeys bitta faylda, export'larsiz.
    expect(files['guide-bool.js']).toContain('function parseExpr(');
    expect(files['guide-bool.js']).toContain("getElementById('bool-calc')");
    expect(files['guide-bool.js']).not.toMatch(/^export /m);
    expect(() => new Function(files['guide-bool.js'])).not.toThrow();
  });

  it("sanoq sistemalari: misollar to'g'ri, kalkulyator va havolalar", () => {
    for (const [n, from, to] of Object.values(BASE_EXAMPLES)) expect(convert(n, from, to).result).toBe(parseInt(n, from).toString(to).toUpperCase());
    for (const lang of ['uz', 'ru']) {
      const b = BASES[lang];
      const html = files[b.path.slice(1) + 'index.html'];
      expect(b.title.length).toBeLessThanOrEqual(60);
      expect(b.description.length).toBeLessThanOrEqual(200);
      expect(html).toContain('<script src="/guide-base.js" defer></script>');
      expect(html).toContain('<strong>2026₁₀ = 7EA₁₆</strong>');
      expect(html).toContain('7EA₁₆ = 7·16² + 14·16¹ + 10·16⁰ = 1792 + 224 + 10 = 2026₁₀');
      expect(html).toContain('<strong>11111101010₂ = 3752₈</strong>');
      expect(html).toContain('<strong>11111101010₂ = 7EA₁₆</strong>');
      // Tanlovlar: 2–16, boshlang'ich — 10 dan 16 ga.
      expect(html.match(/<option value=/g)).toHaveLength(2 * 15);
      expect(html).toContain('<option value="10" selected>');
      expect(html).toContain('<option value="16" selected>');
      // Jadval 0–16 va matnlar ko'rinadigan joyda shablonsiz.
      expect(html).toContain('<td>16</td><td>10000</td><td>20</td><td>10</td>');
      expect(html.replace(/data-[a-z-]+="[^"]*"/g, '')).not.toMatch(/undefined|NaN|\[object|\{to\}|\{from\}|\{n\}/);
      expect(html.match(/<section/g)?.length).toBe(html.match(/<\/section>/g)?.length);
      // Kalkulyator matnlari skript uchun JSON sifatida.
      const labels = JSON.parse(html.match(/data-labels="([^"]*)"/)[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
      expect(labels.division).toBe(b.calc.steps.division);
      // Ikkilik qo'llanmasi bilan o'zaro havola.
      expect(html).toContain(`href="${BINARY[lang].path}"`);
      expect(files[BINARY[lang].path.slice(1) + 'index.html']).toContain(`href="${b.path}"`);
      expect(Object.keys(b.calc.steps).sort()).toEqual(Object.keys(BASES.uz.calc.steps).sort());
      expect(Object.keys(b.calc.errors).sort()).toEqual(['base', 'big', 'digit', 'empty']);
    }
    expect(files['guide-base.js']).toContain('function convert(');
    expect(files['guide-base.js']).toContain("getElementById('base-calc')");
    expect(files['guide-base.js']).not.toMatch(/^export /m);
    expect(() => new Function(files['guide-base.js'])).not.toThrow();
  });

  it("o'qituvchilar sahifasi: darajalar haqiqiy, darslar to'liq, sinf yaratishga havola", () => {
    const ids = new Set(pack.levels.map((l) => l.id));
    for (const lang of ['uz', 'ru']) {
      const b = TEACHERS[lang];
      const html = files[b.path.slice(1) + 'index.html'];
      expect(b.title.length).toBeLessThanOrEqual(60);
      expect(b.description.length).toBeLessThanOrEqual(200);
      expect(html).toContain(`href="/?lang=${lang}#/teacher"`);
      // O'yinga boshqa havolalar ham sahifa tilida (tilsiz qolgani yo'q).
      expect(html).toContain(`href="/?lang=${lang}"`);
      expect(html).not.toMatch(/href="\/(#\/[^"]*)?"/);
      expect(html.match(/<article class="lesson">/g)).toHaveLength(b.lessons.items.length);
      for (const x of b.lessons.items) {
        for (const id of [...x.inClass, ...x.homework]) expect(ids.has(id), id).toBe(true);
        // 45 daqiqa — bosqichlar yig'indisi.
        expect(x.plan.reduce((s, [m]) => s + m, 0), x.title).toBe(45);
        expect(x.plan.some(([, t]) => t.includes('{inClass}'))).toBe(true);
      }
      // uz va ru darslari bir xil darajalar bilan.
      expect(b.lessons.items.map((x) => [x.inClass, x.homework, x.guide])).toEqual(TEACHERS.uz.lessons.items.map((x) => [x.inClass, x.homework, x.guide]));
      expect(html).not.toMatch(/undefined|NaN|\[object|\{inClass\}/);
      expect(html.match(/<section/g)?.length).toBe(html.match(/<\/section>/g)?.length);
      // Daraja raqami va nomi joriy tilda: 1-daraja.
      const first = pack.levels[0];
      expect(html).toContain(`<span class="lvl">1. ${lang === 'uz' ? first.title : first.i18n.ru.title}</span>`);
    }
  });
});
