import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { t } from '../i18n';
import { createProfile, errorText } from '../sync';
import { sdk, suggestedNickname } from '../telegram';

/** Taxallus kiritib reytingga qo'shilish shakli. */
export function JoinForm({ compact = false, onJoined }: { compact?: boolean; onJoined?: () => void }) {
  const name = useSignal('');
  const busy = useSignal(false);
  const error = useSignal('');

  // Telegram ichida — ism oldindan yozilgan bo'ladi (o'zgartirsa bo'ladi).
  useEffect(() => {
    void sdk.then(() => {
      if (!name.value) name.value = suggestedNickname();
    });
  }, []);

  const submit = async (e: Event) => {
    e.preventDefault();
    if (busy.value) return;
    busy.value = true;
    error.value = '';
    try {
      await createProfile(name.value);
      onJoined?.();
    } catch (err) {
      error.value = errorText(err);
    } finally {
      busy.value = false;
    }
  };

  return (
    <form class={`join${compact ? ' compact' : ''}`} onSubmit={submit}>
      {!compact && <h2>{t.home.joinTitle}</h2>}
      {!compact && <p class="muted">{t.home.joinText}</p>}
      <div class="row">
        <input
          type="text"
          maxLength={20}
          autoComplete="nickname"
          placeholder={t.home.nicknamePlaceholder}
          value={name.value}
          onInput={(e) => (name.value = (e.currentTarget as HTMLInputElement).value)}
          aria-label={t.home.nicknamePlaceholder}
        />
        <button class="btn" disabled={busy.value || name.value.trim().length < 2}>
          {t.home.join}
        </button>
      </div>
      {error.value && <p class="form-error">{error.value}</p>}
    </form>
  );
}
