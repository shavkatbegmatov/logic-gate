import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FunnelEvent } from './funnel';

// localStorage o'rnida (Node'da yo'q): voronka holati qurilmada qolishini tekshirish uchun.
const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
});

const circuit = { gates: [], wires: [] };
const result = { stars: 3, gates: 1, circuit, at: 1, synced: true };

/** Yangi modullar bilan ishga tushirish: post — server o'rnida (ok — qabul qilindimi). */
async function start(ok: (ev: FunnelEvent) => boolean = () => true) {
  vi.resetModules();
  const sent: string[] = [];
  const mods = {
    state: await import('./state'),
    daily: await import('./daily'),
    funnel: await import('./funnel'),
  };
  mods.funnel.startFunnel(async (ev, src) => {
    sent.push(`${ev}:${src}`);
    return ok(ev);
  });
  await Promise.resolve();
  return { sent, ...mods };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => mem.clear());

describe("o'yinchilar voronkasi", () => {
  it("har bosqich qurilmadan bir marta: ochilish, 1 va 3 daraja, kunlik masala", async () => {
    const { sent, state, daily } = await start();
    await tick();
    expect(sent).toEqual(['visit:web']);

    state.progress.value = { b1: result };
    await tick();
    state.progress.value = { b1: result, b2: result };
    await tick();
    state.progress.value = { b1: result, b2: result, b3: result };
    await tick();
    daily.dailyHistory.value = { 20400: { ...result } };
    await tick();
    expect(sent).toEqual(['visit:web', 'level1:web', 'level3:web', 'daily1:web']);

    // Keyingi ochilish (shu kuni): hech narsa qayta yuborilmaydi.
    const again = await start();
    await tick();
    expect(again.sent).toEqual([]);
  });

  it("aloqa bo'lmasa — belgilanmaydi va keyingi ochilishda qayta yuboriladi", async () => {
    const first = await start(() => false);
    await tick();
    expect(first.sent).toEqual(['visit:web']);
    const second = await start();
    await tick();
    expect(second.sent).toEqual(['visit:web']);
  });

  it("boshqa kuni ochilsa — «qaytdi» bir marta", async () => {
    const { daily } = await start();
    await tick();
    mem.set('lg.funnel.v1', JSON.stringify({ first: daily.today() - 1, sent: ['visit'] }));
    const next = await start();
    await tick();
    expect(next.sent).toEqual(['return:web']);
    const later = await start();
    await tick();
    expect(later.sent).toEqual([]);
  });

  it("bu o'zgarishdan oldin o'ynagan qurilma hisoblanmaydi", async () => {
    mem.set('lg.progress.v1', JSON.stringify({ b1: result }));
    const { sent } = await start();
    await tick();
    expect(sent).toEqual([]);
  });
});
