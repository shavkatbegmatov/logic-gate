// 3D modellar uchun Canvas2D teksturalar generatori: chiplar ustki yozuvi, plata sirti va pin belgilari.
import { BLOCK_TYPES, GATE_TYPES, isBlock, type GateType } from '../../sim/types';
import type { RealStyle } from '../../theme';
import { CHIP_CODE } from '../GateShape';
import { DFF_BODY, SHAPES } from '../shapes';

export interface UVRect {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export interface StylePalette3D {
  slabTop: [number, number, number];
  slabSide: [number, number, number];
  floor: [number, number, number];
  gateBody: [number, number, number];
  gateAccent: [number, number, number];
  traceOff: [number, number, number];
  traceOn: [number, number, number];
  pulse: [number, number, number];
  lampOff: [number, number, number];
  lampOn: [number, number, number];
  pinBox: [number, number, number];
  sel: [number, number, number];
  good: [number, number, number];
  bad: [number, number, number];
  metal: [number, number, number];
  brass: [number, number, number];
  ambientSky: [number, number, number];
  ambientGround: [number, number, number];
  clearColor: [number, number, number];
}

export const PALETTES_3D: Record<RealStyle, StylePalette3D> = {
  pcb: {
    slabTop: [0.055, 0.2, 0.135],
    slabSide: [0.22, 0.28, 0.18],
    floor: [0.042, 0.088, 0.068],
    gateBody: [0.09, 0.1, 0.12],
    gateAccent: [1.0, 0.75, 0.26],
    traceOff: [0.13, 0.33, 0.24],
    traceOn: [1.0, 0.73, 0.1],
    pulse: [1.0, 0.98, 0.84],
    lampOff: [0.1, 0.16, 0.13],
    lampOn: [1.0, 0.78, 0.14],
    pinBox: [0.08, 0.16, 0.12],
    sel: [0.35, 0.8, 1.0],
    good: [0.32, 0.88, 0.56],
    bad: [1.0, 0.36, 0.32],
    metal: [0.78, 0.82, 0.85],
    brass: [0.85, 0.65, 0.28],
    ambientSky: [0.3, 0.42, 0.36],
    ambientGround: [0.08, 0.13, 0.1],
    clearColor: [0.036, 0.076, 0.058],
  },
  bench: {
    slabTop: [0.08, 0.11, 0.14],
    slabSide: [0.18, 0.22, 0.27],
    floor: [0.04, 0.055, 0.07],
    gateBody: [0.13, 0.16, 0.21],
    gateAccent: [0.22, 0.74, 0.97],
    traceOff: [0.23, 0.28, 0.35],
    traceOn: [1.0, 0.72, 0.1],
    pulse: [1.0, 0.97, 0.84],
    lampOff: [0.11, 0.14, 0.18],
    lampOn: [1.0, 0.76, 0.14],
    pinBox: [0.12, 0.15, 0.2],
    sel: [0.22, 0.74, 0.97],
    good: [0.29, 0.87, 0.5],
    bad: [0.97, 0.44, 0.44],
    metal: [0.76, 0.8, 0.86],
    brass: [0.85, 0.66, 0.32],
    ambientSky: [0.25, 0.31, 0.38],
    ambientGround: [0.07, 0.09, 0.12],
    clearColor: [0.05, 0.068, 0.088],
  },
  breadboard: {
    slabTop: [0.92, 0.9, 0.85],
    slabSide: [0.78, 0.75, 0.68],
    floor: [0.82, 0.79, 0.73],
    gateBody: [0.12, 0.13, 0.16],
    gateAccent: [0.95, 0.18, 0.14],
    traceOff: [0.33, 0.37, 0.43],
    traceOn: [0.95, 0.16, 0.12],
    pulse: [1.0, 0.86, 0.08],
    lampOff: [0.54, 0.52, 0.49],
    lampOn: [0.96, 0.16, 0.12],
    pinBox: [0.8, 0.77, 0.71],
    sel: [0.08, 0.54, 0.86],
    good: [0.15, 0.6, 0.34],
    bad: [0.84, 0.16, 0.2],
    metal: [0.76, 0.79, 0.83],
    brass: [0.82, 0.62, 0.26],
    ambientSky: [0.68, 0.66, 0.62],
    ambientGround: [0.42, 0.39, 0.35],
    clearColor: [0.85, 0.82, 0.76],
  },
  scifi: {
    slabTop: [0.03, 0.07, 0.15],
    slabSide: [0.08, 0.26, 0.42],
    floor: [0.015, 0.03, 0.07],
    gateBody: [0.05, 0.1, 0.2],
    gateAccent: [0.0, 0.9, 1.0],
    traceOff: [0.1, 0.2, 0.34],
    traceOn: [0.04, 0.92, 1.0],
    pulse: [0.96, 1.0, 1.0],
    lampOff: [0.06, 0.11, 0.2],
    lampOn: [0.08, 0.95, 1.0],
    pinBox: [0.05, 0.11, 0.22],
    sel: [1.0, 0.82, 0.4],
    good: [0.2, 0.96, 0.66],
    bad: [1.0, 0.36, 0.48],
    metal: [0.62, 0.78, 0.92],
    brass: [0.38, 0.74, 0.95],
    ambientSky: [0.18, 0.3, 0.46],
    ambientGround: [0.04, 0.08, 0.16],
    clearColor: [0.02, 0.038, 0.082],
  },
};

/** Atlasdagi kataklar: 4 ustun, har holat (0/1) uchun ATLAS_ROWS qator. */
const ATLAS_TYPES: GateType[] = [...GATE_TYPES, 'DFF', ...BLOCK_TYPES];
const ATLAS_ROWS = Math.ceil(ATLAS_TYPES.length / 4);

export function gateAtlasUV(type: GateType, on = false): UVRect {
  const idx = Math.max(0, ATLAS_TYPES.indexOf(type));
  const col = idx % 4;
  const row = Math.floor(idx / 4) + (on ? ATLAS_ROWS : 0);
  const pad = 0.004;
  const rows = ATLAS_ROWS * 2;
  return {
    u0: col * 0.25 + pad,
    v0: row / rows + pad,
    u1: (col + 1) * 0.25 - pad,
    v1: (row + 1) / rows - pad,
  };
}

export function buildChipAtlasCanvas(style: RealStyle): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256 * ATLAS_ROWS * 2;
  const ctx = c.getContext('2d')!;

