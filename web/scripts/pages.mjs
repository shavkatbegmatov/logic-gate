// Qidiruv tizimlari uchun statik fayllar (build oxirida, dist/ ga):
//   /mantiqiy-elementlar/       — mantiqiy elementlar qo'llanmasi (o'zbekcha)
//   /ru/logicheskie-elementy/   — o'sha qo'llanma ruscha
//   /robots.txt, /sitemap.xml
// O'yin hash marshrutli SPA: qidiruv tizimi undan faqat bosh sahifani ko'radi. Bu sahifalar esa
// JavaScript'siz o'qiladigan oddiy HTML — element belgilari o'yindagi bilan bir xil (src/board/shapes.ts),
// ranglar — o'yinning Plata mavzusi (src/styles.css).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DFF_BODY, inputLeads, leadEnd, outputY, SHAPE_H, SHAPE_W, SHAPES } from '../src/board/shapes.ts';
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
:root{--bg:#0b1712;--panel:#13271e;--line:#244232;--text:#e6eee4;--muted:#8fa697;--on:#f2a93b;--copper:#c68a57;--fill:#102a1f;--stroke:#63b98d;--mono:ui-monospace,'Cascadia Mono','SF Mono',Consolas,Menlo,monospace;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 system-ui,-apple-system,'Segoe UI',Roboto,'Noto Sans',sans-serif}
a{color:var(--on)}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:820px;margin:0 auto;padding:12px 16px;border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:8px;color:var(--text);font-weight:700;text-decoration:none}
.top nav{display:flex;gap:16px;font-size:15px}
main{max-width:820px;margin:0 auto;padding:8px 16px 32px}
h1{font-size:30px;line-height:1.2;margin:24px 0 12px}
h2{font-size:22px;line-height:1.25;margin:0 0 12px}
section{margin:28px 0;padding:20px;border:1px solid var(--line);border-radius:14px;background:var(--panel)}
.lead{font-size:17px;color:var(--text)}
.muted{color:var(--muted)}
code{font-family:var(--mono);white-space:nowrap}
.cta{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 6px}
.btn{display:inline-block;padding:11px 18px;border:1px solid var(--stroke);border-radius:10px;color:var(--text);text-decoration:none;font-weight:600}
.btn.primary{background:var(--on);border-color:var(--on);color:#1e1305}
.toc{display:flex;flex-wrap:wrap;gap:8px;margin:22px 0 0;padding:0;list-style:none}
.toc a{display:inline-block;padding:4px 10px;border:1px solid var(--line);border-radius:999px;text-decoration:none;font-size:14px}
.gate-row{display:flex;flex-wrap:wrap;align-items:center;gap:12px 28px;margin:4px 0 12px}
figure{margin:0;text-align:center}
figcaption,.formula{font:700 18px var(--mono);color:var(--copper)}
svg.gate{display:block;max-width:100%;height:auto}
svg.gate .lead{stroke:#46705e;stroke-width:2.2}
svg.gate .body{fill:var(--fill);stroke:var(--stroke);stroke-width:2.2;stroke-linejoin:round}
svg.gate .back{fill:none;stroke:var(--stroke);stroke-width:2.2;stroke-linecap:round}
svg.gate text{fill:var(--muted);font:700 9px var(--mono);text-anchor:middle;dominant-baseline:central}
svg.gate text.in-label{fill:var(--text)}
.truth{border-collapse:collapse;font:15px var(--mono);text-align:center}
.truth caption{caption-side:top;font:13px system-ui,sans-serif;color:var(--muted);padding-bottom:4px}
.truth th,.truth td{min-width:40px;padding:5px 10px;border:1px solid var(--line)}
.truth th{color:var(--muted);font-weight:600}
.truth .out{color:var(--copper)}
.truth td.one{color:var(--on);font-weight:700}
.steps th{text-align:left}
.scroll-x{overflow-x:auto;margin:4px 0 12px}
.laws{display:grid;grid-template-columns:max-content 1fr;gap:8px 16px;margin:0 0 12px}
.laws dt{color:var(--muted)}
.laws dd{margin:0;font:15px var(--mono)}
.tip{margin:0;padding:10px 12px;border-left:3px solid var(--copper);border-radius:8px;background:#1f2615}
ol.chapters{padding-left:22px}
ol.chapters li{margin:6px 0}
footer{max-width:820px;margin:0 auto;padding:16px 16px 40px;color:var(--muted);font-size:14px;border-top:1px solid var(--line)}
@media (max-width:560px){h1{font-size:25px}section{padding:16px}.laws{grid-template-columns:1fr;gap:2px}.laws dd{margin-bottom:8px}}
`.trim();

function guidePage(c, ctx) {
  const other = CONTENT[c.other.lang];
  const url = ctx.site + c.path;
  const totalLevels = ctx.pack.levels.length;
  const chapterTitle = (ch) => (c.lang === 'uz' ? ch.title : ch.i18n?.[c.lang]?.title ?? ch.title);
  const chapterDesc = (ch) => (c.lang === 'uz' ? ch.description : ch.i18n?.[c.lang]?.description ?? ch.description);
  const count = (ch) => ctx.pack.levels.filter((l) => l.chapter === ch.id).length;
  const cta = (extra = '') =>
    `<div class="cta"><a class="btn primary" href="/">${esc(c.play)}</a>${ctx.tgApp ? `<a class="btn" href="${esc(ctx.tgApp)}">${esc(c.playTg)}</a>` : ''}${extra}</div>`;

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LearningResource',
        name: c.h1,
        description: c.description,
        inLanguage: c.lang,
        url,
        learningResourceType: 'article',
        isAccessibleForFree: true,
        teaches: c.gates.map((g) => short(g.title)),
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
  };

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

  return `<!doctype html>
<html lang="${c.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.title)}</title>
<meta name="description" content="${esc(c.description)}">
<link rel="canonical" href="${esc(url)}">
<link rel="alternate" hreflang="${c.lang}" href="${esc(url)}">
<link rel="alternate" hreflang="${other.lang}" href="${esc(ctx.site + other.path)}">
<link rel="alternate" hreflang="x-default" href="${esc(ctx.site + CONTENT.uz.path)}">
<meta name="theme-color" content="#07110d">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Logic Gate">
<meta property="og:title" content="${esc(c.h1)}">
<meta property="og:description" content="${esc(c.description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(ctx.site)}/og.png?v=3">
<meta property="og:locale" content="${c.locale}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${jsonLd(ld)}</script>
<style>${CSS}</style>
</head>
<body>
<header class="top"><a class="brand" href="/"><img src="/favicon.svg" width="28" height="28" alt="">Logic Gate</a><nav><a href="/">${esc(c.play.replace(/^▶\s*/, ''))}</a><a href="${other.path}" hreflang="${other.lang}" lang="${other.lang}">${esc(c.other.label)}</a></nav></header>
<main>
<h1>${esc(c.h1)}</h1>
${c.lead.map((p) => `<p class="lead">${esc(p)}</p>`).join('\n')}
${cta()}
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
<p class="tip">💡 ${esc(c.laws.tip)}</p>
</section>
<section id="game">
<h2>${esc(c.game.title)}</h2>
<p>${esc(c.game.text)}</p>
<p>${esc(c.game.chapters(ctx.pack.chapters.length, totalLevels))}</p>
<ol class="chapters">${ctx.pack.chapters.map((ch) => `<li><b>${esc(chapterTitle(ch))}</b> — ${esc(c.game.levels(count(ch)))}. ${esc(chapterDesc(ch))}</li>`).join('')}</ol>
<ul>${c.game.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
${cta(`<a class="btn" href="/#/daily">${esc(c.daily)}</a>`)}
</section>
</main>
<footer>Logic Gate · <a href="/">${esc(ctx.site.replace(/^https?:\/\//, ''))}</a> · <a href="${other.path}" hreflang="${other.lang}" lang="${other.lang}">${esc(c.other.label)}</a></footer>
</body>
</html>
`;
}

/** Barcha fayllar: dist ichidagi yo'l → mazmun. */
export function buildPages(ctx) {
  const site = ctx.site.replace(/\/+$/, '');
  const full = { ...ctx, site };
  const files = {};
  for (const c of Object.values(CONTENT)) files[c.path.slice(1) + 'index.html'] = guidePage(c, full);
  files['robots.txt'] = `User-agent: *\nDisallow: /api/\n\nSitemap: ${site}/sitemap.xml\n`;
  const alt = Object.values(CONTENT)
    .map((c) => `<xhtml:link rel="alternate" hreflang="${c.lang}" href="${site}${c.path}"/>`)
    .join('');
  const urls = [`<url><loc>${site}/</loc></url>`, ...Object.values(CONTENT).map((c) => `<url><loc>${site}${c.path}</loc>${alt}</url>`)];
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
