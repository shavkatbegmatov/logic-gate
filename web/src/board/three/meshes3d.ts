// 3D apparat geometriyasi quruvchisi: PCB platasi, DIP mikrosxemalar, egilgan jumper simlar, tumbler va svetodiodlar.
import type { Circuit, Spec } from '../../sim/types';
import type { RealStyle } from '../../theme';
import { bounds, GATE_H, GATE_W, inputPortY, isSourcePort, outputPortY, type Layout, type Point } from '../geometry';
import type { Routed } from '../routing';
import { inputLeads, outputY } from '../shapes';
import { clamp, normalize3, sub3, type Vec3 } from './math3d';
import { gateAtlasUV, PALETTES_3D, type UVRect } from './textures3d';

export const VERTEX_FLOATS = 16;

export interface MeshBucket {
  verts: Float32Array;
  indices: Uint16Array;
  vertCount: number;
  indexCount: number;
}

export interface PointLight3D {
  pos: Vec3;
  color: [number, number, number];
  intensity: number;
}

export interface WireHit3D {
  index: number;
  pts: Vec3[];
}

export interface Scene3DData {
  solid: MeshBucket;
  boardTop: MeshBucket;
  chipTops: MeshBucket;
  labels: MeshBucket;
  lights: PointLight3D[];
  wireHits: WireHit3D[];
  bounds3D: { minX: number; minZ: number; maxX: number; maxZ: number };
  /**
   * Sahnada yoniq sim bor: animatsiya yoqilgan bo'lsa, signal to'lqini (shaders3d: emissive > 0.5 va
   * pulseCoord > 0.01) vaqt bilan yuguradi — kadr har safar chizilishi kerak. Yo'q bo'lsa, sahna yoki
   * kamera o'zgarmaguncha har kadr oldingisining aynan nusxasi.
   */
  pulsing: boolean;
}

/** Shaderdagi signal to'lqini shartiga mos uch bormi (emissive — 14, pulseCoord — 15-o'rin). */
export function hasPulse(b: MeshBucket): boolean {
  for (let o = 0; o < b.vertCount * VERTEX_FLOATS; o += VERTEX_FLOATS) {
    if (b.verts[o + 14] > 0.5 && b.verts[o + 15] > 0.01) return true;
  }
  return false;
}

export interface SceneBuildInput {
  style: RealStyle;
  spec: Spec;
  circuit: Circuit;
  layout: Layout;
  routed: Routed;
  values: Map<string, number>;
  outputs: (number | null)[];
  bits: number[];
  expected?: number[] | null;
  drivers: Map<string, string>;
  reached: (src: string, extra: number) => boolean;
  selection: { kind: 'gate'; id: string } | { kind: 'wire'; index: number } | null;
  activePort: string | null;
  highlight: string | null;
  draggingGateId: string | null;
  ghost: { a: Point; b: Point } | null;
  leverAngles: Map<string, number>;
  stateNames: Map<string, string>;
  labelUVs: Map<string, UVRect>;
}

const JUMPER_RGB: [number, number, number][] = [
  [0.23, 0.51, 0.96],
  [0.06, 0.72, 0.5],
  [0.96, 0.62, 0.04],
  [0.66, 0.33, 0.97],
  [0.02, 0.71, 0.83],
  [0.92, 0.28, 0.6],
];

function jumperColor(net: string): [number, number, number] {
  let h = 0;
  for (let i = 0; i < net.length; i++) h = (h * 31 + net.charCodeAt(i)) | 0;
  return JUMPER_RGB[Math.abs(h) % JUMPER_RGB.length];
}

export class MeshBuilder {
  private v = new Float32Array(2048 * VERTEX_FLOATS);
  private i = new Uint16Array(4096);
  private vc = 0;
  private ic = 0;

  private ensureV(extra: number) {
    if ((this.vc + extra) * VERTEX_FLOATS <= this.v.length) return;
    const next = new Float32Array(Math.max(this.v.length * 2, (this.vc + extra) * VERTEX_FLOATS));
    next.set(this.v);
    this.v = next;
  }

  private ensureI(extra: number) {
    if (this.ic + extra <= this.i.length) return;
    const next = new Uint16Array(Math.max(this.i.length * 2, this.ic + extra));
    next.set(this.i);
    this.i = next;
  }

  vert(
    px: number,
    py: number,
    pz: number,
    nx: number,
    ny: number,
    nz: number,
    u: number,
    v: number,
    col: [number, number, number],
    rough: number,
    metal: number,
    emissive = 0,
    pulseCoord = 0,
  ): number {
    this.ensureV(1);
    const idx = this.vc;
    const o = idx * VERTEX_FLOATS;
    this.v[o] = px;
    this.v[o + 1] = py;
    this.v[o + 2] = pz;
    this.v[o + 3] = nx;
    this.v[o + 4] = ny;
    this.v[o + 5] = nz;
    this.v[o + 6] = u;
    this.v[o + 7] = v;
    this.v[o + 8] = col[0];
    this.v[o + 9] = col[1];
    this.v[o + 10] = col[2];
    this.v[o + 11] = 1;
    this.v[o + 12] = rough;
    this.v[o + 13] = metal;
    this.v[o + 14] = emissive;
    this.v[o + 15] = pulseCoord;
    this.vc++;
    return idx;
  }

