// Qidiruv tizimlari uchun statik fayllar (build oxirida, dist/ ga):
//   /mantiqiy-elementlar/, /ru/logicheskie-elementy/        — mantiqiy elementlar qo'llanmasi
//   /ikkilik-sanoq-sistemasi/, /ru/dvoichnaya-sistema/       — ikkilik sanoq sistemasi (+ public/guide-binary.js)
//   /bul-algebrasi/, /ru/algebra-logiki/                     — Bul algebrasi (+ /guide-bool.js: src/boolexpr.ts + guide-bool-ui.js)
//   /sanoq-sistemalari/, /ru/sistemy-schisleniya/            — sanoq sistemalari (+ /guide-base.js: numbase.mjs + guide-base-ui.js)
//   /oqituvchilar/, /ru/uchitelyam/                          — o'qituvchilar uchun: sinf rejimi va dars ishlanmalari
//   /robots.txt, /sitemap.xml
// O'yin hash marshrutli SPA: qidiruv tizimi undan faqat bosh sahifani ko'radi. Bu sahifalar esa
// JavaScript'siz o'qiladigan oddiy HTML — element belgilari o'yindagi bilan bir xil (src/board/shapes.ts),
// ranglar va uslub — o'yinning Plata mavzusi, yorug' tizim rejimida — Daftar (src/styles.css): bloklar
// hoshiya bilan emas, sirt tusi bilan ajraladi (--panel — bo'lim, --ctl — uning ustidagi tugma va
// katakchalar; --edge Plata'da shaffof, Daftar'da ingichka chiziq), urg'u rangi bitta (--on).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DFF_BODY, inputLeads, leadEnd, outputY, SHAPE_H, SHAPE_W, SHAPES } from '../src/board/shapes.ts';
import { calcTableHtml, compareExprs, evalExpr, parseExpr, rowsOf } from '../src/boolexpr.ts';
import { convert, MAX_BASE, MIN_BASE, stepsHtml, sub } from './numbase.mjs';
import { BASE_EXAMPLES, BASES } from './pages-base.mjs';
import { BINARY, binaryAdd, divisionSteps, EXAMPLES } from './pages-binary.mjs';
import { TEACHERS } from './pages-teachers.mjs';
import { BOOL, KMAP_COLS, KMAP_GROUPS, SOP_EXAMPLE, SOP_FACTORED, SOP_SIMPLIFIED, sopTerms } from './pages-bool.mjs';
import { CONTENT } from './pages-content.mjs';

const OUT = { NOT: (a) => 1 - a, AND: (a, b) => a & b, OR: (a, b) => a | b, XOR: (a, b) => a ^ b };
OUT.NAND = (a, b) => 1 - OUT.AND(a, b);
OUT.NOR = (a, b) => 1 - OUT.OR(a, b);
OUT.XNOR = (a, b) => 1 - OUT.XOR(a, b);

/** Element chiqishi (jadval uchun). Testda o'yin simulyatori bilan solishtiriladi. */
export const gateOut = (type, a, b) => OUT[type](a, b);

/** D-trigger namunasi: D ketma-ketligi va Q (bir takt kechikkan, boshida 0). */
export const DFF_EXAMPLE = [1, 0, 1, 1, 0, 0];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonLd = (data) => JSON.stringify(data).replace(/</g, '\\u003c');
const short = (title) => title.split(' — ')[0];

function gateSvg(type, label) {
  const parts = [];
  for (const y of inputLeads(type)) parts.push(`<line class="lead" x1="0" y1="${y}" x2="${leadEnd(type)}" y2="${y}"/>`);
  if (type === 'DFF') {
    const d = DFF_BODY;
    parts.push(`<line class="lead" x1="${d.out}" y1="${outputY(type)}" x2="${SHAPE_W}" y2="${outputY(type)}"/>`);
    parts.push(`<rect class="body" x="${d.x}" y="${d.y}" width="${d.w}" height="${d.h}" rx="${d.rx}"/>`);
    parts.push(`<path class="back" d="${d.clock}"/>`);
    parts.push(`<text x="37" y="25" class="in-label">DFF</text>`);
  } else {
    const s = SHAPES[type];
    parts.push(`<line class="lead" x1="${s.bubble ? s.tip + 8 : s.tip}" y1="24" x2="${SHAPE_W}" y2="24"/>`);
    if (s.back) parts.push(`<path class="back" d="${s.back}"/>`);
    parts.push(`<path class="body" d="${s.body}"/>`);
    if (s.bubble) parts.push(`<circle class="body" cx="${s.tip + 4}" cy="24" r="4"/>`);
  }
  const ins = type === 'DFF' ? ['D'] : inputLeads(type).length === 1 ? ['A'] : ['A', 'B'];
  inputLeads(type).forEach((y, i) => parts.push(`<text x="-8" y="${y + 1}">${ins[i]}</text>`));
  parts.push(`<text x="${SHAPE_W + 9}" y="${outputY(type) + 1}">Q</text>`);
  return `<svg class="gate" viewBox="-16 0 ${SHAPE_W + 32} ${SHAPE_H}" width="208" height="${Math.round((208 * SHAPE_H) / (SHAPE_W + 32))}" role="img" aria-label="${esc(label)}">${parts.join('')}</svg>`;
}

