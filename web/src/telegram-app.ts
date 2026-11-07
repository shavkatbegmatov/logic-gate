// Telegram ichida ishga tushish: marshrut, oyna sozlamalari va profil kodini Telegram bulutida saqlash.
// main.tsx ilova chizilgandan keyin chaqiradi (faqat Telegram ichida).
import { effect } from '@preact/signals';
import { ApiError } from './api';
import { showToast } from './components/Toast';
import { t } from './i18n';
import { replaceRoute } from './router';
import { profile } from './state';
import { restoreProfile } from './sync';
import { launchHash, launchStartParam, sdk, startRoute, type TgWebApp } from './telegram';

const BG = '#07110d';
/** Telegram bulutidagi kalit: { code } — tiklash kodi (shu bot va shu foydalanuvchi uchun shaxsiy). */
const CLOUD_KEY = 'profile';

export async function startTelegram() {
  const app = await sdk;
  // SDK parametrlarni o'qib, sessiyaga saqladi — endi hashni o'yin marshrutiga almashtirsa bo'ladi.
  if (launchHash) replaceRoute(startRoute(launchStartParam ?? app?.initDataUnsafe.start_param));
  if (!app) return;
  try {
    app.ready();
    app.expand();
    // Maydonda sudrash pastga surish bilan ilovani yopib yubormasin.
    if (app.isVersionAtLeast('7.7')) app.disableVerticalSwipes?.();
    if (app.isVersionAtLeast('6.1')) {
      app.setHeaderColor(BG);
      app.setBackgroundColor(BG);
    }
    if (app.isVersionAtLeast('7.10')) app.setBottomBarColor?.(BG);
  } catch {
    // Eski Telegram — sozlamalarsiz ham ishlaydi.
  }
  if (app.isVersionAtLeast('6.9')) await syncCloudProfile(app);
}

const cloudGet = (app: TgWebApp, key: string) =>
  new Promise<string | null>((resolve) => {
    try {
      app.CloudStorage.getItem(key, (err, value) => resolve(err ? null : value || null));
    } catch {
      resolve(null);
    }
  });

const cloudSet = (app: TgWebApp, key: string, value: string) =>
  new Promise<void>((resolve) => {
    try {
      app.CloudStorage.setItem(key, value, () => resolve());
    } catch {
      resolve();
    }
  });

const cloudRemove = (app: TgWebApp, key: string) =>
  new Promise<void>((resolve) => {
    try {
      app.CloudStorage.removeItem(key, () => resolve());
    } catch {
      resolve();
    }
  });

/**
 * Telegram bulutida tiklash kodi: boshqa qurilmadagi Telegram'da o'yin ochilsa, profil va natijalar
 * o'zi tiklanadi. Qurilmada ham, bulutda ham boshqa-boshqa profil bo'lsa — hech biriga tegilmaydi.
 */
async function syncCloudProfile(app: TgWebApp) {
  let saved: { code?: string } | null = null;
  try {
    saved = JSON.parse((await cloudGet(app, CLOUD_KEY)) ?? 'null');
  } catch {
    // Buzilgan yozuv — yo'q deb hisoblanadi.
  }
  if (!profile.value && saved?.code) {
    try {
      await restoreProfile(saved.code);
      const name = profile.peek()?.nickname;
      if (name) showToast(t.telegram.restored(name), 'ok', 4000);
    } catch (e) {
      // Kod endi yaroqsiz — bulutdan olib tashlanadi; aloqa yo'q bo'lsa, keyingi safar yana urinadi.
      if (e instanceof ApiError && e.status === 401) await cloudRemove(app, CLOUD_KEY);
    }
  } else if (profile.value && !saved?.code) {
    await cloudSet(app, CLOUD_KEY, JSON.stringify({ code: profile.value.code }));
    saved = { code: profile.value.code };
  }

  // Keyingi o'zgarishlar: yangi yoki tiklangan profil bulutga yoziladi; o'chirilgan profil bulutdan
  // ham o'chiriladi — faqat bulutdagi aynan o'sha bo'lsa.
  let cloudCode = saved?.code ?? null;
  let last = profile.value?.code ?? null;
  effect(() => {
    const code = profile.value?.code ?? null;
    if (code === last) return;
    const removed = last;
    last = code;
    if (code) {
      cloudCode = code;
      void cloudSet(app, CLOUD_KEY, JSON.stringify({ code }));
    } else if (removed && removed === cloudCode) {
      cloudCode = null;
      void cloudRemove(app, CLOUD_KEY);
    }
  });
}
