import { beforeEach, describe, expect, it, vi } from 'vitest';

// Server o'rnida: bitta profil (soxta kod), «boshqa qurilmalardan chiqish» uning kodini almashtiradi.
// mode: ok — javob keldi; applied-lost — server almashtirdi, javob yo'qoldi; lost — so'rov yetmadi;
// refused — server rad etdi.
let serverCode = '';
let mode: 'ok' | 'applied-lost' | 'lost' | 'refused' = 'ok';
let during: (() => Promise<void>) | null = null;
const norm = (c?: string) => (c ?? '').replace(/[^0-9a-z]/gi, '').toUpperCase();

vi.mock('./api', async (orig) => {
  const real = await orig<typeof import('./api')>();
  const { profile } = await import('./state');
  const check = (code?: string) => {
    if (norm(code ?? profile.value?.code) !== serverCode) throw new real.ApiError(401, 'unauthorized');
  };
  return {
    ...real,
    api: {
      me: async (code?: string) => {
        check(code);
        return { id: 'p1', nickname: 'TEST_USER', createdAt: 0 };
      },
      progress: async () => {
        check();
        return { levels: [] };
      },
      solve: async () => ({}),
      logoutOthers: async (code: string) => {
        check();
        if (mode === 'refused') throw new real.ApiError(400, 'bad_code');
        if (mode !== 'lost') serverCode = norm(code);
        if (during) await during();
        if (mode !== 'ok') throw new real.ApiError(0, 'network');
        return {};
      },
    },
  };
});
vi.mock('./daily', async (orig) => ({ ...(await orig<typeof import('./daily')>()), syncDaily: async () => {} }));

const { ApiError } = await import('./api');
const { profile } = await import('./state');
const { logoutOthers, lostProfile, randomCode, rotatedCode, syncProgress } = await import('./sync');

const OLD = 'AAAA-AAAA-AAAA-AAAA';

beforeEach(() => {
  serverCode = norm(OLD);
  mode = 'ok';
  during = null;
  rotatedCode.value = null;
  lostProfile.value = null;
  profile.value = { id: 'p1', nickname: 'TEST_USER', code: OLD };
});

describe('boshqa qurilmalardan chiqish', () => {
  it('yangi kod — 80 bit, tiklash kodi ko\'rinishida, har safar boshqa', () => {
    const a = randomCode();
    expect(a).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    expect(randomCode()).not.toBe(a);
  });

  it('kod almashadi va darhol ko\'rsatiladi', async () => {
    const code = await logoutOthers();
    expect(profile.value).toEqual({ id: 'p1', nickname: 'TEST_USER', code });
    expect(norm(code)).toBe(serverCode);
    expect(rotatedCode.value).toBe(code);
  });

  it("javob yo'qolsa ham — server qabul qilgan bo'lsa, yangi kod saqlanadi (profil qulflanmaydi)", async () => {
    mode = 'applied-lost';
    const code = await logoutOthers();
    expect(profile.value?.code).toBe(code);
    expect(norm(code)).toBe(serverCode);
  });

  it("so'rov yetmasa yoki rad etilsa — eski kod joyida", async () => {
    for (const m of ['lost', 'refused'] as const) {
      mode = m;
      await expect(logoutOthers()).rejects.toBeInstanceOf(ApiError);
      expect(profile.value?.code).toBe(OLD);
      expect(rotatedCode.value).toBeNull();
    }
  });

  it("almashish paytida eski kod bilan ketgan sinxronlash profilni «yo'qolgan» qilmaydi", async () => {
    during = () => syncProgress().catch(() => {});
    const code = await logoutOthers();
    expect(lostProfile.value).toBeNull();
    expect(profile.value?.code).toBe(code);
    // Keyin esa yangi kod bilan odatdagidek.
    await syncProgress();
    expect(lostProfile.value).toBeNull();
  });

  it("kod boshqa qurilmada almashgan bo'lsa — bu qurilma profilsiz qoladi (natijalar joyida)", async () => {
    serverCode = 'ZZZZZZZZZZZZZZZZ';
    await syncProgress();
    expect(profile.value).toBeNull();
    expect(lostProfile.value).toBe('TEST_USER');
  });
});
