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
 * 'failed' — bulutda profil bor, lekin aloqa yo'qligidan tiklanmadi, 'unknown' — bulut javob bermadi
 * (bor-yo'qligi noma'lum). Shu paytda yangi profil ochilsa, bulutdagi eski profil tashlab ketilardi —
 * shuning uchun avval shu holat ko'rsatiladi.
 */
export const cloudRestore = signal<'idle' | 'pending' | 'failed' | 'unknown'>('idle');

let retry: (() => void) | null = null;
let teacherRetry: (() => void) | null = null;

/** JoinForm dagi «Qayta urinish»: profil va (o'qilmagan bo'lsa) o'qituvchi sinflari. */
export function retryCloudRestore() {
  retry?.();
  teacherRetry?.();
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
/** Javob kelmasa — bir marta o'zi qayta so'raladi (sekin internet). */
const CLOUD_RETRY = 4000;

/**
 * Bulutdagi qiymat: { value } — javob keldi (value null — kalit bo'sh), null — javob kelmadi yoki xato.
 * Ikkalasi farqlanadi: javob kelmaganini "bo'sh" deb hisoblab, bulutdagi profil yoki sinflar ro'yxati
 * ustidan yozib yuborilardi.
 */
const cloudGet = (app: TgWebApp, key: string) =>
  new Promise<{ value: string | null } | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), CLOUD_TIMEOUT);
    try {
      app.CloudStorage.getItem(key, (err, value) => {
        clearTimeout(timer);
        resolve(err ? null : { value: value || null });
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
  // Bulutdagi profil kodi (shu qurilmaga tiklanganmi-yo'qmi, farqi yo'q): null — bulut bo'sh,
  // undefined — hali bilinmaydi (javob kelmadi). Noma'lum bulut ustidan hech qachon yozilmaydi.
  let cloudCode: string | null | undefined;
  const read = async (): Promise<boolean> => {
    const r = await cloudGet(app, CLOUD_KEY);
    if (!r) return false;
    let saved: { code?: unknown } | null = null;
    try {
      saved = JSON.parse(r.value ?? 'null');
    } catch {
      // Buzilgan yozuv — yo'q deb hisoblanadi.
    }
    cloudCode = typeof saved?.code === 'string' ? saved.code : null;
    return true;
  };

  let running = false;
  let retried = false;
  const restore = async () => {
    if (running || profile.value) return;
    running = true;
    cloudRestore.value = 'pending';
    try {
      if (cloudCode === undefined && !(await read())) {
        // Bulut javob bermadi: profil bor-yo'qligi noma'lum. Bir marta o'zi qayta so'raydi.
        cloudRestore.value = profile.peek() ? 'idle' : 'unknown';
        if (!retried) {
          retried = true;
          setTimeout(() => void restore(), CLOUD_RETRY);
        }
        return;
      }
      const code = cloudCode;
      // Kutish paytida o'quvchi yangi profil ochgan bo'lsa — unga tegilmaydi.
      if (code && (await restoreProfile(code, true))) {
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

  if (!profile.value) {
    retry = () => void restore();
    addEventListener('online', retry);
    await restore();
  } else {
    cloudRestore.value = 'idle';
    if ((await read()) && cloudCode === null && profile.value) {
      cloudCode = profile.value.code;
      await cloudSet(app, CLOUD_KEY, JSON.stringify({ code: cloudCode }));
    }
  }

  // Keyingi o'zgarishlar: yangi yoki tiklangan profil bulutga yoziladi — faqat bulut bo'sh bo'lsa yoki
  // unda shu qurilmadagi oldingi profil turgan bo'lsa (bulutdagi tiklanmagan profil ustidan yozilmaydi).
  // O'chirilgan profil bulutdan ham o'chiriladi — faqat bulutdagi aynan o'sha bo'lsa. Bulut holati
  // noma'lum bo'lsa, avval o'qiladi; javob kelmasa — tegilmaydi (keyingi ochilishda yoziladi).
  let last = profile.value?.code ?? null;
  effect(() => {
    const code = profile.value?.code ?? null;
    if (code === last) return;
    const removed = last;
    last = code;
    void (async () => {
      if (cloudCode === undefined && !(await read())) return;
      if (code) {
        if (cloudCode !== null && cloudCode !== removed) return;
        cloudCode = code;
        cloudRestore.value = 'idle';
        await cloudSet(app, CLOUD_KEY, JSON.stringify({ code }));
      } else if (removed && removed === cloudCode) {
        cloudCode = null;
        await cloudRemove(app, CLOUD_KEY);
      }
    })();
  });
}

/**
 * O'qituvchi kalitlari Telegram bulutida: boshqa qurilmadagi Telegram'da ham sinflar ro'yxati to'liq
 * bo'ladi. Ikki tomondagi sinflar birlashtiriladi, keyingi o'zgarishlar bulutga yoziladi.
 */
async function syncCloudTeacher(app: TgWebApp) {
  // Bulutdagi ro'yxat o'qilmaguncha unga yozilmaydi: javob kelmaganda shu qurilmadagi ro'yxat boshqa
  // qurilmalarda yaratilgan sinflar ustidan yozib yuborilardi.
  const known = signal(false);
  let last = '';
  const read = async () => {
    const r = await cloudGet(app, TEACHER_KEY);
    if (!r) return false;
    mergeTeacherClasses(decodeTeacherClasses(r.value));
    last = r.value ?? encodeTeacherClasses([]);
    known.value = true;
    return true;
  };
  // Javob kelmasa — oraliq uzayib boradi; «Qayta urinish» va internet qaytishi ham qayta o'qitadi.
  const delays = [CLOUD_RETRY, 15_000, 60_000];
  let busy = false;
  const again = async () => {
    if (known.value || busy) return;
    busy = true;
    const ok = await read();
    busy = false;
    const next = delays.shift();
    if (!ok && next) setTimeout(() => void again(), next);
  };
  teacherRetry = () => void again();
  addEventListener('online', teacherRetry);
  if (!(await read())) setTimeout(() => void again(), delays.shift());
  effect(() => {
    const value = encodeTeacherClasses(teacherClasses.value);
    if (!known.value || value === last) return;
    last = value;
    void cloudSet(app, TEACHER_KEY, value);
  });
}
