import { describe, expect, it } from 'vitest';
import { degree, midiHz, rng, sceneKey, SCENES } from './audio-rich';
import { chapters, levels } from './levels';

describe('audio-rich', () => {
  it('har bo\'limning o\'z musiqa sahnasi bor', () => {
    for (const ch of chapters) expect(SCENES[ch.id], ch.id).toBeDefined();
  });

  it('marshrut → sahna', () => {
    const lvl = levels.find((l) => l.chapter === 'memory')!;
    expect(sceneKey({ name: 'level', id: lvl.id })).toBe('memory');
    expect(sceneKey({ name: 'contest', code: 'X', level: lvl.id })).toBe('memory');
    expect(sceneKey({ name: 'level', id: 'yoq' })).toBe('menu');
    expect(sceneKey({ name: 'lesson', id: 'nand' })).toBe('nand');
    expect(sceneKey({ name: 'daily' })).toBe('daily');
    expect(sceneKey({ name: 'sandbox' })).toBe('sandbox');
    expect(sceneKey({ name: 'levels' })).toBe('menu');
    expect(sceneKey({ name: 'settings' })).toBe('menu');
  });

  it('lad pog\'onalari oktavalar bo\'ylab to\'g\'ri', () => {
    const s = SCENES.basics; // C major, C4 = 60
    expect([0, 1, 2, 7, 9, -1].map((d) => degree(s, d))).toEqual([60, 62, 64, 72, 76, 59]);
    expect(midiHz(69)).toBe(440);
    expect(midiHz(81)).toBeCloseTo(880);
  });

  it('tasodif takrorlanadi va 0..1 oralig\'ida', () => {
    const a = rng(42);
    const b = rng(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('sahna sozlamalari chegarada', () => {
    for (const [k, s] of Object.entries(SCENES)) {
      expect(s.mode.length, k).toBe(7);
      expect(s.bpm, k).toBeGreaterThan(50);
      expect(s.bpm, k).toBeLessThan(140);
      expect(s.density, k).toBeLessThanOrEqual(1);
    }
  });
});