function truthTable(type, caption) {
  const two = inputLeads(type).length === 2;
  const head = (two ? ['A', 'B'] : ['A']).map((h) => `<th>${h}</th>`).join('') + '<th class="out">Q</th>';
  const rows = [];
  for (let r = 0; r < (two ? 4 : 2); r++) {
    const a = two ? r >> 1 : r;
    const b = r & 1;
    const cells = (two ? [a, b] : [a]).map((v) => `<td>${v}</td>`).join('');
    const q = gateOut(type, a, b);
    rows.push(`<tr>${cells}<td class="out${q ? ' one' : ''}">${q}</td></tr>`);
  }
  return `<table class="truth"><caption>${esc(caption)}</caption><thead><tr>${head}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

function dffTable(c) {
  const q = [0, ...DFF_EXAMPLE.slice(0, -1)];
  const row = (name, vals, cls = '') =>
    `<tr><th>${name}</th>${vals.map((v) => `<td class="${cls}${v && cls ? ' one' : ''}">${v}</td>`).join('')}</tr>`;
  return `<div class="scroll-x"><table class="truth steps"><tbody>${row(c.memory.step, DFF_EXAMPLE.map((_, i) => i + 1))}${row('D', DFF_EXAMPLE)}${row('Q', q, 'out')}</tbody></table></div>`;
}

const CSS = `
:root{--bg:#0b1712;--panel:#11241b;--ctl:#19352a;--edge:transparent;--line:#223d31;--text:#ecf1e7;--muted:#9cb2a5;--on:#ffb23e;--on-ink:#231503;--copper:#c68a57;--fill:#132b21;--stroke:#6fc79b;--lead:#4b7663;--tint:#26291a;--mono:ui-monospace,'Cascadia Mono','SF Mono',Consolas,Menlo,monospace;color-scheme:dark}
@media (prefers-color-scheme:light){:root{--bg:#efe9dc;--panel:#f8f4ea;--ctl:#fffdf8;--edge:#d9cfba;--line:#ddd4c0;--text:#1d2939;--muted:#5a6475;--on:#2253b0;--on-ink:#ffffff;--copper:#a35f2a;--fill:#fffdf7;--stroke:#2a3550;--lead:#8d96a5;--tint:#fbf0d9;color-scheme:light}}
*{box-sizing:border-box}
[hidden]{display:none!important}
body{margin:0;background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased;font:16px/1.6 system-ui,-apple-system,'Segoe UI',Roboto,'Noto Sans',sans-serif}
a{color:var(--on)}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:820px;margin:0 auto;padding:12px 16px;border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:8px;color:var(--text);font-weight:700;text-decoration:none}
.top nav{display:flex;gap:16px;font-size:15px}
main{max-width:820px;margin:0 auto;padding:8px 16px 32px}
h1{font-size:36px;line-height:1.12;letter-spacing:-.02em;margin:28px 0 12px;text-wrap:balance}
h2{font-size:22px;line-height:1.25;letter-spacing:-.01em;margin:0 0 12px}
section{margin:24px 0;padding:20px;border:1px solid var(--edge);border-radius:16px;background:var(--panel)}
.lead{font-size:17px;color:var(--text)}
.muted{color:var(--muted)}
code{font-family:var(--mono);white-space:nowrap}
.cta{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 6px}
.btn{display:inline-block;padding:12px 20px;border:1px solid var(--edge);border-radius:12px;background:var(--ctl);color:var(--text);text-decoration:none;font-weight:600}
.btn.primary{background:var(--on);border-color:var(--on);color:var(--on-ink)}
.toc{display:flex;flex-wrap:wrap;gap:8px;margin:22px 0 0;padding:0;list-style:none}
.toc a{display:inline-block;padding:5px 12px;border:1px solid var(--edge);border-radius:999px;background:var(--panel);color:var(--text);text-decoration:none;font-size:14px}
.toc a:hover{background:var(--ctl)}
.gate-row{display:flex;flex-wrap:wrap;align-items:center;gap:12px 28px;margin:4px 0 12px}
figure{margin:0;text-align:center}
figcaption,.formula{font:600 18px var(--mono);color:var(--on)}
svg.gate{display:block;max-width:100%;height:auto}
svg.gate .lead{stroke:var(--lead);stroke-width:2.4}
svg.gate .body{fill:var(--fill);stroke:var(--stroke);stroke-width:2.6;stroke-linejoin:round}
svg.gate .back{fill:none;stroke:var(--stroke);stroke-width:2.6;stroke-linecap:round}
svg.gate text{fill:var(--muted);font:700 9px var(--mono);text-anchor:middle;dominant-baseline:central}
svg.gate text.in-label{fill:var(--text)}
.truth{border-collapse:collapse;font:15px var(--mono);text-align:center}
.truth caption{caption-side:top;font:13px system-ui,sans-serif;color:var(--muted);padding-bottom:4px}
.truth th,.truth td{min-width:40px;padding:5px 10px;border:1px solid var(--line)}
.truth th{color:var(--muted);font-weight:600}
.truth .out{color:var(--text)}
.truth td.one{color:var(--on);font-weight:700}
.steps th{text-align:left}
.scroll-x{overflow-x:auto;margin:4px 0 12px}
.laws{display:grid;grid-template-columns:max-content 1fr;gap:8px 16px;margin:0 0 12px}
.laws dt{color:var(--muted)}
.laws dd{margin:0;font:15px var(--mono)}
.tip{margin:0;padding:10px 12px;border-radius:10px;background:var(--tint)}
.tip .ico{vertical-align:-3px;fill:none;stroke:var(--on);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.guides{display:flex;flex-wrap:wrap;gap:8px 18px;max-width:820px;margin:0 auto;padding:10px 16px;font-size:14px;border-bottom:1px solid var(--line)}
.guides span{color:var(--text);font-weight:600}
.guides a{color:var(--muted);text-decoration:none}
.guides a:hover{color:var(--on)}
.bits{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:6px;margin:14px 0 10px}
.bit{display:grid;justify-items:center;gap:4px;padding:8px 0 10px;border:1px solid var(--edge);border-radius:10px;background:var(--ctl);color:var(--muted);font:600 12px var(--mono);cursor:pointer}
.bit .v{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;border:2px solid var(--line);color:var(--text);font-size:15px}
.bit[aria-pressed=true]{border-color:var(--on)}
.bit[aria-pressed=true] .v{background:var(--on);border-color:var(--on);color:var(--on-ink)}
.bits-out{font:600 20px var(--mono)}
.bits-out code{letter-spacing:.08em}
.bits-in{display:flex;flex-wrap:wrap;align-items:center;gap:8px;color:var(--muted);font-size:14px}
.bits-in input{width:96px;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--text);font:600 16px var(--mono)}
.bin-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:6px;margin:4px 0 12px}
.bin-grid span{display:flex;justify-content:space-between;align-items:baseline;gap:6px;padding:6px 10px;border:1px solid var(--edge);border-radius:8px;background:var(--ctl)}
.bin-grid b{font:600 15px var(--mono)}
.bin-grid code{color:var(--on);font-size:14px}
.truth.column td{min-width:34px}
.truth.column .carry td{color:var(--copper);font-size:12px;border-color:transparent}
.truth.column .carry th{font:12px system-ui,sans-serif}
.truth.column .sum td{border-top:2px solid var(--text)}
.truth.column td.dec{color:var(--muted);border:none;text-align:left}
@media (max-width:560px){.bits{gap:4px}.bit .v{width:24px;height:24px;font-size:13px}.bit{font-size:10px}}
.calc{display:grid;gap:8px}
.calc label{font-size:14px;color:var(--muted)}
.calc input{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--text);font:600 18px var(--mono)}
.calc input:focus{outline:2px solid var(--on);outline-offset:1px}
.syms{display:flex;flex-wrap:wrap;gap:6px}
.sym{min-width:42px;height:38px;padding:0 10px;border:1px solid var(--edge);border-radius:8px;background:var(--ctl);color:var(--text);font:600 17px var(--mono);cursor:pointer}
.sym:hover{border-color:var(--on)}
.verdict{margin:4px 0 0;font-weight:600}
.verdict.ok{color:var(--stroke)}
.verdict.bad{color:var(--on)}
.calc-table tr.differ td{background:var(--tint)}
.ops td:nth-child(2),.ops td:nth-child(3){font-family:var(--mono)}
.wide{border-collapse:collapse;width:100%;font-size:15px}
.wide th,.wide td{padding:7px 10px;border:1px solid var(--line);text-align:left;vertical-align:top}
.wide th{color:var(--muted);font-weight:600}
.wide code{white-space:normal}
@media (max-width:560px){.wide thead{display:none}.wide,.wide tbody,.wide tr,.wide td{display:block;width:100%}.wide tr{padding:8px 0;border-bottom:1px solid var(--line)}.wide td{border:none;padding:2px 0}.wide td:first-child{font-weight:600}.wide td[colspan]{padding-top:4px}}
.chain{margin:0 0 14px;padding:0;list-style:none}
.chain li{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;padding:3px 0}
.chain code{font-size:16px}
.chain li+li code::before{content:'= ';color:var(--muted)}
.chain span{color:var(--muted);font-size:14px}
.truth tr.hl td{background:var(--tint)}
.kmap td{min-width:52px}
.kmap td.g1{box-shadow:inset 0 0 0 2px var(--stroke)}
.kmap td.g2{box-shadow:inset 0 -4px 0 var(--copper)}
.kmap td.g1.g2{box-shadow:inset 0 0 0 2px var(--stroke),inset 0 -6px 0 var(--copper)}
.legend{margin:0 0 12px;padding-left:20px}
.legend .g1{color:var(--stroke)}
.legend .g2{color:var(--copper)}
.formula-line{font:600 17px var(--mono);overflow-wrap:anywhere}
.base-row{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px 10px}
.base-row label{display:grid;gap:4px}
.calc select{min-width:150px;padding:9px 10px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--text);font:600 15px system-ui,sans-serif}
.answer{font:600 20px var(--mono);margin:12px 0 0}
.answer strong{color:var(--on)}
.groups td{min-width:56px}
.base-table td:nth-child(n+2){font-family:var(--mono)}
.features{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin:0;padding:0;list-style:none}
.features li{padding:12px 14px;border:1px solid var(--edge);border-radius:12px;background:var(--ctl)}
.features b{display:block;margin-bottom:4px}
.steps-list{padding-left:22px}
.steps-list li{margin:6px 0}
.lesson{margin:18px 0 0;padding:16px 0 0;border-top:1px solid var(--line)}
.lesson h3{margin:0 0 4px;font-size:19px}
.lesson .meta{margin:0 0 10px;color:var(--muted);font-size:14px}
.lesson h4{margin:12px 0 6px;font-size:15px}
.plan{border-collapse:collapse;width:100%;font-size:15px}
.plan td{padding:6px 10px;border:1px solid var(--line);vertical-align:top}
.plan td:first-child{width:72px;white-space:nowrap;font-family:var(--mono);color:var(--muted)}
.lvl{font-family:var(--mono);font-size:14px;padding:1px 6px;border:1px solid var(--edge);border-radius:6px;background:var(--ctl);white-space:nowrap}
.faq dt{font-weight:600;margin-top:10px}
.faq dd{margin:4px 0 0;color:var(--muted)}
ol.chapters{padding-left:22px}
ol.chapters li{margin:6px 0}
footer{max-width:820px;margin:0 auto;padding:16px 16px 40px;color:var(--muted);font-size:14px;border-top:1px solid var(--line)}
@media (max-width:560px){h1{font-size:28px}section{padding:16px}.laws{grid-template-columns:1fr;gap:2px}.laws dd{margin-bottom:8px}}
`.trim();

const BULB =
  '<svg class="ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3Z"/></svg>';

/** Qo'llanmalar: har biri uz va ru; sahifa tanasi — o'z funksiyasi. */
const GUIDES = [
  { id: 'elements', text: CONTENT, body: elementsBody },
  { id: 'binary', text: BINARY, body: binaryBody },
  { id: 'bool', text: BOOL, body: boolBody },
  { id: 'bases', text: BASES, body: basesBody },
  { id: 'teachers', text: TEACHERS, body: teachersBody },
];

const pageOf = (g, lang) => (g.id === 'elements' ? { ...CONTENT[lang], nav: CONTENT[lang].h1 } : g.text[lang]);

/**
 * O'yinga havolalar sahifa tilini olib boradi (?lang=): ruscha sahifadagi «Играть» o'yinni ruscha ochadi
 * (o'yin parametrni o'qib, manzildan olib tashlaydi — src/lang-detect.ts).
 */
export const gameLinks = (html, lang) =>
  html.replaceAll('href="/"', `href="/?lang=${lang}"`).replaceAll('href="/#/', `href="/?lang=${lang}#/`);

