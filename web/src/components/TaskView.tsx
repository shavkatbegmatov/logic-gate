import type { ClassTask } from '../api';
import { todaySig, dayLabel } from '../daily';
import { t } from '../i18n';
import { levelNumber } from '../levels';
import { go } from '../router';
import { progress } from '../state';
import { activeTask, dueState, myTasks, taskLevels, taskProgress } from '../tasks';
import { Icon } from './ui';

const solved = (id: string) => !!progress.value[id];

/** Vazifa nomi: o'qituvchi yozgani yoki "N ta daraja". */
export const taskTitle = (task: ClassTask) => task.title || t.tasks.untitled(task.levels.length);

/** Muddat yozuvi: "12-noyabrgacha", "Bugun oxirgi kun", "Muddat o'tgan". */
export function DueLabel({ due }: { due?: number }) {
  const state = dueState(due, todaySig.value);
  if (state === 'none') return null;
  const text = state === 'today' ? t.tasks.dueToday : state === 'over' ? t.tasks.overdue(dayLabel(due!)) : t.tasks.due(dayLabel(due!));
  return <span class={`task-due ${state}`}>{text}</span>;
}

/** Vazifa darajalari: raqam, yechilgani belgisi; bosilsa — darajaga. */
export function TaskLevels({ task, links = true }: { task: ClassTask; links?: boolean }) {
  return (
    <div class="task-levels">
      {taskLevels(task).map((l) => {
        const p = progress.value[l.id];
        const body = (
          <>
            <b>{levelNumber(l)}</b>
            <span>{l.title}</span>
            {links && p && <span class="task-check">{'★'.repeat(p.stars)}</span>}
          </>
        );
        return links ? (
          <button key={l.id} class={`task-level${p ? ' done' : ''}`} onClick={() => go(`level/${l.id}`)}>
            {body}
          </button>
        ) : (
          <span key={l.id} class="task-level">
            {body}
          </span>
        );
      })}
    </div>
  );
}

/** O'quvchi: bitta vazifa (sinf sahifasida). */
export function TaskItem({ task }: { task: ClassTask }) {
  const p = taskProgress(task, solved);
  const done = p.total > 0 && p.done === p.total;
  return (
    <article class={`task card${done ? ' complete' : ''}`}>
      <header>
        <h3>{taskTitle(task)}</h3>
        <span class={`task-count${done ? ' good' : ''}`}>{done ? t.tasks.done : t.tasks.progress(p.done, p.total)}</span>
      </header>
      <DueLabel due={task.due} />
      <TaskLevels task={task} />
    </article>
  );
}

/** Bosh sahifa: eng yaqin bajarilmagan vazifa va "Davom etish". */
export function HomeTaskCard() {
  const task = activeTask(myTasks.value, solved, todaySig.value);
  if (!task) return null;
  const p = taskProgress(task, solved);
  const next = taskLevels(task).find((l) => !solved(l.id));
  return (
    <section class="home-task">
      <div class="home-task-head">
        <span class="home-task-class">
          <Icon name="users" /> {t.tasks.homeTitle} · {task.className}
        </span>
        <DueLabel due={task.due} />
      </div>
      <h3>{taskTitle(task)}</h3>
      <div class="home-task-foot">
        <span class="muted">{t.tasks.progress(p.done, p.total)}</span>
        <button class="btn small" onClick={() => go(next ? `level/${next.id}` : `class/${task.classCode}`)}>
          <Icon name="play" /> {p.done ? t.tasks.continue : t.tasks.start}
        </button>
      </div>
    </section>
  );
}
