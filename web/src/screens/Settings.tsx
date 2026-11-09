import { useSignal } from '@preact/signals';
import { useRef } from 'preact/hooks';
import { copyText, selectContents } from '../clipboard';
import { ClassesCard } from '../components/ClassesCard';
import { JoinForm } from '../components/JoinForm';
import { RemindToggle } from '../components/RemindToggle';
import { showToast } from '../components/Toast';
import { Icon, TopBar } from '../components/ui';
import { LANGS, t } from '../i18n';
import { go } from '../router';
import { resetAchievements } from '../achievements';
import { resetCustom } from '../custom';
import { resetDaily } from '../daily';
import { profile, resetLocalProgress, settings } from '../state';
import { installed, installPrompt, isIOS, promptInstall } from '../install';
import { inTelegram, openExternal } from '../telegram';
import { THEMES } from '../theme';
import { APP_VERSION } from '../version';
import { errorText, renameProfile, restoreProfile } from '../sync';


export function Settings() {
  const p = profile.value;
  const nick = useSignal(p?.nickname ?? '');
  const code = useSignal('');
  const busy = useSignal(false);
  const codeRef = useRef<HTMLElement>(null);

  const run = async (fn: () => Promise<void>, ok: string) => {
    busy.value = true;
    try {
      await fn();
      showToast(ok, 'ok');
    } catch (e) {
      showToast(errorText(e), 'error');
    } finally {
      busy.value = false;
    }
  };

  const copy = async () => {
    if (await copyText(p!.code)) {
      showToast(t.settings.copied, 'ok');
    } else if (codeRef.current) {
      selectContents(codeRef.current);
      showToast(t.settings.copyManual, 'info');
    }
  };

  const reset = () => {
    if (!confirm(p ? t.settings.resetConfirmProfile : t.settings.resetConfirm)) return;
    resetLocalProgress();
    resetDaily();
    resetCustom();
    resetAchievements();
    // Profil qolsa, keyingi ochilishda serverdagi natijalar qaytib kelardi — qurilma to'liq tozalanadi.
    profile.value = null;
    nick.value = '';
    showToast(t.settings.resetDone, 'ok');
  };

  return (
    <div class="screen settings">
      <TopBar title={t.settings.title} onBack={() => go('')} />
      <div class="scroll">
        <div class="narrow">
          <section class="card">
            <h2>{t.settings.profile}</h2>
            {p ? (
              <>
                <form
                  class="row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() => renameProfile(nick.value), t.settings.rename);
                  }}
                >
                  <input
                    type="text"
                    maxLength={20}
                    value={nick.value}
                    onInput={(e) => (nick.value = (e.currentTarget as HTMLInputElement).value)}
                    aria-label={t.settings.nickname}
                  />
                  <button class="btn" disabled={busy.value || nick.value.trim() === p.nickname}>
                    {t.settings.rename}
                  </button>
                </form>
                <h3>{t.settings.code}</h3>
                <div class="code-box">
                  <code ref={codeRef}>{p.code}</code>
                  <button class="icon-btn" onClick={copy} title={t.settings.copy} aria-label={t.settings.copy}>
                    <Icon name="copy" />
                  </button>
                </div>
                <p class="muted">{t.settings.codeText}</p>
              </>
            ) : (
              <JoinForm compact />
            )}
          </section>

          <section class="card">
            <h2>{t.settings.restore}</h2>
            <p class="muted">{t.settings.restoreText}</p>
            <form
              class="row"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => restoreProfile(code.value), t.settings.restored).then(() => {
                  if (profile.value) nick.value = profile.value.nickname;
                });
              }}
            >
              <input
                type="text"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                autoComplete="off"
                spellcheck={false}
                value={code.value}
                onInput={(e) => (code.value = (e.currentTarget as HTMLInputElement).value)}
                aria-label={t.settings.code}
              />
              <button class="btn" disabled={busy.value || code.value.replace(/[^0-9a-z]/gi, '').length !== 16}>
                {t.settings.restoreButton}
              </button>
            </form>
          </section>

          <ClassesCard />

          <section class="card">
            <div class="row between">
              <span>{t.language}</span>
              <LangSwitch />
            </div>
          </section>

          <section class="card">
            <div class="row between">
              <span>{t.settings.theme}</span>
              <ThemeSwitch />
            </div>
          </section>

          <InstallCard />

          <GuidesCard />

          <RemindToggle card />

          <section class="card">
            <div class="row between">
              <span>{t.settings.sound}</span>
              <button
                class={`btn toggle${settings.value.sound ? ' on' : ''}`}
                onClick={() => (settings.value = { ...settings.value, sound: !settings.value.sound })}
                aria-pressed={settings.value.sound}
              >
                <Icon name={settings.value.sound ? 'sound' : 'mute'} /> {settings.value.sound ? t.settings.on : t.settings.off}
              </button>
            </div>
          </section>

          <section class="card">
            <h2>{t.settings.reset}</h2>
            <p class="muted">{p ? t.settings.resetTextProfile : t.settings.resetText}</p>
            <button class="btn danger" onClick={reset}>
              {t.settings.reset}
            </button>
          </section>

          <p class="muted center">
            {t.appName} · {t.settings.version(APP_VERSION)} ·{' '}
            <button class="link-btn" onClick={() => go('news')}>
              {t.news.link}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

