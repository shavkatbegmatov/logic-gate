import { useSignal } from '@preact/signals';
import { useEffect, useMemo } from 'preact/hooks';
import type { SolveResult } from '../api';
import { sfx } from '../audio';
import { Editor } from '../board/editor';
import { outputColumn } from '../board/geometry';
import { GateIntro } from '../components/GateIntro';
import { JoinForm } from '../components/JoinForm';
import { ShareButtons } from '../components/ShareButtons';
import { Modal, Stars } from '../components/ui';
import { t } from '../i18n';
import { chapterDone, lessonsRead } from '../lessons';
import { chapterOf, chapters, levelById, levelNumber, levels, newGates } from '../levels';
import { go } from '../router';
import { levelShareText } from '../share';
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
import { Workbench, type Solved } from './Workbench';

interface Result {
  stars: number;
  gates: number;
  improved: boolean;
  prevGates?: number;
  /** undefined — yuborilmoqda, null — yuborilmadi (profil yoki aloqa yo'q). */
  server?: SolveResult | null;
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
  const result = useSignal<Result | null>(null);
  // Daraja yangi element bilan tanishtirsa — bir martalik karta.
  const intro = useSignal(newGates(level).filter((g) => !seenIntro.value.includes(g)));

  useMemo(() => {
    editor.load(level, getDraft(level.id) ?? progress.value[level.id]?.circuit ?? emptyCircuit(), outputColumn(level.goal));
    editor.onChange = (c) => setDraft(level.id, c);
  }, [level]);

  const onSolved = async ({ circuit, gates, stars }: Solved) => {
    const { improved, prev } = recordSolve(level.id, circuit, gates, stars);
    const base: Result = { stars, gates, improved, prevGates: prev?.gates };
    result.value = base;
    const server = await submitSolve(level.id, circuit);
    if (result.value) result.value = { ...base, server };
  };

  // Birinchi daraja va birinchi xotira darajasi — o'rgatuvchi qadamlar.
  const tutorialStep = level.id === 'b1' ? tutorial(editor) : level.id === 's1' ? tutorialSeq(editor) : -1;
  const tutorialText = level.id === 's1' ? t.tutorialSeq : t.tutorial;

  return (
    <Workbench
      level={level}
      editor={editor}
      title={`${levelNumber(level)}. ${level.title}`}
      sub={chapterOf(level).title}
      onBack={() => go('levels')}
      onSolved={onSolved}
      topInset={tutorialStep >= 0 ? 150 : 64}
      banner={tutorialStep >= 0 && <div class="tutorial">{tutorialText[tutorialStep]}</div>}
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
    </Workbench>
  );
}

function tutorial(editor: Editor): number {
  const c = editor.circuit.value;
  if (!c.gates.length) return 0;
  if (!c.wires.some((w) => w.from === 'in:A' && !w.to.startsWith('out:'))) return 1;
  if (!c.wires.some((w) => w.to === 'out:Q' && w.from !== 'in:A')) return 2;
  return 3;
}

function tutorialSeq(editor: Editor): number {
  const c = editor.circuit.value;
  const dff = c.gates.find((g) => g.type === 'DFF');
  if (!dff) return 0;
  const wired =
    c.wires.some((w) => w.from === 'in:A' && w.to === `${dff.id}:0`) && c.wires.some((w) => w.from === dff.id && w.to === 'out:Q');
  if (!wired) return 1;
  if (!editor.history.value.length) return 2;
  return 3;
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
      {chapterDone(level.chapter) && !lessonsRead.value.includes(level.chapter) && (
        <button class="btn small lesson-btn new" onClick={() => go(`lesson/${level.chapter}`)}>
          {t.lesson.unlocked}
        </button>
      )}
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
