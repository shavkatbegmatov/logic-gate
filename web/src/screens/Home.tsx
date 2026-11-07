import { JoinForm } from '../components/JoinForm';
import { ShareButtons } from '../components/ShareButtons';
import { Icon } from '../components/ui';
import { dailyHistory, streak, today } from '../daily';
import { t } from '../i18n';
import { levels, MAX_STARS } from '../levels';
import { go } from '../router';
import { continueLevel, profile, solvedCount, totalStars } from '../state';

export function Home() {
  const started = solvedCount.value > 0;
  return (
    <div class="screen home">
      <div class="home-inner">
        <Logo />
        <p class="tagline">{t.tagline}</p>
        {profile.value && <p class="hello">{t.home.hello(profile.value.nickname)}</p>}
        <div class="home-stats">
          <span>{t.home.stars(totalStars.value, MAX_STARS)}</span>
          <span>{t.home.solved(solvedCount.value, levels.length)}</span>
        </div>
        <DailyCard />
        <nav class="menu">
          <button class="btn primary big" onClick={() => go(`level/${continueLevel().id}`)} autoFocus>
            {started ? t.home.continue : t.home.play}
          </button>
          <button class="btn big" onClick={() => go('levels')}>
            {t.home.levels}
          </button>
          <button class="btn big" onClick={() => go('sandbox')}>
            {t.home.sandbox}
          </button>
          <div class="menu-row">
            <button class="btn" onClick={() => go('leaderboard')}>
              {t.home.leaderboard}
            </button>
            <button class="btn" onClick={() => go('settings')}>
              {t.home.settings}
            </button>
          </div>
        </nav>
        <ShareButtons text={t.share.inviteText} label={t.share.invite} />
        {!profile.value && started && (
          <div class="card">
            <JoinForm />
          </div>
        )}
      </div>
    </div>
  );
}

function DailyCard() {
  const done = dailyHistory.value[today()];
  const days = streak.value;
  return (
    <button class={`daily-card${done ? ' done' : ''}`} onClick={() => go('daily')}>
      <Icon name="calendar" />
      <span class="daily-text">
        <strong>{t.daily.home}</strong>
        <span class="muted">
          {done ? t.daily.homeDone('★'.repeat(done.stars) + '☆'.repeat(3 - done.stars), done.gates) : t.daily.homeNew}
        </span>
        {days > 0 && <span class="streak">{t.daily.streak(days)}</span>}
      </span>
      {!done && <span class="dot" aria-hidden="true" />}
    </button>
  );
}

function Logo() {
  // Logotip: ikki kirishli AND belgisi va nur sochuvchi simlar.
  return (
    <div class="logo">
      <svg viewBox="0 0 160 72" width="160" height="72" aria-hidden="true">
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
