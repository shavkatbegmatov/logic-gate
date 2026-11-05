import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { api, type LeaderEntry } from '../api';
import { JoinForm } from '../components/JoinForm';
import { TopBar } from '../components/ui';
import { t } from '../i18n';
import { go } from '../router';
import { profile } from '../state';
import { syncProgress } from '../sync';

type Data = { top: LeaderEntry[]; me: LeaderEntry | null };

export function Leaderboard() {
  const data = useSignal<Data | null>(null);
  const failed = useSignal(false);

  const fetchData = async () => {
    failed.value = false;
    try {
      // Avval yuborilmagan natijalar jo'natiladi, keyin reyting olinadi.
      await syncProgress().catch(() => {});
      data.value = await api.leaderboard();
    } catch {
      failed.value = true;
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile.value?.id]);

  const d = data.value;
  return (
    <div class="screen leaderboard">
      <TopBar title={t.leaderboard.title} onBack={() => go('')} />
      <div class="scroll">
        <div class="narrow">
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
          ) : !d ? (
            <p class="muted center">{t.loading}</p>
          ) : !d.top.length ? (
            <p class="muted center">{t.leaderboard.empty}</p>
          ) : (
            <>
              {d.me && !d.top.some((e) => e.me) && <p class="good center">{t.leaderboard.yourRank(d.me.rank)}</p>}
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
                  {d.top.map((e) => (
                    <tr key={e.rank} class={`${e.me ? 'me' : ''}${e.rank <= 3 ? ` top${e.rank}` : ''}`}>
                      <td>{e.rank}</td>
                      <td class="left">
                        {e.nickname}
                        {e.me && <span class="badge">{t.leaderboard.you}</span>}
                      </td>
                      <td>{e.stars}</td>
                      <td>{e.solved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