/** Mavzu tanlash: Plata, Daftar yoki Avto (telefon/Telegram rejimiga qarab). */
function ThemeSwitch() {
  const current = settings.value.theme ?? 'plata';
  return (
    <div class="lang-switch" role="group" aria-label={t.settings.theme}>
      {THEMES.map((id) => (
        <button
          key={id}
          class={id === current ? 'on' : ''}
          aria-pressed={id === current}
          title={t.settings.themeHint[id]}
          onClick={() => (settings.value = { ...settings.value, theme: id })}
        >
          {t.settings.themes[id]}
        </button>
      ))}
    </div>
  );
}

/** Til tanlash: har bir til o'z nomi bilan ko'rsatiladi. */
export function LangSwitch() {
  const current = settings.value.lang ?? 'uz';
  return (
    <div class="lang-switch" role="group" aria-label={t.language}>
      {LANGS.map((l) => (
        <button
          key={l.id}
          class={l.id === current ? 'on' : ''}
          aria-pressed={l.id === current}
          lang={l.id}
          onClick={() => (settings.value = { ...settings.value, lang: l.id })}
        >
          {l.name}
        </button>
      ))}
    </div>
  );
}

/** Saytdagi qo'llanmalar (statik sahifalar). Telegram ichida — Telegram brauzerida, Mini App yopilmaydi. */
function GuidesCard() {
  const open = (e: MouseEvent, url: string) => {
    if (inTelegram && openExternal(location.origin + url)) e.preventDefault();
  };
  return (
    <section class="card guides-card">
      <h2>{t.guides.title}</h2>
      <p class="muted small">{t.guides.text}</p>
      <div class="guides-list">
        {t.guides.items.map((g) => (
          <a key={g.url} class="guide-link" href={g.url} onClick={(e) => open(e, g.url)}>
            <Icon name="book" />
            <span>
              <b>{g.title}</b>
              <small>{g.text}</small>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

/** O'rnatish: tizim oynasi (Chrome/Edge/Android) yoki iPhone uchun izoh. O'rnatilgan va Telegram'da — yo'q. */
function InstallCard() {
  if (inTelegram || installed.value) return null;
  const canPrompt = !!installPrompt.value;
  if (!canPrompt && !isIOS()) return null;
  return (
    <section class="card install-card">
      <h2>{t.install.title}</h2>
      <p class="muted small">{t.install.text}</p>
      {canPrompt ? (
        <button class="btn primary" onClick={() => void promptInstall()}>
          <Icon name="download" /> {t.install.button}
        </button>
      ) : (
        <p class="small">{t.install.ios}</p>
      )}
    </section>
  );
}
