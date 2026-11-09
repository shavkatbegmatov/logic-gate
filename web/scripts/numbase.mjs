// Sanoq sistemalari: sonni bir asosdan boshqasiga o'tkazish va yechim bosqichlari.
// "Sanoq sistemalari" qo'llanmasi uchun: build'da (misollar, statik yechim) va brauzerda (kalkulyator)
// bir xil kod — pages.mjs bu faylni `export` so'zlarisiz dist/guide-base.js ga qo'shadi. Shuning uchun
// bu yerda import yo'q va faqat oddiy JavaScript. Butun musbat sonlar, 2⁶⁴ dan kichik (BigInt).

export const DIGITS = '0123456789ABCDEF';
export const MIN_BASE = 2;
export const MAX_BASE = 16;
export const LIMIT = 2n ** 64n;

export class BaseError extends Error {
  constructor(code, detail) {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

/** Raqam qiymati: "A" → 10; noto'g'ri belgi — -1. */
const digitValue = (ch) => DIGITS.indexOf(ch.toUpperCase());

/** Satrni o'qiydi (bo'shliq va _ e'tiborsiz): BigInt. Xatoda BaseError (empty, digit, big). */
export function parseInBase(src, base) {
  const s = String(src).replace(/[\s_]/g, '').toUpperCase();
  if (!s) throw new BaseError('empty');
  let n = 0n;
  const b = BigInt(base);
  for (const ch of s) {
    const d = digitValue(ch);
    if (d < 0 || d >= base) throw new BaseError('digit', ch);
    n = n * b + BigInt(d);
    if (n >= LIMIT) throw new BaseError('big');
  }
  return n;
}

export function toBase(n, base) {
  if (n === 0n) return '0';
  const b = BigInt(base);
  let s = '';
  for (let x = n; x > 0n; x /= b) s = DIGITS[Number(x % b)] + s;
  return s;
}

/** O'nlikdan: ketma-ket bo'lish — [{ dividend, quotient, remainder }]. */
export function divisionSteps(n, base) {
  const b = BigInt(base);
  const steps = [];
  let x = n;
  do {
    steps.push({ dividend: x, quotient: x / b, remainder: Number(x % b) });
    x /= b;
  } while (x > 0n);
  return steps;
}

/** O'nlikka: yoyish — [{ digit, value, power, term }] (chapdan o'ngga). */
export function expansionTerms(digits, base) {
  const s = digits.toUpperCase();
  return [...s].map((ch, i) => {
    const value = digitValue(ch);
    const power = s.length - 1 - i;
    return { digit: ch, value, power, term: BigInt(value) * BigInt(base) ** BigInt(power) };
  });
}

/** 2 ↔ 8 ↔ 16: bitta raqam — nechta bit (8 → 3, 16 → 4). */
const BITS = { 2: 1, 8: 3, 16: 4 };

/** Ikkilikni guruhlarga bo'lish (o'ngdan): [{ bits, digit }]. */
export function groupBits(bin, size) {
  const padded = bin.padStart(Math.ceil(bin.length / size) * size, '0');
  const out = [];
  for (let i = 0; i < padded.length; i += size) {
    const bits = padded.slice(i, i + size);
    out.push({ bits, digit: DIGITS[parseInt(bits, 2)] });
  }
  return out;
}

/**
 * O'tkazish va usul:
 *   same      — asoslar bir xil;
 *   division  — 10 dan: bo'lish;
 *   expansion — 10 ga: yoyish;
 *   group     — 2 ↔ 8/16 (va 8 ↔ 16 — 2 orqali): bitlar guruhi;
 *   via10     — qolganlari: avval 10 ga yoyish, keyin bo'lish.
 */
export function convert(src, from, to) {
  if (![from, to].every((b) => Number.isInteger(b) && b >= MIN_BASE && b <= MAX_BASE)) throw new BaseError('base');
  const n = parseInBase(src, from);
  const input = toBase(n, from);
  const result = toBase(n, to);
  const base = { input, from, to, result, decimal: n };
  if (from === to) return { ...base, method: 'same' };
  if (from === 10) return { ...base, method: 'division', division: divisionSteps(n, to) };
  if (to === 10) return { ...base, method: 'expansion', expansion: expansionTerms(input, from) };
  if (BITS[from] && BITS[to]) {
    const bin = toBase(n, 2);
    return {
      ...base,
      method: 'group',
      binary: bin,
      // 8/16 → 2: har raqam bitlarga; 2 → 8/16: bitlar guruhlarga.
      split: from === 2 ? null : groupBits(bin, BITS[from]),
      join: to === 2 ? null : groupBits(bin, BITS[to]),
    };
  }
  return { ...base, method: 'via10', expansion: expansionTerms(input, from), division: divisionSteps(n, to) };
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n) => String(n).replace(/\d/g, (d) => SUP[Number(d)]);
const SUB = '₀₁₂₃₄₅₆₇₈₉';
export const sub = (n) => String(n).replace(/\d/g, (d) => SUB[Number(d)]);
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Qoldiq yozuvi: 14 → "14 (E)". */
const rem = (r) => (r > 9 ? `${r} (${DIGITS[r]})` : String(r));

/**
 * Yechim bosqichlari (HTML). L — matnlar: { division, expansion, group, via10, dividend, quotient,
 * remainder, readUp, digitsTo, bitsTo, answer, same }; {from}, {to} — asoslar.
 */
export function stepsHtml(c, L) {
  const fill = (s) => s.replace(/\{from\}/g, String(c.from)).replace(/\{to\}/g, String(c.to));
  const answer = `<p class="answer"><strong>${escHtml(c.input)}${sub(c.from)} = ${escHtml(c.result)}${sub(c.to)}</strong></p>`;
  const division = (steps, to) =>
    `<p>${escHtml(fill(L.division))}</p><div class="scroll-x"><table class="truth steps"><thead><tr><th>${escHtml(L.dividend)}</th><th>${escHtml(L.quotient)}</th><th>${escHtml(L.remainder)}</th></tr></thead><tbody>${steps
      .map((s) => `<tr><td>${s.dividend} : ${to}</td><td>${s.quotient}</td><td class="out">${rem(s.remainder)}</td></tr>`)
      .join('')}</tbody></table></div><p>${escHtml(L.readUp)} <code>${escHtml(toBase(steps[0].dividend, to))}</code></p>`;
  const expansion = (terms, from) => {
    const parts = terms.map((t) => `${t.value}·${from}${sup(t.power)}`).join(' + ');
    const values = terms.map((t) => String(t.term)).join(' + ');
    const sum = terms.reduce((s, t) => s + t.term, 0n);
    return `<p>${escHtml(fill(L.expansion))}</p><p class="formula-line">${escHtml(c.input)}${sub(from)} = ${parts}${terms.length > 1 ? ` = ${values}` : ''} = ${sum}${sub(10)}</p>`;
  };
  const groups = (list, cls) =>
    `<div class="scroll-x"><table class="truth groups ${cls}"><tbody><tr>${list.map((g) => `<td><code>${g.bits}</code></td>`).join('')}</tr><tr>${list
      .map((g) => `<td class="out">${g.digit}</td>`)
      .join('')}</tr></tbody></table></div>`;

  switch (c.method) {
    case 'same':
      return `<p>${escHtml(L.same)}</p>${answer}`;
    case 'division':
      return division(c.division, c.to) + answer;
    case 'expansion':
      return expansion(c.expansion, c.from) + answer;
    case 'group': {
      let html = `<p>${escHtml(fill(L.group))}</p>`;
      if (c.split) html += `<p>${escHtml(L.digitsTo.replace('{n}', String(c.split[0].bits.length)))}</p>${groups(c.split, 'split')}<p><code>${c.binary}${sub(2)}</code></p>`;
      if (c.join) html += `<p>${escHtml(L.bitsTo.replace('{n}', String(c.join[0].bits.length)))}</p>${groups(c.join, 'join')}`;
      return html + answer;
    }
    default:
      return `<p>${escHtml(fill(L.via10))}</p>${expansion(c.expansion, c.from)}${division(c.division, c.to)}${answer}`;
  }
}
