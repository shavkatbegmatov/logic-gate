import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { api, ApiError, type Contest } from '../api';
import { CONTEST_MINUTES, formatClock, localEnd } from '../contest';
import { t } from '../i18n';
import { go } from '../router';
import { errorText } from '../sync';
import { MAX_TASK_LEVELS } from '../tasks';
import { useNow } from './Countdown';
import { askConfirm } from './Dialogs';
import { LevelPicker } from './LevelPicker';
import { TaskLevels } from './TaskView';
import { Icon } from './ui';

/**
 * O'qituvchi hisobotidagi «Sinf musobaqasi»: yangisini boshlash (darajalar, vaqt), davom etayotganini
 * proyektorda ochish yoki tugatish, oxirgisining natijalari.
 */
export function TeacherContest({ code, teacherKey }: { code: string; teacherKey: string }) {
  const last = useSignal<{ contest: Contest; endsAt: number } | null>(null);
  const editing = useSignal(false);
  const error = useSignal('');
  const now = useNow();

  const load = async () => {
    try {
      const r = await api.teacherContest(code, teacherKey);
      last.value = { contest: r.contest, endsAt: localEnd(r.contest) };
    } catch (e) {
      if (e instanceof ApiError && e.code === 'no_contest') last.value = null;
    }
  };
  useEffect(() => {
    void load();
  }, [code]);

  const active = last.value && last.value.endsAt > now ? last.value : null;

  const stop = async () => {
    if (!active) return;
    if (!(await askConfirm({ title: t.contest.stop, text: t.contest.stopConfirm, ok: t.contest.stop, danger: true, icon: 'clock' }))) return;
    try {
      await api.stopContest(code, teacherKey, active.contest.id);
    } catch (e) {
      error.value = errorText(e);
    }
    await load();
  };

  return (
    <section class="card teacher-contest">
      <div class="teacher-tasks-head">
        <h2>🏁 {t.contest.teacherTitle}</h2>
        {!active && !editing.value && (
          <button class="btn small primary" onClick={() => (editing.value = true)}>
            <Icon name="plus" /> {t.contest.newContest}
          </button>
        )}
      </div>
      {active ? (
        <div class="contest-live">
          <p>
            <b>{active.contest.title || t.contest.title}</b> · {t.contest.running} ·{' '}
            <span class="countdown">{t.contest.left(formatClock(active.endsAt - now))}</span>
          </p>
          <TaskLevels task={{ id: 0, title: '', levels: active.contest.levels, createdAt: 0 }} links={false} />
          <div class="row wrap">
            <button class="btn primary" onClick={() => go(`contest/${code}`)}>
              <Icon name="fit" /> {t.contest.projector}
            </button>
            <button class="btn danger" onClick={stop}>
              {t.contest.stop}
            </button>
          </div>
        </div>
      ) : editing.value ? (
        <ContestEditor
          code={code}
          teacherKey={teacherKey}
          onCancel={() => (editing.value = false)}
          onStarted={() => {
            editing.value = false;
            go(`contest/${code}`);
          }}
        />
      ) : (
        <>
          <p class="muted">{t.contest.teacherIntro}</p>
          {last.value && (
            <button class="btn small" onClick={() => go(`contest/${code}`)}>
              {t.contest.results}: {last.value.contest.title || t.contest.title}
            </button>
          )}
        </>
      )}
      {error.value && <p class="form-error">{error.value}</p>}
    </section>
  );
}

function ContestEditor({ code, teacherKey, onCancel, onStarted }: {
  code: string;
  teacherKey: string;
  onCancel: () => void;
  onStarted: () => void;
}) {
  const title = useSignal('');
  const picked = useSignal<string[]>([]);
  const minutes = useSignal<number>(15);
  const busy = useSignal(false);
  const error = useSignal('');

  const submit = async (e: Event) => {
    e.preventDefault();
    if (busy.value || !picked.value.length) return;
    busy.value = true;
    error.value = '';
    try {
      await api.createContest(code, teacherKey, { title: title.value, levels: picked.value, minutes: minutes.value });
      onStarted();
    } catch (err) {
      error.value = errorText(err);
    } finally {
      busy.value = false;
    }
  };

  return (
    <form class="task-editor" onSubmit={submit}>
      <p class="muted small">{t.contest.teacherIntro}</p>
      <label class="field-label" for="contest-title">
        {t.contest.titleLabel}
      </label>
      <input
        id="contest-title"
        type="text"
        maxLength={60}
        placeholder={t.contest.titlePlaceholder}
        value={title.value}
        onInput={(e) => (title.value = (e.currentTarget as HTMLInputElement).value)}
      />
      <LevelPicker picked={picked.value} max={MAX_TASK_LEVELS} onChange={(next) => (picked.value = next)} />
      {picked.value.length > 0 && <TaskLevels task={{ id: 0, title: '', levels: picked.value, createdAt: 0 }} links={false} />}
      <p class="field-label">{t.contest.minutesLabel}</p>
      <div class="lang-switch contest-minutes" role="group" aria-label={t.contest.minutesLabel}>
        {CONTEST_MINUTES.map((m) => (
          <button type="button" key={m} class={minutes.value === m ? 'on' : ''} aria-pressed={minutes.value === m} onClick={() => (minutes.value = m)}>
            {t.contest.minutes(m)}
          </button>
        ))}
      </div>
      <p class="muted small">{t.contest.rules}</p>
      {error.value && <p class="form-error">{error.value}</p>}
      <div class="row task-editor-actions">
        <button type="button" class="btn" onClick={onCancel}>
          {t.contest.cancel}
        </button>
        <button class="btn primary" disabled={busy.value || !picked.value.length}>
          🏁 {t.contest.start}
        </button>
      </div>
    </form>
  );
}
