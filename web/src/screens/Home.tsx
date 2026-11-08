import { JoinForm } from '../components/JoinForm';
import { MiniBoard } from '../components/MiniBoard';
import { ShareButtons } from '../components/ShareButtons';
import { Icon, type IconName } from '../components/ui';
import { states } from '../achievements';
import { dailyHistory, streak, todaySig } from '../daily';
import { t } from '../i18n';
import { chapterLevels, chapters, levelNumber, levels, MAX_STARS } from '../levels';
import { go } from '../router';
import { chapterStars, continueLevel, getDraft, profile, progress, settings, solvedCount, totalStars } from '../state';
import { hasProgress, moveUrl, onOldHost, siteHost } from '../migrate';
import { TG_APP_URL } from '../share';
import { inTelegram } from '../telegram';

export function Home() {
  const started = solvedCount.value > 0;
  return (
    <div class="screen home">
      <div class="home-scroll">
        <div class="home-inner">
          <LangToggle />
          <Logo />
          {onOldHost() && hasProgress() && <MoveBanner />}
          <p class="tagline">{profile.value ? t.home.hello(profile.value.nickname) : t.tagline}</p>
          <ContinueCard />
          <DailyCard />
          <ShareButtons text={t.share.inviteText} label={t.share.invite} />
          {TG_APP_URL && !inTelegram && (
            <a class="btn tg play-tg" href={TG_APP_URL} target="_blank" rel="noopener noreferrer">
              <Icon name="telegram" /> {t.telegram.play}
            </a>
          )}
          {!profile.value && started && (
            <div class="card">
              <JoinForm />
            </div>
          )}
        </div>
      </div>
      <HomeNav />
    </div>
  );
}

/** Asosiy kartochka: navbatdagi daraja — bo'limi, nomi, kichik sxemasi va bitta katta tugma. */
function ContinueCard() {
  const allDone = solvedCount.value === levels.length;
  const level = continueLevel();
  const index = chapters.findIndex((c) => c.id === level.chapter);
  const ch = chapters[index];
  const list = chapterLevels(ch.id);
  const solved = list.filter((l) => progress.value[l.id]).length;
  const draft = getDraft(level.id);
  return (
    <section class="continue-card">
      <div class="continue-head">
        <span class="continue-chapter">{allDone ? t.home.allDoneSub : t.home.chapter(index + 1, ch.title)}</span>
        <span class="continue-stars">{t.home.stars(totalStars.value, MAX_STARS)}</span>
      </div>
      <h2 class="continue-title">{allDone ? t.home.allDone : `${levelNumber(level)}. ${level.title}`}</h2>
      {!allDone && (
        <button class="continue-board" onClick={() => go(`level/${level.id}`)} aria-label={t.home.continue} tabIndex={-1}>
          <MiniBoard level={level} circuit={draft} />
        </button>
      )}
      <div class="continue-foot">
        <span class="continue-progress">
          {allDone
            ? t.home.solved(solvedCount.value, levels.length)
            : t.home.chapterProgress(solved, list.length, chapterStars(ch), list.length * 3)}
        </span>
        <button class="btn primary" onClick={() => go(allDone ? 'levels' : `level/${level.id}`)} autoFocus>
          <Icon name="play" /> {allDone ? t.home.levels : solvedCount.value > 0 || draft ? t.home.continue : t.home.play}
        </button>
      </div>
    </section>
  );
}

const NAV: { route: string; icon: IconName; label: () => string }[] = [
  { route: 'levels', icon: 'levels', label: () => t.home.levels },
  { route: 'sandbox', icon: 'chip', label: () => t.home.sandbox },
  { route: 'leaderboard', icon: 'trophy', label: () => t.home.leaderboard },
  { route: 'achievements', icon: 'medal', label: () => t.achievements.title },
  { route: 'settings', icon: 'settings', label: () => t.home.settings },
];

/** Pastki panel: bo'limlar bosh barmoq yetadigan joyda (bir xil og'irlikdagi tugmalar devori o'rniga). */
function HomeNav() {
  const done = states.value.filter((s) => s.done).length;
  return (
    <nav class="home-nav">
      <div class="home-nav-inner">
        {NAV.map((n) => (
          <button key={n.route} onClick={() => go(n.route)}>
            <Icon name={n.icon} />
            <span>{n.label()}</span>
            {n.route === 'achievements' && done > 0 && <b class="nav-badge">{done}</b>}
          </button>
        ))}
      </div>
    </nav>
  );
}

/** Tilni tez almashtirish (to'liq tanlov — sozlamalarda). */
function LangToggle() {
  const next = (settings.value.lang ?? 'uz') === 'uz' ? 'ru' : 'uz';
  return (
    <button
      class="lang-toggle"
      lang={next}
      onClick={() => (settings.value = { ...settings.value, lang: next })}
      aria-label={next === 'ru' ? 'Русский' : "O'zbekcha"}
    >
      {next.toUpperCase()}
    </button>
  );
}

/** Eski manzilda: natijalar bilan yangi manzilga o'tish. */
function MoveBanner() {
  return (
    <div class="card move-banner">
      <strong>{t.migrate.title(siteHost() ?? '')}</strong>
      <p class="muted">{t.migrate.text}</p>
      <a class="btn primary" href={moveUrl()}>
        {t.migrate.button}
      </a>
    </div>
  );
}

function DailyCard() {
  const done = dailyHistory.value[todaySig.value];
  const days = streak.value;
  return (
    <div class="daily-wrap">
      <button class={`daily-card${done ? ' done' : ''}`} onClick={() => go('daily')}>
        <Icon name="calendar" />
        <span class="daily-text">
          <strong>{t.daily.home}</strong>
          <span class="muted">
            {done ? t.daily.homeDone('★'.repeat(done.stars) + '☆'.repeat(3 - done.stars), done.gates) : t.daily.homeNew}
          </span>
          {days > 0 && (
            <span class="streak">
              <Icon name="flame" /> {t.daily.streak(days)}
            </span>
          )}
        </span>
        {!done && <span class="dot" aria-hidden="true" />}
      </button>
      <button class="archive-link" onClick={() => go('archive')}>
        <Icon name="archive" /> {t.daily.archiveLink}
      </button>
    </div>
  );
}

function Logo() {
  // Logotip: ikki kirishli AND belgisi va signal o'tayotgan sim.
  return (
    <div class="logo">
      <svg viewBox="0 0 160 72" width="112" height="50" aria-hidden="true">
        <path class="logo-wire on" d="M4,22 H50" />
        <path class="logo-wire" d="M4,50 H50" />
        <path class="logo-gate" d="M50,8 H82 A28,28 0 0 1 82,64 H50 Z" />
        <path class="logo-wire on" d="M110,36 H156" />
        <circle class="logo-dot on" cx={4} cy={22} r={4} />
        <circle class="logo-dot" cx={4} cy={50} r={4} />
        <circle class="logo-dot on" cx={156} cy={36} r={5} />
      </svg>
      <h1 class="logo-text">
        LOGIC<span>GATE</span>
      </h1>
    </div>
  );
}
