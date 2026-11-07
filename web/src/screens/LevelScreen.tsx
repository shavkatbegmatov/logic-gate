import { useSignal } from '@preact/signals';
import { useEffect, useMemo } from 'preact/hooks';
import type { SolveResult } from '../api';
import { sfx } from '../audio';
import { Board } from '../board/Board';
import { Editor } from '../board/editor';
import { outputColumn } from '../board/geometry';
import { GateIntro } from '../components/GateIntro';
import { GateList } from '../components/GateList';
import { JoinForm } from '../components/JoinForm';
import { ShareButtons } from '../components/ShareButtons';
import { Palette } from '../components/Palette';
import { showToast } from '../components/Toast';
import { TruthTable } from '../components/TruthTable';
import { Icon, Modal, Stars, TopBar } from '../components/ui';
import { t } from '../i18n';
import { chapterOf, chapters, levelById, levelNumber, levels, newGates } from '../levels';
import { go } from '../router';
import { levelShareText } from '../share';
import { check, expected, type SimError } from '../sim/sim';
import { emptyCircuit, type Level } from '../sim/types';
import {
  chapterUnlocked,
  getDraft,
  levelUnlocked,
  markIntroSeen,
  nextLevel,
  profile,
  progress,
  recordSolve,
  seenIntro,
  setDraft,
  solvedCount,
  totalStars,
} from '../state';
import { submitSolve } from '../sync';
import { useEditorKeys } from './useEditorKeys';

interface Result {
  stars: number;
  gates: number;
  improved: boolean;
  prevGates?: number;
  /** undefined — yuborilmoqda, null — yuborilmadi (profil yoki aloqa yo'q). */
  server?: SolveResult | null;
}

function errorMessage(err: SimError): string {
  if (err.code === 'unconnected_output' && err.ref) return t.unconnectedOutput(err.ref);
  return t.errors[err.code];
}

export function LevelScreen({ id }: { id: string }) {
  const level = levelById(id);
  if (!level || !levelUnlocked(level)) return <Redirect to="levels" />;
  return <Play key={level.id} level={level} />;
}

function Redirect({ to }: { to: string }) {
  useEffect(() => go(to), []);
  return null;
}

function Play({ level }: { level: Level }) {
  const editor = useMemo(() => new Editor(), []);
  const showHint = useSignal(false);
  const showSide = useSignal(false);
  const result = useSignal<Result | null>(null);
  // Daraja yangi element bilan tanishtirsa — bir martalik karta.
  const intro = useSignal(newGates(level).filter((g) => !seenIntro.value.includes(g)));

  useMemo(() => {
    editor.load(level, getDraft(level.id) ?? progress.value[level.id]?.circuit ?? emptyCircuit(), outputColumn(level.goal));
    editor.onChange = (c) => setDraft(level.id, c);
  }, [level]);

  useEditorKeys(editor);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea')) return;
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runCheck();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const runCheck = async () => {
    const circuit = editor.circuit.value;
    const res = check(level, circuit);
    if (!res.ok) {
      sfx.error();
      if ('error' in res) {
        const ref = res.error.ref ?? null;
        const gateRef = ref?.includes(':') && !ref.startsWith('out:') ? ref.slice(0, ref.lastIndexOf(':')) : ref;
        editor.highlight.value = ref?.startsWith('out:') ? ref.slice(4) : gateRef;
        showToast(errorMessage(res.error), 'error');
      } else {
        editor.setRow(res.wrongRows[0]);
        showSide.value = true;
        showToast(t.wrongRows(res.wrongRows.length), 'error');
      }
      return;
    }
    sfx.success();
    const { improved, prev } = recordSolve(level.id, circuit, res.gates, res.stars);
    const base: Result = { stars: res.stars, gates: res.gates, improved, prevGates: prev?.gates };
    result.value = base;
    const server = await submitSolve(level.id, circuit);
    if (result.value) result.value = { ...base, server };
  };

  const chapter = chapterOf(level);
  const rows = editor.table.value;
  const row = editor.row.value;
  const used = editor.circuit.value.gates.length;
  const allOk = rows.every((got, r) => expected(level, r).every((v, i) => got[i] === v));
  const tutorialStep = level.id === 'b1' ? tutorial(editor) : -1;

  return (
    <div class="screen play">
      <TopBar title={`${levelNumber(level)}. ${level.title}`} sub={chapter.title} onBack={() => go('levels')}>
        <button class="icon-btn" onClick={() => editor.undo()} disabled={!editor.canUndo.value} title={t.play.undo} aria-label={t.play.undo}>
          <Icon name="undo" />
        </button>
        <button class="icon-btn" onClick={() => editor.redo()} disabled={!editor.canRedo.value} title={t.play.redo} aria-label={t.play.redo}>
          <Icon name="redo" />
        </button>
        <button
          class="icon-btn"
          onClick={() => confirm(t.play.clearConfirm) && editor.clear()}
          disabled={!used && !editor.circuit.value.wires.length}
          title={t.play.clear}
          aria-label={t.play.clear}
        >
          <Icon name="trash" />
        </button>
      </TopBar>

      <div class="play-body">
        <div class="stage">
          <Board editor={editor} expected={expected(level, row)} topInset={tutorialStep >= 0 ? 150 : 64} />
          <button class="task-strip" onClick={() => (showSide.value = !showSide.value)}>
            <span class="task-text">{level.task}</span>
            <span class={`count${used && used <= level.goal ? ' good' : ''}`}>
              {used}/{level.goal}
            </span>
          </button>
          {tutorialStep >= 0 && <div class="tutorial">{t.tutorial[tutorialStep]}</div>}
          <ZoomTools editor={editor} />
        </div>

        <aside class={`side${showSide.value ? ' open' : ''}`}>
          <section class="task">
            <h2>{t.play.task}</h2>
            <p>{level.task}</p>
            <div class="meta">
              <span>{t.play.goal(level.goal)}</span>
              <span class={used && used <= level.goal ? 'good' : ''}>{t.play.used(used)}</span>
            </div>
            <button class="btn ghost small" onClick={() => (showHint.value = !showHint.value)}>
              <Icon name="hint" /> {t.play.hint}
            </button>
            {showHint.value && <p class="hint">{level.hint}</p>}
          </section>
          <TruthTable
            inputs={level.inputs}
            outputs={level.outputs}
            rows={rows}
            target={level.target}
            current={row}
            onRow={(r) => editor.setRow(r)}
          />
          {allOk && <p class="all-ok">{t.play.rowsOk}</p>}
          <GateList gates={level.gates} />
          <button class="btn ghost small side-close" onClick={() => (showSide.value = false)}>
            {t.close}
          </button>
        </aside>
      </div>

      <div class="play-bottom">
        <Palette editor={editor} gates={level.gates} />
        <div class="actions">
          <button class="btn table-toggle" onClick={() => (showSide.value = !showSide.value)}>
            <Icon name="table" /> {t.play.table}
          </button>
          <button class={`btn primary check${allOk ? ' pulse' : ''}`} onClick={runCheck}>
            {t.play.check}
          </button>
        </div>
      </div>

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
        <SuccessModal
          level={level}
          result={result.value}
          onAgain={() => (result.value = null)}
          onJoined={async () => {
            const server = await submitSolve(level.id, editor.circuit.value);
            if (result.value) result.value = { ...result.value, server };
          }}
        />
      )}
    </div>
  );
}

