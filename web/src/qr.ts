// QR kod (ISO/IEC 18004): faqat bayt rejimi (UTF-8), 1–10 versiya — sinf havolasi uchun yetarli
// (M darajada 213 baytgacha). Kutubxonasiz: bundle'ga ~3 KB, tashqi bog'liqlik yo'q. Sof funksiyalar.

export type QrLevel = 'L' | 'M' | 'Q' | 'H';

const MAX_VERSION = 10;

// Versiya bo'yicha (indeks = versiya, 0 — ishlatilmaydi): bitta blokdagi tuzatish baytlari va bloklar soni.
const ECC_PER_BLOCK: Record<QrLevel, number[]> = {
  L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
  M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
  Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
  H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
};
const BLOCKS: Record<QrLevel, number[]> = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
  Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
  H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8],
};
/** Format satridagi tuzatish darajasi kodi (standartda tartib L, M, Q, H emas). */
const LEVEL_BITS: Record<QrLevel, number> = { L: 1, M: 0, Q: 3, H: 2 };

const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0;

/** Ma'lumot va tuzatish baytlari uchun modullar soni (funksional naqshlardan tashqari). */
function rawModules(ver: number): number {
  let n = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const align = Math.floor(ver / 7) + 2;
    n -= (25 * align - 10) * align - 55;
    if (ver >= 7) n -= 36;
  }
  return n;
}

/** Versiyadagi ma'lumot baytlari (tuzatishsiz). */
export function dataCapacity(ver: number, level: QrLevel): number {
  return Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[level][ver] * BLOCKS[level][ver];
}

/** Tekislash naqshlari markazlari (bir o'q bo'yicha). */
export function alignmentPositions(ver: number): number[] {
  if (ver === 1) return [];
  const count = Math.floor(ver / 7) + 2;
  const size = ver * 4 + 17;
  const step = Math.floor((ver * 8 + count * 3 + 5) / (count * 4 - 4)) * 2;
  const out = [6];
  for (let pos = size - 7; out.length < count; pos -= step) out.splice(1, 0, pos);
  return out;
}

// --- Reed–Solomon, GF(256), x^8 + x^4 + x^3 + x^2 + 1 ---

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree: number): number[] {
  const out = new Array<number>(degree).fill(0);
  out[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < out.length; j++) {
      out[j] = gfMul(out[j], root);
      if (j + 1 < out.length) out[j] ^= out[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return out;
}

/** Ma'lumot baytlari uchun tuzatish baytlari. */
export function rsRemainder(data: readonly number[], degree: number): number[] {
  const divisor = rsDivisor(degree);
  const out = new Array<number>(degree).fill(0);
  for (const b of data) {
    const factor = b ^ (out.shift() as number);
    out.push(0);
    divisor.forEach((coef, i) => (out[i] ^= gfMul(coef, factor)));
  }
  return out;
}

// --- Kodlash ---

/** Matn → ma'lumot baytlari (rejim, uzunlik, matn, to'ldirish) va eng kichik mos versiya. */
function encodeData(text: string, level: QrLevel): { ver: number; data: number[] } {
  const bytes = [...new TextEncoder().encode(text)];
  for (let ver = 1; ver <= MAX_VERSION; ver++) {
    const countBits = ver <= 9 ? 8 : 16;
    const capacityBits = dataCapacity(ver, level) * 8;
    const used = 4 + countBits + bytes.length * 8;
    if (used > capacityBits) continue;

    const bits: number[] = [];
    const push = (val: number, len: number) => {
      for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
    };
    push(0b0100, 4);
    push(bytes.length, countBits);
    for (const b of bytes) push(b, 8);
    push(0, Math.min(4, capacityBits - bits.length));
    push(0, (8 - (bits.length % 8)) % 8);
    const data: number[] = [];
    for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
    for (let pad = 0xec; data.length < capacityBits / 8; pad ^= 0xec ^ 0x11) data.push(pad);
    return { ver, data };
  }
  throw new Error('qr: matn juda uzun');
}

/** Bloklarga bo'lish, har biriga tuzatish va aralashtirish (standart tartibida). */
function addEcc(data: readonly number[], ver: number, level: QrLevel): number[] {
  const blocks = BLOCKS[level][ver];
  const eccLen = ECC_PER_BLOCK[level][ver];
  const total = Math.floor(rawModules(ver) / 8);
  const shortBlocks = blocks - (total % blocks);
  const shortLen = Math.floor(total / blocks);

  const all: number[][] = [];
  for (let i = 0, k = 0; i < blocks; i++) {
    const len = shortLen - eccLen + (i < shortBlocks ? 0 : 1);
    const part = data.slice(k, k + len);
    k += len;
    const ecc = rsRemainder(part, eccLen);
    // Qisqa bloklarga vaqtincha bitta bo'sh bayt: hammasi bir uzunlikda bo'lsin.
    if (i < shortBlocks) part.push(0);
    all.push([...part, ...ecc]);
  }
  const out: number[] = [];
  for (let i = 0; i < all[0].length; i++) {
    all.forEach((b, j) => {
      if (i !== shortLen - eccLen || j >= shortBlocks) out.push(b[i]);
    });
  }
  return out;
}

/** Format satri (15 bit): tuzatish darajasi + niqob, BCH bilan. */
export function formatBits(level: QrLevel, mask: number): number {
  const data = (LEVEL_BITS[level] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

/** Versiya satri (18 bit, 7-versiyadan boshlab). */
export function versionBits(ver: number): number {
  let rem = ver;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (ver << 12) | rem;
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

class Matrix {
  readonly ver: number;
  readonly size: number;
  readonly dark: boolean[][];
  readonly fixed: boolean[][];

  constructor(ver: number) {
    this.ver = ver;
    this.size = ver * 4 + 17;
    this.dark = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.fixed = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
  }

  set(x: number, y: number, dark: boolean) {
    this.dark[y][x] = dark;
    this.fixed[y][x] = true;
  }

  drawPatterns() {
    const n = this.size;
    for (let i = 0; i < n; i++) {
      this.set(6, i, i % 2 === 0);
      this.set(i, 6, i % 2 === 0);
    }
    for (const [cx, cy] of [
      [3, 3],
      [n - 4, 3],
      [3, n - 4],
    ]) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          if (x >= 0 && x < n && y >= 0 && y < n) this.set(x, y, d !== 2 && d !== 4);
        }
      }
    }
    const pos = alignmentPositions(this.ver);
    const last = pos.length - 1;
    pos.forEach((cx, i) =>
      pos.forEach((cy, j) => {
        // Qidiruv naqshlari ustiga tushadiganlari chizilmaydi.
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) this.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }),
    );
    // Format joyi band (niqob tanlangach yoziladi).
    this.drawFormat(0);
    if (this.ver >= 7) {
      const bits = versionBits(this.ver);
      for (let i = 0; i < 18; i++) {
        const a = n - 11 + (i % 3);
        const b = Math.floor(i / 3);
        this.set(a, b, bit(bits, i));
        this.set(b, a, bit(bits, i));
      }
    }
  }

  drawFormat(bits: number) {
    const n = this.size;
    for (let i = 0; i <= 5; i++) this.set(8, i, bit(bits, i));
    this.set(8, 7, bit(bits, 6));
    this.set(8, 8, bit(bits, 7));
    this.set(7, 8, bit(bits, 8));
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(bits, i));
    for (let i = 0; i < 8; i++) this.set(n - 1 - i, 8, bit(bits, i));
    for (let i = 8; i < 15; i++) this.set(8, n - 15 + i, bit(bits, i));
    this.set(8, n - 8, true);
  }

  /** Baytlarni ikki ustunli ilon yo'li bilan joylash (o'ngdan chapga, navbat bilan yuqoriga/pastga). */
  drawCodewords(codewords: readonly number[]) {
    const n = this.size;
    let i = 0;
    for (let right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      const up = ((right + 1) & 2) === 0;
      for (let v = 0; v < n; v++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const y = up ? n - 1 - v : v;
          if (this.fixed[y][x] || i >= codewords.length * 8) continue;
          this.dark[y][x] = bit(codewords[i >>> 3], 7 - (i & 7));
          i++;
        }
      }
    }
  }

  applyMask(mask: number) {
    const f = MASKS[mask];
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) if (!this.fixed[y][x] && f(x, y)) this.dark[y][x] = !this.dark[y][x];
    }
  }
}