/** Umumiy qobiq: head (SEO teglari), sarlavha (qo'llanmalar va til), tana, pastki qism. */
function shell(g, lang, ctx, ld, body) {
  return gameLinks(shellHtml(g, lang, ctx, ld, body), lang);
}

function shellHtml(g, lang, ctx, ld, body) {
  const c = CONTENT[lang];
  const page = pageOf(g, lang);
  const otherLang = c.other.lang;
  const other = pageOf(g, otherLang);
  const url = ctx.site + page.path;
  const nav = GUIDES.map((x) => {
    const p = pageOf(x, lang);
    return x === g ? `<span aria-current="page">${esc(p.nav)}</span>` : `<a href="${p.path}">${esc(p.nav)}</a>`;
  }).join('');
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<link rel="canonical" href="${esc(url)}">
<link rel="alternate" hreflang="${lang}" href="${esc(url)}">
<link rel="alternate" hreflang="${otherLang}" href="${esc(ctx.site + other.path)}">
<link rel="alternate" hreflang="x-default" href="${esc(ctx.site + pageOf(g, 'uz').path)}">
<meta name="theme-color" content="#0b1712" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#efe9dc" media="(prefers-color-scheme: light)">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Logic Gate">
<meta property="og:title" content="${esc(page.h1)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(ctx.site)}/og.png?v=5">
<meta property="og:locale" content="${c.locale}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${jsonLd(ld(page, url))}</script>
<style>${CSS}</style>
</head>
<body>
<header class="top"><a class="brand" href="/"><img src="/favicon.svg" width="28" height="28" alt="">Logic Gate</a><nav><a href="/">${esc(c.play.replace(/^▶\s*/, ''))}</a><a href="${other.path}" hreflang="${otherLang}" lang="${otherLang}">${esc(c.other.label)}</a></nav></header>
<nav class="guides" aria-label="Logic Gate">${nav}</nav>
<main>
${body}
</main>
<footer>Logic Gate · <a href="/">${esc(ctx.site.replace(/^https?:\/\//, ''))}</a> · <a href="${other.path}" hreflang="${otherLang}" lang="${otherLang}">${esc(c.other.label)}</a></footer>
</body>
</html>
`;
}

/** schema.org: o'quv materiali + o'yinning o'zi. */
const learning = (lang, teaches, ctx) => (page, url) => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'LearningResource',
      name: page.h1,
      description: page.description,
      inLanguage: lang,
      url,
      learningResourceType: 'article',
      isAccessibleForFree: true,
      teaches,
      isPartOf: { '@id': `${ctx.site}/#app` },
    },
    {
      '@type': 'WebApplication',
      '@id': `${ctx.site}/#app`,
      name: 'Logic Gate',
      url: `${ctx.site}/`,
      applicationCategory: 'GameApplication',
      operatingSystem: 'Any',
      inLanguage: ['uz', 'ru'],
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'UZS' },
    },
  ],
});

