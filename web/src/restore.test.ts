import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RemoteSolution } from './api';

// Server o'rnida: har bir kod — bitta o'yinchi; yuborilgan natijalar kim nomidan ketganini yozib boramiz.
const players: Record<string, { id: string; nickname: string; levels: RemoteSolution[] }> = {};
const solved: { by: string | undefined; levelId: string }[] = [];

vi.mock('./api', async (orig) => {
  const real = await orig<typeof import('./api')>();
  const { profile } = await import('./state');
  // Server kodni normallashtiradi (bo'shliq, chiziqcha, kichik harf farq qilmaydi).
  const byCode = (code?: string) => players[(code ?? profile.value?.code ?? '').replace(/[^0-9a-z]/gi, '').toUpperCase()];
  return {
    ...real,
    api: {
      me: async (code: string) => {
        const p = byCode(code);
        if (!p) throw new real.ApiError(401, 'unauthorized');
        return { id: p.id, nickname: p.nickname, createdAt: 0 };
      },
      progress: async () => ({ levels: byCode()?.levels ?? [] }),
      solve: async (levelId: string) => {
        solved.push({ by: profile.value?.id, levelId });
        return {};
      },
    },
  };
});
vi.mock('./daily', async (orig) => ({ ...(await orig<typeof import('./daily')>()), syncDaily: async () => {} }));

const { profile, progress } = await import('./state');
const { formatCode, restoreProfile } = await import('./sync');

const circuit = { gates: [], wires: [] };
const result = (gates: number, synced: boolean) => ({ stars: 3, gates, circuit, at: 1, synced });

beforeEach(() => {
  solved.length = 0;
  players.AAAAAAAAAAAAAAAA = { id: 'ali', nickname: 'Ali', levels: [] };
  players.BBBBBBBBBBBBBBBB = {
    id: 'vali',
    nickname: 'Vali',
    levels: [{ levelId: 'b1', gates: 1, stars: 3, circuit, solvedAt: 1 }],
  };
});

describe('tiklash kodi: umumiy kompyuter', () => {
  it("boshqa o'quvchiga o'tilsa — avvalgisining natijalari o'z hisobiga ketadi va qurilmadan tozalanadi", async () => {
    profile.value = { id: 'ali', nickname: 'Ali', code: 'AAAA-AAAA-AAAA-AAAA' };
    progress.value = { b1: result(2, true), b2: result(3, false) };

    expect(await restoreProfile('bbbb bbbb bbbb bbbb')).toBe(true);

    // Alining yuborilmagan natijasi — Ali nomidan; Valiga hech narsa o'tmadi.
    expect(solved).toEqual([{ by: 'ali', levelId: 'b2' }]);
    expect(profile.value).toEqual({ id: 'vali', nickname: 'Vali', code: 'BBBB-BBBB-BBBB-BBBB' });
    expect(Object.keys(progress.value)).toEqual(['b1']);
    expect(progress.value.b1.gates).toBe(1);
  });

  it("o'z kodini qayta kiritsa yoki profilsiz o'ynagan bo'lsa — natijalar saqlanadi", async () => {
    profile.value = { id: 'ali', nickname: 'Ali', code: 'AAAA-AAAA-AAAA-AAAA' };
    progress.value = { b2: result(3, false) };
    await restoreProfile('AAAA-AAAA-AAAA-AAAA');
    expect(progress.value.b2).toBeDefined();

    profile.value = null;
    progress.value = { b2: result(3, false) };
    await restoreProfile('BBBB-BBBB-BBBB-BBBB');
    expect(Object.keys(progress.value).sort()).toEqual(['b1', 'b2']);
    expect(solved.at(-1)).toEqual({ by: 'vali', levelId: 'b2' });
  });

  it("kutish paytida yangi profil ochilgan bo'lsa (Telegram bulutidan tiklash) — unga tegilmaydi", async () => {
    profile.value = null;
    progress.value = {};
    const pending = restoreProfile('BBBB-BBBB-BBBB-BBBB', true);
    profile.value = { id: 'ali', nickname: 'Ali', code: 'AAAA-AAAA-AAAA-AAAA' };
    expect(await pending).toBe(false);
    expect(profile.value?.id).toBe('ali');
  });

  it('kod ko\'rinishi', () => {
    expect(formatCode(' abcd efgh-ijkl mnop ')).toBe('ABCD-EFGH-IJKL-MNOP');
    expect(formatCode('')).toBe('');
  });
});
