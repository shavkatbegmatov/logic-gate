import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { api, ApiError, type TgStart } from '../api';
import { t } from '../i18n';
import { profile } from '../state';
import { adoptNewProfile, codeComplete, errorText, formatCode, restoreProfile } from '../sync';
import { askConfirm } from './Dialogs';
import { showToast } from './Toast';
import { Icon } from './ui';

/** Holat so'rash oralig'i (bot tasdig'ini kutish). */
const POLL = 2000;

type State =
  | { kind: 'idle'; note?: string }
  | { kind: 'starting' }
  | { kind: 'waiting'; req: TgStart; until: number }
  | { kind: 'new'; id: string; name: string };

/**
 * Saytga Telegram orqali kirish (mode="login") yoki ochiq profilni Telegram'ga bog'lash (mode="link").
 * Tugma bosilganda server bir martalik so'rov ochadi: sayt raqam va botni ochadigan havolani ko'rsatadi,
 * o'quvchi botda shu raqamni tanlaydi (boshqa birov yuborgan havola bilan begona brauzer profilga kira
 * olmasin). Sayt holatni so'rab turadi; tasdiqlangach profilga kiradi. Telegram hali hech bir profilga
 * bog'lanmagan bo'lsa — yangi profil ochish yoki tiklash kodi bilan mavjudini bog'lash taklif qilinadi.
 * onActive — so'rov ketayotganini bildiradi (JoinForm o'z shaklini yashiradi).
 */