const cta = (c, ctx, extra = '') =>
  `<div class="cta"><a class="btn primary" href="/">${esc(c.play)}</a>${ctx.tgApp ? `<a class="btn" href="${esc(ctx.tgApp)}">${esc(c.playTg)}</a>` : ''}${extra}</div>`;

function elementsBody(lang, ctx) {
  const c = CONTENT[lang];
  const totalLevels = ctx.pack.levels.length;
  const chapterTitle = (ch) => (lang === 'uz' ? ch.title : ch.i18n?.[lang]?.title ?? ch.title);
  const chapterDesc = (ch) => (lang === 'uz' ? ch.description : ch.i18n?.[lang]?.description ?? ch.description);
  const count = (ch) => ctx.pack.levels.filter((l) => l.chapter === ch.id).length;

  const gates = c.gates
    .map(
      (g) => `
<section id="${g.type.toLowerCase()}">
<h2>${esc(g.title)}</h2>
<div class="gate-row"><figure>${gateSvg(g.type, short(g.title))}<figcaption>${esc(g.formula)}</figcaption></figure>${truthTable(g.type, c.table)}</div>
<p>${esc(g.text)}</p>
<p class="muted">${esc(c.notation)}: ${g.notation.split(', ').map((n) => `<code>${esc(n)}</code>`).join(', ')}</p>
</section>`,
    )
    .join('');

  const toc = [...c.gates.map((g) => [g.type.toLowerCase(), short(g.title)]), ['dff', short(c.memory.title)], ['laws', c.laws.title], ['game', c.game.title]]
    .map(([id, name]) => `<li><a href="#${id}">${esc(name)}</a></li>`)
    .join('');

  return {
    ld: learning(lang, c.gates.map((g) => short(g.title)), ctx),
    html: `<h1>${esc(c.h1)}</h1>
${c.lead.map((p) => `<p class="lead">${esc(p)}</p>`).join('\n')}
${cta(c, ctx)}
<p class="muted">${esc(c.free)}</p>
<nav aria-label="${esc(c.toc)}"><ul class="toc">${toc}</ul></nav>
${gates}
<section id="dff">
<h2>${esc(c.memory.title)}</h2>
<div class="gate-row"><figure>${gateSvg('DFF', 'D-trigger')}<figcaption>${esc(c.memory.formula)}</figcaption></figure></div>
${c.memory.text.map((p) => `<p>${esc(p)}</p>`).join('\n')}
${dffTable(c)}
</section>
<section id="laws">
<h2>${esc(c.laws.title)}</h2>
<dl class="laws">${c.laws.rows.map(([name, f]) => `<dt>${esc(name)}</dt><dd>${f.split(/,\s+/).map((e) => `<code>${esc(e)}</code>`).join(', ')}</dd>`).join('')}</dl>
<p class="tip">${BULB} ${esc(c.laws.tip)}</p>
<p><a href="${BOOL[lang].path}">${esc(BOOL[lang].more)} →</a></p>
</section>
<section id="game">
<h2>${esc(c.game.title)}</h2>
<p>${esc(c.game.text)}</p>
<p>${esc(c.game.chapters(ctx.pack.chapters.length, totalLevels))}</p>
<ol class="chapters">${ctx.pack.chapters.map((ch) => `<li><b>${esc(chapterTitle(ch))}</b> — ${esc(c.game.levels(count(ch)))}. ${esc(chapterDesc(ch))}</li>`).join('')}</ol>
<ul>${c.game.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
${cta(c, ctx, `<a class="btn" href="/#/daily">${esc(c.daily)}</a>`)}
</section>`,
  };
}

