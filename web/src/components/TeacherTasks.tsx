import { useSignal } from '@preact/signals';
import { api, type ClassMember, type ClassReport, type ClassTask } from '../api';
import { todaySig } from '../daily';
import { t } from '../i18n';
import { errorText } from '../sync';
import { dayToISO, isoToDay, MAX_TASK_LEVELS, MAX_TASKS, taskLevels } from '../tasks';
import { DueLabel, TaskLevels, taskTitle } from './TaskView';
import { askConfirm } from './Dialogs';
import { LevelPicker } from './LevelPicker';
import { Icon } from './ui';

/** O'qituvchi hisobotidagi "Vazifalar": yangi vazifa berish va har biri bo'yicha kim bajargani. */
export function TeacherTasks({ code, teacherKey, report, onChange }: {
  code: string;
  teacherKey: string;
  report: ClassReport;
  onChange: () => void;
}) {
  const editing = useSignal(false);
  const error = useSignal('');
  const tasks = report.tasks ?? [];

  const remove = async (task: ClassTask) => {
    if (!(await askConfirm({ title: t.tasks.delete, text: t.tasks.deleteConfirm, ok: t.tasks.delete, danger: true, icon: 'trash' }))) return;
    error.value = '';
    try {
      await api.deleteTask(code, teacherKey, task.id);
    } catch (e) {
      error.value = errorText(e);
    }
    // Xato bo'lsa ham (masalan, boshqa qurilmada allaqachon o'chirilgan) — ro'yxat yangilansin.
    onChange();
  };

  return (
    <section class="card teacher-tasks">
      <div class="teacher-tasks-head">
        <h2>{t.tasks.title}</h2>
        {!editing.value && tasks.length < MAX_TASKS && (
          <button class="btn small" onClick={() => (editing.value = true)}>
            <Icon name="plus" /> {t.tasks.add}
          </button>
        )}
      </div>
      {editing.value && (
        <TaskEditor
          code={code}
          teacherKey={teacherKey}
          onCancel={() => (editing.value = false)}
          onDone={() => {
            editing.value = false;
            onChange();
          }}
        />
      )}
      {error.value && <p class="form-error">{error.value}</p>}
      {!tasks.length && !editing.value && <p class="muted">{t.tasks.noTasks}</p>}
      {tasks.map((task) => (
        <TeacherTask key={task.id} task={task} members={report.members} onDelete={() => remove(task)} />
      ))}
    </section>
  );
}

function TeacherTask({ task, members, onDelete }: { task: ClassTask; members: ClassMember[]; onDelete: () => void }) {
  const list = taskLevels(task);
  const rows = members.map((m) => ({ id: m.id, nick: m.nickname, done: list.filter((l) => m.levels[l.id]).length }));
  // O'yin bilmaydigan darajalar (eski versiya) bo'lsa, vazifa "bajarilgan" hisoblanmaydi.
  const complete = list.length ? rows.filter((r) => r.done === list.length).length : 0;
  const behind = rows
    .filter((r) => !list.length || r.done < list.length)
    .sort((a, b) => a.done - b.done || a.nick.localeCompare(b.nick, undefined, { sensitivity: 'base' }));
  return (
    <article class="task teacher-task">
      <header>
        <h3>{taskTitle(task)}</h3>
        <button class="icon-btn small" onClick={onDelete} aria-label={t.tasks.delete} title={t.tasks.delete}>
          <Icon name="trash" />
        </button>
      </header>
      <DueLabel due={task.due} />
      <TaskLevels task={task} links={false} />
      {members.length > 0 && (
        <div class="task-stats">
          <div class="task-meter" style={{ '--fill': String(complete / members.length) }} aria-hidden="true">
            <span />
          </div>
          <p class="small">{t.tasks.completed(complete, members.length)}</p>
          {behind.length > 0 ? (
            <details class="task-behind">
              <summary>{t.tasks.notDone(behind.length)}</summary>
              <ul>
                {behind.map((r) => (
                  <li key={r.id}>
                    {r.nick} <span class="muted">{r.done}/{list.length}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            <p class="good small">{t.tasks.allDone}</p>
          )}
        </div>
      )}
    </article>
  );
}

function TaskEditor({ code, teacherKey, onDone, onCancel }: {
  code: string;
  teacherKey: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const title = useSignal('');
  const picked = useSignal<string[]>([]);
  const due = useSignal('');
  const busy = useSignal(false);
  const error = useSignal('');
  const today = todaySig.value;

  const submit = async (e: Event) => {
    e.preventDefault();
    if (busy.value || !picked.value.length) return;
    busy.value = true;
    error.value = '';
    try {
      await api.createTask(code, teacherKey, {
        title: title.value,
        levels: picked.value,
        due: due.value ? isoToDay(due.value) : 0,
      });
      onDone();
    } catch (err) {
      error.value = errorText(err);
    } finally {
      busy.value = false;
    }
  };

  return (
    <form class="task-editor" onSubmit={submit}>
      <label class="field-label" for="task-title">
        {t.tasks.titleLabel}
      </label>
      <input
        id="task-title"
        type="text"
        maxLength={60}
        placeholder={t.tasks.titlePlaceholder}
        value={title.value}
        onInput={(e) => (title.value = (e.currentTarget as HTMLInputElement).value)}
      />

      <LevelPicker picked={picked.value} max={MAX_TASK_LEVELS} onChange={(next) => (picked.value = next)} />
      {picked.value.length > 0 && <TaskLevels task={{ id: 0, title: '', levels: picked.value, createdAt: 0 }} links={false} />}

      <label class="field-label" for="task-due">
        {t.tasks.dueLabel}
      </label>
      <input
        id="task-due"
        type="date"
        min={dayToISO(today)}
        max={dayToISO(today + 366)}
        value={due.value}
        onInput={(e) => (due.value = (e.currentTarget as HTMLInputElement).value)}
      />
      <p class="muted small">{t.tasks.teacherIntro}</p>
      {error.value && <p class="form-error">{error.value}</p>}
      <div class="row task-editor-actions">
        <button type="button" class="btn" onClick={onCancel}>
          {t.tasks.cancel}
        </button>
        <button class="btn primary" disabled={busy.value || !picked.value.length}>
          {t.tasks.create}
        </button>
      </div>
    </form>
  );
}