export function TelegramLogin({
  mode = 'login',
  onActive,
  onDone,
}: {
  mode?: 'login' | 'link';
  onActive?: (active: boolean) => void;
  onDone?: () => void;
}) {
  const state = useSignal<State>({ kind: 'idle' });
  const set = (s: State) => {
    state.value = s;
    onActive?.(s.kind === 'waiting' || s.kind === 'new');
  };

  const start = async () => {
    set({ kind: 'starting' });
    try {
      const req = await api.telegramStart(mode === 'link');
      set({ kind: 'waiting', req, until: Date.now() + req.expiresIn * 1000 });
    } catch (e) {
      set({ kind: 'idle', note: startError(e) });
    }
  };

  // Bot tasdig'ini kutish: holat so'raladi; brauzerga qaytilganda (Telegram'dan) — darhol.
  const reqId = state.value.kind === 'waiting' ? state.value.req.id : null;
  useEffect(() => {
    if (!reqId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    const tick = async () => {
      clearTimeout(timer);
      const s = state.peek();
      if (stopped || inFlight || s.kind !== 'waiting') return;
      if (Date.now() > s.until) return set({ kind: 'idle', note: t.tgLogin.expired });
      inFlight = true;
      try {
        const r = await api.telegramStatus(reqId);
        if (stopped) return;
        if (r.status === 'pending') {
          // davom etadi
        } else if (r.status === 'denied') {
          return set({ kind: 'idle', note: t.tgLogin.denied });
        } else if (r.status === 'linked') {
          set({ kind: 'idle' });
          showToast(t.tgLogin.linked, 'ok');
          return onDone?.();
        } else if (r.status === 'new') {
          return set({ kind: 'new', id: reqId, name: r.name });
        } else {
          set({ kind: 'idle' });
          if (await enterProfile(r.player.code!)) onDone?.();
          return;
        }
      } catch (e) {
        if (stopped) return;
        if (e instanceof ApiError && e.status === 404) return set({ kind: 'idle', note: t.tgLogin.expired });
        // Aloqa uzildi — muddat tugaguncha qayta so'raladi.
      } finally {
        inFlight = false;
      }
      if (!stopped) timer = setTimeout(tick, POLL);
    };
    timer = setTimeout(tick, POLL);
    const onVisible = () => document.visibilityState === 'visible' && void tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reqId]);

  const s = state.value;

  if (s.kind === 'waiting') {
    return (
      <div class="tg-login waiting" role="status">
        <p class="tg-login-title">{t.tgLogin.waitTitle}</p>
        <p class="muted small">{t.tgLogin.waitText}</p>
        <div class="tg-number" aria-label={t.tgLogin.numberLabel(s.req.number)}>
          {s.req.number}
        </div>
        <a class="btn primary tg-open" href={s.req.url} target="_blank" rel="noopener noreferrer">
          <Icon name="telegram" />
          {t.tgLogin.open}
        </a>
        <p class="muted small tg-wait">{t.tgLogin.waiting}</p>
        <button type="button" class="link-btn small" onClick={() => set({ kind: 'idle' })}>
          {t.tgLogin.cancel}
        </button>
      </div>
    );
  }

  if (s.kind === 'new') {
    return (
      <NewTelegram
        id={s.id}
        name={s.name}
        onCancel={() => set({ kind: 'idle' })}
        onDone={() => {
          set({ kind: 'idle' });
          onDone?.();
        }}
      />
    );
  }

  return (
    <div class="tg-login">
      <button type="button" class="btn tg-btn" disabled={s.kind === 'starting'} onClick={start}>
        <Icon name="telegram" />
        {mode === 'link' ? t.tgLogin.linkButton : t.tgLogin.button}
      </button>
      {s.kind === 'idle' && s.note && <p class="form-error">{s.note}</p>}
    </div>
  );
}

function startError(e: unknown): string {
  if (e instanceof ApiError && (e.code === 'telegram_off' || e.code === 'telegram_unavailable' || e.code === 'busy')) return t.tgLogin.off;
  return errorText(e);
}

/**
 * Telegram tasdiqlagan profilga kirish. Qurilmada boshqa profil ochiq bo'lsa (umumiy kompyuter) — avval
 * so'raladi: uning natijalari qurilmadan olib tashlanadi (serverda qoladi). false — kirilmadi.
 */
async function enterProfile(code: string): Promise<boolean> {
  const cur = profile.peek();
  try {
    if (cur) {
      const me = await api.me(code);
      if (me.id === cur.id) {
        showToast(t.home.restoredAs(cur.nickname), 'ok');
        return true;
      }
      if (!(await askConfirm({ title: t.settings.restore, text: t.settings.switchConfirm(cur.nickname), ok: t.settings.restore, icon: 'users' }))) {
        return false;
      }
    }
    await restoreProfile(code);
    showToast(t.home.restoredAs(profile.peek()?.nickname ?? ''), 'ok');
    return true;
  } catch (e) {
    showToast(errorText(e), 'error');
    return false;
  }
}

/**
 * Telegram hali hech bir profilga bog'lanmagan. Profilsiz qurilmada — yangi profil (taxallus Telegram
 * ismidan taklif qilinadi) yoki tiklash kodi bilan avvalgi profilni bog'lash. Profil ochiq bo'lsa — shu
 * profilni bog'lash (yoki boshqasining kodi).
 */
function NewTelegram({ id, name, onCancel, onDone }: { id: string; name: string; onCancel: () => void; onDone: () => void }) {
  const cur = profile.value;
  const busy = useSignal(false);
  const error = useSignal('');
  const nick = useSignal(name);
  const code = useSignal('');
  const withCode = useSignal(false);
  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (withCode.value) codeRef.current?.focus();
  }, [withCode.value]);

  const run = async (fn: () => Promise<boolean | void>) => {
    if (busy.value) return;
    busy.value = true;
    error.value = '';
    try {
      if ((await fn()) !== false) onDone();
    } catch (e) {
      error.value = e instanceof ApiError && e.status === 404 ? t.tgLogin.expired : errorText(e);
    } finally {
      busy.value = false;
    }
  };

  const create = (e: Event) => {
    e.preventDefault();
    void run(async () => {
      const r = await api.telegramNewPlayer(id, nick.value);
      // Shu orada Telegram boshqa qurilmadan bog'langan bo'lsa — server yangisini ochmay, o'sha profilni beradi.
      if (!r.created) return enterProfile(r.player.code!);
      adoptNewProfile(r.player);
    });
  };

  const attach = (c: string) =>
    run(async () => {
      await api.telegramAttach(id, c);
      showToast(t.tgLogin.linked, 'ok');
      // Boshqa profilning kodi kiritilgan bo'lsa — o'sha profilga o'tiladi.
      if (!cur || formatCode(c) !== formatCode(cur.code)) return enterProfile(c);
    });

  return (
    <div class="tg-login new">
      <p class="tg-login-title">{t.tgLogin.newTitle}</p>
      {withCode.value ? (
        <>
          <p class="muted small">{t.tgLogin.codeText}</p>
          <form
            class="row"
            onSubmit={(e) => {
              e.preventDefault();
              void attach(code.value);
            }}
          >
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
              {t.tgLogin.attach}
            </button>
          </form>
        </>
      ) : cur ? (
        <>
          <p class="muted small">{t.tgLogin.linkHint}</p>
          <button type="button" class="btn primary" disabled={busy.value} onClick={() => void attach(cur.code)}>
            {t.tgLogin.attachCurrent(cur.nickname)}
          </button>
        </>
      ) : (
        <>
          <p class="muted small">{t.tgLogin.newText}</p>
          <form class="row" onSubmit={create}>
            <input
              type="text"
              maxLength={20}
              autoComplete="nickname"
              placeholder={t.home.nicknamePlaceholder}
              value={nick.value}
              onInput={(e) => (nick.value = (e.currentTarget as HTMLInputElement).value)}
              aria-label={t.home.nicknamePlaceholder}
            />
            <button class="btn" disabled={busy.value || nick.value.trim().length < 2}>
              {t.tgLogin.create}
            </button>
          </form>
        </>
      )}
      {error.value && <p class="form-error">{error.value}</p>}
      <p class="join-switch small tg-actions">
        <button type="button" class="link-btn" onClick={() => (withCode.value = !withCode.value)}>
          {withCode.value ? (cur ? t.tgLogin.attachCurrent(cur.nickname) : t.tgLogin.newInstead) : t.tgLogin.haveCode}
        </button>
        <button type="button" class="link-btn" onClick={onCancel}>
          {t.tgLogin.cancel}
        </button>
      </p>
    </div>
  );
}
