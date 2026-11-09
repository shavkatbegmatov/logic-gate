// Sertifikat: o'yinchi tugatgan bo'limlar, yulduzlar va sana — canvas'ga chiziladi (PNG yuklab olish,
// ulashish, chop etish). Ko'rinishi har doim Daftar (oq qog'oz, siyoh): qog'ozga chiqadigan narsa.
// Ma'lumot — certificate-data.ts (toza funksiya); bu yerda chizish (drawCertificate) — brauzerda.
import type { CertData } from './certificate-data';

export { certificateData, type CertChapter, type CertData } from './certificate-data';

export interface CertLabels {
  title: string;
  given: string;
  /** Asosiy matn: hamma darajalar yoki n ta bo'lim. */
  reason: string;
  stats: string;
  date: string;
  site: string;
}

export const CERT_W = 1600;
export const CERT_H = 1131; // A4 yotiq nisbati

const INK = '#1d2939';
const BLUE = '#2253b0';
const COPPER = '#a35f2a';
const LINE = '#d9cfba';
const PAPER = '#fbf8f1';
const MUTED = '#5a6475';
const SANS = "'IBM Plex Sans', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

/** Shriftlar yuklangach chizish kerak (aks holda canvas zaxira shriftni oladi). */
export async function loadCertFonts() {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(
    [`600 72px ${SANS}`, `400 30px ${SANS}`, `600 40px ${MONO}`, `400 24px ${MONO}`].map((f) =>
      document.fonts.load(f, 'ABCabcʻ’ЖжЎўҚқ').catch(() => []),
    ),
  );
}

/** Burchakdagi plata yo'li: kontakt, 45° burilish, kontakt. sx/sy — yo'nalish (±1). */
function trace(ctx: CanvasRenderingContext2D, x: number, y: number, sx: number, sy: number) {
  ctx.strokeStyle = COPPER;
  ctx.fillStyle = PAPER;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [len, off] of [
    [150, 0],
    [110, 26],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, y + sy * off);
    ctx.lineTo(x + sx * (len - 40), y + sy * off);
    ctx.lineTo(x + sx * len, y + sy * (off + 40));
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + sx * len, y + sy * (off + 40), 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

/** O'yin logotipi (Home.tsx dagi SVG bilan bir xil shakllar), markazi (cx, cy), o'lchami s. */
function logo(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.save();
  ctx.translate(cx - (32 * s) / 64, cy - (32 * s) / 64);
  ctx.scale(s / 64, s / 64);
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = COPPER;
  ctx.stroke(new Path2D('M8 15l7 7M8 49l7-7M44 32h6'));
  ctx.fillStyle = COPPER;
  for (const y of [15, 49]) {
    ctx.beginPath();
    ctx.arc(6, y, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = PAPER;
  ctx.strokeStyle = INK;
  const gate = new Path2D('M15 12h9a20 20 0 0 1 0 40h-9Z');
  ctx.fill(gate);
  ctx.stroke(gate);
  ctx.fillStyle = BLUE;
  ctx.beginPath();
  ctx.roundRect(50, 26, 10, 12, 5);
  ctx.fill();
  ctx.restore();
}

/** Matnni kenglikka sig'dirib (shrift kichrayadi) markazda yozadi. */
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, weight: number, size: number, family: string) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxW && s > 14) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  ctx.fillText(text, x, y);
}

export function drawCertificate(ctx: CanvasRenderingContext2D, d: CertData, name: string, L: CertLabels) {
  const W = CERT_W;
  const H = CERT_H;
  ctx.save();
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  // Ramka: tashqi siyoh va ichki ingichka chiziq.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.strokeRect(58, 58, W - 116, H - 116);
  trace(ctx, 80, 92, 1, 1);
  trace(ctx, W - 80, 92, -1, 1);
  trace(ctx, 80, H - 92, 1, -1);
  trace(ctx, W - 80, H - 92, -1, -1);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Sarlavha: logotip va o'yin nomi.
  logo(ctx, W / 2 - 150, 150, 72);
  ctx.fillStyle = INK;
  ctx.font = `600 40px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.fillText('LOGIC', W / 2 - 100, 164);
  ctx.fillStyle = BLUE;
  ctx.fillText('GATE', W / 2 + 40, 164);
  ctx.textAlign = 'center';

  ctx.fillStyle = INK;
  fitText(ctx, L.title.toUpperCase(), W / 2, 290, W - 400, 600, 76, SANS);
  ctx.fillStyle = MUTED;
  ctx.font = `400 30px ${SANS}`;
  ctx.fillText(L.given, W / 2, 360);

  // Ism.
  ctx.fillStyle = BLUE;
  fitText(ctx, name, W / 2, 460, W - 360, 600, 84, SANS);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 420, 492);
  ctx.lineTo(W / 2 + 420, 492);
  ctx.stroke();

  ctx.fillStyle = INK;
  fitText(ctx, L.reason, W / 2, 560, W - 300, 400, 32, SANS);

  // Bo'limlar: ikki ustun, tugatilgani — belgi bilan.
  const col = Math.ceil(d.chapters.length / 2);
  const x0 = W / 2 - 470;
  d.chapters.forEach((c, i) => {
    const x = x0 + (i < col ? 0 : 500);
    const y = 630 + (i % col) * 52;
    ctx.strokeStyle = c.done ? BLUE : LINE;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y - 24, 28, 28);
    if (c.done) {
      ctx.beginPath();
      ctx.moveTo(x + 6, y - 10);
      ctx.lineTo(x + 12, y - 3);
      ctx.lineTo(x + 23, y - 19);
      ctx.stroke();
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = c.done ? INK : MUTED;
    ctx.font = `${c.done ? 600 : 400} 26px ${SANS}`;
    let label = `${c.n}. ${c.title}`;
    while (ctx.measureText(label).width > 420 && label.length > 4) label = label.slice(0, -2) + '…';
    ctx.fillText(label, x + 44, y);
    ctx.textAlign = 'center';
  });

  ctx.fillStyle = COPPER;
  ctx.font = `600 30px ${MONO}`;
  ctx.fillText(L.stats, W / 2, 630 + col * 52 + 22);

  // Pastki qism: sana, muhr, sayt — burchakdagi yo'llardan yuqorida.
  const yb = H - 190;
  ctx.fillStyle = MUTED;
  ctx.font = `400 24px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.fillText(L.date, 150, yb);
  ctx.textAlign = 'right';
  ctx.fillText(L.site, W - 150, yb);
  ctx.textAlign = 'center';
  ctx.strokeStyle = COPPER;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(W / 2, yb + 4, 52, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, yb + 4, 44, 0, Math.PI * 2);
  ctx.stroke();
  logo(ctx, W / 2 + 2, yb + 4, 54);
  ctx.restore();
}
