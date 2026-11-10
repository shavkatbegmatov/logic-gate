import './ArchiveScreen.css';
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { api, type ArchiveDay } from '../api';
import { TopBar } from '../components/ui';
import { bestFor, dayLabel } from '../daily';
import { t } from '../i18n';
import { go } from '../router';

/** O'tgan kunlar masalalari: kechagisi hali ochiq (seriyaga kiradi), qolganlari — mashq. */
export function ArchiveScreen() {
  const days = useSignal<ArchiveDay[] | null>(null);
  const failed = useSignal(false);

  const load = async () => {
    failed.value = false;
    try {
      days.value = (await api.dailyArchive()).days;
    } catch {
      failed.value = true;
    }
  };

  useEffect(() => {
    load();
  }, []);

  const list = days.value;
  return (
    <div class="screen">
      <TopBar title={t.daily.archive} sub={list ? t.daily.archiveSub(list.length) : undefined} onBack={() => go('')} />
      <div class="scroll">
        {failed.value ? (
          <div class="narrow">
            <div class="card">
              <p>{t.daily.archiveOffline}</p>
              <button class="btn" onClick={load}>
                {t.retry}
              </button>
            </div>
          </div>
        ) : !list ? (
          <p class="muted center">{t.loading}</p>
        ) : list.length === 0 ? (
          <p class="muted center narrow">{t.daily.archiveEmpty}</p>
        ) : (
          <div class="archive">
            <p class="muted small archive-note">{t.daily.archiveNote}</p>
            {list.map((d) => (
              <ArchiveItem key={d.day} d={d} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ArchiveItem({ d }: { d: ArchiveDay }) {
  const best = bestFor(d.day, d.me);
  const kind = d.seq ? t.daily.memoryDay : (t.daily.tiers[d.tier] ?? '');
  return (
    <button class={`archive-day${best ? ' done' : ''}${d.open ? ' open' : ''}`} onClick={() => go(`daily/${d.day}`)}>
      <span class="archive-num">#{d.number}</span>
      <span class="archive-body">
        <strong>
          {dayLabel(d.day)} · {kind}
        </strong>
        <span class="muted">{t.daily.dayStats(d.solvers, d.bestGates)}</span>
        {d.open && <span class="archive-open">{t.daily.open}</span>}
      </span>
      <span class="archive-result" aria-label={best ? t.daily.mine(best.stars, best.gates) : t.daily.notSolved}>
        {best ? (
          <>
            <span class="stars-text">{'★'.repeat(best.stars) + '☆'.repeat(3 - best.stars)}</span>
            <span class="muted small">{t.daily.gatesShort(best.gates)}</span>
          </>
        ) : (
          <span class="muted">—</span>
        )}
      </span>
    </button>
  );
}
