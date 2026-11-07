import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { api, ApiError } from '../api';
import { lang, t } from '../i18n';
import { requestWriteAccess, sdk, tg } from '../telegram';
import { showToast } from './Toast';

/**
 * Telegram ichida: kunlik eslatmani bot orqali yoqish/o'chirish. Telegram tashqarisida, bot serverda
 * o'rnatilmagan bo'lsa yoki aloqa bo'lmasa — hech narsa ko'rsatilmaydi.
 */
export function RemindToggle({ compact = false, card = false }: { compact?: boolean; card?: boolean }) {
  /** null — ko'rsatilmaydi. */
  const on = useSignal<boolean | null>(null);
  const busy = useSignal(false);

  useEffect(() => {
    let alive = true;
    void sdk.then(async (app) => {
      if (!app?.initData) return;
      try {
        const r = await api.telegramRemind(app.initData);
        if (alive) on.value = r.remind;
      } catch {
        // Bot o'rnatilmagan yoki aloqa yo'q — tugma kerak emas.
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  if (on.value === null) return null;

  const toggle = async () => {
    const app = tg();
    if (!app || busy.value) return;
    const want = !on.value;
    busy.value = true;
    try {
      // Bot foydalanuvchiga yozishi uchun Telegram ruxsat so'raydi (berilgan bo'lsa — darhol).
      if (want && !(await requestWriteAccess())) {
        showToast(t.telegram.remindDenied, 'error');
        return;
      }
      const r = await api.telegramRemind(app.initData, want, lang.value);
      on.value = r.remind;
      showToast(r.remind ? t.telegram.remindEnabled : t.telegram.remindDisabled, 'ok', 4000);
    } catch (e) {
      showToast(e instanceof ApiError && e.code === 'bot_blocked' ? t.telegram.remindBlocked : t.network, 'error', 5000);
    } finally {
      busy.value = false;
    }
  };

  const body = (
    <div class={`remind${compact ? ' compact' : ''}`}>
      {!compact && <p class="muted small">{t.telegram.remindText}</p>}
      <button class={`btn remind-btn${on.value ? ' on' : ''}`} onClick={toggle} disabled={busy.value} aria-pressed={on.value}>
        {on.value ? t.telegram.remindOff : t.telegram.remindOn}
      </button>
    </div>
  );
  // Sozlamalarda alohida karta — faqat tugma ko'rsatilganda (bo'sh karta qolmasin).
  return card ? <section class="card">{body}</section> : body;
}
