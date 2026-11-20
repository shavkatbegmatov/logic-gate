// 3D modellar uchun Canvas2D teksturalar generatori: chiplar ustki yozuvi, plata sirti va pin belgilari.
import { GATE_TYPES, type GateType } from '../../sim/types';
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
    slabTop: [0.04, 0.16, 0.11],
    slabSide: [0.22, 0.28, 0.18],
    floor: [0.02, 0.05, 0.04],
    gateBody: [0.09, 0.1, 0.12],
    gateAccent: [1.0, 0.75, 0.26],
    traceOff: [0.16, 0.44, 0.31],
    traceOn: [1.0, 0.76, 0.25],
    pulse: [1.0, 0.96, 0.72],
    lampOff: [0.12, 0.2, 0.16],
    lampOn: [1.0, 0.78, 0.24],
    pinBox: [0.08, 0.16, 0.12],
    sel: [0.35, 0.8, 1.0],
    good: [0.32, 0.88, 0.56],
    bad: [1.0, 0.36, 0.32],
    metal: [0.78, 0.82, 0.85],
    brass: [0.85, 0.65, 0.28],
    ambientSky: [0.24, 0.34, 0.3],
    ambientGround: [0.06, 0.1, 0.08],
    clearColor: [0.024, 0.055, 0.043],
  },
  bench: {
    slabTop: [0.08, 0.11, 0.14],
    slabSide: [0.18, 0.22, 0.27],
    floor: [0.04, 0.055, 0.07],
    gateBody: [0.13, 0.16, 0.21],
    gateAccent: [0.22, 0.74, 0.97],
    traceOff: [0.27, 0.33, 0.4],
    traceOn: [0.98, 0.75, 0.14],
    pulse: [1.0, 0.95, 0.75],
    lampOff: [0.11, 0.14, 0.18],
    lampOn: [0.99, 0.75, 0.18],
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
    gateAccent: [0.15, 0.39, 0.76],
    traceOff: [0.35, 0.41, 0.48],
    traceOn: [0.92, 0.24, 0.22],
    pulse: [1.0, 0.88, 0.48],
    lampOff: [0.72, 0.68, 0.63],
    lampOn: [1.0, 0.28, 0.24],
    pinBox: [0.94, 0.92, 0.88],
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
    traceOff: [0.11, 0.26, 0.45],
    traceOn: [0.15, 0.94, 1.0],
    pulse: [0.9, 0.99, 1.0],
    lampOff: [0.06, 0.12, 0.23],
    lampOn: [0.15, 0.95, 1.0],
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

export function gateAtlasUV(type: GateType): UVRect {
  const idx = GATE_TYPES.indexOf(type);
  const col = idx % 4;
  const row = Math.floor(idx / 4);
  const pad = 0.004;
  return {
    u0: col * 0.25 + pad,
    v0: row * 0.5 + pad,
    u1: (col + 1) * 0.25 - pad,
    v1: (row + 1) * 0.5 - pad,
  };
}

export function buildChipAtlasCanvas(style: RealStyle): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  const bg = style === 'bench' ? '#1c2430' : style === 'scifi' ? '#0a162b' : '#17191d';
  const stroke = style === 'scifi' ? '#4de8ff' : style === 'bench' ? '#9fd8ff' : '#dce6de';
  const sub = style === 'scifi' ? '#4fa8d6' : style === 'bench' ? '#7b97b3' : '#85968a';
  const bezel = style === 'scifi' ? '#185482' : style === 'bench' ? '#364659' : '#2a2e35';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);

  GATE_TYPES.forEach((type, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const ox = col * 256;
    const oy = row * 256;

    ctx.save();
    ctx.translate(ox, oy);

    // Chip yuzasi gradienti va mayda hoshiya
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = bezel;
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 236, 236);

    // 1-oyoqcha belgisi (chuqurcha)
    ctx.fillStyle = sub;
    ctx.beginPath();
    ctx.arc(32, 32, 8, 0, Math.PI * 2);
    ctx.fill();

    // ANSI mantiqiy belgi
    ctx.save();
    ctx.translate(64, 34);
    ctx.scale(1.8, 1.8);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (type === 'DFF') {
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
    ctx.fillStyle = stroke;
    ctx.font = '700 42px "IBM Plex Mono", monospace';
    ctx.fillText(type, 128, 162);

    ctx.fillStyle = sub;
    ctx.font = '600 24px "IBM Plex Mono", monospace';
    ctx.fillText(CHIP_CODE[type], 128, 206);

    ctx.restore();
  });

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
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  const uvs = new Map<string, UVRect>();

  const unique = [...new Set(['000', ...labels])].slice(0, 32);
  const cols = 4;
  const rows = 8;
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
