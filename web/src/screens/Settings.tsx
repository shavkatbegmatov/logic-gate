import './Settings.css';
import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { api } from '../api';
import { sfx } from '../audio';
import { copyText, selectContents } from '../clipboard';
import { ClassesCard } from '../components/ClassesCard';
import { askConfirm } from '../components/Dialogs';
import { JoinForm } from '../components/JoinForm';
import { Avatar } from '../components/PlayerChip';
import { RemindToggle } from '../components/RemindToggle';
import { showToast } from '../components/Toast';
import { Icon, TopBar } from '../components/ui';
import { forgetAllTeacherClasses, teacherClasses } from '../classes';
import { LANGS, t } from '../i18n';
import { switchLang } from '../lang-switch';
import { go } from '../router';
import { currentRank, dateText, refreshMyRank } from '../player';
import { profile, settings } from '../state';
import { installed, installPrompt, isIOS, promptInstall } from '../install';
import { inTelegram, openExternal } from '../telegram';
import { AAA_THEMES, activeBoardMode, BOARD_MODES, boardModeForTheme, CLASSIC_THEMES, isAaaTheme, MOTIONS, systemReducedMotion, type BoardMode, type Theme } from '../theme';
import { APP_VERSION } from '../version';
import { clearPlayerData, codeComplete, errorText, formatCode, renameProfile, restoreProfile } from '../sync';


/**
 * Profilning boshi: avatar, taxallus, to'liq o'yinchi ID (nusxalash bilan), ochilgan sana va reytingdagi o'rin.
 * ID — ochiq raqam (o'qituvchi yoki administratorga aytish uchun), kirish uchun emas: buni yonida aytamiz,
 * aks holda tiklash kodi bilan adashtiriladi.
 */
