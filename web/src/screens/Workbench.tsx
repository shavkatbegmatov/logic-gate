import { useSignal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { sfx } from '../audio';
import { Board } from '../board/Board';
import type { Editor } from '../board/editor';
import { GateList } from '../components/GateList';
import { Palette } from '../components/Palette';
import { showToast } from '../components/Toast';
import { TruthTable } from '../components/TruthTable';
import { Icon, TopBar } from '../components/ui';
import { t } from '../i18n';
import { check, expected, type SimError } from '../sim/sim';
import type { Circuit, Level } from '../sim/types';
import { useEditorKeys } from './useEditorKeys';

export interface Solved {
  circuit: Circuit;
  gates: number;
  stars: number;
}

function errorMessage(err: SimError): string {
  if (err.code === 'unconnected_output' && err.ref) return t.unconnectedOutput(err.ref);
  return t.errors[err.code];
}

/**
 * Masala yechiladigan ekran: maydon, vazifa, haqiqat jadvali, palitra va tekshirish.
 * Daraja ham, kunlik boshqotirma ham shundan foydalanadi; yechilgandan keyingi ish — onSolved da.
 */
export function Workbench({ level, editor, title, sub, onBack, onSolved, topInset = 64, banner, children }: {
  level: Level;
  editor: Editor;
  title: string;
  sub: string;
  onBack: () => void;
  onSolved: (s: Solved) => void;
  topInset?: number;
  /** Maydon ustidagi qo'shimcha yozuv (o'rgatuvchi qadamlar). */
  banner?: ComponentChildren;
  /** Oynalar (natija, tanishtiruv). */
  children?: ComponentChildren;
}) {
  const showHint = useSignal(false);
  const showSide = useSignal(false);
  const solvedRef = useRef(onSolved);
  solvedRef.current = onSolved;

  useEditorKeys(editor);

  const runCheck = () => {
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
    solvedRef.current({ circuit, gates: res.gates, stars: res.stars });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea, [role="dialog"]')) return;
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runCheck();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [level]);

  const rows = editor.table.value;
  const row = editor.row.value;
  const used = editor.circuit.value.gates.length;
  const allOk = rows.every((got, r) => expected(level, r).every((v, i) => got[i] === v));

  return (
    <div class="screen play">
      <TopBar title={title} sub={sub} onBack={onBack}>
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
          <Board editor={editor} expected={expected(level, row)} topInset={topInset} />
          <button class="task-strip" onClick={() => (showSide.value = !showSide.value)}>
            <span class="task-text">{level.task}</span>
            <span class={`count${used && used <= level.goal ? ' good' : ''}`}>
              {used}/{level.goal}
            </span>
          </button>
          {banner}
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

      {children}
    </div>
  );
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