  tri(a: number, b: number, c: number) {
    this.ensureI(3);
    this.i[this.ic++] = a;
    this.i[this.ic++] = b;
    this.i[this.ic++] = c;
  }

  quad(
    p0: Vec3,
    p1: Vec3,
    p2: Vec3,
    p3: Vec3,
    n: Vec3,
    col: [number, number, number],
    rough: number,
    metal: number,
    emissive = 0,
    uv: UVRect = { u0: 0, v0: 0, u1: 1, v1: 1 },
  ) {
    const v0 = this.vert(p0[0], p0[1], p0[2], n[0], n[1], n[2], uv.u0, uv.v0, col, rough, metal, emissive);
    const v1 = this.vert(p1[0], p1[1], p1[2], n[0], n[1], n[2], uv.u1, uv.v0, col, rough, metal, emissive);
    const v2 = this.vert(p2[0], p2[1], p2[2], n[0], n[1], n[2], uv.u1, uv.v1, col, rough, metal, emissive);
    const v3 = this.vert(p3[0], p3[1], p3[2], n[0], n[1], n[2], uv.u0, uv.v1, col, rough, metal, emissive);
    this.tri(v0, v3, v2);
    this.tri(v0, v2, v1);
  }

  addBox(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    col: [number, number, number],
    rough: number,
    metal: number,
    emissive = 0,
    topUV?: UVRect,
  ) {
    // Yuqori (+Y)
    this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], col, rough, metal, emissive, topUV);
    // Pastki (-Y)
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], [0, -1, 0], col, rough, metal, emissive);
    // Old (+Z)
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1], [0, 0, 1], col, rough, metal, emissive);
    // Orqa (-Z)
    this.quad([x1, y1, z0], [x0, y1, z0], [x0, y0, z0], [x1, y0, z0], [0, 0, -1], col, rough, metal, emissive);
    // O'ng (+X)
    this.quad([x1, y1, z1], [x1, y1, z0], [x1, y0, z0], [x1, y0, z1], [1, 0, 0], col, rough, metal, emissive);
    // Chap (-X)
    this.quad([x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [x0, y0, z0], [-1, 0, 0], col, rough, metal, emissive);
  }

  /** Ichki qismini yopmaydigan to'rt qirrali hoshiya (ramka). */
  addFrameBox(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    t: number,
    col: [number, number, number],
    rough: number,
    metal: number,
    emissive = 0,
  ) {
    this.addBox(x0, y0, z1 - t, x1, y1, z1, col, rough, metal, emissive);
    this.addBox(x0, y0, z0, x1, y1, z0 + t, col, rough, metal, emissive);
    this.addBox(x0, y0, z0 + t, x0 + t, y1, z1 - t, col, rough, metal, emissive);
    this.addBox(x1 - t, y0, z0 + t, x1, y1, z1 - t, col, rough, metal, emissive);
  }

  addCylinderY(
    cx: number,
    y0: number,
    y1: number,
    cz: number,
    rBot: number,
    rTop: number,
    segs: number,
    col: [number, number, number],
    rough: number,
    metal: number,
    emissive = 0,
  ) {
    const dy = y1 - y0;
    const dr = rBot - rTop;
    const nLen = Math.hypot(dy, dr) || 1;
    const ny = dr / nLen;
    const nr = dy / nLen;

    const topC = this.vert(cx, y1, cz, 0, 1, 0, 0.5, 0.5, col, rough, metal, emissive);
    const botC = this.vert(cx, y0, cz, 0, -1, 0, 0.5, 0.5, col, rough, metal, emissive);

    const ringBot: number[] = [];
    const ringTop: number[] = [];
    const capTop: number[] = [];
    const capBot: number[] = [];

    for (let s = 0; s <= segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      ringBot.push(this.vert(cx + ca * rBot, y0, cz + sa * rBot, ca * nr, ny, sa * nr, s / segs, 0, col, rough, metal, emissive));
      ringTop.push(this.vert(cx + ca * rTop, y1, cz + sa * rTop, ca * nr, ny, sa * nr, s / segs, 1, col, rough, metal, emissive));
      capTop.push(this.vert(cx + ca * rTop, y1, cz + sa * rTop, 0, 1, 0, 0.5, 0.5, col, rough, metal, emissive));
      capBot.push(this.vert(cx + ca * rBot, y0, cz + sa * rBot, 0, -1, 0, 0.5, 0.5, col, rough, metal, emissive));
    }

    for (let s = 0; s < segs; s++) {
      this.tri(ringBot[s], ringTop[s], ringTop[s + 1]);
      this.tri(ringBot[s], ringTop[s + 1], ringBot[s + 1]);
      this.tri(topC, capTop[s + 1], capTop[s]);
      this.tri(botC, capBot[s], capBot[s + 1]);
    }
  }

  /** Ikki rangli sanoat tumbler dastagi (xrom asos + yuqori kontrastli uchlik). */
  addTiltedLever(
    cx: number,
    cy: number,
    cz: number,
    angleX: number,
    len: number,
    r: number,
    shaftCol: [number, number, number],
    gripCol: [number, number, number],
    gripEmissive = 0,
    accentCol?: [number, number, number],
  ) {
    // Tumbler X o'qi bo'ylab chap/o'ngga og'adi (0 → chap -X, 1 → o'ng +X).
    const dx = Math.sin(angleX);
    const dy = Math.cos(angleX);
    const mid: Vec3 = [cx + dx * len * 0.55, cy + dy * len * 0.55, cz];
    const tip: Vec3 = [cx + dx * len, cy + dy * len, cz];
    this.addTube([[cx, cy, cz], mid], r, 8, shaftCol, 0.14, 0.92, 0);
    if (accentCol) {
      this.addSphere(mid[0], mid[1], mid[2], r * 1.48, 8, 4, accentCol, 0.2, 0.25, gripEmissive * 0.8);
    }
    this.addTube([mid, tip], r * 1.38, 10, gripCol, 0.25, 0.08, gripEmissive);
    this.addSphere(tip[0], tip[1], tip[2], r * 1.65, 10, 5, gripCol, 0.22, 0.08, gripEmissive);
  }

  addSphere(
    cx: number,
    cy: number,
    cz: number,
    r: number,
    segs: number,
    rings: number,
    col: [number, number, number],
    rough: number,
    metal: number,
    emissive = 0,
    halfOnly = false,
    pulseCoord = 0,
  ) {
    const maxLat = halfOnly ? Math.PI * 0.5 : Math.PI;
    const grid: number[][] = [];
    for (let j = 0; j <= rings; j++) {
      const phi = (j / rings) * maxLat;
      const sp = Math.sin(phi);
      const cp = Math.cos(phi);
      const row: number[] = [];
      for (let i = 0; i <= segs; i++) {
        const theta = (i / segs) * Math.PI * 2;
        const nx = sp * Math.cos(theta);
        const ny = cp;
        const nz = sp * Math.sin(theta);
        row.push(this.vert(cx + nx * r, cy + ny * r, cz + nz * r, nx, ny, nz, i / segs, j / rings, col, rough, metal, emissive, pulseCoord));
      }
      grid.push(row);
    }
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < segs; i++) {
        const a = grid[j][i];
        const b = grid[j + 1][i];
        const c = grid[j + 1][i + 1];
        const d = grid[j][i + 1];
        this.tri(a, b, c);
        this.tri(a, c, d);
      }
    }
  }

  /** Silliq 3D sim trubasi: mustaqil segment silindrlari va burchak shar bo'g'inlari bilan. */
  addTube(
    pts: Vec3[],
    radius: number,
    segs: number,
    col: [number, number, number],
    rough: number,
    metal: number,
    emissive = 0,
  ) {
    if (pts.length < 2) return;
    let dist = 0;
    for (let p = 0; p < pts.length - 1; p++) {
      const aPt = pts[p];
      const bPt = pts[p + 1];
      const segVec = sub3(bPt, aPt);
      const segLen = Math.hypot(segVec[0], segVec[1], segVec[2]);
      if (segLen < 1e-4) continue;
      const dir: Vec3 = [segVec[0] / segLen, segVec[1] / segLen, segVec[2] / segLen];
      const up: Vec3 = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      const t1 = normalize3([
        up[1] * dir[2] - up[2] * dir[1],
        up[2] * dir[0] - up[0] * dir[2],
        up[0] * dir[1] - up[1] * dir[0],
      ]);
      const t2: Vec3 = [
        dir[1] * t1[2] - dir[2] * t1[1],
        dir[2] * t1[0] - dir[0] * t1[2],
        dir[0] * t1[1] - dir[1] * t1[0],
      ];
      const d0 = dist;
      const d1 = dist + segLen;
      dist = d1;

      const r0: number[] = [];
      const r1: number[] = [];
      for (let s = 0; s <= segs; s++) {
        const a = (s / segs) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const nx = t1[0] * ca + t2[0] * sa;
        const ny = t1[1] * ca + t2[1] * sa;
        const nz = t1[2] * ca + t2[2] * sa;
        r0.push(
          this.vert(aPt[0] + nx * radius, aPt[1] + ny * radius, aPt[2] + nz * radius, nx, ny, nz, s / segs, d0 * 0.02, col, rough, metal, emissive, d0),
        );
        r1.push(
          this.vert(bPt[0] + nx * radius, bPt[1] + ny * radius, bPt[2] + nz * radius, nx, ny, nz, s / segs, d1 * 0.02, col, rough, metal, emissive, d1),
        );
      }
      for (let s = 0; s < segs; s++) {
        this.tri(r0[s], r1[s], r1[s + 1]);
        this.tri(r0[s], r1[s + 1], r0[s + 1]);
      }
      if (p < pts.length - 2) {
        this.addSphere(bPt[0], bPt[1], bPt[2], radius, segs, 4, col, rough, metal, emissive, false, dist);
      }
    }
  }

  /** Tekis to'rtburchak mis/plazma yo'l (PCB / Sci-Fi sirtidagi bo'rtma yo'l). */
  addFlatTrace(pts: Vec3[], halfW: number, height: number, col: [number, number, number], rough: number, metal: number, emissive = 0) {
    if (pts.length < 2) return;
    let dist = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k];
      const b = pts[k + 1];
      const dx = b[0] - a[0];
      const dz = b[2] - a[2];
      const len = Math.hypot(dx, dz);
      if (len < 1e-4) continue;
      const nx = (-dz / len) * halfW;
      const nz = (dx / len) * halfW;
      const d0 = dist;
      const d1 = dist + len;
      dist = d1;

      const y0 = a[1];
      const y1 = a[1] + height;
      const t0 = this.vert(a[0] - nx, y1, a[2] - nz, 0, 1, 0, 0, 0, col, rough, metal, emissive, d0);
      const t1 = this.vert(a[0] + nx, y1, a[2] + nz, 0, 1, 0, 1, 0, col, rough, metal, emissive, d0);
      const t2 = this.vert(b[0] + nx, y1, b[2] + nz, 0, 1, 0, 1, 1, col, rough, metal, emissive, d1);
      const t3 = this.vert(b[0] - nx, y1, b[2] - nz, 0, 1, 0, 0, 1, col, rough, metal, emissive, d1);
      this.tri(t0, t2, t1);
      this.tri(t0, t3, t2);

      // Yo'lning ikki yon qirrasi
      const sN1 = normalize3([-nx, 0, -nz]);
      const sN2 = normalize3([nx, 0, nz]);
      this.quad([a[0] - nx, y1, a[2] - nz], [b[0] - nx, y1, b[2] - nz], [b[0] - nx, y0, b[2] - nz], [a[0] - nx, y0, a[2] - nz], sN1, col, rough, metal, emissive);
      this.quad([b[0] + nx, y1, b[2] + nz], [a[0] + nx, y1, a[2] + nz], [a[0] + nx, y0, a[2] + nz], [b[0] + nx, y0, b[2] + nz], sN2, col, rough, metal, emissive);
    }
    // Bo'g'in nuqtalarida silliq doira
    for (const p of pts) {
      this.addCylinderY(p[0], p[1], p[1] + height, p[2], halfW, halfW, 8, col, rough, metal, emissive);
    }
  }

  finish(): MeshBucket {
    return {
      verts: this.v.slice(0, this.vc * VERTEX_FLOATS),
      indices: this.i.slice(0, this.ic),
      vertCount: this.vc,
      indexCount: this.ic,
    };
  }
}

