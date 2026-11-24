import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { api, type ClassEntry, type ClassInfo } from '../api';
import { normalizeClassCode, refreshMyTasks } from '../classes';
import { localEnd } from '../contest';
import { Countdown } from '../components/Countdown';
import { JoinForm } from '../components/JoinForm';
import { TaskItem } from '../components/TaskView';
import { askConfirm } from '../components/Dialogs';
import { TopBar } from '../components/ui';
import { t } from '../i18n';
import { go } from '../router';
import { profile } from '../state';
import { errorText, syncProgress } from '../sync';

/** O'quvchi: sinfga taklif (#/class/<kod>) — qo'shilish, sinf reytingi, chiqish. */
export function ClassScreen({ code: raw }: { code: string }) {
  const code = normalizeClassCode(raw);
  const info = useSignal<ClassInfo | null>(null);
  const board = useSignal<ClassEntry[] | null>(null);
  const error = useSignal('');
  const busy = useSignal(false);
  // Davom etayotgan musobaqaning tugash vaqti (shu qurilma soati bo'yicha; javob kelganda bir marta hisoblanadi).
  const contestEnd = useSignal(0);

  const load = async () => {
    error.value = '';
    if (!code) {
      error.value = t.classes.errors.no_class;
      return;
    }
    try {
      const c = await api.classInfo(code);
      info.value = c;
      contestEnd.value = c.contest ? localEnd(c.contest) : 0;
      board.value = c.member ? (await api.classBoard(code)).top : null;
      refreshMyTasks(true);
    } catch (e) {
      error.value = errorText(e);
    }
  };

  useEffect(() => {
    load();
  }, [profile.value?.id]);

  const join = async () => {
    busy.value = true;
    error.value = '';
    try {
      // Qurilmadagi natijalar avval serverga — sinf reytingida darhol ko'rinsin.
      await syncProgress().catch(() => {});
      await api.joinClass(code);
      await load();
    } catch (e) {
      error.value = errorText(e);
    } finally {
      busy.value = false;
    }
  };

  const leave = async () => {
    if (!(await askConfirm({ title: t.classes.leave, text: t.classes.leaveConfirm, ok: t.classes.leave, danger: true, icon: 'users' }))) return;
    try {
      await api.leaveClass(code);
      await load();
    } catch (e) {
      error.value = errorText(e);
    }
  };

  const c = info.value;
  return (
    <div class="screen">
      <TopBar
        title={c?.name ?? t.classes.title}
        sub={c ? `${t.classes.code}: ${c.code} · ${t.classes.members(c.members)}` : undefined}
        onBack={() => go('')}
      />
      <div class="scroll">
        <div class="narrow">
          {error.value && (
            <div class="card">
              <p>{error.value}</p>
            </div>
          )}
          {!c && !error.value && <p class="muted center">{t.loading}</p>}
          {c && !c.member && (
            <section class="card class-invite">
              <p class="muted small">{t.classes.joinTitle}</p>
              <h2 class="class-name">{c.name}</h2>
              <p class="muted">{t.classes.joinText}</p>
              {profile.value ? (
                <button class="btn primary" onClick={join} disabled={busy.value}>
                  {t.classes.join}
                </button>
              ) : (
                <JoinForm compact hint={t.classes.joinNeedsProfile} onJoined={join} />
              )}
            </section>
          )}
          {c?.member && (
            <>
              <p class="good center">{t.classes.joined}</p>
              {c.contest && contestEnd.value > Date.now() && (
                <button class="contest-banner" onClick={() => go(`contest/${c.code}`)}>
                  <span class="contest-banner-flag" aria-hidden="true">
                    🏁
                  </span>
                  <span class="contest-banner-text">
                    <b>{c.contest.title || t.contest.title}</b>
                    <span>
                      {t.contest.running} · <Countdown endsAt={contestEnd.value} />
                    </span>
                  </span>
                  <span class="btn primary small">{t.contest.join}</span>
                </button>
              )}
              {(c.tasks?.length ?? 0) > 0 && (
                <>
                  <h2 class="section-title">{t.tasks.title}</h2>
                  <div class="task-list">
                    {c.tasks!.map((task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                </>
              )}
              <h2 class="section-title">{t.classes.board}</h2>
              {board.value && (
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
                    {board.value.map((e) => (
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
              )}
              <div class="center class-actions">
                <button class="btn ghost small" onClick={leave}>
                  {t.classes.leave}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