function binaryBody(lang, ctx) {
  const c = CONTENT[lang];
  const b = BINARY[lang];
  const div = divisionSteps(EXAMPLES.toBin);
  const bits = EXAMPLES.toDec.split('');
  const weights = bits.map((_, i) => 2 ** (bits.length - 1 - i));
  const dec = weights.reduce((s, w, i) => s + (bits[i] === '1' ? w : 0), 0);
  const add = binaryAdd(...EXAMPLES.add);
  const w = add.sum.length;
  const pad = (s) => s.padStart(w, ' ').split('');
  const col = (cells, cls = '') => cells.map((v) => `<td class="${cls}${v === '1' ? ' one' : ''}">${v.trim()}</td>`).join('');
  const toyBits = [128, 64, 32, 16, 8, 4, 2, 1]
    .map((v) => `<button type="button" class="bit" data-w="${v}" aria-pressed="false"><span class="w">${v}</span><span class="v">0</span></button>`)
    .join('');
  const ex = (n) => `${n} = ${n.toString(2)}₂`;

  return {
    ld: learning(lang, [b.toBin.title, b.toDec.title, b.add.title], ctx),
    html: `<h1>${esc(b.h1)}</h1>
${b.lead.map((p) => `<p class="lead">${esc(p)}</p>`).join('\n')}
${cta(c, ctx)}
<section id="bits">
<h2>${esc(b.toy.title)}</h2>
<p>${esc(b.toy.text)}</p>
<div class="bits" id="bits-toy">${toyBits}</div>
<p class="bits-out"><code id="bits-bin">00000000</code> = <strong id="bits-dec">0</strong></p>
<label class="bits-in">${esc(b.toy.input)} <input id="bits-input" type="number" min="0" max="255" value="0" inputmode="numeric"></label>
</section>
<section id="to-binary">
<h2>${esc(b.toBin.title)}</h2>
<p>${esc(b.toBin.text)}</p>
<div class="scroll-x"><table class="truth steps"><thead><tr>${b.toBin.cols.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${div.steps
      .map(([x, q, r]) => `<tr><td>${x}</td><td>${q}</td><td class="out${r ? ' one' : ''}">${r}</td></tr>`)
      .join('')}</tbody></table></div>
<p>${esc(b.toBin.result)} <code>${div.bin}</code> — <strong>${EXAMPLES.toBin} = ${div.bin}₂</strong></p>
</section>
<section id="to-decimal">
<h2>${esc(b.toDec.title)}</h2>
<p>${esc(b.toDec.text)}</p>
<div class="scroll-x"><table class="truth steps"><tbody><tr><th>${esc(b.toDec.rows[0])}</th>${bits.map((v) => `<td class="${v === '1' ? 'one' : ''}">${v}</td>`).join('')}</tr><tr><th>${esc(b.toDec.rows[1])}</th>${weights.map((v) => `<td>${v}</td>`).join('')}</tr></tbody></table></div>
<p><strong>${EXAMPLES.toDec}₂ = ${weights.filter((_, i) => bits[i] === '1').join(' + ')} = ${dec}</strong></p>
</section>
<section id="table">
<h2>${esc(b.table.title)}</h2>
<div class="bin-grid" role="list">${Array.from({ length: 16 }, (_, n) => `<span role="listitem"><b>${n}</b><code>${n.toString(2).padStart(4, '0')}</code></span>`).join('')}</div>
<p class="muted">${[5, 10, 100, 255].map(ex).join(' · ')}</p>
</section>
<section id="addition">
<h2>${esc(b.add.title)}</h2>
<p>${esc(b.add.text)}</p>
<div class="scroll-x"><table class="truth column"><tbody>
<tr class="carry"><th>${esc(b.add.carry)}</th>${col(pad(add.carry.slice(-w).replace(/0/g, ' ')), 'carry')}<td></td></tr>
<tr><th></th>${col(pad(add.a))}<td class="dec">${parseInt(add.a, 2)}</td></tr>
<tr><th>+</th>${col(pad(add.b))}<td class="dec">${parseInt(add.b, 2)}</td></tr>
<tr class="sum"><th>=</th>${col(pad(add.sum), 'out')}<td class="dec">${parseInt(add.sum, 2)}</td></tr>
</tbody></table></div>
<p class="tip">${BULB} ${esc(b.add.tip)}</p>
<p><a href="${BASES[lang].path}">${esc(BASES[lang].more)} →</a></p>
<p><a href="${CONTENT[lang].path}">${esc(b.related)} →</a></p>
${cta(c, ctx)}
</section>
<script src="/guide-binary.js" defer></script>`,
  };
}

/** O'yindagi Qum qutiga havola: formula oynasi shu ifoda bilan ochiladi (guide-bool-ui.js ham shunday yozadi). */
export const sandboxLink = (expr) => `/#/sandbox/${encodeURIComponent(expr)}`;

/** Kalkulyatorning boshlang'ich misoli — De Morgan (sahifa JavaScript'siz ham jadvalni ko'rsatadi). */
export const CALC_DEFAULT = ['¬(A ∧ B)', '¬A ∨ ¬B'];

