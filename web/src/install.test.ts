import { describe, expect, it } from 'vitest';
import { canOfferInstall, dismissInstall, installed, installPrompt, isIOS } from './install';

// Testda brauzer hodisasi yo'q — ushlangan hodisa o'rniga soxtasi qo'yiladi.
const fakePrompt = (outcome: 'accepted' | 'dismissed') =>
  Object.assign(new Event('beforeinstallprompt'), { prompt: async () => {}, userChoice: Promise.resolve({ outcome }) }) as never;

describe("o'rnatish", () => {
  it('iPhone, iPad (Mac deb ko\'rinsa ham), Android emas', () => {
    expect(isIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 5)).toBe(true);
    expect(isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
    expect(isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
    expect(isIOS('Mozilla/5.0 (Linux; Android 14)', 5)).toBe(false);
  });

  it('brauzer tayyor bo\'lsa taklif qilinadi; yopilsa — 30 kun ko\'rsatilmaydi', async () => {
    expect(canOfferInstall.value).toBe(false);
    installPrompt.value = fakePrompt('accepted');
    expect(canOfferInstall.value).toBe(true);
    dismissInstall();
    expect(canOfferInstall.value).toBe(false);
    dismissInstall(Date.now() - 31 * 24 * 3600 * 1000);
    expect(canOfferInstall.value).toBe(true);
  });

  it("o'rnatilgach taklif yo'qoladi", async () => {
    const { promptInstall } = await import('./install');
    installPrompt.value = fakePrompt('accepted');
    expect(await promptInstall()).toBe(true);
    expect(installed.value).toBe(true);
    expect(installPrompt.value).toBeNull();
    expect(canOfferInstall.value).toBe(false);
  });
});