function tutorial(editor: Editor): number {
  const c = editor.circuit.value;
  if (!c.gates.length) return 0;
  if (!c.wires.some((w) => w.from === 'in:A' && !w.to.startsWith('out:'))) return 1;
  if (!c.wires.some((w) => w.to === 'out:Q' && w.from !== 'in:A')) return 2;
  return 3;
}

export function ZoomTools({ editor }: { editor: Editor }) {
  return (
    <div class="zoom-tools">
      <button class="icon-btn" onClick={() => editor.zoomAt(1.25)} title={t.play.zoomIn} aria-label={t.play.zoomIn}>
        <Icon name="plus" />
      </button>
      <button class="icon-btn" onClick={() => editor.zoomAt(0.8)} title={t.play.zoomOut} aria-label={t.play.zoomOut}>
        <Icon name="minus" />
      </button>
      <button
        class="icon-btn"
        onClick={() => {
          editor.viewTouched = false;
          editor.fit();
        }}
        title={t.play.fit}
        aria-label={t.play.fit}
      >
        <Icon name="fit" />
      </button>
    </div>
  );
}

function SuccessModal({ level, result, onAgain, onJoined }: {
  level: Level;
  result: Result;
  onAgain: () => void;
  onJoined: () => void;
}) {
  const next = nextLevel(level);
  const nextOpen = next && levelUnlocked(next);
  const nextChapter = next && chapters.find((c) => c.id === next.chapter);
  const server = result.server;

  useEffect(() => {
    for (let i = 0; i < result.stars; i++) setTimeout(() => sfx.star(i), 350 + i * 180);
  }, []);

  return (
    <Modal onClose={onAgain}>
      <h2 class="success-title">{t.success.title}</h2>
      <Stars n={result.stars} size="lg" />
      <p>{t.success.gates(result.gates, level.goal)}</p>
      {result.stars < 3 && <p class="muted">{t.success.tryFewer(level.goal)}</p>}
      {result.improved && result.prevGates !== undefined && <p class="good">{t.success.improved}</p>}

      <div class="server-info">
        {profile.value ? (
          server === undefined ? (
            <p class="muted">{t.loading}</p>
          ) : server === null ? (
            <p class="muted">{t.success.offline}</p>
          ) : (
            <>
              <p>
                {server.best.gates <= server.level.bestGates
                  ? t.success.beatRecord
                  : t.success.record(server.level.bestGates, server.level.bestBy.join(', '))}
              </p>
              <p class="muted">{t.success.solvers(server.level.solvers)}</p>
            </>
          )
        ) : (
          <>
            <p class="muted">{t.success.joinHint}</p>
            <JoinForm compact onJoined={onJoined} />
          </>
        )}
      </div>

      <ShareButtons
        text={levelShareText({
          number: levelNumber(level),
          title: level.title,
          stars: result.stars,
          gates: result.gates,
          goal: level.goal,
        })}
      />

      {solvedCount.value === levels.length && <p class="good">{t.success.allDone}</p>}
      {next && !nextOpen && nextChapter && !chapterUnlocked(nextChapter) && (
        <p class="muted">
          {t.success.nextLocked(nextChapter.unlockStars)} ({totalStars.value} ★)
        </p>
      )}
      <div class="modal-actions">
        <button class="btn" onClick={onAgain}>
          {t.success.again}
        </button>
        {nextOpen ? (
          <button class="btn primary" onClick={() => go(`level/${next!.id}`)} autoFocus>
            {t.success.next}
          </button>
        ) : (
          <button class="btn primary" onClick={() => go('levels')} autoFocus>
            {t.success.toLevels}
          </button>
        )}
      </div>
    </Modal>
  );
}