/** 2D yo'ldan 3D sim/yo'l nuqtalarini yasash (jumper yoylar yoki PCB tekis yo'llar). */
function wirePath3D(route: Point[], hops: Point[][], style: RealStyle): Vec3[] {
  if (style === 'pcb') {
    return route.map((p) => [p.x, 0.2, p.y]);
  }
  const baseH = style === 'scifi' ? 3.2 : 7.5;
  const p0 = route[0];
  const out: Vec3[] = [
    [p0.x, 1.4, p0.y],
    [p0.x, baseH, p0.y],
  ];
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const dx = b.x - a.x;
    const dz = b.y - a.y;
    const len = Math.hypot(dx, dz);
    const segHops = (hops[i] ?? []).slice().sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y));
    for (const h of segHops) {
      const d = Math.hypot(h.x - a.x, h.y - a.y);
      const t0 = clamp((d - 9) / Math.max(1, len), 0.05, 0.95);
      const t1 = clamp((d + 9) / Math.max(1, len), 0.05, 0.95);
      out.push([a.x + dx * t0, baseH, a.y + dz * t0]);
      out.push([h.x, baseH + 8.5, h.y]);
      out.push([a.x + dx * t1, baseH, a.y + dz * t1]);
    }
    out.push([b.x, baseH, b.y]);
  }
  const last = route[route.length - 1];
  out.push([last.x, 1.4, last.y]);
  return out;
}

