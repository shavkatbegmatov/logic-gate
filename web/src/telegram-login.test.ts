import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mini App: bulutdagi kod yo'q yoki eskirgan bo'lsa — server Telegram bog'lanishi orqali tiklaydi; ochiq
// profil esa Telegram'ga bog'lanadi. Faqat soxta ma'lumot (TEST_USER, TEST-… kodlar).
const env = vi.hoisted(() => {
  const cloud = new Map<string, string>();
  const state = { linked: true, appLogins: 0, links: [] as string[], current: (): string | undefined => undefined };
  const app = {
    initData: 'TEST_INIT_DATA',
    initDataUnsafe: {},
    version: '8.0',
    platform: 'tdesktop',
    isVersionAtLeast: () => true,
    ready() {},
    expand() {},
    setHeaderColor() {},
    setBackgroundColor() {},
    openTelegramLink() {},
    BackButton: { show() {}, hide() {}, onClick() {} },
    HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} },
    CloudStorage: {
      getItem(key: string, cb: (err: unknown, value?: string) => void) {
        cb(null, cloud.get(key) ?? '');
      },
      setItem(key: string, value: string, cb?: () => void) {
        cloud.set(key, value);
        cb?.();
      },
      removeItem(key: string, cb?: () => void) {
        cloud.delete(key);
        cb?.();
      },
    },
  };
  return { app, cloud, state };
});

const TOKEN = 'TEST-TOKN-0000-0001';

vi.mock('./api', async (orig) => {
  const real = await orig<typeof import('./api')>();
  const { profile } = await import('./state');
  return {
    ...real,
    api: {
      ...real.api,
      me: async (code?: string) => {
        if ((code ?? profile.value?.code) === 'TEST-ESKI-0000-0000') throw new real.ApiError(401, 'unauthorized');
        return { id: 'p1', nickname: 'TEST_USER', createdAt: 0 };
      },
      progress: async () => ({ levels: [] }),
      telegramAppLogin: async (initData: string) => {
        env.state.appLogins++;
        if (initData !== 'TEST_INIT_DATA') throw new real.ApiError(401, 'bad_init_data');
        if (!env.state.linked) throw new real.ApiError(404, 'not_linked');
        return { player: { id: 'p1', nickname: 'TEST_USER', createdAt: 0, code: TOKEN } };
      },
      telegramAppLink: async (initData: string) => {
        env.state.links.push(`${env.state.current()}:${initData}`);
        return { linked: true };
      },
    },
  };
});
vi.mock('./telegram', async (orig) => ({ ...(await orig<typeof import('./telegram')>()), sdk: Promise.resolve(env.app) }));
vi.mock('./router', () => ({ holdHash() {}, releaseHash() {} }));
vi.mock('./daily', async (orig) => ({ ...(await orig<typeof import('./daily')>()), syncDaily: async () => {} }));
vi.stubGlobal('addEventListener', () => {});

async function start(cloudCode: string | null, current: { id: string; nickname: string; code: string } | null = null) {
  vi.resetModules();
  env.cloud.clear();
  if (cloudCode) env.cloud.set('profile', JSON.stringify({ code: cloudCode }));
  const { profile } = await import('./state');
  env.state.current = () => profile.value?.id;
  profile.value = current;
  const { cloudRestore, startTelegram } = await import('./telegram-app');
  await startTelegram();
  // Bulutga yozish (effekt) va bog'lash so'rovi tugasin.
  await new Promise((r) => setTimeout(r, 0));
  return { profile, cloudRestore };
}

beforeEach(() => {
  env.state.linked = true;
  env.state.appLogins = 0;
  env.state.links = [];
});

describe('Mini App: Telegram bog\'lanishi orqali profil', () => {
  it("bulut bo'sh, Telegram profilga bog'langan — profil serverdan tiklanadi va bulutga yoziladi", async () => {
    const { profile, cloudRestore } = await start(null);
    expect(profile.value).toEqual({ id: 'p1', nickname: 'TEST_USER', code: TOKEN });
    expect(cloudRestore.value).toBe('idle');
    expect(JSON.parse(env.cloud.get('profile')!).code).toBe(TOKEN);
  });

  it("bulut bo'sh, Telegram bog'lanmagan — taxallus so'raladi (profil ochilmaydi)", async () => {
    env.state.linked = false;
    const { profile, cloudRestore } = await start(null);
    expect(env.state.appLogins).toBe(1);
    expect(profile.value).toBeNull();
    expect(cloudRestore.value).toBe('idle');
  });

  it("bulutdagi profil o'chirilgan — bulutdan olinadi, Telegram'ga bog'langan profil tiklanadi", async () => {
    const { profile } = await start('TEST-ESKI-0000-0000');
    expect(profile.value?.code).toBe(TOKEN);
    expect(JSON.parse(env.cloud.get('profile')!).code).toBe(TOKEN);
  });

  it("bulutdagi kod ishlasa — server so'ralmaydi", async () => {
    const { profile } = await start('TEST-KODI-0000-0000');
    expect(env.state.appLogins).toBe(0);
    expect(profile.value?.code).toBe('TEST-KODI-0000-0000');
  });

  it("ochiq profil Telegram'ga bir marta bog'lanadi; profil almashsa — yangisi ham", async () => {
    const { profile } = await start(null, { id: 'p7', nickname: 'TEST_USER_7', code: 'TEST-SEVN-0000-0000' });
    expect(env.state.appLogins).toBe(0);
    expect(env.state.links).toEqual(['p7:TEST_INIT_DATA']);
    profile.value = { ...profile.value! };
    profile.value = { id: 'p8', nickname: 'TEST_USER_8', code: 'TEST-EIGT-0000-0000' };
    await new Promise((r) => setTimeout(r, 0));
    expect(env.state.links).toEqual(['p7:TEST_INIT_DATA', 'p8:TEST_INIT_DATA']);
  });
});
