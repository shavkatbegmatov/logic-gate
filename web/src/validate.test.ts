import { afterEach, describe, expect, it, vi } from 'vitest';
import { load } from './storage';
import { cleanCircuit, cleanList, cleanRecord, cleanResult, hasOwn, isGateType } from './validate';

describe('saqlangan ma\'lumot shakli', () => {
  it("sxema: noto'g'ri elementlar va simlar tashlanadi, ortiqcha maydonlar olinmaydi", () => {
    expect(cleanCircuit(null)).toBeNull();
    expect(cleanCircuit({ gates: {}, wires: [] })).toBeNull();
    expect(
      cleanCircuit({
        gates: [
          { id: 'g1', type: 'AND', x: 0, y: 0, extra: 1 },
          { id: 'g2', type: 'constructor', x: 0, y: 0 },
          { id: 'g3', type: 'XYZ', x: 0, y: 0 },
          { id: 4, type: 'NOT', x: 0, y: 0 },
          { id: 'g5', type: 'NOT', x: Infinity, y: 0 },
          null,
        ],
        wires: [{ from: 'in:A', to: 'g1:0' }, { from: 1, to: 'g1:1' }, 'sim'],
      }),
    ).toEqual({ gates: [{ id: 'g1', type: 'AND', x: 0, y: 0 }], wires: [{ from: 'in:A', to: 'g1:0' }] });
  });

  it("meros kalitlar element turi yoki til bo'lib o'tmaydi", () => {
    expect(isGateType('constructor')).toBe(false);
    expect(isGateType('toString')).toBe(false);
    expect(isGateType('DFF')).toBe(true);
    expect(hasOwn({}, 'constructor')).toBe(false);
  });

  it("natijalar: null va son yozuvlar tashlanadi, sxemasi buzuq natija yulduzi bilan qoladi", () => {
    const ok = { stars: 3, gates: 1, circuit: { gates: [], wires: [] }, at: 5, synced: true };
    const raw = JSON.parse('{"b1":' + JSON.stringify(ok) + ',"b2":null,"b3":7,"b4":{"stars":2,"gates":3,"circuit":"x"},"__proto__":{"stars":1,"gates":1}}');
    const out = cleanRecord(raw, cleanResult)!;
    expect(Object.keys(out).sort()).toEqual(['b1', 'b4']);
    expect(out.b1).toEqual(ok);
    expect(out.b4).toEqual({ stars: 2, gates: 3, circuit: { gates: [], wires: [] }, at: 0, synced: false });
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(cleanRecord([1, 2], cleanResult)).toBeNull();
  });

  it("ro'yxat: massiv bo'lmasa — null, noto'g'ri elementlar tashlanadi", () => {
    const str = (v: unknown) => (typeof v === 'string' ? v : null);
    expect(cleanList({ 0: 'a' }, str)).toBeNull();
    expect(cleanList(['a', 1, null, 'b'], str)).toEqual(['a', 'b']);
  });
});

describe("load: turi mos kelmasa — o'rniga standart qiymat", () => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  afterEach(() => store.clear());

  it("massiv o'rniga son, obyekt o'rniga massiv, buzuq JSON", () => {
    store.set('a', '5');
    store.set('b', '[1]');
    store.set('c', '{oops');
    expect(load('a', [] as string[])).toEqual([]);
    expect(load('b', {})).toEqual({});
    expect(load('c', 0)).toBe(0);
    expect(load('yoq', 'x')).toBe('x');
  });

  it("clean berilsa — u hal qiladi; null qaytarsa — standart qiymat", () => {
    store.set('p', JSON.stringify({ b1: null, b2: { stars: 1, gates: 2, circuit: { gates: [], wires: [] } } }));
    expect(Object.keys(load('p', {}, (v) => cleanRecord(v, cleanResult)))).toEqual(['b2']);
    store.set('q', '"matn"');
    expect(load('q', { ok: true }, (v) => (typeof v === 'object' ? (v as { ok: boolean }) : null))).toEqual({ ok: true });
  });
});
