// Telegram ichida ishga tushish: marshrut, oyna sozlamalari, profil kodi va o'qituvchi kalitlarini
// Telegram bulutida saqlash. main.tsx ilova chizilgandan keyin chaqiradi (faqat Telegram ichida).
import { effect, signal } from '@preact/signals';
import { ApiError } from './api';
import { decodeTeacherClasses, encodeTeacherClasses, mergeTeacherClasses, teacherClasses } from './classes';
import { showToast } from './components/Toast';
import { t } from './i18n';
import { holdHash, releaseHash } from './router';
import { profile } from './state';
import { restoreProfile } from './sync';
import { activeTheme, telegramScheme, THEME_BG } from './theme';
import { launchHash, launchStartParam, sdk, startRoute, type TgWebApp } from './telegram';

/** Telegram bulutidagi kalit: { code } — tiklash kodi (shu bot va shu foydalanuvchi uchun shaxsiy). */
const CLOUD_KEY = 'profile';
/** O'qituvchi yaratgan sinflar va kalitlari (classes.ts: encodeTeacherClasses). */
const TEACHER_KEY = 'teacher';

/**
 * Bulutdagi profil holati (JoinForm ko'rsatadi): 'pending' — tekshirilmoqda yoki tiklanmoqda,
 * 'failed' — bulutda profil bor, lekin aloqa yo'qligidan tiklanmadi. Shu paytda yangi profil
 * ochilsa, bulutdagi eski profil tashlab ketilardi — shuning uchun avval shu holat ko'rsatiladi.
 */
export const cloudRestore = signal<'idle' | 'pending' | 'failed'>('idle');

let retry: (() => void) | null = null;

/** JoinForm dagi «Qayta urinish». */
export function retryCloudRestore() {
  retry?.();
}

export async function startTelegram() {
  // SDK ishga tushirish parametrlarini hashdan o'qiydi — u yuklanguncha hash o'zgarmasin.
  if (launchHash) holdHash();
  if (!profile.value) cloudRestore.value = 'pending';
  const app = await sdk;
  // SDK parametrlarni o'qib, sessiyaga saqladi — endi hashni o'yin marshrutiga almashtirsa bo'ladi.
  // O'yinchi kutish paytida boshqa ekranga o'tgan bo'lsa, o'sha ekran qoladi.
  if (launchHash) releaseHash(startRoute(launchStartParam ?? app?.initDataUnsafe.start_param));
  if (!app || !app.isVersionAtLeast('6.9')) cloudRestore.value = 'idle';
  if (!app) return;
  try {
    app.ready();
    app.expand();
    // Maydonda sudrash pastga surish bilan ilovani yopib yubormasin.
    if (app.isVersionAtLeast('7.7')) app.disableVerticalSwipes?.();
    // "Avto" mavzu Telegram rejimiga qaraydi; Telegram oynasining ranglari — mavzu fonida.
    if (app.colorScheme) telegramScheme.value = app.colorScheme;
    app.onEvent?.('themeChanged', () => (telegramScheme.value = app.colorScheme ?? null));
    effect(() => {
      const bg = THEME_BG[activeTheme.value];
      try {
        if (app.isVersionAtLeast('6.1')) {
          app.setHeaderColor(bg);
          app.setBackgroundColor(bg);
        }
        if (app.isVersionAtLeast('7.10')) app.setBottomBarColor?.(bg);
      } catch {
        // Eski Telegram — ranglarsiz.
      }
    });
  } catch {
    // Eski Telegram — sozlamalarsiz ham ishlaydi.
  }
  if (app.isVersionAtLeast('6.9')) {
    await syncCloudProfile(app);
    await syncCloudTeacher(app);
  }
}

/** Ba'zi Telegram ilovalarida javob kelmay qolishi mumkin — o'yin kutib qolmasin. */
const CLOUD_TIMEOUT = 5000;

const cloudGet = (app: TgWebApp, key: string) =>
  new Promise<string | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), CLOUD_TIMEOUT);
    try {
      app.CloudStorage.getItem(key, (err, value) => {
        clearTimeout(timer);
        resolve(err ? null : value || null);
      });
    } catch {
      clearTimeout(timer);
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
  // Bulutdagi profil (shu qurilmaga tiklanganmi-yo'qmi, farqi yo'q).
  let cloudCode = typeof saved?.code === 'string' ? saved.code : null;

  let running = false;
  const restore = async () => {
    const code = cloudCode;
    if (running || !code || profile.value) return;
    running = true;
    cloudRestore.value = 'pending';
    try {
      // Kutish paytida o'quvchi yangi profil ochgan bo'lsa — unga tegilmaydi.
      if (await restoreProfile(code, true)) {
        const name = profile.peek()?.nickname;
        if (name) showToast(t.telegram.restored(name), 'ok', 4000);
      }
      cloudRestore.value = 'idle';
    } catch (e) {
      // Kod endi yaroqsiz — bulutdan olib tashlanadi; aloqa yo'q bo'lsa, qayta urinsa bo'ladi.
      if (e instanceof ApiError && e.status === 401) {
        cloudCode = null;
        await cloudRemove(app, CLOUD_KEY);
      }
      cloudRestore.value = cloudCode && !profile.peek() ? 'failed' : 'idle';
    } finally {
      running = false;
    }
  };

  if (!profile.value && cloudCode) {
    retry = () => void restore();
    addEventListener('online', retry);
    await restore();
  } else {
    cloudRestore.value = 'idle';
    if (profile.value && !cloudCode) {
      cloudCode = profile.value.code;
      await cloudSet(app, CLOUD_KEY, JSON.stringify({ code: cloudCode }));
    }
  }

  // Keyingi o'zgarishlar: yangi yoki tiklangan profil bulutga yoziladi — faqat bulut bo'sh bo'lsa yoki
  // unda shu qurilmadagi oldingi profil turgan bo'lsa (bulutdagi tiklanmagan profil ustidan yozilmaydi).
  // O'chirilgan profil bulutdan ham o'chiriladi — faqat bulutdagi aynan o'sha bo'lsa.
  let last = profile.value?.code ?? null;
  effect(() => {
    const code = profile.value?.code ?? null;
    if (code === last) return;
    const removed = last;
    last = code;
    if (code) {
      if (cloudCode !== null && cloudCode !== removed) return;
      cloudCode = code;
      cloudRestore.value = 'idle';
      void cloudSet(app, CLOUD_KEY, JSON.stringify({ code }));
    } else if (removed && removed === cloudCode) {
      cloudCode = null;
      void cloudRemove(app, CLOUD_KEY);
    }
  });
}

/**
 * O'qituvchi kalitlari Telegram bulutida: boshqa qurilmadagi Telegram'da ham sinflar ro'yxati to'liq
 * bo'ladi. Ikki tomondagi sinflar birlashtiriladi, keyingi o'zgarishlar bulutga yoziladi.
 */
async function syncCloudTeacher(app: TgWebApp) {
  const raw = await cloudGet(app, TEACHER_KEY);
  mergeTeacherClasses(decodeTeacherClasses(raw));
  let last = raw ?? encodeTeacherClasses([]);
  effect(() => {
    const value = encodeTeacherClasses(teacherClasses.value);
    if (value === last) return;
    last = value;
    void cloudSet(app, TEACHER_KEY, value);
  });
}
