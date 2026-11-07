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
import { check, depths, expected, type SimError } from '../sim/sim';
import type { Circuit, Level } from '../sim/types';
import { useEditorKeys } from './useEditorKeys';

type RowState = 'wait' | 'cur' | 'ok' | 'bad';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const reducedMotion = () => {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * Tekshiruv animatsiyasi vaqtlari: jami ~1,6 s (qatorlar soniga qarab), har qatorda signal to'lqini
 * va natijani ko'rish uchun qisqa to'xtash.
 */
export function checkTiming(rows: number, maxDepth: number) {
  const row = Math.min(360, Math.max(50, 1600 / rows));
  const steps = 2 * maxDepth + 3;
  // Bir kadr ~16 ms: to'lqin qatorga ajratilgan vaqtga sig'masa, qadamlar guruhlab o'tiladi.
  const frames = Math.max(1, Math.floor((row * 0.65) / 16));
  const stride = Math.ceil(steps / frames);
  return { steps, stride, step: (row * 0.65) / Math.ceil(steps / stride), hold: row * 0.35 };
}

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
  /** Tekshiruv qatorlari holati; null — tekshiruv ko'rsatilmayapti. */
  const rowStates = useSignal<RowState[] | null>(null);
  const solvedRef = useRef(onSolved);
  solvedRef.current = onSolved;
  // Joriy tekshiruv: skip — oxiriga sakrash, dead — ekran yopildi.
  const run = useRef<{ skip: boolean; dead: boolean } | null>(null);
  // Natija qatorlari biroz ko'rinib turadi, keyin vazifa qatori qaytadi.
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hideRowsLater = () => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => (rowStates.value = null), 2500);
  };

  useEditorKeys(editor);

  useEffect(
    () => () => {
      clearTimeout(hideTimer.current);
      if (run.current) run.current.dead = true;
      editor.wave.value = null;
      editor.busy.value = false;
    },
    [],
  );

  // Sxema o'zgarsa, oldingi tekshiruv natijasi (qatorlar) yashiriladi.
  useEffect(() => {
    if (!editor.busy.value) rowStates.value = null;
  }, [editor.circuit.value]);

  const finish = (wrongRows: number[]) => {
    sfx.error();
    editor.setRow(wrongRows[0]);
    showSide.value = true;
    showToast(t.wrongRows(wrongRows.length), 'error');
  };

  /** Qatorlarni birma-bir ko'rsatadi: har birida signal kirishlardan chiqishlarga oqadi. */
  const animate = async (total: number, wrong: number) => {
    const me = { skip: false, dead: false };
    run.current = me;
    clearTimeout(hideTimer.current);
    editor.busy.value = true;
    editor.selection.value = null;
    editor.pending.value = null;
    const last = wrong >= 0 ? wrong : total - 1;
    const maxDepth = Math.max(0, ...depths(editor.compiled.value).values());
    const time = checkTiming(total, maxDepth);
    const rows: RowState[] = Array(total).fill('wait');
    const show = () => (rowStates.value = rows.slice());
    try {
      for (let r = 0; r <= last && !me.skip && !me.dead; r++) {
        rows[r] = 'cur';
        show();
        editor.setRow(r);
        for (let k = 0; k < time.steps && !me.skip && !me.dead; k += time.stride) {
          editor.wave.value = k;
          await sleep(time.step);
        }
        editor.wave.value = null;
        rows[r] = r === wrong ? 'bad' : 'ok';
        show();
        if (r !== wrong) sfx.tick(r);
        if (!me.skip) await sleep(time.hold);
      }
      if (me.skip && !me.dead) {
        for (let r = 0; r <= last; r++) rows[r] = r === wrong ? 'bad' : 'ok';
        show();
        editor.setRow(last);
      }
    } finally {
      editor.wave.value = null;
      editor.busy.value = false;
      if (run.current === me) run.current = null;
    }
    return !me.dead;
  };

  const runCheck = async () => {
    if (run.current) {
      run.current.skip = true;
      return;
    }
    const circuit = editor.circuit.value;
    const res = check(level, circuit);
    if (!res.ok && 'error' in res) {
      sfx.error();
      rowStates.value = null;
      const ref = res.error.ref ?? null;
      const gateRef = ref?.includes(':') && !ref.startsWith('out:') ? ref.slice(0, ref.lastIndexOf(':')) : ref;
      editor.highlight.value = ref?.startsWith('out:') ? ref.slice(4) : gateRef;
      showToast(errorMessage(res.error), 'error');
      return;
    }
    const wrongRows = res.ok ? [] : res.wrongRows;
    if (!reducedMotion()) {
      if (!(await animate(1 << level.inputs.length, wrongRows[0] ?? -1))) return;
      hideRowsLater();
    }
    if (!res.ok) {
      finish(wrongRows);
      return;
    }
    sfx.success();
    solvedRef.current({ circuit, gates: res.gates, stars: res.stars });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea, [role="dialog"]')) return;
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runCheck();
      else if (run.current && (e.key === 'Escape' || e.key === ' ')) {
        e.preventDefault();
        run.current.skip = true;
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [level]);

  const busy = editor.busy.value;
  const states = rowStates.value;

  const rows = editor.table.value;
  const row = editor.row.value;
  const used = editor.circuit.value.gates.length;
  const allOk = rows.every((got, r) => expected(level, r).every((v, i) => got[i] === v));

  return (
    <div class={`screen play${busy ? ' checking' : ''}`}>
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
        <div class={`stage${states ? ' has-check' : ''}`}>
          <Board editor={editor} expected={expected(level, row)} topInset={topInset} />
          <button class="task-strip" onClick={() => (showSide.value = !showSide.value)}>
            <span class="task-text">{level.task}</span>
            <span class={`count${used && used <= level.goal ? ' good' : ''}`}>
              {used}/{level.goal}
            </span>
          </button>
          {banner}
          {states && <CheckStrip states={states} busy={busy} />}
          {busy && (
            <button
              class="skip-layer"
              aria-label={t.play.skip}
              title={t.play.skip}
              onClick={() => run.current && (run.current.skip = true)}
            />
          )}
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
          <button class={`btn primary check${allOk && !busy ? ' pulse' : ''}`} onClick={runCheck}>
            {busy ? t.play.skip : t.play.check}
          </button>
        </div>
      </div>

      {children}
    </div>
  );
}

/** Tekshiruv qatorlari: kutmoqda / tekshirilmoqda / to'g'ri / xato. */
function CheckStrip({ states, busy }: { states: RowState[]; busy: boolean }) {
  const label = busy ? t.play.checking : states.includes('bad') ? '✗' : '✓';
  return (
    <div class={`check-strip${busy ? '' : ' done'}${states.includes('bad') ? ' bad' : ''}`} role="status">
      <span class="check-label">{label}</span>
      <span class={`check-cells${states.length > 16 ? ' tiny' : ''}`}>
        {states.map((st, r) => (
          <i key={r} class={st} title={t.play.rowLabel(r)} />
        ))}
      </span>
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
