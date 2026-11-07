import { useSignal } from '@preact/signals';
import { useEffect, useMemo } from 'preact/hooks';
import { sfx } from '../audio';
import { Editor } from '../board/editor';
import { outputColumn } from '../board/geometry';
import { ShareButtons } from '../components/ShareButtons';
import { Modal, Stars, TopBar } from '../components/ui';
import { customLevel, customStore, decodePuzzle, recordCustom, type CustomPuzzle } from '../custom';
import { t } from '../i18n';
import { go } from '../router';
import { emptyCircuit, type Level } from '../sim/types';
import { getDraft, setDraft } from '../state';
import { Workbench, type Solved } from './Workbench';

interface Result {
  stars: number;
  gates: number;
  improved: boolean;
  prevGates?: number;
}

/** Do'st yuborgan masala: havoladagi kod o'qiladi va oddiy daraja kabi yechiladi. */
export function CustomScreen({ code }: { code: string }) {
  const puzzle = useMemo(() => decodePuzzle(code), [code]);
  if (!puzzle) {
    return (
      <div class="screen">
        <TopBar title={t.custom.untitled} onBack={() => go('')} />
        <div class="scroll">
          <div class="narrow">
            <div class="card">
              <p>{t.custom.bad}</p>
              <button class="btn primary" onClick={() => go('')}>
                {t.custom.toHome}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return <Play puzzle={puzzle} code={code} />;
}

function Play({ puzzle, code }: { puzzle: CustomPuzzle; code: string }) {
  const level = useMemo(() => customLevel(puzzle, code), [code]);
  const editor = useMemo(() => new Editor(), []);
  const result = useSignal<Result | null>(null);

  useMemo(() => {
    editor.load(level, getDraft(level.id) ?? emptyCircuit(), outputColumn(level.goal));
    editor.onChange = (c) => setDraft(level.id, c);
  }, [level]);

  const onSolved = ({ gates, stars }: Solved) => {
    const { improved, prev } = recordCustom(level.id, gates, stars);
    result.value = { stars, gates, improved, prevGates: prev?.gates };
  };

  return (
    <Workbench
      level={level}
      editor={editor}
      title={level.title}
      sub={puzzle.by ? t.custom.by(puzzle.by) : t.custom.sub}
      onBack={() => go('')}
      onSolved={onSolved}
    >
      {result.value && <Success level={level} code={code} result={result.value} onAgain={() => (result.value = null)} />}
    </Workbench>
  );
}

function Success({ level, code, result, onAgain }: { level: Level; code: string; result: Result; onAgain: () => void }) {
  // Ulashishda eng yaxshi natija ko'rsatiladi.
  const best = customStore.value.solved[level.id] ?? result;
  const title = level.title === t.custom.untitled ? '' : level.title;

  useEffect(() => {
    for (let i = 0; i < result.stars; i++) setTimeout(() => sfx.star(i), 350 + i * 180);
  }, []);

  return (
    <Modal onClose={onAgain}>
      <h2 class="success-title">{t.custom.solved}</h2>
      <Stars n={result.stars} size="lg" />
      <p>{t.custom.gates(result.gates, level.goal)}</p>
      {result.gates < level.goal ? (
        <p class="good">{t.custom.beatAuthor}</p>
      ) : (
        result.stars < 3 && <p class="muted">{t.success.tryFewer(level.goal)}</p>
      )}
      {result.improved && result.prevGates !== undefined && <p class="good">{t.success.improved}</p>}
      <ShareButtons
        text={t.custom.resultText(title, '★'.repeat(best.stars) + '☆'.repeat(3 - best.stars), best.gates, level.goal)}
        path={`#/p/${code}`}
      />
      <div class="modal-actions">
        <button class="btn" onClick={onAgain}>
          {t.success.again}
        </button>
        <button class="btn primary" onClick={() => go('sandbox')} autoFocus>
          {t.custom.makeOwn}
        </button>
      </div>
    </Modal>
  );
}