  const offBg = style === 'bench' ? '#1c2430' : style === 'scifi' ? '#0a162b' : '#17191d';
  const offStroke = style === 'scifi' ? '#4de8ff' : style === 'bench' ? '#9fd8ff' : '#dce6de';
  const offSub = style === 'scifi' ? '#4fa8d6' : style === 'bench' ? '#7b97b3' : '#85968a';
  const offBezel = style === 'scifi' ? '#185482' : style === 'bench' ? '#364659' : '#2a2e35';

  const onBg = style === 'breadboard' ? '#2b1414' : style === 'scifi' ? '#0a2742' : '#262012';
  const onCol = style === 'breadboard' ? '#ff3b2f' : style === 'scifi' ? '#00f0ff' : '#ffbe42';
  const onText = style === 'breadboard' ? '#ffece8' : style === 'scifi' ? '#dffcff' : '#fff6d6';
  const onBadgeInk = style === 'breadboard' ? '#ffffff' : '#111518';

  ctx.fillStyle = offBg;
  ctx.fillRect(0, 0, c.width, c.height);

  for (const on of [false, true]) {
    ATLAS_TYPES.forEach((type, idx) => {
      const col = idx % 4;
      const row = Math.floor(idx / 4) + (on ? ATLAS_ROWS : 0);
      const ox = col * 256;
      const oy = row * 256;

      ctx.save();
      ctx.translate(ox, oy);

      ctx.fillStyle = on ? onBg : offBg;
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = on ? onCol : offBezel;
      ctx.lineWidth = on ? 8 : 4;
      ctx.strokeRect(10, 10, 236, 236);

      // 1-oyoqcha belgisi (chuqurcha)
      ctx.fillStyle = on ? onCol : offSub;
      ctx.beginPath();
      ctx.arc(32, 32, 8, 0, Math.PI * 2);
      ctx.fill();

      // Yuqori o'ng burchakda holat nishoni (0 / 1)
      ctx.fillStyle = on ? onCol : 'rgba(255,255,255,0.08)';
      ctx.fillRect(190, 18, 44, 34);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = on ? onBadgeInk : offSub;
      ctx.font = '700 26px "IBM Plex Mono", monospace';
      ctx.fillText(on ? '1' : '0', 212, 36);

      // ANSI mantiqiy belgi
      ctx.save();
      ctx.translate(64, 34);
      ctx.scale(1.8, 1.8);
      ctx.strokeStyle = on ? onCol : offStroke;
      ctx.lineWidth = on ? 3.4 : 3;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (isBlock(type)) {
        // Blok: oddiy to'rtburchak korpus, belgi o'rnida nomi (pastda yoziladi).
        ctx.strokeRect(14, 6, 44, 36);
      } else if (type === 'DFF') {
        const d = DFF_BODY;
        ctx.strokeRect(d.x, d.y, d.w, d.h);
        ctx.stroke(new Path2D(d.clock));
      } else {
        const s = SHAPES[type];
        if (s.back) ctx.stroke(new Path2D(s.back));
        ctx.stroke(new Path2D(s.body));
        if (s.bubble) {
          ctx.beginPath();
          ctx.arc(s.tip + 4, 24, 4, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();

      // Turi va mikrosxema markasi
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = on ? onText : offStroke;
      ctx.font = '700 42px "IBM Plex Mono", monospace';
      ctx.fillText(type, 128, 162);

      ctx.fillStyle = on ? onCol : offSub;
      ctx.font = '600 24px "IBM Plex Mono", monospace';
      ctx.fillText(CHIP_CODE[type], 128, 206);

      ctx.restore();
    });
  }

  return c;
}

export function buildBoardTileCanvas(style: RealStyle): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  if (style === 'pcb') {
    ctx.fillStyle = '#092419';
    ctx.fillRect(0, 0, 256, 256);
    // FR-4 shishatekstolit to'qimasi
    ctx.strokeStyle = 'rgba(28, 92, 66, 0.28)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 256; i += 16) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }
    // Oltin/mis mikro-teshiklar (to'r qadamiga mos)
    ctx.fillStyle = '#184b36';
    ctx.strokeStyle = '#3f8f68';
    ctx.lineWidth = 2;
    for (let x = 32; x < 256; x += 64) {
      for (let y = 32; y < 256; y += 64) {
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  } else if (style === 'bench') {
    ctx.fillStyle = '#141a21';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(130, 165, 200, 0.16)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(130, 165, 200, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 64; i < 256; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }
  } else if (style === 'breadboard') {
    ctx.fillStyle = '#f5f1e7';
    ctx.fillRect(0, 0, 256, 256);
    for (let x = 16; x < 256; x += 32) {
      for (let y = 16; y < 256; y += 32) {
        ctx.fillStyle = '#47423a';
        ctx.fillRect(x - 5, y - 5, 10, 10);
        ctx.fillStyle = '#201e1a';
        ctx.fillRect(x - 3, y - 3, 6, 6);
      }
    }
  } else {
    // scifi
    ctx.fillStyle = '#071124';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.22)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 254, 254);
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 64; i < 256; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0, 229, 255, 0.45)';
    for (let x = 64; x < 256; x += 64) {
      for (let y = 64; y < 256; y += 64) {
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
    }
  }
  return c;
}

export interface LabelAtlas {
  canvas: HTMLCanvasElement;
  uvs: Map<string, UVRect>;
}

export function buildLabelAtlasCanvas(_style: RealStyle, labels: string[], expWord = 'kerak'): LabelAtlas {
  // Shinali darajada sonlar (0–15) ham yoziladi — 32 katak yetmaydi; boshqa darajalarda avvalgidek 512×512.
  const unique = [...new Set(['000', '0', '1', ...labels])].slice(0, 64);
  const rows = unique.length > 32 ? 16 : 8;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = rows * 64;
  const ctx = c.getContext('2d')!;
  const uvs = new Map<string, UVRect>();

  const cols = 4;
  const cw = c.width / cols;
  const ch = c.height / rows;

  ctx.clearRect(0, 0, c.width, c.height);

  unique.forEach((txt, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = col * cw;
    const y = row * ch;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const isSub = txt.startsWith('exp:');
    const display = isSub ? `${expWord}: ${txt.slice(4)}` : txt;
    ctx.fillStyle = '#ffffff';
    ctx.font = isSub ? '600 18px "IBM Plex Mono", monospace' : '700 32px "IBM Plex Mono", monospace';
    ctx.fillText(display, x + cw / 2, y + ch / 2);

    const padU = 0.004;
    const padV = 0.003;
    uvs.set(txt, {
      u0: col / cols + padU,
      v0: row / rows + padV,
      u1: (col + 1) / cols - padU,
      v1: (row + 1) / rows - padV,
    });
  });

  return { canvas: c, uvs };
}