function boolBody(lang, ctx) {
  const c = CONTENT[lang];
  const b = BOOL[lang];
  const code = (s) => `<code>${esc(s)}</code>`;

  // Kalkulyator: boshlang'ich jadval va xulosa build'da hisoblanadi.
  const [ea, eb] = CALC_DEFAULT.map(parseExpr);
  const vars = [...new Set([...ea.vars, ...eb.vars])].sort();
  const rows = rowsOf(vars);
  const outs = [
    { label: b.calc.shortA, values: rows.map((env) => evalExpr(ea.ast, env)) },
    { label: b.calc.shortB, values: rows.map((env) => evalExpr(eb.ast, env)) },
  ];
  const equal = compareExprs(...CALC_DEFAULT).equal;
  const data = {
    'short-a': b.calc.shortA,
    'short-b': b.calc.shortB,
    equal: b.calc.equal,
    differ: b.calc.differ,
    rows: b.calc.rows,
    ...Object.fromEntries(Object.entries(b.calc.errors).map(([k, v]) => [`err-${k}`, v])),
  };
  const attrs = Object.entries(data)
    .map(([k, v]) => `data-${k}="${esc(v)}"`)
    .join(' ');
  const syms = ['¬', '∧', '∨', '⊕', '(', ')', 'A', 'B', 'C']
    .map((s) => `<button type="button" class="sym" data-sym="${esc(s)}">${esc(s)}</button>`)
    .join('');

  // De Morgan jadvali.
  const dmCols = ['A ∧ B', '¬(A ∧ B)', '¬A ∨ ¬B'];
  const dm = rowsOf(['A', 'B'])
    .map((env) => {
      const vals = dmCols.map((e) => evalExpr(parseExpr(e).ast, env));
      return `<tr><td>${env.A}</td><td>${env.B}</td>${vals.map((v, i) => `<td class="${i ? 'out' : ''}${v && i ? ' one' : ''}">${v}</td>`).join('')}</tr>`;
    })
    .join('');

  // Jadvaldan formula va Karno kartasi.
  const terms = sopTerms(SOP_EXAMPLE);
  const sop = terms.map((t) => `(${t.term})`).join(' ∨ ');
  const sopRows = rowsOf(['A', 'B', 'C'])
    .map((env, r) => {
      const q = Number(SOP_EXAMPLE[r]);
      const term = terms.find((t) => parseInt(t.row, 2) === r);
      return `<tr${q ? ' class="hl"' : ''}><td>${env.A}</td><td>${env.B}</td><td>${env.C}</td><td class="out${q ? ' one' : ''}">${q}</td><td class="term">${term ? esc(term.term) : ''}</td></tr>`;
    })
    .join('');
  const kmapRows = [0, 1]
    .map((a) => {
      const cells = KMAP_COLS.map((bc) => {
        const q = SOP_EXAMPLE[parseInt(`${a}${bc}`, 2)];
        const groups = KMAP_GROUPS.map((g, i) => (g.cells.includes(`${a},${bc}`) ? ` g${i + 1}` : '')).join('');
        return `<td class="${q === '1' ? 'one' : ''}${groups}">${q}</td>`;
      }).join('');
      return `<tr><th>A = ${a}</th>${cells}</tr>`;
    })
    .join('');

  const simplify = b.simplify.steps
    .map(
      (steps, i) =>
        `<h3>${esc(b.simplify.example)} ${i + 1}</h3><ol class="chain">${steps
          .map(([e, why]) => `<li>${code(e)}${why ? `<span>${esc(why)}</span>` : ''}</li>`)
          .join('')}</ol>`,
    )
    .join('');

  return {
    ld: learning(lang, [b.laws.title, b.demorgan.title, b.simplify.title, b.kmap.title], ctx),
    html: `<h1>${esc(b.h1)}</h1>
${b.lead.map((p) => `<p class="lead">${esc(p)}</p>`).join('\n')}
${cta(c, ctx)}
<section id="calc">
<h2>${esc(b.calc.title)}</h2>
<p>${esc(b.calc.text)}</p>
<div class="calc" id="bool-calc" ${attrs}>
<label for="expr-a">${esc(b.calc.labelA)}</label>
<input id="expr-a" type="text" value="${esc(CALC_DEFAULT[0])}" autocomplete="off" autocapitalize="characters" spellcheck="false">
<label for="expr-b">${esc(b.calc.labelB)}</label>
<input id="expr-b" type="text" value="${esc(CALC_DEFAULT[1])}" autocomplete="off" autocapitalize="characters" spellcheck="false">
<div class="syms" role="group" aria-label="${esc(b.calc.symbols)}">${syms}</div>
<p class="muted">${esc(b.calc.syntax)}</p>
<p class="verdict${equal ? ' ok' : ' bad'}" id="expr-verdict" role="status">${esc(b.calc.equal.replace('{n}', String(rows.length)))}</p>
<div class="scroll-x" id="expr-table">${calcTableHtml(vars, rows, outs)}</div>
<p><a class="btn" id="expr-sandbox" href="${sandboxLink(CALC_DEFAULT[0])}">${esc(b.calc.toSandbox)}</a></p>
</div>
</section>
<section id="ops">
<h2>${esc(b.ops.title)}</h2>
<p>${esc(b.ops.text)}</p>
<div class="scroll-x"><table class="wide ops"><thead><tr>${b.ops.cols.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.ops.rows
      .map(([name, sym, when]) => `<tr><td>${esc(name)}</td><td>${esc(sym)}</td><td>${esc(when)}</td></tr>`)
      .join('')}</tbody></table></div>
<p>${esc(b.ops.order)}</p>
</section>
<section id="laws">
<h2>${esc(b.laws.title)}</h2>
<p>${esc(b.laws.text)}</p>
<div class="scroll-x"><table class="wide"><thead><tr>${b.laws.cols.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.laws.rows
      .map(([name, and, or]) => `<tr><td>${esc(name)}</td><td>${code(and)}</td><td>${code(or)}</td></tr>`)
      .join('')}<tr><td>${esc(b.laws.double)}</td><td colspan="2">${code(b.laws.doubleLaw)}</td></tr></tbody></table></div>
<p class="tip">${BULB} ${esc(b.laws.tip)}</p>
</section>
<section id="de-morgan">
<h2>${esc(b.demorgan.title)}</h2>
${b.demorgan.text.map((t) => `<p>${esc(t)}</p>`).join('\n')}
<div class="scroll-x"><table class="truth"><thead><tr><th>A</th><th>B</th>${dmCols.map((h) => `<th class="out">${esc(h)}</th>`).join('')}</tr></thead><tbody>${dm}</tbody></table></div>
<p class="tip">${BULB} ${esc(b.demorgan.tip)}</p>
</section>
<section id="simplify">
<h2>${esc(b.simplify.title)}</h2>
<p>${esc(b.simplify.text)}</p>
${simplify}
<p class="muted">${esc(b.simplify.check)}</p>
</section>
<section id="sop">
<h2>${esc(b.sop.title)}</h2>
${b.sop.text.map((t) => `<p>${esc(t)}</p>`).join('\n')}
<div class="scroll-x"><table class="truth"><caption>${esc(b.sop.caption)}</caption><thead><tr><th>A</th><th>B</th><th>C</th><th class="out">Q</th><th>${esc(b.sop.term)}</th></tr></thead><tbody>${sopRows}</tbody></table></div>
<p>${esc(b.sop.formula)}:</p>
<p class="formula-line">Q = ${esc(sop)}</p>
<p>${esc(b.sop.simplified)}:</p>
<p class="formula-line">Q = ${esc(SOP_SIMPLIFIED)} = ${esc(SOP_FACTORED)}</p>
<p>${esc(b.sop.why)}</p>
</section>
<section id="karnaugh">
<h2>${esc(b.kmap.title)}</h2>
${b.kmap.text.map((t) => `<p>${esc(t)}</p>`).join('\n')}
<div class="scroll-x"><table class="truth kmap"><caption>${esc(b.kmap.caption)}</caption><thead><tr><th></th>${KMAP_COLS.map((bc) => `<th>BC = ${bc}</th>`).join('')}</tr></thead><tbody>${kmapRows}</tbody></table></div>
<ul class="legend">${b.kmap.groups.map((g, i) => `<li class="g${i + 1}">${esc(g)}</li>`).join('')}</ul>
<p>${esc(b.kmap.result)}: <span class="formula-line">Q = ${esc(SOP_SIMPLIFIED)}</span></p>
</section>
<section id="game">
<h2>${esc(b.game.title)}</h2>
<p>${esc(b.game.text)}</p>
<p><a href="${CONTENT[lang].path}">${esc(b.related)} →</a></p>
${cta(c, ctx, `<a class="btn" href="/#/sandbox">${esc(c.game.features[1].split(':')[0])}</a>`)}
</section>
<script src="/guide-bool.js" defer></script>`,
  };
}

