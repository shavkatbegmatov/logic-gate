import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { refreshMyTasks } from '../classes';
import { HeroGate } from '../components/HeroGate';
import { JoinForm } from '../components/JoinForm';
import { HomeTaskCard } from '../components/TaskView';
import { canOfferInstall, dismissInstall, promptInstall } from '../install';
import { MiniBoard } from '../components/MiniBoard';
import { ShareButtons } from '../components/ShareButtons';
import { Icon, type IconName } from '../components/ui';
import { states } from '../achievements';
import { dailyHistory, refreshDailyStatus, streak, todaySig } from '../daily';
import { t } from '../i18n';
import { switchLang } from '../lang-switch';
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
          <header class="home-top">
            <h1 class="brand">{t.appName}</h1>
            <LangToggle />
          </header>
          {/* O'yin: sxema, navbatdagi daraja va bitta asosiy tugma. */}
          <div class="home-lead">
            <HeroGate />
            <p class="home-hello">{profile.value ? t.home.hello(profile.value.nickname) : t.tagline}</p>
            {onOldHost() && hasProgress() && <MoveBanner />}
            <HomeTaskCard />
            <ContinueCard />
          </div>
          {/* Qolgan hammasi: bitta ro'yxat va vaqtinchalik xabarlar. */}
          <div class="home-more">
            {newsFor(started || !!profile.value) && <NewsBanner />}
            {canOfferInstall.value && !inTelegram && solvedCount.value >= 2 && <InstallBanner />}
            <div class="home-list">
              <DailyRow />
              <button class="home-row" onClick={() => go('archive')}>
                <Icon name="archive" />
                <span class="home-row-text">{t.daily.archiveLink}</span>
                <span class="home-row-end">
                  <Icon name="chevron" />
                </span>
              </button>
              <ShareButtons text={t.share.inviteText} label={t.share.invite} row />
              {TG_APP_URL && !inTelegram && (
                <a class="home-row tg" href={TG_APP_URL} target="_blank" rel="noopener noreferrer">
                  <Icon name="telegram" />
                  <span class="home-row-text">{t.telegram.play}</span>
                  <span class="home-row-end">
                    <Icon name="chevron" />
                  </span>
                </a>
              )}
            </div>
            {!profile.value && started && (
              <div class="card">
                <JoinForm />
              </div>
            )}
          </div>
        </div>
      </div>
      <HomeNav />
    </div>
  );
}

/** Navbatdagi daraja: nomi (katta sarlavha), bo'limi, kichik sxemasi, yulduzlar chizig'i va bitta katta tugma. */
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
      <h2 class="continue-title">{allDone ? t.home.allDone : `${levelNumber(level)}. ${level.title}`}</h2>
      <p class="continue-chapter">{head}</p>
      {short && <p class="muted continue-hint">{t.home.improveHint}</p>}
      {!allDone && (
        <button class="continue-board" onClick={() => go(`level/${level.id}`)} aria-label={t.home.continue} tabIndex={-1}>
          <MiniBoard level={level} circuit={draft} />
        </button>
      )}
      <div class="continue-meter">
        <div class="continue-meter-row">
          <span>
            {allDone
              ? t.home.solved(solvedCount.value, levels.length)
              : t.home.chapterProgress(solved, list.length, chapterStars(ch), list.length * 3)}
          </span>
          <span class="continue-stars">{t.home.stars(totalStars.value, MAX_STARS)}</span>
        </div>
        <div class="meter" aria-hidden="true">
          <i style={{ '--fill': totalStars.value / MAX_STARS }} />
        </div>
      </div>
      {/* autoFocus yo'q: har ochilishda tugma atrofida fokus halqasi chiqardi. */}
      <button class="btn primary big" onClick={() => go(allDone ? 'levels' : `level/${level.id}`)}>
        <Icon name="play" />{' '}
        {allDone ? t.home.levels : short ? t.home.improve : solvedCount.value > 0 || draft ? t.home.continue : t.home.play}
      </button>
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
      onClick={() => void switchLang(next)}
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

/** Kunlik boshqotirma — ro'yxatning birinchi qatori: holati, seriya; yechilmagan bo'lsa — miltillovchi nuqta. */
function DailyRow() {
  const done = dailyHistory.value[todaySig.value];
  const days = streak.value;
  return (
    <button class="home-row" onClick={() => go('daily')}>
      <Icon name="calendar" />
      <span class="home-row-text">
        <strong>{t.daily.home}</strong>
        <span class="muted">{done ? t.daily.homeDone('★'.repeat(done.stars) + '☆'.repeat(3 - done.stars), done.gates) : t.daily.homeNew}</span>
        {days > 0 && (
          <span class="streak">
            <Icon name="flame" /> {t.daily.streak(days)}
          </span>
        )}
      </span>
      <span class="home-row-end">{done ? <Icon name="chevron" /> : <span class="dot" aria-hidden="true" />}</span>
    </button>
  );
}
