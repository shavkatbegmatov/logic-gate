import { describe, expect, it } from 'vitest';
import { ALL_GATE_TYPES, type Circuit, type Gate, type Spec } from '../../sim/types';
import { layout, outputColumn } from '../geometry';
import { routeAll } from '../routing';
import {
  mat4Invert,
  mat4Multiply,
  mat4Perspective,
  OrbitCamera,
  projectPoint,
  rayAABB,
  rayPlaneY,
  rayPolylineDist,
  raySphere,
  unprojectRay,
  type Vec3,
} from './math3d';
import { buildScene3D, VERTEX_FLOATS } from './meshes3d';
import type { UVRect } from './textures3d';

describe('3D matematika va orbita kamerasi', () => {
  it('matritsa ko\'paytirish va teskari matritsa birlik matritsani beradi', () => {
    const p = mat4Perspective((38 * Math.PI) / 180, 16 / 9, 10, 4000);
    const inv = mat4Invert(p);
    expect(inv).not.toBeNull();
    const id = mat4Multiply(p, inv!);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        expect(id[c * 4 + r]).toBeCloseTo(r === c ? 1 : 0, 4);
      }
    }
  });

  it('projectPoint va unprojectRay + rayPlaneY o\'zaro teskari', () => {
    const cam = new OrbitCamera();
    cam.targetX = 200;
    cam.targetZ = 120;
    cam.distance = 580;
    const { vp, invVP } = cam.matrices(1000, 700);
    for (const pt of [
      [0, 0, 36],
      [220, 0, 140],
      [480, 0, 220],
    ] as Vec3[]) {
      const sp = projectPoint(pt, vp, 1000, 700)!;
      expect(sp).not.toBeNull();
      const ray = unprojectRay(sp.x, sp.y, 1000, 700, invVP);
      const hit = rayPlaneY(ray, 0)!;
      expect(hit.x).toBeCloseTo(pt[0], 2);
      expect(hit.z).toBeCloseTo(pt[2], 2);
    }
  });

  it('zoomAtScreen kursor ostidagi nuqtani joyida ushlab turadi', () => {
    const cam = new OrbitCamera();
    const sx = 640;
    const sy = 310;
    const w = 1000;
    const h = 700;
    const before = rayPlaneY(unprojectRay(sx, sy, w, h, cam.matrices(w, h).invVP), 0)!;
    cam.zoomAtScreen(1.4, sx, sy, w, h);
    const after = rayPlaneY(unprojectRay(sx, sy, w, h, cam.matrices(w, h).invVP), 0)!;
    expect(after.x).toBeCloseTo(before.x, 1);
    expect(after.z).toBeCloseTo(before.z, 1);
  });

  it('panByScreenDelta o\'ngga surilganda targetX ni kamaytiradi', () => {
    const cam = new OrbitCamera();
    cam.yaw = 0;
    const tx0 = cam.targetX;
    cam.panByScreenDelta(80, 0, 1000, 700);
    expect(cam.targetX).toBeLessThan(tx0);
  });

  it('rayAABB, raySphere va rayPolylineDist aniq kesishishni topadi', () => {
    const ray = { origin: [0, 100, 0] as Vec3, dir: [0, -1, 0] as Vec3 };
    expect(rayAABB(ray, -10, 0, -10, 10, 15, 10)).toBeCloseTo(85, 4);
    expect(rayAABB(ray, 30, 0, 30, 40, 15, 40)).toBeNull();
    expect(raySphere(ray, 0, 4, 0, 5)).toBeCloseTo(91, 4);
    expect(raySphere(ray, 20, 4, 0, 5)).toBeNull();
    const wire = rayPolylineDist(ray, [
      [-40, 8, 2],
      [40, 8, 2],
    ], 5);
    expect(wire).not.toBeNull();
    expect(wire!.dist).toBeCloseTo(2, 4);
  });
});

describe('3D sahna geometriyasi', () => {
  const spec: Spec = { inputs: ['A', 'B'], outputs: ['Q'], gates: ALL_GATE_TYPES };
  const circuit: Circuit = {
    gates: [
      { id: 'g1', type: 'AND', x: 144, y: 24 },
      { id: 'g2', type: 'DFF', x: 264, y: 84 },
    ],
    wires: [
      { from: 'in:A', to: 'g1:0' },
      { from: 'in:B', to: 'g1:1' },
      { from: 'g1', to: 'g2:0' },
      { from: 'g2', to: 'out:Q' },
    ],
  };
  const lay = layout(spec, outputColumn(2));
  const gmap = new Map<string, Gate>(circuit.gates.map((g) => [g.id, g]));
  const routed = routeAll(circuit.wires, gmap, lay);
  const labelUVs = new Map<string, UVRect>([
    ['000', { u0: 0, v0: 0, u1: 0.2, v1: 0.1 }],
    ['A', { u0: 0.2, v0: 0, u1: 0.4, v1: 0.1 }],
    ['B', { u0: 0.4, v0: 0, u1: 0.6, v1: 0.1 }],
    ['Q', { u0: 0.6, v0: 0, u1: 0.8, v1: 0.1 }],
    ['q1', { u0: 0.8, v0: 0, u1: 1, v1: 0.1 }],
    ['exp:1', { u0: 0, v0: 0.1, u1: 0.2, v1: 0.2 }],
  ]);

  it.each(['pcb', 'bench', 'breadboard', 'scifi'] as const)('%s uslubida barcha mesh chelaklari yaroqli va NaN yo\'q', (style) => {
    const scene = buildScene3D({
      style,
      spec,
      circuit,
      layout: lay,
      routed,
      values: new Map([
        ['in:A', 1],
        ['in:B', 1],
        ['g1', 1],
        ['g2', 1],
      ]),
      outputs: [1],
      bits: [1, 1],
      expected: [1],
      drivers: new Map([['out:Q', 'g2']]),
      reached: () => true,
      selection: { kind: 'gate', id: 'g1' },
      activePort: 'g1',
      highlight: null,
      draggingGateId: null,
      ghost: { a: { x: 0, y: 36 }, b: { x: 144, y: 36 } },
      leverAngles: new Map([
        ['A', 0.48],
        ['B', 0.48],
      ]),
      stateNames: new Map([['g2', 'q1']]),
      labelUVs,
    });

    for (const bucket of [scene.solid, scene.boardTop, scene.chipTops, scene.labels]) {
      expect(bucket.vertCount).toBeGreaterThan(0);
      expect(bucket.indexCount).toBeGreaterThan(0);
      expect(bucket.verts.length).toBe(bucket.vertCount * VERTEX_FLOATS);
      for (let i = 0; i < bucket.verts.length; i++) {
        expect(Number.isFinite(bucket.verts[i])).toBe(true);
      }
      for (let i = 0; i < bucket.indexCount; i++) {
        expect(bucket.indices[i]).toBeLessThan(bucket.vertCount);
      }
    }
    expect(scene.lights.length).toBeGreaterThan(0);
    expect(scene.wireHits).toHaveLength(circuit.wires.length);
  });
});
