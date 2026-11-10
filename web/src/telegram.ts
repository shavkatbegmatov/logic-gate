// Telegram Mini App: o'yin bot orqali Telegram ichida ochilganda.
//
// Telegram SDK (telegram.org/js/telegram-web-app.js) faqat Telegram ichida yuklanadi — oddiy saytga
// uchinchi tomon skripti qo'shilmaydi. Telegram ishga tushirish parametrlarini hashga yozadi
// (#tgWebAppData=…&tgWebAppPlatform=…); SDK ularni yuklanayotganda o'qiydi, shuning uchun hash
// SDK yuklangandan keyingina o'yin marshrutiga almashtiriladi (telegram-app.ts).
//
// Bu modul ilova holatini import qilmaydi (audio.ts dan ham chaqiriladi).

// Lokal sinov (pnpm dev): Telegram'siz soxta SDK — web/dev/tg-mock.js (VITE_TG_SDK_URL). Build'da yo'q.
const SDK_URL =
  (import.meta.env.DEV && (import.meta.env.VITE_TG_SDK_URL as string | undefined)) || 'https://telegram.org/js/telegram-web-app.js';
const FLAG = 'lg.tg';

/** Ishlatiladigan Telegram.WebApp qismi. */
export interface TgWebApp {
  initData: string;
  initDataUnsafe: { user?: { first_name?: string; last_name?: string; username?: string }; start_param?: string };
  version: string;
  platform: string;
  isVersionAtLeast(v: string): boolean;
  ready(): void;
  expand(): void;
  disableVerticalSwipes?(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  setBottomBarColor?(color: string): void;
  /** Telegram'ning yorug'/qorong'i rejimi (6.0+); o'zgarsa — 'themeChanged' hodisasi. */
  colorScheme?: 'light' | 'dark';
  onEvent?(event: 'themeChanged', cb: () => void): void;
  openTelegramLink(url: string): void;
  /** Oddiy havola (sayt) — Telegram'ning brauzerida, Mini App yopilmaydi. */
  openLink?(url: string): void;
  requestWriteAccess?(cb: (granted: boolean) => void): void;
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void };
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
  CloudStorage: {
    getItem(key: string, cb: (err: unknown, value?: string) => void): void;
    setItem(key: string, value: string, cb?: (err: unknown, ok?: boolean) => void): void;
    removeItem(key: string, cb?: (err: unknown, ok?: boolean) => void): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

function hashParams(): URLSearchParams {
  try {
    return new URLSearchParams(location.hash.replace(/^#/, ''));
  } catch {
    return new URLSearchParams();
  }
}

/**
 * Telegram ichida ochilganmi: ishga tushirish parametrlari hashda, yoki sahifa shu sessiyada
 * qayta yuklangan (Telegram ichida "yangilash").
 */
function detect(): boolean {
  if (typeof location === 'undefined') return false;
  const p = hashParams();
  if (p.has('tgWebAppPlatform') || p.has('tgWebAppData')) {
    try {
      sessionStorage.setItem(FLAG, '1');
    } catch {
      // Sessiya xotirasi yo'q — faqat shu ochilishda.
    }
    return true;
  }
  try {
    return sessionStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

export const inTelegram = detect();

/** Ishga tushirishdagi start parametri (t.me/bot/app?startapp=…): SDK dan oldin, hashdan. */
export const launchStartParam = inTelegram ? hashParams().get('tgWebAppStartParam') : null;
/** Hash Telegram parametrlarimi (o'yin marshruti emas). */
export const launchHash = inTelegram && /^#tgWebApp/.test(location.hash);

/** Telegram ilovasining tili (user.language_code): SDK dan oldin, hashdagi tgWebAppData dan. */
export const launchLanguage: string | null = (() => {
  if (!launchHash) return null;
  try {
    const data = new URLSearchParams(hashParams().get('tgWebAppData') ?? '');
    const code: unknown = JSON.parse(data.get('user') ?? 'null')?.language_code;
    return typeof code === 'string' ? code : null;
  } catch {
    return null;
  }
})();

/** start_param (t.me/bot/app?startapp=…) → o'yin marshruti. */
export function startRoute(param: string | null | undefined): string {
  if (!param) return '';
  if (param === 'daily' || param === 'levels' || param === 'sandbox') return param;
  if (param.startsWith('p_') && param.length > 2) return `p/${param.slice(2)}`;
  if (/^c_[0-9A-Za-z]{6}$/.test(param)) return `class/${param.slice(2)}`;
  return '';
}

let app: TgWebApp | null = null;

/** SDK yuklanganda Telegram.WebApp; Telegram tashqarisida yoki yuklanmasa — null. */
export const sdk: Promise<TgWebApp | null> = !inTelegram
  ? Promise.resolve(null)
  : new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = SDK_URL;
      s.onload = () => {
        app = window.Telegram?.WebApp ?? null;
        resolve(app);
      };
      // Oflayn yoki bloklangan — o'yin oddiy sayt kabi ishlayveradi.
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });

export function tg(): TgWebApp | null {
  return app;
}

type Haptic = 'light' | 'medium' | 'select' | 'success' | 'error';

/** Telefon tebranishi (faqat Telegram ichida; eski versiyalarda jim). */
export function haptic(kind: Haptic) {
  if (!app || !app.isVersionAtLeast('6.1')) return;
  try {
    const h = app.HapticFeedback;
    if (kind === 'select') h.selectionChanged();
    else if (kind === 'success' || kind === 'error') h.notificationOccurred(kind);
    else h.impactOccurred(kind);
  } catch {
    // Tebranish ixtiyoriy.
  }
}

/** Telegram ilovasining ichki havolasi (t.me/…) — Telegram'ning o'zida ochiladi, brauzerda emas. */
export function openTelegramLink(url: string): boolean {
  if (!app) return false;
  try {
    app.openTelegramLink(url);
    return true;
  } catch {
    return false;
  }
}

/** Sayt havolasi Telegram ichida: Mini App'dan chiqmasdan brauzerda ochiladi. */
export function openExternal(url: string): boolean {
  if (!app?.openLink) return false;
  try {
    app.openLink(url);
    return true;
  } catch {
    return false;
  }
}

/** Bot foydalanuvchiga yozishi uchun ruxsat (Telegram o'z oynasida so'raydi; berilgan bo'lsa — darhol true). */
export function requestWriteAccess(): Promise<boolean> {
  if (!app || !app.isVersionAtLeast('6.9') || !app.requestWriteAccess) return Promise.resolve(true);
  return new Promise((resolve) => {
    try {
      app!.requestWriteAccess!((granted) => resolve(granted));
    } catch {
      resolve(true);
    }
  });
}

/** Telegram'dagi foydalanuvchi ismidan taxallus taklifi (server baribir tekshiradi). */
export function suggestedNickname(): string {
  const u = app?.initDataUnsafe.user;
  if (!u) return '';
  // Hangul "to'ldiruvchi" belgilari harf hisoblanadi, lekin ko'rinmaydi ("bo'sh" Telegram ismlari) —
  // server ularni rad etadi, shuning uchun taklifga qo'shilmaydi.
  const clean = (s = '') =>
    s
      .replace(/[ᅟᅠㅤﾠ]/g, '')
      .replace(/[^\p{L}\p{N} _.-]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  const full = clean(`${u.first_name ?? ''} ${u.last_name ?? ''}`);
  const name = full.length >= 2 ? full : clean(u.username);
  return name.slice(0, 20).trim();
}

// ── Orqaga tugmasi ──────────────────────────────────────────
// Har bir ekranning TopBar dagi "orqaga" amali ro'yxatga yoziladi; Telegram sarlavhasidagi
// orqaga tugmasi (va Android'dagi tizim tugmasi) eng oxirgisini bajaradi.

const backStack: (() => void)[] = [];
let backBound = false;

function syncBack() {
  if (!app || !app.isVersionAtLeast('6.1')) return;
  if (!backBound) {
    backBound = true;
    app.BackButton.onClick(() => backStack[backStack.length - 1]?.());
  }
  if (backStack.length) app.BackButton.show();
  else app.BackButton.hide();
}

/** TopBar chaqiradi: ekran ochiq ekan, Telegram'ning orqaga tugmasi shu amalni bajaradi. */
export function registerBack(fn: () => void): () => void {
  backStack.push(fn);
  syncBack();
  return () => {
    const i = backStack.lastIndexOf(fn);
    if (i >= 0) backStack.splice(i, 1);
    syncBack();
  };
}

void sdk.then(() => syncBack());
