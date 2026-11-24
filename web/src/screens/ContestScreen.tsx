import './ContestScreen.css';
import { useSignal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo } from 'preact/hooks';
import { api, ApiError, type ContestBoard, type ContestSolveResult } from '../api';
import { Editor } from '../board/editor';
import { outputColumn } from '../board/geometry';
import { teacherClasses } from '../classes';
import { contestDraft, localEnd, setContestDraft } from '../contest';
import { Countdown, useNow } from '../components/Countdown';
import { askConfirm } from '../components/Dialogs';
import { GateIntro } from '../components/GateIntro';
import { Icon, Modal, Stars, TopBar } from '../components/ui';
import { t } from '../i18n';
import { levelById, levelNumber } from '../levels';
import { go } from '../router';
import { emptyCircuit, type Level } from '../sim/types';
import { markIntroSeen, profile, recordSolve, unseenGates } from '../state';
import { errorText, submitSolve } from '../sync';
import { taskLevels } from '../tasks';
import { inTelegram } from '../telegram';
import { Workbench, type Solved } from './Workbench';

/** Reytingni yangilash: proyektorda tez-tez, o'quvchida kamroq (bitta maktab IP si ortida 40 ta qurilma). */
const POLL_TEACHER = 4000;
const POLL_STUDENT = 8000;

interface Loaded {
  data: ContestBoard;
  /** tugash vaqti shu qurilma soati bo'yicha (ms) */
  endsAt: number;
}

/**
 * #/contest/<sinf> — musobaqa: o'qituvchi qurilmasida (sinf kaliti shu yerda) — proyektor uchun katta reyting,
 * o'quvchida — darajalar va reyting; #/contest/<sinf>/<daraja> — darajani bo'sh maydondan yechish.
 */
export function ContestScreen({ code, level }: { code: string; level?: string }) {
  const teacherKey = teacherClasses.value.find((c) => c.code === code)?.key;
  if (level) return <ContestPlay key={level} code={code} levelId={level} />;
  return teacherKey ? <Projector code={code} teacherKey={teacherKey} /> : <StudentContest code={code} />;
}

