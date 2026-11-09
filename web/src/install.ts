// Telefonga (yoki kompyuterga) o'rnatish: Chrome/Edge/Android "beforeinstallprompt" hodisasini beradi —
// uni ushlab, o'z tugmamiz bilan tizim oynasini chaqiramiz. iPhone/iPad Safari'da bunday hodisa yo'q —
// u yerda "Ulashish → Bosh ekranga qo'shish" izohi. Telegram ichida va o'rnatilgan ilovada ko'rsatilmaydi.
// main.tsx bu faylni erta import qiladi: hodisa sahifa ochilishi bilanoq keladi.
import { computed, signal } from '@preact/signals';
import { load, save } from './storage';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'lg.installDismissed.v1';
/** Bosh sahifadagi taklif yopilgandan keyin qayta ko'rsatilmaydigan muddat. */
const DISMISS_FOR = 30 * 24 * 3600 * 1000;

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone/iPad (iPadOS 13+ o'zini Mac deb ko'rsatadi — sensorli ekran bo'yicha ajratiladi). */
export function isIOS(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '', touch = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0): boolean {
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && touch > 1);
}

export const installPrompt = signal<InstallPromptEvent | null>(null);
export const installed = signal(isStandalone());
export const installDismissedAt = signal<number>(load(DISMISS_KEY, 0));

if (typeof window !== 'undefined') {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt.value = e as InstallPromptEvent;
  });
  addEventListener('appinstalled', () => {
    installed.value = true;
    installPrompt.value = null;
  });
}

/** Tizimning o'rnatish oynasi; true — o'rnatildi. */
export async function promptInstall(): Promise<boolean> {
  const e = installPrompt.value;
  if (!e) return false;
  try {
    await e.prompt();
    const { outcome } = await e.userChoice;
    installPrompt.value = null;
    if (outcome === 'accepted') installed.value = true;
    return outcome === 'accepted';
  } catch {
    return false;
  }
}

export function dismissInstall(now = Date.now()) {
  installDismissedAt.value = now;
  save(DISMISS_KEY, now);
}

/** Bosh sahifadagi taklif: brauzer o'rnatishga tayyor, hali o'rnatilmagan, yaqinda yopilmagan. */
export const canOfferInstall = computed(
  () => !!installPrompt.value && !installed.value && Date.now() - installDismissedAt.value > DISMISS_FOR,
);
