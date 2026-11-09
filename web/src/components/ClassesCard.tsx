import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { api, type ClassInfo } from '../api';
import { normalizeClassCode } from '../classes';
import { setMyTasks, tasksFromClasses } from '../tasks';
import { t } from '../i18n';
import { go } from '../router';
import { profile } from '../state';

/** Sozlamalardagi "Sinf" bo'limi: o'quvchining sinflari, kod bilan qo'shilish, o'qituvchilar uchun. */
export function ClassesCard() {
  const mine = useSignal<ClassInfo[]>([]);
  const code = useSignal('');
  const error = useSignal('');

  useEffect(() => {
    if (!profile.value) {
      mine.value = [];
      return;
    }
    api
      .myClasses()
      .then((r) => {
        mine.value = r.classes;
        setMyTasks(tasksFromClasses(r.classes));
      })
      .catch(() => {});
  }, [profile.value?.id]);

  const open = (e: Event) => {
    e.preventDefault();
    const c = normalizeClassCode(code.value);
    if (!c) {
      error.value = t.classes.errors.no_class;
      return;
    }
    go(`class/${c}`);
  };

  return (
    <section class="card">
      <h2>{t.classes.title}</h2>
      {mine.value.length > 0 && (
        <div class="class-list">
          {mine.value.map((c) => (
            <button key={c.code} class="class-item" onClick={() => go(`class/${c.code}`)}>
              <span class="class-item-name">{c.name}</span>
              <span class="muted small">{t.classes.members(c.members)}</span>
            </button>
          ))}
        </div>
      )}
      <form class="row" onSubmit={open}>
        <input
          type="text"
          maxLength={8}
          placeholder={t.classes.codePlaceholder}
          aria-label={t.classes.enterCode}
          value={code.value}
          onInput={(e) => {
            code.value = (e.currentTarget as HTMLInputElement).value;
            error.value = '';
          }}
        />
        <button class="btn" disabled={code.value.trim().length < 6}>
          {t.classes.open}
        </button>
      </form>
      {error.value && <p class="form-error">{error.value}</p>}
      <button class="btn ghost small teacher-link" onClick={() => go('teacher')}>
        {t.classes.teacherLink}
      </button>
    </section>
  );
}
