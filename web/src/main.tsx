// Birinchi: eski manzildan ko'chirilgan natijalar ilova holati o'qilishidan oldin yoziladi.
import { onOldHost } from './migrate';
import { render } from 'preact';
import { App } from './app';
import { startMusic } from './audio';
import { installErrorReporting } from './errors';
import { startFunnel } from './funnel';
import './install';
import './theme';
import { loadLevelDetails } from './levels';
import { route } from './router';
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
  // Fon musiqasi va boy ovozlar (birinchi bosishdan keyin, alohida bo'lak).
  startMusic(route);
  // O'yinchilar voronkasi (faqat bosqich nomlari, har biri qurilmadan bir marta).
  startFunnel();
  // Daraja tafsilotlari (jadvallar, vazifa matni) — birinchi chizishdan keyin, bo'sh paytda: daraja darhol ochiladi.
  const idle = window.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 300));
  idle(() => void loadLevelDetails().catch(() => {}));
});

// Oflayn rejim (scripts/sw.template.js). Faqat build'da va HTTPS/localhost'da: eski manzil
// foydalanuvchini yangisiga o'tkazadi, u yerda o'rnatilgan nusxa kerak emas.
if (import.meta.env.PROD && 'serviceWorker' in navigator && !onOldHost()) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