function basesBody(lang, ctx) {
  const c = CONTENT[lang];
  const b = BASES[lang];
  const L = b.calc.steps;
  const solve = ([n, from, to]) => stepsHtml(convert(n, from, to), L);
  const [n0, from0, to0] = BASE_EXAMPLES.calc;
  const option = (base, selected) =>
    `<option value="${base}"${base === selected ? ' selected' : ''}>${base}${b.calc.names[base] ? ` — ${esc(b.calc.names[base])}` : ''}</option>`;
  const options = (selected) => Array.from({ length: MAX_BASE - MIN_BASE + 1 }, (_, i) => option(MIN_BASE + i, selected)).join('');
  const rows = Array.from({ length: 17 }, (_, n) =>
    `<tr><td>${n}</td><td>${n.toString(2)}</td><td>${n.toString(8)}</td><td>${n.toString(16).toUpperCase()}</td></tr>`,
  ).join('');
  const bin = BASE_EXAMPLES.group8[0];

  return {
    ld: learning(lang, [b.toBase.title, b.toDec.title, b.groups.title], ctx),
    html: `<h1>${esc(b.h1)}</h1>
${b.lead.map((p) => `<p class="lead">${esc(p)}</p>`).join('\n')}
${cta(c, ctx)}
<section id="calc">
<h2>${esc(b.calc.title)}</h2>
<p>${esc(b.calc.text)}</p>
<div class="calc" id="base-calc" data-labels="${esc(JSON.stringify(L))}" data-errors="${esc(JSON.stringify(b.calc.errors))}">
<label for="base-num">${esc(b.calc.number)}</label>
<input id="base-num" type="text" value="${n0}" autocomplete="off" autocapitalize="characters" spellcheck="false">
<div class="base-row">
<label>${esc(b.calc.from)} <select id="base-from">${options(from0)}</select></label>
<button type="button" class="sym" id="base-swap" aria-label="${esc(b.calc.swap)}" title="${esc(b.calc.swap)}">⇄</button>
<label>${esc(b.calc.to)} <select id="base-to">${options(to0)}</select></label>
</div>
<p class="verdict bad" id="base-error" role="alert" hidden></p>
<div id="base-steps" aria-live="polite">${solve(BASE_EXAMPLES.calc)}</div>
</div>
</section>
<section id="table">
<h2>${esc(b.table.title)}</h2>
<div class="scroll-x"><table class="wide base-table"><thead><tr>${b.table.cols.map((h, i) => `<th>${esc(h)} (${[10, 2, 8, 16][i]})</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
</section>
<section id="to-base">
<h2>${esc(b.toBase.title)}</h2>
<p>${esc(b.toBase.text)}</p>
${solve(BASE_EXAMPLES.toBase)}
</section>
<section id="to-decimal">
<h2>${esc(b.toDec.title)}</h2>
<p>${esc(b.toDec.text)}</p>
${solve(BASE_EXAMPLES.toDec)}
</section>
<section id="groups">
<h2>${esc(b.groups.title)}</h2>
<p>${esc(b.groups.text)}</p>
<p><code>${bin}${sub(2)}</code></p>
${solve(BASE_EXAMPLES.group8)}
${solve(BASE_EXAMPLES.group16)}
<p class="tip">${BULB} ${esc(b.tip)}</p>
<p><a href="${BINARY[lang].path}">${esc(b.related[0])} →</a></p>
<p><a href="${CONTENT[lang].path}">${esc(b.related[1])} →</a></p>
${cta(c, ctx)}
</section>
<script src="/guide-base.js" defer></script>`,
  };
}

function teachersBody(lang, ctx) {
  const c = CONTENT[lang];
  const b = TEACHERS[lang];
  const levels = ctx.pack.levels;
  // Daraja: raqami (xaritadagi) va nomi — joriy tilda.
  const lvl = (id) => {
    const i = levels.findIndex((l) => l.id === id);
    if (i < 0) throw new Error(`teachers: noma'lum daraja ${id}`);
    const l = levels[i];
    const title = lang === 'uz' ? l.title : l.i18n?.[lang]?.title ?? l.title;
    return `<span class="lvl">${i + 1}. ${esc(title)}</span>`;
  };
  const list = (ids) => ids.map(lvl).join(', ');
  const guides = { elements: CONTENT[lang], bool: BOOL[lang], bases: BASES[lang], binary: BINARY[lang] };
  const create = `<a class="btn primary" href="/#/teacher">${esc(b.create)}</a>`;

  const lessons = b.lessons.items
    .map((x) => {
      const g = guides[x.guide];
      const rows = x.plan
        .map(([m, text]) => `<tr><td>${m} ${esc(b.lessons.min)}</td><td>${esc(text).replace('{inClass}', list(x.inClass))}</td></tr>`)
        .join('');
      return `<article class="lesson">
<h3>${esc(x.title)}</h3>
<p class="meta">${esc(b.lessons.grade)}: ${esc(x.grade)} · ${esc(b.lessons.minutes)} · ${esc(b.lessons.guide)}: <a href="${g.path}">${esc(g.nav ?? g.h1)}</a></p>
<h4>${esc(b.lessons.goals)}</h4>
<ul>${x.goals.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
<h4>${esc(b.lessons.plan)}</h4>
<div class="scroll-x"><table class="plan"><tbody>${rows}</tbody></table></div>
<p><b>${esc(b.lessons.homework)}:</b> ${list(x.homework)}</p>
<p><b>${esc(b.lessons.assess)}:</b> ${esc(x.assess)}</p>
</article>`;
    })
    .join('\n');

  return {
    ld: learning(lang, b.lessons.items.map((x) => x.title), ctx),
    html: `<h1>${esc(b.h1)}</h1>
${b.lead.map((p) => `<p class="lead">${esc(p)}</p>`).join('\n')}
<div class="cta">${create}<a class="btn" href="/">${esc(c.play.replace(/^▶\s*/, ''))}</a></div>
<section id="features">
<h2>${esc(b.features.title)}</h2>
<ul class="features">${b.features.items.map(([t, d]) => `<li><b>${esc(t)}</b>${esc(d)}</li>`).join('')}</ul>
</section>
<section id="start">
<h2>${esc(b.start.title)}</h2>
<ol class="steps-list">${b.start.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
<div class="cta">${create}</div>
</section>
<section id="lessons">
<h2>${esc(b.lessons.title)}</h2>
<p>${esc(b.lessons.text)}</p>
${lessons}
</section>
<section id="faq">
<h2>${esc(b.faq.title)}</h2>
<dl class="faq">${b.faq.items.map(([q, a]) => `<dt>${esc(q)}</dt><dd>${esc(a)}</dd>`).join('')}</dl>
${cta(c, ctx)}
</section>`,
  };
}

