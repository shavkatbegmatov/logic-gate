import { useSignal } from '@preact/signals';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { t } from '../i18n';
import { profile } from '../state';
import { codeComplete, createProfile, errorText, restoreProfile } from '../sync';
import { sdk, suggestedNickname } from '../telegram';
import { cloudRestore, retryCloudRestore } from '../telegram-app';
import { showToast } from './Toast';

/**
 * Taxallus kiritib reytingga qo'shilish shakli. Avval boshqa qurilmada (yoki shu brauzerda, tozalashdan
 * oldin) o'ynagan o'quvchi shu yerning o'zida tiklash kodini kiritadi: busiz u odatdagidek ismini yozib,
 * har safar yangi profil ochardi — reytingda bir odamning ismi ko'payib ketardi.
 * hint — taxallus so'raladigan joydagi izoh (kod kiritilayotganda uning o'rniga kod haqidagi izoh chiqadi).
 * restore=false — kod bilan tiklash yonida alohida turibdi (Sozlamalar).
 * startWithCode — avval kod maydoni (o'chirilgan profil o'rniga asosiysiga kirish); codeHint — kod maydoni
 * izohi (standart — t.home.codeText); nickname — taxallus maydonidagi boshlang'ich ism.
 */
export function JoinForm({
  compact = false,
  hint,
  codeHint,
  restore = true,
  startWithCode = false,
  nickname = '',
  onJoined,
}: {
  compact?: boolean;
  hint?: string;
  codeHint?: string;
  restore?: boolean;
  startWithCode?: boolean;
  nickname?: string;
  onJoined?: () => void;
}) {
  const name = useSignal(nickname);
  const code = useSignal('');
  const withCode = useSignal(startWithCode);
  const busy = useSignal(false);
  const error = useSignal('');
  // Telegram bulutida profil bor-yo'qligi hali aniq emas yoki u tiklanmadi: yangi profil ochilsa,
  // eski natijalar tashlab ketiladi — avval shu haqda aytiladi.
  const forceNew = useSignal(false);
  const cloud = cloudRestore.value;

  // Telegram ichida — ism oldindan yozilgan bo'ladi (o'zgartirsa bo'ladi).
  useEffect(() => {
    void sdk.then(() => {
      if (!name.value) name.value = suggestedNickname();
    });
  }, []);

  const run = async (fn: () => Promise<void>) => {
    if (busy.value) return;
    busy.value = true;
    error.value = '';
    try {
      await fn();
      onJoined?.();
    } catch (err) {
      error.value = errorText(err);
    } finally {
      busy.value = false;
    }
  };

  const submit = (e: Event) => {
    e.preventDefault();
    void run(() => createProfile(name.value));
  };

  const submitCode = (e: Event) => {
    e.preventDefault();
    void run(async () => {
      // Kutish paytida profil paydo bo'lsa (Telegram bulutidan tiklandi, boshqa tabda ochildi) — unga tegilmaydi.
      if (await restoreProfile(code.value, true)) showToast(t.home.restoredAs(profile.peek()?.nickname ?? ''), 'ok');
    });
  };

  const toggle = () => {
    withCode.value = !withCode.value;
    error.value = '';
  };

  // «Kodim bor» bosilgach — darhol kod maydoniga yoziladi. Layout effect: fokus chizishdan oldin o'tadi,
  // aks holda tez yozilgan bo'shliq hali fokusdagi havolani qayta bosib, shaklni orqaga almashtirardi.
  const codeRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (withCode.value) codeRef.current?.focus();
  }, [withCode.value]);

  if (cloud !== 'idle' && !forceNew.value) {
    return (
      <div class={`join${compact ? ' compact' : ''}`}>
        {!compact && <h2>{t.home.joinTitle}</h2>}
        <p class="muted" role="status">
          {cloud === 'pending' ? t.telegram.restoring : cloud === 'unknown' ? t.telegram.checkFailed : t.telegram.restoreFailed}
        </p>
        {cloud !== 'pending' && (
          <div class="row wrap">
            <button class="btn" onClick={retryCloudRestore}>
              {t.retry}
            </button>
            <button class="link-btn" onClick={() => (forceNew.value = true)}>
              {t.telegram.newProfile}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div class={`join${compact ? ' compact' : ''}`}>
      {!compact && <h2>{t.home.joinTitle}</h2>}
      {withCode.value ? (
        <p class="muted">{codeHint ?? t.home.codeText}</p>
      ) : hint ? (
        <p class="muted">{hint}</p>
      ) : (
        !compact && <p class="muted">{t.home.joinText}</p>
      )}
      {/* key: ikki shakl alohida DOM — aks holda Preact bitta maydonni qayta ishlatib, taxallusdagi
          maxLength olib tashlanganda u 0 ga aylanadi va kod maydoniga hech narsa yozilmaydi. */}
      {withCode.value ? (
        <form key="code" class="row" onSubmit={submitCode}>
          <input
            ref={codeRef}
            type="text"
            class="code-input"
            maxLength={24}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            autoComplete="off"
            spellcheck={false}
            value={code.value}
            onInput={(e) => (code.value = (e.currentTarget as HTMLInputElement).value)}
            aria-label={t.settings.code}
          />
          <button class="btn" disabled={busy.value || !codeComplete(code.value)}>
            {t.settings.restoreButton}
          </button>
        </form>
      ) : (
        <form key="nick" class="row" onSubmit={submit}>
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
        </form>
      )}
      {error.value && <p class="form-error">{error.value}</p>}
      {restore && (
        <p class="join-switch small">
          <button type="button" class="link-btn" onClick={toggle}>
            {withCode.value ? t.home.newInstead : t.home.haveCode}
          </button>
        </p>
      )}
    </div>
  );
}