function ProfileHead({ id, nickname }: { id: string; nickname: string }) {
  const created = useSignal<number | null>(null);
  const idRef = useRef<HTMLElement>(null);
  useEffect(() => {
    created.value = null;
    void refreshMyRank();
    api
      .me()
      .then((me) => me.id === id && (created.value = me.createdAt))
      .catch(() => {});
  }, [id]);
  const rank = currentRank();
  const copyId = async () => {
    if (await copyText(id)) showToast(t.player.copied, 'ok');
    else if (idRef.current) {
      selectContents(idRef.current);
      showToast(t.settings.copyManual, 'info');
    }
  };
  const meta = [
    created.value ? t.player.since(dateText(created.value)) : null,
    rank === undefined ? null : rank === null ? t.player.unranked : t.player.rank(rank),
  ].filter(Boolean);
  return (
    <div class="profile-head">
      <Avatar id={id} name={nickname} size="lg" />
      <div class="profile-head-text">
        <strong>{nickname}</strong>
        <span class="profile-id">
          {t.player.id}: <code ref={idRef}>{id}</code>
          <button class="icon-btn small" onClick={copyId} title={t.settings.copy} aria-label={`${t.settings.copy}: ${t.player.id}`}>
            <Icon name="copy" />
          </button>
        </span>
        {meta.length > 0 && <span class="profile-meta">{meta.join(' · ')}</span>}
      </div>
      <p class="muted small profile-id-hint">{t.player.idHint}</p>
    </div>
  );
}

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

  const restore = async () => {
    // Umumiy kompyuterda boshqa o'quvchining profili ochiq bo'lishi mumkin: uning natijalari qurilmadan
    // olib tashlanadi (serverda qoladi) — buni oldindan aytamiz.
    if (
      p &&
      formatCode(code.value) !== formatCode(p.code) &&
      !(await askConfirm({ title: t.settings.restore, text: t.settings.switchConfirm(p.nickname), ok: t.settings.restore, icon: 'users' }))
    ) {
      return;
    }
    run(async () => void (await restoreProfile(code.value)), t.settings.restored).then(() => {
      if (profile.value) nick.value = profile.value.nickname;
    });
  };

  // O'qituvchi kalitlari ham qurilmada: kompyuterdan keyingi foydalanuvchi sinf hisobotini ochmasin.
  const teacherCount = teacherClasses.value.length;

  const reset = async () => {
    const yes = await askConfirm({
      title: t.settings.reset,
      text: p ? t.settings.resetConfirmProfile : t.settings.resetConfirm,
      note: teacherCount ? t.settings.resetTeacher(teacherCount) : undefined,
      ok: t.settings.reset,
      danger: true,
      icon: 'trash',
    });
    if (!yes) return;
    clearPlayerData();
    forgetAllTeacherClasses();
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
                <ProfileHead id={p.id} nickname={p.nickname} />
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
              // Kod bilan tiklash — pastdagi alohida kartada.
              <JoinForm compact restore={false} />
            )}
          </section>

          <section class="card">
            <h2>{t.settings.restore}</h2>
            <p class="muted">{t.settings.restoreText}</p>
            <form
              class="row code-row"
              onSubmit={(e) => {
                e.preventDefault();
                restore();
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
              <button class="btn" disabled={busy.value || !codeComplete(code.value)}>
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
            <span>{t.settings.boardMode}</span>
            <BoardModeSwitch />
          </section>

          <section class="card">
            <span>{t.settings.theme}</span>
            <ThemeSwitch />
          </section>

          <section class="card">
            <div class="row between">
              <span>{t.settings.motion}</span>
              <MotionSwitch />
            </div>
            {(settings.value.motion ?? 'auto') === 'auto' && systemReducedMotion.value && (
              <p class="muted small">{t.settings.motionSystem}</p>
            )}
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
            {teacherCount > 0 && <p class="muted small">{t.settings.resetTeacher(teacherCount)}</p>}
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

const MODE_ICONS: Record<BoardMode, 'layers' | 'cube' | 'schematic'> = {
  real2d: 'layers',
  real3d: 'cube',
  schematic: 'schematic',
};

/** Sxema ko'rinishi: 2D Real, 3D Real yoki Klassik sxema. */
function BoardModeSwitch() {
  const current = settings.value.boardMode ?? 'real2d';
  return (
    <>
      <div class="mode-grid" role="group" aria-label={t.settings.boardMode}>
        {BOARD_MODES.map((id) => (
          <button
            key={id}
            class={`mode-tile${id === current ? ' on' : ''}`}
            aria-pressed={id === current}
            title={t.settings.boardModeHint[id]}
            onClick={() => {
              settings.value = { ...settings.value, boardMode: id };
              sfx.mode();
            }}
          >
            <Icon name={MODE_ICONS[id]} />
            <span>{t.settings.boardModes[id]}</span>
          </button>
        ))}
      </div>
      <p class="mode-hint">{t.settings.boardModeHint[current]}</p>
    </>
  );
}

/**
 * Mavzu va uslub tanlash: 4 ta AAA studiya uslubi + klassik o'quv mavzulari.
 * Har bir namuna ranglarni <span data-theme="…"> orqali styles.css dan oladi.
 */
function ThemeSwitch() {
  const current = settings.value.theme ?? 'pcb';
  const mode = activeBoardMode.value;
  const pickTheme = (next: Theme) => {
    const nextMode = boardModeForTheme(next, mode);
    settings.value = nextMode ? { ...settings.value, theme: next, boardMode: nextMode } : { ...settings.value, theme: next };
    sfx.mode();
  };
  const tile = (id: Theme) => (
    <button
      key={id}
      class={`theme-tile${id === current ? ' on' : ''}`}
      aria-pressed={id === current}
      title={t.settings.themeHint[id]}
      onClick={() => pickTheme(id)}
    >
      <span class="theme-swatch" aria-hidden="true">
        {(id === 'auto' ? (['pcb', 'daftar'] as const) : [id]).map((look) => {
          const aaa = isAaaTheme(look);
          return (
            <span key={look} data-theme={look}>
              <svg viewBox="0 0 48 30" preserveAspectRatio="xMidYMid slice">
                {aaa ? (
                  <>
                    <rect class="swatch-mat" x={2} y={2} width={44} height={26} rx={3} />
                    <path class="swatch-wire-off" d="M3,11 H14 M3,19 H14" />
                    <path class="swatch-wire" d="M30,15 H37" />
                    <rect class="swatch-pin" x={12} y={9.5} width={4} height={3} />
                    <rect class="swatch-pin" x={12} y={17.5} width={4} height={3} />
                    <rect class="swatch-pin" x={29} y={13.5} width={4} height={3} />
                    <rect class="swatch-gate" x={15} y={6} width={15} height={18} rx={2} />
                    <circle class="swatch-pad" cx={18} cy={10} r={1.2} />
                    <circle class="swatch-lamp" cx={41} cy={15} r={4.2} />
                  </>
                ) : (
                  <>
                    <path class="swatch-wire" d="M3,15 H14 M30,15 H36" />
                    <path class="swatch-gate" d="M14,7 H22 A8,8 0 0 1 22,23 H14 Z" />
                    <circle class="swatch-lamp" cx={41} cy={15} r={4.5} />
                  </>
                )}
              </svg>
            </span>
          );
        })}
      </span>
      {t.settings.themes[id]}
    </button>
  );

  return (
    <>
      <div class="theme-group-title">{t.settings.styleGroups.aaa}</div>
      <div class="theme-grid" role="group" aria-label={t.settings.styleGroups.aaa}>
        {AAA_THEMES.map(tile)}
      </div>
      <div class="theme-group-title">{t.settings.styleGroups.classic}</div>
      <div class="theme-grid" role="group" aria-label={t.settings.styleGroups.classic}>
        {CLASSIC_THEMES.map(tile)}
      </div>
      <p class="mode-hint">{t.settings.themeHint[current]}</p>
    </>
  );
}

/** Animatsiya: Yoqilgan, O'chirilgan yoki Avto (qurilma sozlamasiga qarab) — theme.ts. */
function MotionSwitch() {
  const current = settings.value.motion ?? 'auto';
  return (
    <div class="lang-switch" role="group" aria-label={t.settings.motion}>
      {MOTIONS.map((id) => (
        <button
          key={id}
          class={id === current ? 'on' : ''}
          aria-pressed={id === current}
          title={t.settings.motionHint[id]}
          onClick={() => (settings.value = { ...settings.value, motion: id })}
        >
          {t.settings.motions[id]}
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
          onClick={() => void switchLang(l.id)}
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
