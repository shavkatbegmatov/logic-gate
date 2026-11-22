import { describe, expect, it } from 'vitest';
import { hasPulse, VERTEX_FLOATS, type MeshBucket } from './meshes3d';

/** Berilgan (emissive, pulseCoord) juftliklaridan uchlar to'plami; qolgan maydonlar nol. */
const bucket = (verts: [emissive: number, pulse: number][]): MeshBucket => {
  const data = new Float32Array(verts.length * VERTEX_FLOATS);
  verts.forEach(([em, pulse], i) => {
    data[i * VERTEX_FLOATS + 14] = em;
    data[i * VERTEX_FLOATS + 15] = pulse;
  });
  return { verts: data, indices: new Uint16Array(0), vertCount: verts.length, indexCount: 0 };
};

describe('3D: signal to\'lqini bor-yo\'qligi (chizish faqat kerak bo\'lganda)', () => {
  it("yoniq sim — shaderdagi shart: emissive > 0.5 va pulseCoord > 0.01", () => {
    expect(hasPulse(bucket([[0, 0], [1.08, 42]]))).toBe(true);
  });

  it("porlaydigan, lekin to'lqinsiz uch (tumbler, chiroq) yoki o'chiq sim — kadr qayta chizilmaydi", () => {
    expect(hasPulse(bucket([[1.15, 0]]))).toBe(false); // tanlangan element: porlaydi, to'lqin yo'q
    expect(hasPulse(bucket([[0.4, 30]]))).toBe(false); // xira
    expect(hasPulse(bucket([]))).toBe(false);
  });

  it('vertCount dan keyingi (bo\'sh qolgan) joy hisobga olinmaydi', () => {
    const b = bucket([[0, 0], [1, 5]]);
    expect(hasPulse({ ...b, vertCount: 1 })).toBe(false);
  });
});