export function buildScene3D(input: SceneBuildInput): Scene3DData {
  const pal = PALETTES_3D[input.style];
  const solid = new MeshBuilder();
  const boardTop = new MeshBuilder();
  const chipTops = new MeshBuilder();
  const labels = new MeshBuilder();
  const lights: PointLight3D[] = [];
  const wireHits: WireHit3D[] = [];

  const slab = bounds(input.circuit, input.layout, false);
  const bx0 = slab.minX - 24;
  const bz0 = slab.minY - 26;
  const bx1 = slab.maxX + 24;
  const bz1 = slab.maxY + 26;

  // 1. Studiya stoli (pastki tekislik) va plata korpusi
  solid.addBox(bx0 - 900, -10, bz0 - 900, bx1 + 900, -7, bz1 + 900, pal.floor, 0.88, 0.05, 0);
  // Plata yon qirralari
  solid.addBox(bx0, -7, bz0, bx1, -0.05, bz1, pal.slabSide, 0.55, 0.15, 0);
  // Plata ustki sirti (UV takrorlanuvchi tekstura)
  const tileScale = 1 / 96;
  const btUV: UVRect = { u0: bx0 * tileScale, v0: bz0 * tileScale, u1: bx1 * tileScale, v1: bz1 * tileScale };
  boardTop.quad([bx0, 0, bz0], [bx1, 0, bz0], [bx1, 0, bz1], [bx0, 0, bz1], [0, 1, 0], [1, 1, 1], 0.48, 0.08, 0, btUV);

  if (input.style === 'breadboard') {
    // +5V qizil va GND ko'k shinalar + markaziy IC ariqcha
    solid.addBox(bx0 + 14, 0.05, bz0 + 8, bx1 - 14, 0.5, bz0 + 11, pal.bad, 0.4, 0.0, 0);
    solid.addBox(bx0 + 14, 0.05, bz1 - 11, bx1 - 14, 0.5, bz1 - 8, pal.sel, 0.4, 0.0, 0);
    const midZ = (bz0 + bz1) / 2;
    solid.addBox(bx0 + 8, -0.8, midZ - 4, bx1 - 8, 0.15, midZ + 4, pal.slabSide, 0.75, 0.0, 0);
  } else {
    // 4 burchakdagi jez / titan montaj vintlari
    for (const [cx, cz] of [
      [bx0 + 12, bz0 + 12],
      [bx1 - 12, bz0 + 12],
      [bx0 + 12, bz1 - 12],
      [bx1 - 12, bz1 - 12],
    ]) {
      solid.addCylinderY(cx, 0, 2.5, cz, 5.5, 5.5, 10, pal.brass, 0.25, 0.88, 0);
      solid.addCylinderY(cx, 2.5, 3.6, cz, 3.2, 2.8, 8, pal.metal, 0.2, 0.92, 0);
    }
  }

  // 2. Simlar / mis yo'llar / ko'prik rezistorlar
  const driven = new Set(input.circuit.wires.map((w) => w.to));
  const usedSources = new Set(input.circuit.wires.map((w) => w.from));
  const mixMuted = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [
    a[0] * 0.85 + b[0] * 0.15,
    a[1] * 0.85 + b[1] * 0.15,
    a[2] * 0.85 + b[2] * 0.15,
  ];

  input.circuit.wires.forEach((w, i) => {
    const route = input.routed.routes[i];
    if (!route) return;
    const pts = wirePath3D(route, input.routed.hops[i], input.style);
    wireHits.push({ index: i, pts });

    const live = input.reached(w.from, 1);
    const on = live && input.values.get(w.from) === 1;
    const sel = input.selection?.kind === 'wire' && input.selection.index === i;

    const baseCol = sel
      ? pal.sel
      : on
        ? pal.traceOn
        : input.style === 'breadboard' || input.style === 'bench'
          ? mixMuted(pal.traceOff, jumperColor(w.from))
          : pal.traceOff;
    const em = sel ? 1.15 : on ? 1.08 : 0;

    if (input.style === 'pcb') {
      solid.addFlatTrace(pts, on || sel ? 2.8 : 1.75, on || sel ? 1.7 : 0.9, baseCol, on ? 0.22 : 0.42, 0.78, em);
      // Kesishish ustiga 3D SMD 000 rezistor ko'prik
      input.routed.hops[i].forEach((list, segIdx) => {
        if (!list.length || segIdx >= route.length - 1) return;
        const p0 = route[segIdx];
        const p1 = route[segIdx + 1];
        const horiz = Math.abs(p1.x - p0.x) >= Math.abs(p1.y - p0.y);
        for (const h of list) {
          const sx = horiz ? 7 : 4.5;
          const sz = horiz ? 4.5 : 7;
          solid.addBox(h.x - sx, 0.8, h.y - sz, h.x + sx, 3.6, h.y + sz, pal.gateBody, 0.42, 0.1, 0);
          solid.addBox(h.x - (horiz ? 8.5 : 4.6), 0.2, h.y - (horiz ? 4.6 : 8.5), h.x + (horiz ? 8.5 : 4.6), 2.8, h.y + (horiz ? 4.6 : 8.5), pal.metal, 0.2, 0.9, 0);
          const uv0 = input.labelUVs.get('000');
          if (uv0) {
            labels.quad([h.x - sx + 1, 3.7, h.y - sz + 1], [h.x + sx - 1, 3.7, h.y - sz + 1], [h.x + sx - 1, 3.7, h.y + sz - 1], [h.x - sx + 1, 3.7, h.y + sz - 1], [0, 1, 0], [0.95, 0.97, 0.98], 0.5, 0, 0.1, uv0);
          }
        }
      });
    } else {
      solid.addTube(pts, on || sel ? 2.65 : 1.65, 8, baseCol, on ? 0.25 : 0.48, input.style === 'scifi' ? 0.35 : 0.08, em);
      solid.addCylinderY(pts[0][0], 0, 3.2, pts[0][2], 2.7, 2.2, 8, pal.metal, 0.2, 0.9, 0);
      const endP = pts[pts.length - 1];
      solid.addCylinderY(endP[0], 0, 3.2, endP[2], 2.7, 2.2, 8, pal.metal, 0.2, 0.9, 0);
    }
  });

  // Tarmoqlanish nuqtalari
  for (const { net, at } of input.routed.dots) {
    const live = input.reached(net, 1);
    const on = live && input.values.get(net) === 1;
    const sel = input.selection?.kind === 'wire' && input.circuit.wires[input.selection.index]?.from === net;
    const jCol = sel
      ? pal.sel
      : on
        ? pal.traceOn
        : input.style === 'breadboard' || input.style === 'bench'
          ? mixMuted(pal.traceOff, jumperColor(net))
          : pal.traceOff;
    const jEm = sel ? 1.15 : on ? 1.08 : 0;

    if (input.style === 'pcb') {
      solid.addCylinderY(at.x, 0, 1.2, at.y, 5.2, 4.8, 12, pal.brass, 0.25, 0.88, 0);
      const r = on || sel ? 4.0 : 3.0;
      const topY = on || sel ? 2.3 : 1.5;
      solid.addCylinderY(at.x, 0.8, topY, at.y, r, r * 0.9, 12, jCol, 0.22, 0.8, jEm);
      solid.addSphere(at.x, topY, at.y, r * 0.85, 10, 5, jCol, 0.2, 0.82, jEm, true);
    } else {
      const baseH = input.style === 'scifi' ? 3.2 : 7.5;
      solid.addCylinderY(at.x, 0, 2.4, at.y, 4.8, 3.9, 12, pal.brass, 0.25, 0.85, 0);
      solid.addCylinderY(at.x, 1.6, baseH, at.y, on || sel ? 2.2 : 1.75, on || sel ? 2.2 : 1.75, 10, sel ? pal.sel : on ? pal.traceOn : pal.metal, 0.2, 0.88, jEm * 0.85);
      const hubR = (on || sel ? 2.65 : 1.65) * 1.45;
      solid.addCylinderY(at.x, baseH - 1.4, baseH + 1.4, at.y, hubR * 1.06, hubR * 1.06, 12, sel ? pal.sel : on ? pal.traceOn : pal.brass, 0.22, 0.85, jEm);
      solid.addSphere(at.x, baseH, at.y, hubR, 12, 6, jCol, on ? 0.22 : 0.35, on ? 0.2 : 0.6, jEm);
    }
  }

  // Tortilayotgan sim (3D egri kamalak)
  if (input.ghost) {
    const { a, b } = input.ghost;
    const gPts: Vec3[] = [];
    const segs = 14;
    for (let s = 0; s <= segs; s++) {
      const k = s / segs;
      const arch = Math.sin(k * Math.PI) * 24;
      gPts.push([a.x + (b.x - a.x) * k, 3.2 + arch, a.y + (b.y - a.y) * k]);
    }
    solid.addTube(gPts, 1.8, 8, pal.sel, 0.2, 0.2, 1.35);
  }

  // Port yaratish yordamchisi
  const addPort = (id: string, x: number, y: number, src: boolean, connected: boolean, on: boolean) => {
    const act = input.activePort === id;
    const want =
      input.activePort !== null &&
      input.activePort !== id &&
      (isSourcePort(input.activePort) ? !src && !connected : src);
    const col = act ? pal.sel : want ? pal.sel : on ? pal.lampOn : src ? pal.brass : pal.metal;
    const em = act ? 1.5 : want ? 0.95 : on ? 1.1 : 0;
    const r = act || want ? 5.6 : 4.2;
    solid.addCylinderY(x, 0, 2.2, y, r + 1.1, r, 10, pal.brass, 0.25, 0.85, 0);
    solid.addSphere(x, 2.4, y, r * 0.72, 8, 4, col, 0.22, 0.75, em, true);
  };

  // 3. Elementlar (3D DIP mikrosxemalar / modullar)
  for (const g of input.circuit.gates) {
    const live = input.reached(g.id, 0);
    const on = live && input.values.get(g.id) === 1;
    const sel = input.selection?.kind === 'gate' && input.selection.id === g.id;
    const err = input.highlight === g.id;
    const lift = input.draggingGateId === g.id ? 7 : 0;

    const ins = inputLeads(g.type);
    const out = outputY(g.type);

    // Oyoqchalar va kavshar konusi
    for (const ly of ins) {
      solid.addBox(g.x, 1.2 + lift, g.y + ly - 2.2, g.x + 13, 3.8 + lift, g.y + ly + 2.2, pal.metal, 0.2, 0.92, 0);
      if (lift === 0) solid.addCylinderY(g.x + 2, 0, 2.5, g.y + ly, 4.4, 2.2, 8, pal.metal, 0.16, 0.94, 0);
    }
    solid.addBox(g.x + 59, 1.2 + lift, g.y + out - 2.2, g.x + GATE_W, 3.8 + lift, g.y + out + 2.2, pal.metal, 0.2, 0.92, 0);
    if (lift === 0) solid.addCylinderY(g.x + GATE_W - 2, 0, 2.5, g.y + out, 4.4, 2.2, 8, pal.metal, 0.16, 0.94, 0);

    // Asosiy korpus
    const gx0 = g.x + 12;
    const gx1 = g.x + 60;
    const gz0 = g.y + 4;
    const gz1 = g.y + GATE_H - 4;

    solid.addBox(gx0, 2 + lift, gz0, gx1, 11.4 + lift, gz1, pal.gateBody, 0.45, 0.14, 0);
    if (err || sel || on) {
      const rimCol = err ? pal.bad : sel ? pal.sel : pal.traceOn;
      const rimEm = err ? 1.15 : sel ? 0.95 : 1.0;
      solid.addBox(gx0 - 1.4, 2.2 + lift, gz0 - 1.4, gx1 + 1.4, 12.25 + lift, gz1 + 1.4, rimCol, 0.3, 0.25, rimEm);
    } else {
      solid.addBox(gx0 + 1.2, 11.4 + lift, gz0 + 1.2, gx1 - 1.2, 12.2 + lift, gz1 - 1.2, pal.gateBody, 0.35, 0.3, 0);
    }

    // Ustki yuzaga atlasdan chip belgisi (0/1 ikki holatli)
    const uv = gateAtlasUV(g.type, on);
    chipTops.quad(
      [gx0 + 2.2, 12.3 + lift, gz0 + 2.2],
      [gx1 - 2.2, 12.3 + lift, gz0 + 2.2],
      [gx1 - 2.2, 12.3 + lift, gz1 - 2.2],
      [gx0 + 2.2, 12.3 + lift, gz1 - 2.2],
      [0, 1, 0],
      [1, 1, 1],
      0.42,
      0.08,
      on ? 0.78 : 0,
      uv,
    );

    // Chiqish mikro-svetodiodi va gardishi
    solid.addCylinderY(gx1 - 6, 12.28 + lift, 12.55 + lift, g.y + out, 4.2, 4.0, 10, pal.brass, 0.22, 0.88, 0);
    solid.addSphere(gx1 - 6, 12.35 + lift, g.y + out, 3.6, 8, 4, on ? pal.lampOn : pal.lampOff, 0.18, 0.1, on ? 1.15 : 0, true);
    if (on && lights.length < 8) {
      lights.push({ pos: [g.x + 36, 20 + lift, g.y + 24], color: pal.lampOn, intensity: 0.55 });
    }

    // DFF holat belgisi (q1...)
    const stName = input.stateNames.get(g.id);
    if (g.type === 'DFF' && stName) {
      const suv = input.labelUVs.get(stName);
      if (suv) {
        labels.quad(
          [gx0 + 10, 0.25, gz1 + 2],
          [gx1 - 10, 0.25, gz1 + 2],
          [gx1 - 10, 0.25, gz1 + 14],
          [gx0 + 10, 0.25, gz1 + 14],
          [0, 1, 0],
          pal.gateAccent,
          0.5,
          0,
          input.style === 'scifi' ? 0.45 : 0.15,
          suv,
        );
      }
    }

    for (let k = 0; k < ins.length; k++) {
      const pid = `${g.id}:${k}`;
      const drv = input.drivers.get(pid);
      const inOn = drv !== undefined && input.reached(drv, 1) && input.values.get(drv) === 1;
      addPort(pid, g.x, g.y + inputPortY(g, k), false, driven.has(pid), inOn);
    }
    addPort(g.id, g.x + GATE_W, g.y + outputPortY(g), true, usedSources.has(g.id), on);
  }

  // 4. Kirish tumblerlari (pin-in): botiq to'q panel, yorug' ramka va ikki rangli dasta
  input.spec.inputs.forEach((name, k) => {
    const p = input.layout.inputs.get(name)!;
    const on = input.bits[k] === 1;
    const x0 = p.x - 78;
    const x1 = p.x - 14;
    const z0 = p.y - 21;
    const z1 = p.y + 21;

    solid.addBox(x0, 0, z0, x1, 7.2, z1, pal.pinBox, 0.45, 0.18, 0);
    solid.addBox(x0 + 2.2, 7.2, z0 + 2.2, x1 - 2.2, 7.65, z1 - 2.2, pal.gateBody, 0.55, 0.1, 0);
    solid.addFrameBox(x0 + 0.6, 7.2, z0 + 0.6, x1 - 0.6, on ? 8.3 : 7.8, z1 - 0.6, 2.0, on ? pal.traceOn : pal.slabSide, 0.3, 0.25, on ? 1.0 : 0);
    solid.addBox(p.x - 14, 1.2, p.y - 2, p.x, 3.4, p.y + 2, on ? pal.traceOn : pal.metal, 0.2, 0.9, on ? 0.8 : 0);

    // Botiq yo'lak (chap 0 — to'q, o'ng 1 — yoniq), jez gayka va ikki rangli tumbler dastagi
    const swX = p.x - 29;
    solid.addBox(swX - 11, 7.6, p.y - 3.6, swX, 7.9, p.y + 3.6, [0.05, 0.06, 0.08], 0.7, 0.05, 0);
    solid.addBox(swX, 7.6, p.y - 3.6, swX + 11, 7.9, p.y + 3.6, on ? pal.traceOn : [0.05, 0.06, 0.08], 0.4, 0.1, on ? 0.85 : 0);
    solid.addCylinderY(swX, 7.65, 9.8, p.y, 5.8, 5.0, 6, pal.brass, 0.22, 0.88, 0);
    solid.addCylinderY(swX, 9.8, 10.1, p.y, 3.5, 3.5, 8, [0.05, 0.06, 0.08], 0.6, 0.1, 0);

    const angle = input.leverAngles.get(name) ?? (on ? 0.6 : -0.6);
    solid.addTiltedLever(
      swX,
      9.8,
      p.y,
      angle,
      16.5,
      2.35,
      [0.88, 0.91, 0.95],
      on ? pal.pulse : [0.68, 0.74, 0.82],
      on ? 0.92 : 0.12,
      on ? pal.lampOn : undefined,
    );

    // Holat LED va gardishi (dasta ustida to'silmaydigan joyda)
    solid.addCylinderY(swX, 7.65, 7.95, p.y - 13.5, 4.0, 3.8, 10, pal.brass, 0.22, 0.88, 0);
    solid.addSphere(swX, 7.7, p.y - 13.5, 3.2, 8, 4, on ? pal.lampOn : pal.lampOff, 0.2, 0.1, on ? 1.15 : 0, true);

    const uv = input.labelUVs.get(name);
    if (uv) {
      labels.quad([p.x - 73, 7.78, p.y - 17], [p.x - 49, 7.78, p.y - 17], [p.x - 49, 7.78, p.y - 1], [p.x - 73, 7.78, p.y - 1], [0, 1, 0], [0.95, 0.98, 1.0], 0.45, 0, 0.55, uv);
    }
    const bitUv = input.labelUVs.get(on ? '1' : '0');
    if (bitUv) {
      labels.quad([p.x - 73, 7.78, p.y + 1], [p.x - 49, 7.78, p.y + 1], [p.x - 49, 7.78, p.y + 17], [p.x - 73, 7.78, p.y + 17], [0, 1, 0], on ? pal.pulse : [0.58, 0.64, 0.72], 0.45, 0, on ? 0.95 : 0.2, bitUv);
    }
    addPort(`in:${name}`, p.x, p.y, true, usedSources.has(`in:${name}`), on);
  });

  // 5. Chiqish chiroqlari (pin-out)
  input.spec.outputs.forEach((name, i) => {
    const p = input.layout.outputs.get(name)!;
    const src = input.drivers.get(`out:${name}`);
    const v = src === undefined || input.reached(src, 2) ? input.outputs[i] : null;
    const on = v === 1;
    const exp = input.expected?.[i];
    const err = input.highlight === name;
    const good = exp !== undefined && v !== null && v === exp;
    const bad = exp !== undefined && v !== null && v !== exp;

    const x0 = p.x + 14;
    const x1 = p.x + 76;
    const z0 = p.y - 21;
    const z1 = p.y + 21;

    solid.addBox(p.x, 1.2, p.y - 2, x0, 3.4, p.y + 2, on ? pal.traceOn : pal.metal, 0.2, 0.9, on ? 0.8 : 0);
    solid.addBox(x0, 0, z0, x1, 6.5, z1, pal.pinBox, 0.45, 0.18, 0);
    solid.addBox(x0 + 2.2, 6.5, z0 + 2.2, x1 - 2.2, 6.95, z1 - 2.2, pal.gateBody, 0.55, 0.1, 0);
    const frameCol = err || bad ? pal.bad : good ? pal.good : pal.slabSide;
    const frameEm = err || bad ? 1.05 : good ? 0.85 : 0;
    const frameH = err || bad || good ? 7.7 : 7.1;
    solid.addFrameBox(x0 + 0.6, 6.5, z0 + 0.6, x1 - 0.6, frameH, z1 - 0.6, 2.0, frameCol, 0.3, 0.22, frameEm);

    // Metall gardish va 3D yarim sharsimon svetodiod
    const lx = p.x + 56;
    if (on) {
      solid.addCylinderY(lx, 6.95, 8.1, p.y, 12.2, 12.0, 14, pal.lampOn, 0.25, 0.2, 1.0);
    }
    solid.addCylinderY(lx, 6.95, 9.7, p.y, 10.5, 9.5, 14, pal.brass, 0.22, 0.88, 0);
    solid.addSphere(lx, 9.4, p.y, 9.2, 12, 6, on ? pal.lampOn : pal.lampOff, 0.14, 0.05, on ? 1.15 : 0, true);
    if (on && lights.length < 8) {
      lights.push({ pos: [lx, 24, p.y], color: pal.lampOn, intensity: 1.15 });
    }

    const uv = input.labelUVs.get(name);
    if (uv) {
      labels.quad([x0 + 4, 7.08, p.y - 17], [x0 + 28, 7.08, p.y - 17], [x0 + 28, 7.08, p.y - 1], [x0 + 4, 7.08, p.y - 1], [0, 1, 0], [0.95, 0.98, 1.0], 0.45, 0, 0.55, uv);
    }
    if (v !== null) {
      const bitUv = input.labelUVs.get(on ? '1' : '0');
      if (bitUv) {
        labels.quad([x0 + 4, 7.08, p.y + 1], [x0 + 28, 7.08, p.y + 1], [x0 + 28, 7.08, p.y + 17], [x0 + 4, 7.08, p.y + 17], [0, 1, 0], on ? pal.pulse : [0.58, 0.64, 0.72], 0.45, 0, on ? 0.95 : 0.2, bitUv);
      }
    }
    if (exp !== undefined) {
      const euv = input.labelUVs.get(`exp:${exp}`);
      if (euv) {
        const accentEm = input.style === 'scifi' ? 0.45 : 0.15;
        labels.quad([x0 - 2, 0.25, z1 + 2], [x1 + 4, 0.25, z1 + 2], [x1 + 4, 0.25, z1 + 15], [x0 - 2, 0.25, z1 + 15], [0, 1, 0], pal.gateAccent, 0.5, 0, accentEm, euv);
      }
    }
    addPort(`out:${name}`, p.x, p.y, false, driven.has(`out:${name}`), on);
  });

  const buckets = { solid: solid.finish(), boardTop: boardTop.finish(), chipTops: chipTops.finish(), labels: labels.finish() };
  return {
    ...buckets,
    lights,
    wireHits,
    bounds3D: { minX: bx0, minZ: bz0, maxX: bx1, maxZ: bz1 },
    pulsing: Object.values(buckets).some(hasPulse),
  };
}
