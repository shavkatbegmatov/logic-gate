import { activeContests, formatClock } from '../contest';
import { t } from '../i18n';
import { go } from '../router';
import { useNow } from './Countdown';

/** Bosh sahifada: o'quvchi a'zo bo'lgan sinfda musobaqa ketmoqda — bir bosishda qatnashish. */
export function ContestBanner() {
  const now = useNow();
  const live = activeContests.value.filter((c) => c.endsAt > now);
  if (!live.length) return null;
  return (
    <>
      {live.map((c) => (
        <button key={c.code} class="contest-banner" onClick={() => go(`contest/${c.code}`)}>
          <span class="contest-banner-flag" aria-hidden="true">
            🏁
          </span>
          <span class="contest-banner-text">
            <b>{t.contest.banner(c.className)}</b>
            <span>
              {c.contest.title ? `${c.contest.title} · ` : ''}
              {t.contest.left(formatClock(c.endsAt - now))}
            </span>
          </span>
          <span class="btn primary small">{t.contest.join}</span>
        </button>
      ))}
    </>
  );
}
