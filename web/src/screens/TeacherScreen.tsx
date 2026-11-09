import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { api, type ClassReport } from '../api';
import {
  classLink,
  forgetTeacherClass,
  normalizeClassCode,
  saveTeacherClass,
  sortSummaries,
  summarize,
  teacherClasses,
  type ReportSort,
} from '../classes';
import { copyText } from '../clipboard';
import { ShareButtons } from '../components/ShareButtons';
import { TeacherTasks } from '../components/TeacherTasks';
import { showToast } from '../components/Toast';
import { Icon, TopBar } from '../components/ui';
import { t } from '../i18n';
import { chapters } from '../levels';
import { go } from '../router';
import { errorText } from '../sync';

const copy = async (text: string) => {
  if (await copyText(text)) showToast(t.classes.copied, 'ok');
  else window.prompt(t.share.copyManual, text);
};

/** O'qituvchi: sinf yaratish, shu qurilmadagi sinflar, boshqa qurilmadan sinf qo'shish. */
export function TeacherScreen() {
  const name = useSignal('');
  const busy = useSignal(false);
  const error = useSignal('');
  const addCode = useSignal('');
  const addKey = useSignal('');
  const addError = useSignal('');

  const create = async (e: Event) => {
    e.preventDefault();
    if (busy.value) return;
    busy.value = true;
    error.value = '';
    try {
      const c = await api.createClass(name.value);
      saveTeacherClass({ code: c.code, name: c.name, key: c.key!, createdAt: Date.now() });
      go(`teacher/${c.code}`);
    } catch (err) {
      error.value = errorText(err);
    } finally {
      busy.value = false;
    }
  };

  const addExisting = async (e: Event) => {
    e.preventDefault();
    addError.value = '';
    const code = normalizeClassCode(addCode.value);
    if (!code) {
      addError.value = t.classes.errors.no_class;
      return;
    }
    try {
      const r = await api.classReport(code, addKey.value.trim());
      saveTeacherClass({ code, name: r.name, key: addKey.value.trim(), createdAt: r.createdAt * 1000 });
      go(`teacher/${code}`);
    } catch (err) {
      addError.value = errorText(err);
    }
  };

  return (
    <div class="screen">
      <TopBar title={t.classes.teacher} onBack={() => go('settings')} />
      <div class="scroll">
        <div class="narrow">
          <p class="muted">{t.classes.teacherIntro}</p>

          <form class="card" onSubmit={create}>
            <label class="field-label" for="class-name">
              {t.classes.nameLabel}
            </label>
            <div class="row">
              <input
                id="class-name"
                type="text"
                maxLength={50}
                placeholder={t.classes.namePlaceholder}
                value={name.value}
                onInput={(e) => (name.value = (e.currentTarget as HTMLInputElement).value)}
              />
              <button class="btn primary" disabled={busy.value || name.value.trim().length < 2}>
                {t.classes.create}
              </button>
            </div>
            {error.value && <p class="form-error">{error.value}</p>}
          </form>

          <h2 class="section-title">{t.classes.myClasses}</h2>
          {teacherClasses.value.length === 0 ? (
            <p class="muted">{t.classes.noClasses}</p>
          ) : (
            <div class="class-list">
              {teacherClasses.value.map((c) => (
                <button key={c.code} class="class-item" onClick={() => go(`teacher/${c.code}`)}>
                  <span class="class-item-name">{c.name}</span>
                  <code>{c.code}</code>
                </button>
              ))}
            </div>
          )}

          <form class="card" onSubmit={addExisting}>
            <h2>{t.classes.addExisting}</h2>
            <p class="muted">{t.classes.addExistingText}</p>
            <div class="row wrap">
              <input
                type="text"
                maxLength={8}
                placeholder={t.classes.codePlaceholder}
                aria-label={t.classes.codePlaceholder}
                value={addCode.value}
                onInput={(e) => (addCode.value = (e.currentTarget as HTMLInputElement).value)}
              />
              <input
                type="text"
                maxLength={24}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                aria-label={t.classes.keyPlaceholder}
                value={addKey.value}
                onInput={(e) => (addKey.value = (e.currentTarget as HTMLInputElement).value)}
              />
              <button class="btn" disabled={!addCode.value.trim() || addKey.value.replace(/[^0-9a-z]/gi, '').length !== 16}>
                {t.classes.add}
              </button>
            </div>
            {addError.value && <p class="form-error">{addError.value}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}

/** O'qituvchi hisoboti: havola, kalit, o'quvchilar jadvali. */
export function TeacherReport({ code }: { code: string }) {
  const cls = teacherClasses.value.find((c) => c.code === code);
  const report = useSignal<ClassReport | null>(null);
  const error = useSignal('');
  const sort = useSignal<ReportSort>('stars');

  const load = async () => {
    if (!cls) return;
    error.value = '';
    try {
      report.value = await api.classReport(code, cls.key);
      // Nom serverdagi bilan bir xil bo'lsin.
      if (report.value.name !== cls.name) saveTeacherClass({ ...cls, name: report.value.name });
    } catch (e) {
      error.value = errorText(e);
    }
  };

  useEffect(() => {
    load();
  }, [code]);

  if (!cls) {
    return (
      <div class="screen">
        <TopBar title={t.classes.teacher} onBack={() => go('teacher')} />
        <div class="scroll">
          <div class="narrow">
            <div class="card">
              <p>{t.classes.noKey}</p>
              <button class="btn" onClick={() => go('teacher')}>
                {t.classes.add}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const r = report.value;
  const rows = r ? sortSummaries(r.members.map((m) => summarize(m, r.now)), sort.value) : [];
  const link = classLink(code);

  const remove = async (id: string, nick: string) => {
    if (!confirm(t.classes.removeConfirm(nick))) return;
    try {
      await api.removeMember(code, cls.key, id);
      await load();
    } catch (e) {
      error.value = errorText(e);
    }
  };

  const destroy = async () => {
    if (!confirm(t.classes.deleteConfirm)) return;
    try {
      await api.deleteClass(code, cls.key);
      forgetTeacherClass(code);
      go('teacher');
    } catch (e) {
      error.value = errorText(e);
    }
  };

  return (
    <div class="screen">
      <TopBar title={cls.name} sub={`${t.classes.code}: ${code}`} onBack={() => go('teacher')}>
        <button class="icon-btn" onClick={load} aria-label={t.classes.refresh} title={t.classes.refresh}>
          <Icon name="reset" />
        </button>
      </TopBar>
      <div class="scroll">
        <div class="report">
          <section class="card class-share">
            <h2>{t.classes.joinLink}</h2>
            <p class="muted">{t.classes.joinLinkText}</p>
            <div class="class-code">{code}</div>
            <div class="row">
              <input type="text" readOnly value={link} aria-label={t.classes.joinLink} onFocus={(e) => e.currentTarget.select()} />
              <button class="icon-btn" onClick={() => copy(link)} aria-label={t.classes.copy} title={t.classes.copy}>
                <Icon name="copy" />
              </button>
            </div>
            <ShareButtons text={t.classes.shareText(cls.name)} path={`#/class/${code}`} />
          </section>

          <section class="card class-key">
            <h2>{t.classes.key}</h2>
            <p class="muted small">{t.classes.keyText}</p>
            <div class="row">
              <code class="key-code">{cls.key}</code>
              <button class="icon-btn" onClick={() => copy(cls.key)} aria-label={t.classes.copy} title={t.classes.copy}>
                <Icon name="copy" />
              </button>
            </div>
          </section>

          {r && <TeacherTasks code={code} teacherKey={cls.key} report={r} onChange={load} />}

          {error.value && (
            <div class="card">
              <p>{error.value}</p>
            </div>
          )}
          {!r && !error.value && <p class="muted center">{t.loading}</p>}
          {r && r.members.length === 0 && <p class="muted center">{t.classes.empty}</p>}
          {r && r.members.length > 0 && (
            <>
              <div class="report-head">
                <p class="muted">
                  {t.classes.members(r.members.length)} · {t.classes.todayCount(r.members.filter((m) => m.dailyToday > 0).length, r.members.length)}
                </p>
                <div class="lang-switch" role="group" aria-label={t.classes.sort}>
                  {(['stars', 'name'] as const).map((s) => (
                    <button key={s} class={sort.value === s ? 'on' : ''} aria-pressed={sort.value === s} onClick={() => (sort.value = s)}>
                      {s === 'stars' ? t.classes.sortStars : t.classes.sortName}
                    </button>
                  ))}
                </div>
              </div>
              <div class="report-wrap">
                <table class="board-table report-table">
                  <thead>
                    <tr>
                      <th class="left">{t.classes.student}</th>
                      <th>★</th>
                      <th>{t.classes.levels}</th>
                      {chapters.map((ch, i) => (
                        <th key={ch.id} class="ch" title={ch.title}>
                          {i + 1}
                        </th>
                      ))}
                      <th>{t.classes.today}</th>
                      <th>{t.classes.week}</th>
                      <th>{t.classes.lastSeen}</th>
                      <th aria-label={t.classes.remove} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s) => (
                      <tr key={s.member.id}>
                        <td class="left">{s.member.nickname}</td>
                        <td class="num gold">{s.stars}</td>
                        <td class="num">{s.solved}</td>
                        {s.chapters.map((c, i) => (
                          <td
                            key={i}
                            class={`ch-cell${c.solved === c.total ? ' full' : ''}`}
                            style={{ '--fill': String(c.total ? c.solved / c.total : 0) }}
                            title={t.classes.chapterHint(chapters[i].title, c.solved, c.total, c.stars)}
                          >
                            {c.solved || ''}
                          </td>
                        ))}
                        <td class="stars-cell">{s.member.dailyToday ? '★'.repeat(s.member.dailyToday) : '—'}</td>
                        <td class="num">{s.member.dailyWeek}</td>
                        <td class="muted small">{t.classes.seen(s.seenDays)}</td>
                        <td>
                          <button
                            class="icon-btn small"
                            onClick={() => remove(s.member.id, s.member.nickname)}
                            aria-label={t.classes.remove}
                            title={t.classes.remove}
                          >
                            <Icon name="trash" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div class="center class-actions">
            <button class="btn danger small" onClick={destroy}>
              {t.classes.deleteClass}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
