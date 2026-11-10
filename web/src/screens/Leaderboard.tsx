import './Leaderboard.css';
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { api, type ClassInfo, type DailyEntry, type LeaderEntry } from '../api';
import { JoinForm } from '../components/JoinForm';
import { TopBar } from '../components/ui';
import { syncDaily } from '../daily';
import { t } from '../i18n';
import { go } from '../router';
import { profile } from '../state';
import { syncProgress } from '../sync';

type Tab = 'overall' | 'daily';
type Overall = { top: LeaderEntry[]; me: LeaderEntry | null };
type Daily = { top: DailyEntry[]; me: DailyEntry | null };

export function Leaderboard({ tab }: { tab: Tab }) {
  const overall = useSignal<Overall | null>(null);
  const daily = useSignal<Daily | null>(null);
  const failed = useSignal(false);
  const classes = useSignal<ClassInfo[]>([]);

  useEffect(() => {
    if (profile.value)
      api
        .myClasses()
        .then((r) => (classes.value = r.classes))
        .catch(() => {});
  }, [profile.value?.id]);

  const fetchData = async () => {
    failed.value = false;
    try {
      // Avval yuborilmagan natijalar jo'natiladi, keyin reyting olinadi.
      if (tab === 'overall') {
        await syncProgress().catch(() => {});
        overall.value = await api.leaderboard();
      } else {
        await syncDaily().catch(() => {});
        daily.value = await api.dailyLeaderboard('today');
      }
    } catch {
      failed.value = true;
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile.value?.id, tab]);

  const data = tab === 'overall' ? overall.value : daily.value;
  return (
    <div class="screen leaderboard">
      <TopBar title={t.leaderboard.title} onBack={() => go('')} />
      <div class="scroll">
        <div class="narrow">
          <div class="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'overall'} class={tab === 'overall' ? 'on' : ''} onClick={() => go('leaderboard')}>
              {t.leaderboard.overall}
            </button>
            <button role="tab" aria-selected={tab === 'daily'} class={tab === 'daily' ? 'on' : ''} onClick={() => go('leaderboard/daily')}>
              {t.leaderboard.today}
            </button>
          </div>
          {classes.value.length > 0 && (
            <div class="class-chips">
              {classes.value.map((c) => (
                <button key={c.code} class="btn ghost small" onClick={() => go(`class/${c.code}`)}>
                  {t.classes.board}: {c.name}
                </button>
              ))}
            </div>
          )}
          {!profile.value && (
            <div class="card">
              <p class="muted">{t.leaderboard.notJoined}</p>
              <JoinForm compact />
            </div>
          )}
          {failed.value ? (
            <div class="card">
              <p>{t.leaderboard.offline}</p>
              <button class="btn" onClick={fetchData}>
                {t.retry}
              </button>
            </div>
          ) : !data ? (
            <p class="muted center">{t.loading}</p>
          ) : !data.top.length ? (
            <div class="center">
              <p class="muted">{tab === 'overall' ? t.leaderboard.empty : t.leaderboard.dailyEmpty}</p>
              {tab === 'daily' && (
                <button class="btn primary" onClick={() => go('daily')}>
                  {t.daily.home}
                </button>
              )}
            </div>
          ) : (
            <>
              <Podium rows={data.top.slice(0, 3)} view={tab === 'overall' ? overallView : dailyView} />
              {data.top.length > 3 &&
                (tab === 'overall' ? <OverallTable rows={overall.value!.top.slice(3)} /> : <DailyTable rows={daily.value!.top.slice(3)} />)}
              {data.me && !data.top.some((e) => e.me) && <MeCard e={data.me} view={tab === 'overall' ? overallView : dailyView} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type Entry = LeaderEntry | DailyEntry;
/** Asosiy ko'rsatkich (umumiy — yulduzlar, kunlik — elementlar) va qo'shimchasi. */
type View = { main: (e: Entry) => string; sub: (e: Entry) => string; stars?: boolean };

const overallView: View = {
  main: (e) => `${e.stars} ★`,
  sub: (e) => t.leaderboard.levelsN((e as LeaderEntry).solved),
};
const dailyView: View = {
  main: (e) => t.leaderboard.gatesN(e.gates),
  sub: (e) => '★'.repeat(e.stars),
  stars: true,
};

/** Birinchi uch o'rin — shohsupa: 2 · 1 · 3, balandligi o'ringa qarab. */
function Podium({ rows, view }: { rows: Entry[]; view: View }) {
  return (
    <div class="podium">
      {rows.map((e) => (
        <div key={e.rank} class={`podium-col place${e.rank}${e.me ? ' me' : ''}`}>
          <span class="podium-medal">{e.rank}</span>
          <span class="podium-name" title={e.nickname}>
            {e.nickname}
          </span>
          {e.me && <span class="badge">{t.leaderboard.you}</span>}
          <div class="podium-base">
            <strong>{view.main(e)}</strong>
            <span class={view.stars ? 'stars-sub' : ''}>{view.sub(e)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** O'yinchi ro'yxatda ko'rinmasa — uning o'rni pastda alohida. */
function MeCard({ e, view }: { e: Entry; view: View }) {
  return (
    <div class="me-card">
      <span class="me-rank">{t.leaderboard.place(e.rank)}</span>
      <span class="me-name">
        {e.nickname} <span class="badge">{t.leaderboard.you}</span>
      </span>
      <span class="me-main">{view.main(e)}</span>
    </div>
  );
}

function rowClass(e: { me?: boolean; rank: number }) {
  return `${e.me ? 'me' : ''}${e.rank <= 3 ? ` top${e.rank}` : ''}`;
}

function Name({ e }: { e: { nickname: string; me?: boolean } }) {
  return (
    <td class="left">
      {e.nickname}
      {e.me && <span class="badge">{t.leaderboard.you}</span>}
    </td>
  );
}

function OverallTable({ rows }: { rows: LeaderEntry[] }) {
  return (
    <table class="board-table">
      <thead>
        <tr>
          <th>{t.leaderboard.rank}</th>
          <th class="left">{t.leaderboard.player}</th>
          <th>{t.leaderboard.stars}</th>
          <th>{t.leaderboard.solved}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => (
          <tr key={e.rank} class={rowClass(e)}>
            <td>{e.rank}</td>
            <Name e={e} />
            <td>{e.stars}</td>
            <td>{e.solved}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DailyTable({ rows }: { rows: DailyEntry[] }) {
  return (
    <table class="board-table">
      <thead>
        <tr>
          <th>{t.leaderboard.rank}</th>
          <th class="left">{t.leaderboard.player}</th>
          <th>{t.leaderboard.gates}</th>
          <th>{t.leaderboard.stars}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => (
          <tr key={e.rank} class={rowClass(e)}>
            <td>{e.rank}</td>
            <Name e={e} />
            <td>{e.gates}</td>
            <td class="stars-cell">{'★'.repeat(e.stars)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
