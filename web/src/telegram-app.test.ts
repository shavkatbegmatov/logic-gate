import { afterEach, describe, expect, it, vi } from 'vitest';

// Telegram.WebApp o'rnida: bulut javobini sinov boshqaradi (answer — darhol, null — umuman javob yo'q).
const tg = vi.hoisted(() => {
  const cloud = new Map<string, string>();
  const sets: string[] = [];
  const state = { answer: true };
  const app = {
    initData: '',
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
        if (state.answer) cb(null, cloud.get(key) ?? '');
      },
      setItem(key: string, value: string, cb?: () => void) {
        sets.push(key);
        cloud.set(key, value);
        cb?.();
      },
      removeItem(key: string, cb?: () => void) {
        cloud.delete(key);
        cb?.();
      },
    },
  };
  return { app, cloud, sets, state };
});

vi.mock('./telegram', async (orig) => ({ ...(await orig<typeof import('./telegram')>()), sdk: Promise.resolve(tg.app) }));
// Marshrut (location.hash) bu sinovga kerak emas.
vi.mock('./router', () => ({ holdHash() {}, releaseHash() {} }));

// Node'da window hodisalari yo'q ('online' tinglovchisi).
vi.stubGlobal('addEventListener', () => {});

const { profile } = await import('./state');
const { cloudRestore, startTelegram } = await import('./telegram-app');

afterEach(() => vi.useRealTimers());

describe('Telegram bulutidagi profil', () => {
  it("bulut javob bermasa — holat noma'lum, yangi profil kodi bulutdagi eski kod ustidan yozilmaydi", async () => {
    vi.useFakeTimers();
    tg.cloud.set('profile', JSON.stringify({ code: 'ESKI-KOD' }));
    tg.state.answer = false;
    profile.value = null;
    const started = startTelegram();
    await vi.advanceTimersByTimeAsync(5_100);
    expect(cloudRestore.value).toBe('unknown');
    // O'quvchi «baribir yangi profil» ochdi; bulut hamon javob bermaydi.
    profile.value = { id: 'yangi', nickname: 'TEST_USER', code: 'YANGI-KOD' };
    await vi.advanceTimersByTimeAsync(30_000);
    await started;
    expect(tg.sets).toEqual([]);
    expect(JSON.parse(tg.cloud.get('profile')!).code).toBe('ESKI-KOD');
  });
});
