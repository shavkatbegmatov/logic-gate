import { useEffect } from 'preact/hooks';
import { Icon, TopBar } from '../components/ui';
import { t } from '../i18n';
import { lessonFor, type Block } from '../lesson-texts';
import { chapterDone, markLessonRead } from '../lessons';
import { chapterLevels, chapters } from '../levels';
import { go } from '../router';
import { progress } from '../state';

/** Bo'lim xulosasi: bo'limning barcha darajalari yechilgach o'qiladi. */
export function LessonScreen({ id }: { id: string }) {
  const index = chapters.findIndex((c) => c.id === id);
  const ch = chapters[index];
  const lesson = lessonFor(id);
  const done = chapterDone(id);

  useEffect(() => {
    if (done) markLessonRead(id);
  }, [done]);

  if (!ch || !lesson) {
    go('levels');
    return null;
  }
  const list = chapterLevels(id);
  const solved = list.filter((l) => progress.value[l.id]).length;
  return (
    <div class="screen">
      <TopBar title={lesson.title} sub={t.lesson.sub(index + 1, ch.title)} onBack={() => go('levels')} />
      <div class="scroll">
        <article class="lesson">
          {done ? (
            lesson.blocks.map((b, i) => <LessonBlock key={i} b={b} />)
          ) : (
            <div class="card">
              <p>{t.lesson.locked(solved, list.length)}</p>
            </div>
          )}
          <div class="lesson-actions">
            <button class="btn primary" onClick={() => go('levels')}>
              {t.lesson.toLevels}
            </button>
          </div>
        </article>
      </div>
    </div>
  );
}

function LessonBlock({ b }: { b: Block }) {
  if ('h' in b) return <h3>{b.h}</h3>;
  if ('p' in b) return <p>{b.p}</p>;
  if ('tip' in b)
    return (
      <p class="lesson-tip">
        <Icon name="hint" /> {b.tip}
      </p>
    );
  if ('f' in b)
    return (
      <div class="formula-lines lesson-formula">
        {b.f.map((line, i) => {
          // "Nom:  ifoda" — nom alohida ustunda (telefonda ifoda ustida); bo'sh joy bilan boshlangan — davomi.
          const named = /^(\S[^:]*:)\s+(.+)$/.exec(line);
          const cont = /^\s+(.+)$/.exec(line);
          if (!named && !cont)
            return (
              <span key={i} class="f-full">
                {line}
              </span>
            );
          return [
            <span key={`${i}l`} class="f-label">
              {named ? named[1] : ''}
            </span>,
            <span key={`${i}e`} class="f-expr">
              {named ? named[2] : cont![1]}
            </span>,
          ];
        })}
      </div>
    );
  const [head, ...rows] = b.table;
  return (
    <div class="truth-wrap">
      <table class="truth lesson-table">
        <thead>
          <tr>
            {head.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