/** Musobaqa va reytingni yuklaydi; davom etayotgan bo'lsa — vaqti-vaqti bilan va sahifaga qaytilganda yangilaydi. */
function useContest(fetch: () => Promise<ContestBoard>, every: number) {
  const loaded = useSignal<Loaded | null>(null);
  const error = useSignal<ApiError | null>(null);
  const load = async () => {
    try {
      const data = await fetch();
      loaded.value = { data, endsAt: localEnd(data.contest) };
      error.value = null;
    } catch (e) {
      // Aloqa bir lahza uzilsa, ko'rinib turgan reyting xato bilan almashmasin.
      if (!loaded.value || (e instanceof ApiError && e.status !== 0)) error.value = e instanceof ApiError ? e : new ApiError(0, 'network');
    }
  };
  useEffect(() => {
    void load();
    const tick = () => {
      const l = loaded.peek();
      // Tugagach — oxirgi marta yangilanadi (so'nggi soniyalardagi yechimlar), keyin to'xtaydi.
      if (document.visibilityState === 'visible' && (!l || l.endsAt + every > Date.now())) void load();
    };
    const id = setInterval(tick, every);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return { loaded, error, load };
}

function StudentContest({ code }: { code: string }) {
  const { loaded, error } = useContest(() => api.studentContest(code), POLL_STUDENT);
  const now = useNow();
  const l = loaded.value;
  const c = l?.data.contest;
  const active = !!l && l.endsAt > now;
  const me = l?.data.board.find((e) => e.me);

  if (!profile.value || error.value?.code === 'not_member') {
    return (
      <Shell title={t.contest.title} code={code}>
        <div class="card">
          <p>{t.contest.notMember}</p>
          <button class="btn primary" onClick={() => go(`class/${code}`)}>
            {t.contest.join}
          </button>
        </div>
      </Shell>
    );
  }
  if (!l) {
    return (
      <Shell title={t.contest.title} code={code}>
        {error.value ? <div class="card"><p>{errorText(error.value)}</p></div> : <p class="muted center">{t.loading}</p>}
      </Shell>
    );
  }

  return (
    <Shell title={`🏁 ${c!.title || t.contest.title}`} sub={l.data.name} code={code}>
      <section class={`card contest-head${active ? ' live' : ''}`}>
        {active ? <Countdown endsAt={l.endsAt} class="contest-clock" /> : <p class="contest-over">{t.contest.finished}</p>}
        {me && me.solved > 0 && <p class="contest-me">{t.contest.yourPlace(me.rank, me.stars)}</p>}
        <p class="muted small">{active ? t.contest.fresh : t.contest.rules}</p>
      </section>

      <div class="contest-levels">
        {taskLevels({ id: c!.id, title: '', levels: c!.levels, createdAt: 0 }).map((lv) => {
          const got = me?.levels[lv.id] ?? 0;
          return (
            <button
              key={lv.id}
              class={`task-level contest-level${got ? ' done' : ''}`}
              disabled={!active}
              onClick={() => go(`contest/${code}/${lv.id}`)}
            >
              <b>{levelNumber(lv)}</b>
              <span>{lv.title}</span>
              <span class="task-check">{got ? '★'.repeat(got) : active ? t.contest.solve : '—'}</span>
            </button>
          );
        })}
      </div>

      <h2 class="section-title">{t.contest.board}</h2>
      <BoardTable data={l.data} />
    </Shell>
  );
}

function Projector({ code, teacherKey }: { code: string; teacherKey: string }) {
  const { loaded, error, load } = useContest(() => api.teacherContest(code, teacherKey), POLL_TEACHER);
  const now = useNow();
  const l = loaded.value;
  const active = !!l && l.endsAt > now;

  const stop = async () => {
    if (!l || !(await askConfirm({ title: t.contest.stop, text: t.contest.stopConfirm, ok: t.contest.stop, danger: true, icon: 'clock' }))) return;
    try {
      await api.stopContest(code, teacherKey, l.data.contest.id);
    } finally {
      await load();
    }
  };
  const fullscreen = () => void document.documentElement.requestFullscreen?.().catch(() => {});

  return (
    <div class="screen contest-projector">
      <TopBar title={l ? `🏁 ${l.data.contest.title || t.contest.title}` : t.contest.title} sub={l?.data.name} onBack={() => go(`teacher/${code}`)}>
        {!inTelegram && (
          <button class="icon-btn" onClick={fullscreen} aria-label={t.contest.fullscreen} title={t.contest.fullscreen}>
            <Icon name="fit" />
          </button>
        )}
      </TopBar>
      <div class="scroll">
        <div class="report">
          {!l ? (
            error.value ? <div class="card"><p>{errorText(error.value)}</p></div> : <p class="muted center">{t.loading}</p>
          ) : (
            <>
              <section class={`contest-head projector${active ? ' live' : ''}`}>
                {active ? <Countdown endsAt={l.endsAt} class="contest-clock big" /> : <p class="contest-over big">{t.contest.finished}</p>}
                <p class="muted">{t.contest.rules}</p>
                {active && (
                  <button class="btn danger small" onClick={stop}>
                    {t.contest.stop}
                  </button>
                )}
              </section>
              <BoardTable data={l.data} perLevel />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Reyting jadvali; perLevel — har daraja ustuni (proyektor). */
function BoardTable({ data, perLevel = false }: { data: ContestBoard; perLevel?: boolean }) {
  const list = taskLevels({ id: data.contest.id, title: '', levels: data.contest.levels, createdAt: 0 });
  if (!data.board.length) return <p class="muted center">{t.contest.nobody}</p>;
  return (
    <div class="report-wrap">
      <table class={`board-table contest-board${perLevel ? ' wide' : ''}`}>
        <thead>
          <tr>
            <th>#</th>
            <th class="left">{t.contest.player}</th>
            <th>★</th>
            {perLevel ? list.map((lv) => <th key={lv.id} title={lv.title}>{levelNumber(lv)}</th>) : <th>{t.contest.solvedCol}</th>}
          </tr>
        </thead>
        <tbody>
          {data.board.map((e, i) => (
            <tr key={i} class={`${e.me ? 'me' : ''}${e.solved && e.rank <= 3 ? ` top${e.rank}` : ''}${e.solved ? '' : ' idle'}`}>
              <td>{e.solved ? e.rank : '—'}</td>
              <td class="left">
                {e.nickname}
                {e.me && <span class="badge">{t.leaderboard.you}</span>}
              </td>
              <td class="num gold">{e.stars}</td>
              {perLevel ? (
                list.map((lv) => (
                  <td key={lv.id} class="stars-cell">
                    {e.levels[lv.id] ? '★'.repeat(e.levels[lv.id]) : ''}
                  </td>
                ))
              ) : (
                <td class="num">
                  {e.solved}/{list.length}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Shell({ title, sub, code, children }: { title: string; sub?: string; code: string; children: ComponentChildren }) {
  return (
    <div class="screen">
      <TopBar title={title} sub={sub} onBack={() => go(`class/${code}`)} />
      <div class="scroll">
        <div class="narrow">{children}</div>
      </div>
    </div>
  );
}

/** Musobaqa darajasi: bo'sh maydondan (oldingi yechim yuklanmaydi), natija musobaqaga alohida yuboriladi. */
function ContestPlay({ code, levelId }: { code: string; levelId: string }) {
  const level = levelById(levelId);
  const contest = useSignal<{ id: number; endsAt: number } | null>(null);
  const error = useSignal('');

  useEffect(() => {
    api
      .studentContest(code)
      .then((r) => {
        const endsAt = localEnd(r.contest);
        if (!r.contest.levels.includes(levelId) || endsAt <= Date.now()) error.value = t.contest.over;
        else contest.value = { id: r.contest.id, endsAt };
      })
      .catch((e) => (error.value = errorText(e)));
  }, [code, levelId]);

  if (!level || error.value) {
    return (
      <div class="screen">
        <TopBar title={t.contest.title} onBack={() => go(`contest/${code}`)} />
        <div class="scroll">
          <div class="narrow">
            <div class="card">
              <p>{error.value || t.contest.over}</p>
              <button class="btn" onClick={() => go(`contest/${code}`)}>
                {t.contest.back}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (!contest.value) return <p class="muted center">{t.loading}</p>;
  return <ContestBoardPlay code={code} level={level} contestId={contest.value.id} endsAt={contest.value.endsAt} />;
}

interface PlayResult {
  stars: number;
  gates: number;
  /** undefined — yuborilmoqda */
  server?: ContestSolveResult | { error: string };
}

function ContestBoardPlay({ code, level, contestId, endsAt }: { code: string; level: Level; contestId: number; endsAt: number }) {
  const editor = useMemo(() => new Editor(), []);
  const result = useSignal<PlayResult | null>(null);
  const intro = useSignal(unseenGates(level));

  useMemo(() => {
    editor.load(level, contestDraft(contestId, level.id) ?? emptyCircuit(), outputColumn(level.goal));
    editor.onChange = (c) => setContestDraft(contestId, level.id, c);
  }, [level, contestId]);

  const onSolved = async ({ circuit, gates, stars }: Solved) => {
    // Oddiy progressga ham yoziladi (daraja yechilgan), musobaqaga esa aynan shu sxema yuboriladi.
    recordSolve(level.id, circuit, gates, stars);
    void submitSolve(level.id, circuit);
    result.value = { stars, gates };
    try {
      const server = await api.contestSolve(code, contestId, level.id, circuit);
      if (result.value) result.value = { stars, gates, server };
    } catch (e) {
      const err = e instanceof ApiError && e.code === 'contest_over' ? t.contest.over : e instanceof ApiError && e.status === 0 ? t.contest.offline : errorText(e);
      if (result.value) result.value = { stars, gates, server: { error: err } };
    }
  };

  return (
    <Workbench
      level={level}
      editor={editor}
      title={`🏁 ${levelNumber(level)}. ${level.title}`}
      sub={t.contest.title}
      onBack={() => go(`contest/${code}`)}
      onSolved={onSolved}
      banner={
        <div class="contest-banner-bar">
          <Countdown endsAt={endsAt} />
        </div>
      }
      topInset={96}
    >
      {intro.value.length > 0 && (
        <GateIntro
          gates={intro.value}
          onClose={() => {
            markIntroSeen(intro.value);
            intro.value = [];
          }}
        />
      )}
      {result.value && (
        <Modal onClose={() => (result.value = null)}>
          <h2 class="success-title">{t.contest.resultTitle}</h2>
          <Stars n={result.value.stars} size="lg" />
          <p>{t.success.gates(result.value.gates, level.goal)}</p>
          <ContestResultText server={result.value.server} />
          <div class="modal-actions">
            <button class="btn" onClick={() => (result.value = null)}>
              {t.contest.again}
            </button>
            <button class="btn primary" autoFocus onClick={() => go(`contest/${code}`)}>
              {t.contest.back}
            </button>
          </div>
        </Modal>
      )}
    </Workbench>
  );
}

function ContestResultText({ server }: { server?: ContestSolveResult | { error: string } }) {
  if (!server) return <p class="muted">{t.loading}</p>;
  if ('error' in server) return <p class="form-error">{server.error}</p>;
  return (
    <>
      {server.rank !== undefined && <p class="good">{t.contest.resultPlace(server.rank, server.total ?? 0)}</p>}
      {!server.improved && <p class="muted">{t.contest.notImproved}</p>}
    </>
  );
}
