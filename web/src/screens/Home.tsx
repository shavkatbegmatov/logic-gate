import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { refreshMyTasks } from '../classes';
import { JoinForm } from '../components/JoinForm';
import { HomeTaskCard } from '../components/TaskView';
import { canOfferInstall, dismissInstall, promptInstall } from '../install';
import { MiniBoard } from '../components/MiniBoard';
import { ShareButtons } from '../components/ShareButtons';
import { Icon, type IconName } from '../components/ui';
import { states } from '../achievements';
import { dailyHistory, refreshDailyStatus, streak, todaySig } from '../daily';
import { t } from '../i18n';
import { chapterLevels, chapters, levelNumber, levels, MAX_STARS } from '../levels';
import { go } from '../router';
import { chapterStars, continueLevel, getDraft, profile, progress, settings, solvedCount, starsShortfall, totalStars } from '../state';
import { hasProgress, moveUrl, onOldHost, siteHost } from '../migrate';
import { TG_APP_URL } from '../share';
import { inTelegram } from '../telegram';
import type { Release } from '../changelog';
import { lang } from '../i18n';
import { APP_VERSION, markNewsSeen, newsFor } from '../version';

export function Home() {
  const started = solvedCount.value > 0;
  useEffect(() => {
    refreshMyTasks();
    refreshDailyStatus();
  }, [profile.value?.id]);
  return (
    <div class="screen home">
      <div class="home-scroll">
        <div class="home-inner">
          <LangToggle />
          <Logo />
          {onOldHost() && hasProgress() && <MoveBanner />}
          <p class="tagline">{profile.value ? t.home.hello(profile.value.nickname) : t.tagline}</p>
          {newsFor(started || !!profile.value) && <NewsBanner />}
          <HomeTaskCard />
          {canOfferInstall.value && !inTelegram && solvedCount.value >= 2 && <InstallBanner />}
          <ContinueCard />
          <DailyCard />
          <ShareButtons text={t.share.inviteText} label={t.share.invite} />
          {TG_APP_URL && !inTelegram && (
            <a class="tg-link" href={TG_APP_URL} target="_blank" rel="noopener noreferrer">
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
  // Ochiq darajalar tugadi, keyingi bo'limga yulduz yetmaydi: yechilgan darajani yaxshilashga yo'llaymiz
  // (avval bu holatda karta yechilgan 1-darajani "Davom etish" deb ko'rsatardi).
  const short = allDone ? null : starsShortfall();
  const head = allDone
    ? t.home.allDoneSub
    : short
      ? t.home.needStars(short.need, chapters.indexOf(short.chapter) + 1)
      : t.home.chapter(index + 1, ch.title);
  return (
    <section class="continue-card">
      <div class="continue-head">
        <span class="continue-chapter">{head}</span>
        <span class="continue-stars">{t.home.stars(totalStars.value, MAX_STARS)}</span>
      </div>
      <h2 class="continue-title">{allDone ? t.home.allDone : `${levelNumber(level)}. ${level.title}`}</h2>
      {short && <p class="muted continue-hint">{t.home.improveHint}</p>}
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
        {/* autoFocus yo'q: har ochilishda tugma atrofida fokus halqasi chiqardi. */}
        <button class="btn primary" onClick={() => go(allDone ? 'levels' : `level/${level.id}`)}>
          <Icon name="play" />{' '}
          {allDone ? t.home.levels : short ? t.home.improve : solvedCount.value > 0 || draft ? t.home.continue : t.home.play}
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

/** Telefonga o'rnatish taklifi: brauzer tayyor bo'lsa; yopilsa — 30 kun ko'rsatilmaydi. */
function InstallBanner() {
  return (
    <div class="install-banner">
      <Icon name="download" />
      <span>{t.install.banner}</span>
      <button class="btn small primary" onClick={() => void promptInstall()}>
        {t.install.button}
      </button>
      <button class="news-close" onClick={() => dismissInstall()} aria-label={t.close} title={t.close}>
        ×
      </button>
    </div>
  );
}

/**
 * Yangi versiyadan keyin bir marta: nima o'zgarganining birinchi qatori va "Nimalar yangi". Yangiliklar
 * ro'yxati alohida bo'lakda (har relizda bir marta kerak) — birinchi qator u yuklangach chiqadi.
 */
function NewsBanner() {
  const latest = useSignal<Release | null>(null);
  useEffect(() => {
    import('../changelog').then((m) => (latest.value = m.CHANGELOG[0])).catch(() => {});
  }, []);
  const first = latest.value && (lang.value === 'ru' ? latest.value.ru : latest.value.uz)[0];
  return (
    <div class="news-banner">
      <button class="news-banner-main" onClick={() => go('news')}>
        <strong>{t.news.banner(APP_VERSION)}</strong>
        {first && <span>{first}</span>}
        <span class="news-more">{t.news.more} →</span>
      </button>
      <button class="news-close" onClick={markNewsSeen} aria-label={t.news.close} title={t.news.close}>
        ×
      </button>
    </div>
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
  // Belgi — public/favicon.svg dagi bilan bir xil (ranglari mavzudan): ikki kontakt, 45° yo'llar,
  // AND elementi va chiqishda yonib turgan chiroq.
  return (
    <div class="logo">
      <svg viewBox="0 0 64 64" width="54" height="54" aria-hidden="true">
        <path class="logo-wire" d="M8 15l7 7M8 49l7-7M44 32h6" />
        <circle class="logo-dot" cx={6} cy={15} r={3.4} />
        <circle class="logo-dot" cx={6} cy={49} r={3.4} />
        <path class="logo-gate" d="M15 12h9a20 20 0 0 1 0 40h-9Z" />
        <rect class="logo-led" x={50} y={26} width={10} height={12} rx={5} />
        <circle class="logo-shine" cx={53.6} cy={30} r={1.5} />
      </svg>
      <h1 class="logo-text">
        LOGIC<span>GATE</span>
      </h1>
    </div>
  );
}
