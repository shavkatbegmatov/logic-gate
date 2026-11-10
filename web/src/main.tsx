// Birinchi: eski manzildan ko'chirilgan natijalar ilova holati o'qilishidan oldin yoziladi.
import { onOldHost } from './migrate';
import { render } from 'preact';
import { App } from './app';
import { installErrorReporting } from './errors';
import './install';
import './theme';
import { freshDevice } from './state';
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

render(<App />, document.getElementById('app')!);

// Telegram Mini App sifatida ochilgan bo'lsa: Telegram oynasi, marshrut, bulutdagi profil.
if (inTelegram) void startTelegram();

// Oflayn rejim (scripts/sw.template.js). Faqat build'da va HTTPS/localhost'da: eski manzil
// foydalanuvchini yangisiga o'tkazadi, u yerda o'rnatilgan nusxa kerak emas.
if (import.meta.env.PROD && 'serviceWorker' in navigator && !onOldHost()) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
