import { copyText } from '../clipboard';
import { t } from '../i18n';
import { fullShareText, telegramShareUrl, tgAppLink } from '../share';
import { inTelegram, openTelegramLink } from '../telegram';
import { showToast } from './Toast';
import { Icon } from './ui';

/**
 * Telegram orqali ulashish + matnni nusxalash. Telefonning o'z ulashish menyusi (navigator.share)
 * faqat HTTPS'da bor — u bo'lsa, Telegram havolasi o'rniga o'sha ishlatiladi.
 */
export function ShareButtons({ text, label, path = '' }: { text: string; label?: string; path?: string }) {
  // Telegram ichida do'st ham o'yinni Telegram ichida ochsin (Mini App havolasi sozlangan bo'lsa).
  const url = (inTelegram && tgAppLink(path)) || `${location.origin}/${path}`;
  const native = !inTelegram && window.isSecureContext && typeof navigator.share === 'function';

  const copy = async () => {
    const full = fullShareText(url, text);
    if (await copyText(full)) showToast(t.share.copied, 'ok');
    // Nusxalab bo'lmasa — matn tanlab olinadigan oynada ko'rsatiladi.
    else window.prompt(t.share.copyManual, full);
  };

  return (
    <div class="share">
      {native ? (
        <button class="btn share-main" onClick={() => navigator.share({ title: t.appName, text, url }).catch(() => {})}>
          <Icon name="share" /> {label ?? t.share.native}
        </button>
      ) : (
        <a
          class="btn share-main tg"
          href={telegramShareUrl(url, text)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => openTelegramLink(telegramShareUrl(url, text)) && e.preventDefault()}
        >
          <Icon name="telegram" /> {label ?? t.share.telegram}
        </a>
      )}
      <button class="icon-btn" onClick={copy} title={t.share.copy} aria-label={t.share.copy}>
        <Icon name="copy" />
      </button>
    </div>
  );
}
