import { copyText } from '../clipboard';
import { t } from '../i18n';
import { fullShareText, telegramShareUrl, tgAppLink } from '../share';
import { inTelegram, openTelegramLink } from '../telegram';
import { showCopy } from './Dialogs';
import { showToast } from './Toast';
import { Icon } from './ui';

/**
 * Telegram orqali ulashish + matnni nusxalash. Telefonning o'z ulashish menyusi (navigator.share)
 * faqat HTTPS'da bor — u bo'lsa, Telegram havolasi o'rniga o'sha ishlatiladi.
 */
export function ShareButtons({ text, label, path = '', row = false }: { text: string; label?: string; path?: string; row?: boolean }) {
  // Telegram ichida do'st ham o'yinni Telegram ichida ochsin (Mini App havolasi sozlangan bo'lsa).
  const url = (inTelegram && tgAppLink(path)) || `${location.origin}/${path}`;
  const native = !inTelegram && window.isSecureContext && typeof navigator.share === 'function';

  const copy = async () => {
    const full = fullShareText(url, text);
    if (await copyText(full)) showToast(t.share.copied, 'ok');
    // Nusxalab bo'lmasa — matn belgilangan holda o'yin oynasida ko'rsatiladi.
    else showCopy(full);
  };

  // Bosh sahifa ro'yxatida (row) — qator: matn chapda, yonida "nusxalash"; boshqa joylarda — tugma.
  const main = row ? 'home-row' : 'btn share-main';
  const name = label ?? (native ? t.share.native : t.share.telegram);
  const body = (
    <>
      <Icon name={native ? 'share' : 'telegram'} /> {row ? <span class="home-row-text">{name}</span> : name}
    </>
  );
  return (
    <div class={row ? 'home-row-wrap' : 'share'}>
      {native ? (
        <button class={main} onClick={() => navigator.share({ title: t.appName, text, url }).catch(() => {})}>
          {body}
        </button>
      ) : (
        <a
          class={`${main} tg`}
          href={telegramShareUrl(url, text)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => openTelegramLink(telegramShareUrl(url, text)) && e.preventDefault()}
        >
          {body}
        </a>
      )}
      <button class="icon-btn" onClick={copy} title={t.share.copy} aria-label={t.share.copy}>
        <Icon name="copy" />
      </button>
    </div>
  );
}