/** Brauzer uchun qo'llanma skripti: kutubxona (export'larsiz) + interfeys, bitta IIFE ichida. */
function guideScript(title, lib, ui) {
  return `// Logic Gate — ${title}.\n(function () {\n'use strict';\n${lib.replace(/^export /gm, '')}\n${ui}\n})();\n`;
}

export function guideBaseScript() {
  const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');
  return guideScript('sanoq sistemalari kalkulyatori (scripts/numbase.mjs + scripts/guide-base-ui.js)', read('./numbase.mjs'), read('./guide-base-ui.js'));
}

/** Kalkulyator skripti: src/boolexpr.ts (turlar va export'larsiz) + guide-bool-ui.js, bitta IIFE ichida. */
export function guideBoolScript() {
  const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');
  const lib = stripTypeScriptTypes(read('../src/boolexpr.ts')).replace(/^export /gm, '');
  return `// Logic Gate — Bul algebrasi kalkulyatori (src/boolexpr.ts + scripts/guide-bool-ui.js).\n(function () {\n'use strict';\n${lib}\n${read('./guide-bool-ui.js')}\n})();\n`;
}

/** Barcha fayllar: dist ichidagi yo'l → mazmun. */
export function buildPages(ctx) {
  const site = ctx.site.replace(/\/+$/, '');
  const full = { ...ctx, site };
  const files = {};
  const urls = [`<url><loc>${site}/</loc></url>`];
  for (const g of GUIDES) {
    const alt = ['uz', 'ru'].map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${site}${pageOf(g, l).path}"/>`).join('');
    for (const lang of ['uz', 'ru']) {
      const { ld, html } = g.body(lang, full);
      const path = pageOf(g, lang).path;
      files[path.slice(1) + 'index.html'] = shell(g, lang, full, ld, html);
      urls.push(`<url><loc>${site}${path}</loc>${alt}</url>`);
    }
  }
  files['guide-bool.js'] = guideBoolScript();
  files['guide-base.js'] = guideBaseScript();
  files['robots.txt'] = `User-agent: *\nDisallow: /api/\n\nSitemap: ${site}/sitemap.xml\n`;
  files['sitemap.xml'] = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
  return files;
}

/** VITE_* qiymatlari: Vite kabi — avval muhit o'zgaruvchisi, keyin .env.production, keyin .env. */
function env(webDir, name) {
  if (process.env[name]) return process.env[name];
  for (const file of ['.env.production.local', '.env.local', '.env.production', '.env']) {
    try {
      const m = readFileSync(join(webDir, file), 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'));
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    } catch {
      // fayl yo'q
    }
  }
  return '';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const webDir = fileURLToPath(new URL('..', import.meta.url));
  const site = env(webDir, 'VITE_SITE_URL');
  if (!site) throw new Error('VITE_SITE_URL yo\'q (web/.env): sitemap va canonical uchun to\'liq manzil kerak');
  const pack = JSON.parse(readFileSync(join(webDir, '../levels/levels.json'), 'utf8'));
  const files = buildPages({ site, tgApp: env(webDir, 'VITE_TG_APP_URL'), pack });
  const dist = join(webDir, 'dist');
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dist, path)), { recursive: true });
    writeFileSync(join(dist, path), body);
  }
  console.log(`pages: ${Object.keys(files).join(', ')}`);
}