/** Skanerlashni qiyinlashtiradigan naqshlar uchun jarima (standartdagi 4 qoida). */
export function penalty(m: readonly (readonly boolean[])[]): number {
  const n = m.length;
  let score = 0;
  const lines: boolean[][] = [];
  for (let i = 0; i < n; i++) {
    lines.push([...m[i]]);
    lines.push(m.map((row) => row[i]));
  }
  // Qidiruv naqshiga o'xshash 1:1:3:1:1 — chetida 4 ta oq bilan (maydon tashqarisi oq hisoblanadi).
  const finderA = '00001011101';
  const finderB = '10111010000';
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i <= n; i++) {
      if (i < n && line[i] === line[i - 1]) run++;
      else {
        if (run >= 5) score += run - 2;
        run = 1;
      }
    }
    const s = '0000' + line.map((d) => (d ? '1' : '0')).join('') + '0000';
    for (let i = 0; i + 11 <= s.length; i++) {
      const w = s.slice(i, i + 11);
      if (w === finderA || w === finderB) score += 40;
    }
  }
  let dark = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (m[y][x]) dark++;
      if (x + 1 < n && y + 1 < n && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) score += 3;
    }
  }
  const total = n * n;
  score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return score;
}

export interface Qr {
  version: number;
  mask: number;
  /** [qator][ustun], true — qora modul. Atrofidagi 4 modulli oq hoshiya kiritilmagan. */
  modules: boolean[][];
}

/** Matnni QR kodga aylantiradi. mask berilmasa — jarimasi eng kami tanlanadi. */
export function qrEncode(text: string, level: QrLevel = 'M', mask?: number): Qr {
  const { ver, data } = encodeData(text, level);
  const codewords = addEcc(data, ver, level);
  const build = (k: number) => {
    const mx = new Matrix(ver);
    mx.drawPatterns();
    mx.drawCodewords(codewords);
    mx.applyMask(k);
    mx.drawFormat(formatBits(level, k));
    return mx;
  };
  let best = mask ?? 0;
  if (mask === undefined) {
    let min = Infinity;
    for (let k = 0; k < 8; k++) {
      const p = penalty(build(k).dark);
      if (p < min) {
        min = p;
        best = k;
      }
    }
  }
  return { version: ver, mask: best, modules: build(best).dark };
}

/** SVG yo'li: har qatordagi ketma-ket qora modullar bitta to'rtburchak (1 modul = 1 birlik). */
export function qrPath(modules: readonly (readonly boolean[])[]): string {
  let d = '';
  modules.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      if (!row[x]) {
        x++;
        continue;
      }
      let end = x;
      while (end < row.length && row[end]) end++;
      d += `M${x} ${y}h${end - x}v1h${x - end}z`;
      x = end;
    }
  });
  return d;
}
