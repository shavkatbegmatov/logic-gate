// Birinchi: eski manzildan ko'chirilgan natijalar ilova holati o'qilishidan oldin yoziladi.
import { onOldHost } from './migrate';
import { render } from 'preact';
import { App } from './app';
import { installErrorReporting } from './errors';
import './install';
import './theme';
import { freshDevice, langReady } from './state';
import { inTelegram } from './telegram';
import { startTelegram } from './telegram-app';
import { markNewsSeen } from './version';
// Shriftlar (IBM Plex): o'z serverimizdan, har alifbo kerak bo'lgandagina yuklanadi (unicode-range).
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles.css';

// Kutilmagan xatolar haqida serverga xabar (faqat build'da: dev'da konsol yetarli).
if (import.meta.env.PROD) installErrorReporting();

// Birinchi ochilish: yangi o'yinchiga hammasi yangi — "yangi versiya" xabari faqat qaytganlarga. Sinf
// havolasi orqali kelgan o'quvchi bosh sahifani profil ochgandan keyin ko'radi, shuning uchun bu shu yerda.
if (freshDevice) markNewsSeen();

// Lug'at alohida bo'lakda (i18n.ts): ilova ochilish tilining lug'ati kelgachgina chiziladi — o'yinchi
// boshqa tildagi matnni bir lahza ham ko'rmaydi. public/theme.js shu bo'lakni oldindan so'rab qo'yadi.
void langReady.then((ok) => {
  if (!ok) {
    // public/theme.js dagi "o'yin ochilmadi" oynasi window'gacha yetgan xatoni kutadi.
    setTimeout(() => {
      throw new Error("lug'at yuklanmadi");
    });
    return;
  }
  render(<App />, document.getElementById('app')!);
  // public/theme.js dagi "o'yin ochilmadi" oynasi endi kerak emas: keyingi xatolarni app.tsx ushlaydi.
  (window as { __lgReady?: boolean }).__lgReady = true;

  // Telegram Mini App sifatida ochilgan bo'lsa: Telegram oynasi, marshrut, bulutdagi profil.
  if (inTelegram) void startTelegram();
});

// Oflayn rejim (scripts/sw.template.js). Faqat build'da va HTTPS/localhost'da: eski manzil
// foydalanuvchini yangisiga o'tkazadi, u yerda o'rnatilgan nusxa kerak emas.
if (import.meta.env.PROD && 'serviceWorker' in navigator && !onOldHost()) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
