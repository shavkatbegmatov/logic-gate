import { useSignal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import { sfx } from '../audio';
import { Board } from '../board/Board';
import { MAX_TICKS, type Editor } from '../board/editor';
import { tidy } from '../board/tidy';
import { GateList } from '../components/GateList';
import { HintPanel } from '../components/HintPanel';
import { Palette } from '../components/Palette';
import { askClear } from '../components/Dialogs';
import { showToast } from '../components/Toast';
import { Formula } from '../components/Formula';
import { Timeline, traceSteps } from '../components/Timeline';
import { TruthTable } from '../components/TruthTable';
import { ViewTools } from '../components/ViewTools';
import { Icon, TopBar } from '../components/ui';
import { t } from '../i18n';
import { check, depths, expected, machineOut, machineReplay, type SimError } from '../sim/sim';
import type { Circuit, Level } from '../sim/types';
import { instantCheck } from '../theme';
import { useEditorKeys } from './useEditorKeys';

type RowState = 'wait' | 'cur' | 'ok' | 'bad';

/** Ketma-ket tekshiruvda ko'pi bilan shuncha takt o'ynab ko'rsatiladi (oxirgilari). */
const SEQ_WINDOW = 16;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Tekshiruv animatsiyasi vaqtlari: jami ~1,6 s (qatorlar soniga qarab), har qatorda signal to'lqini
 * va natijani ko'rish uchun qisqa to'xtash.
 */
export function checkTiming(rows: number, maxDepth: number) {
  const row = Math.min(360, Math.max(50, 1600 / rows));
  const steps = 2 * maxDepth + 3;
  return { steps, ...waveTiming(steps, row * 0.65), hold: row * 0.35 };
}

/**
 * Xato qator sekinroq o'tadi: to'lqin 0,6–1,2 s, keyin natija biroz ko'rinib turadi. Aks holda
 * birinchi qatorning o'zi xato bo'lsa, tekshiruv ~0,3 s da tugab, animatsiya sezilmay qolardi.
 */
export function badRowTiming(maxDepth: number) {
  const steps = 2 * maxDepth + 3;
  return { steps, ...waveTiming(steps, Math.min(1200, Math.max(600, steps * 90))), hold: 500 };
}

/** Bir kadr ~16 ms: to'lqin ajratilgan vaqtga sig'masa, qadamlar guruhlab o'tiladi. */
function waveTiming(steps: number, wave: number) {
  const frames = Math.max(1, Math.floor(wave / 16));
  const stride = Math.ceil(steps / frames);
  return { stride, step: wave / Math.ceil(steps / stride) };
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
  const showSide = useSignal(false);
  /** Tekshiruv qatorlari holati; null — tekshiruv ko'rsatilmayapti. */
  const rowStates = useSignal<RowState[] | null>(null);
  // Tekshiruv natijasining izohi ("2 ta qatorda xato…") — natija chizig'ining ichida; alohida xabar
  // (toast) xuddi shu joyga, chiziq ustiga tushardi.
  const stripNote = useSignal<string | null>(null);
  /** Ketma-ket tekshiruvda birinchi ko'rsatilgan taktning raqami (uzun ketma-ketlikda oxirgilari). */
  const stripOffset = useSignal(0);
  const solvedRef = useRef(onSolved);
  solvedRef.current = onSolved;
  // Joriy tekshiruv: skip — oxiriga sakrash, dead — ekran yopildi.
  const run = useRef<{ skip: boolean; dead: boolean } | null>(null);
  // Natija qatorlari biroz ko'rinib turadi, keyin vazifa qatori qaytadi.
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hideRowsLater = (ms = 2500) => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => (rowStates.value = null), ms);
  };

  /** Xato izohi: natija chizig'i ko'rinib tursa — uning ichida (va uzoqroq), bo'lmasa — xabar. */
  const explain = (text: string) => {
    if (rowStates.value) {
      stripNote.value = text;
      hideRowsLater(5000);
    } else {
      showToast(text, 'error');
    }
  };

  useEditorKeys(editor, { clock: level.gates.includes('DFF') });

  useEffect(
    () => () => {
      clearTimeout(hideTimer.current);
      if (run.current) run.current.dead = true;
      editor.wave.value = null;
      editor.busy.value = false;
    },
    [],
  );

  // Sxema o'zgarsa, oldingi tekshiruv natijasi (qatorlar) yashiriladi. Element surilishi — o'zgarish emas
  // (topology): aks holda har sudrash kadrida butun ekran qayta chizilardi.
  useEffect(() => {
    if (!editor.busy.value) rowStates.value = null;
  }, [editor.topology.value]);

  const finish = (wrongRows: number[]) => {
    sfx.error();
    editor.setRow(wrongRows[0]);
    showSide.value = true;
    explain(t.wrongRows(wrongRows.length));
  };

  /**
   * Qatorlarni birma-bir ko'rsatadi: har birida signal kirishlardan chiqishlarga oqadi. Animatsiya
   * o'chirilgan bo'lsa (Sozlamalar) — darhol oxiriga sakraydi: natija chizig'i baribir ko'rinadi.
   */
  const animate = async (total: number, wrong: number) => {
    const me = { skip: instantCheck(), dead: false };
    run.current = me;
    clearTimeout(hideTimer.current);
    stripNote.value = null;
    editor.busy.value = true;
    editor.selection.value = null;
    editor.pending.value = null;
    const last = wrong >= 0 ? wrong : total - 1;
    const maxDepth = Math.max(0, ...depths(editor.compiled.value).values());
    const normal = checkTiming(total, maxDepth);
    const slow = badRowTiming(maxDepth);
    const rows: RowState[] = Array(total).fill('wait');
    const show = () => (rowStates.value = rows.slice());
    try {
      for (let r = 0; r <= last && !me.skip && !me.dead; r++) {
        const time = r === wrong ? slow : normal;
        rows[r] = 'cur';
        show();
        editor.setRow(r);
        for (let k = 0; k < time.steps && !me.skip && !me.dead; k += time.stride) {
          editor.wave.value = k;
          sfx.flow(k / time.steps);
          await sleep(time.step);
        }
        editor.wave.value = null;
        rows[r] = r === wrong ? 'bad' : 'ok';
        show();
        if (r !== wrong && !me.dead) sfx.tick(r);
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

  /**
   * Ketma-ket masala: qatorlar ketma-ketligi taktma-takt o'ynaladi — har taktda signal oqadi,
   * keyin takt bosiladi. Xato bo'lsa, oxirgi (xato) taktda to'xtaydi.
   */
  const animateSeq = async (trace: number[], wrong: number) => {
    const me = { skip: instantCheck(), dead: false };
    run.current = me;
    clearTimeout(hideTimer.current);
    stripNote.value = null;
    editor.busy.value = true;
    editor.selection.value = null;
    editor.pending.value = null;
    const last = trace.length - 1;
    // Uzun ketma-ketlikda faqat oxirgi taktlar o'ynaladi (xato shu yerda) — oldingilari darhol.
    const start = Math.max(0, trace.length - SEQ_WINDOW);
    stripOffset.value = start;
    const maxDepth = Math.max(0, ...depths(editor.compiled.value).values());
    const normal = checkTiming(trace.length - start, maxDepth);
    const slow = badRowTiming(maxDepth);
    const steps: RowState[] = Array(trace.length - start).fill('wait');
    const show = () => (rowStates.value = steps.slice());
    editor.history.value = trace.slice(0, start);
    try {
      for (let i = start; i <= last && !me.skip && !me.dead; i++) {
        const time = i === wrong ? slow : normal;
        steps[i - start] = 'cur';
        show();
        editor.setRow(trace[i]);
        for (let k = 0; k < time.steps && !me.skip && !me.dead; k += time.stride) {
          editor.wave.value = k;
          sfx.flow(k / time.steps);
          await sleep(time.step);
        }
        editor.wave.value = null;
        steps[i - start] = i === wrong ? 'bad' : 'ok';
        show();
        if (i !== wrong && !me.dead) sfx.tick(i - start);
        if (!me.skip) await sleep(time.hold);
        if (i < last && !me.skip && !me.dead) editor.history.value = trace.slice(0, i + 1);
      }
      if (me.skip && !me.dead) {
        for (let i = start; i <= last; i++) steps[i - start] = i === wrong ? 'bad' : 'ok';
        show();
      }
    } finally {
      editor.wave.value = null;
      editor.busy.value = false;
      if (run.current === me) run.current = null;
    }
    if (!me.dead) {
      editor.history.value = trace.slice(0, last);
      editor.setRow(trace[last]);
    }
    return !me.dead;
  };

  /** Ketma-ket masalada xato: maydon xato taktda turadi, diagrammada qizil katakcha. */
  const finishSeq = (trace: number[]) => {
    sfx.error();
    const seq = level.seq!;
    const row = trace[trace.length - 1];
    const want = machineOut(seq, machineReplay(seq, trace.slice(0, -1)), row);
    const got = editor.evaluation.value.outputs;
    const names = level.outputs.filter((_, i) => got[i] !== want[i]).join(', ');
    showSide.value = true;
    explain(t.play.seqWrong(trace.length, names));
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
    if (level.seq) {
      const trace = res.ok ? level.seq.example : 'trace' in res ? res.trace : [];
      const wrong = res.ok ? -1 : trace.length - 1;
      if (!(await animateSeq(trace, wrong))) return;
      hideRowsLater();
      if (!res.ok) {
        finishSeq(trace);
        return;
      }
      sfx.success();
      solvedRef.current({ circuit, gates: res.gates, stars: res.stars });
      return;
    }
    const wrongRows = res.ok ? [] : 'wrongRows' in res ? res.wrongRows : [];
    if (!(await animate(1 << level.inputs.length, wrongRows[0] ?? -1))) return;
    hideRowsLater();
    if (!res.ok) {
      finish(wrongRows);
      return;
    }
    sfx.success();
    solvedRef.current({ circuit, gates: res.gates, stars: res.stars });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea, [role="dialog"], [role="alertdialog"]')) return;
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
  const used = editor.shape.value.gates;
  const seq = level.seq;
  const history = editor.history.value;
  // Ketma-ket masala: to'liq tekshiruv arzon (bir necha holat), shuning uchun har o'zgarishda.
  const compiled = editor.compiled.value;
  const seqOk = useMemo(() => !!seq && check(level, editor.circuit.peek()).ok, [level, compiled]);
  const live = useMemo(() => (seq ? traceSteps(compiled, [...history, row], seq) : []), [seq, compiled, history, row]);
  const allOk = seq ? seqOk : rows.every((got, r) => expected(level, r).every((v, i) => got[i] === v));
  const want = seq ? machineOut(seq, machineReplay(seq, history), row) : expected(level, row);

  return (
    <div class={`screen play${busy ? ' checking' : ''}`}>
      <TopBar title={title} sub={sub} onBack={onBack}>
        {/* Tekshiruv paytida sxema o'zgarmaydi (editor.locked) — tugmalar klaviaturadan ham bosilmasin. */}
        <button class="icon-btn" onClick={() => editor.undo()} disabled={busy || !editor.canUndo.value} title={t.play.undo} aria-label={t.play.undo}>
          <Icon name="undo" />
        </button>
        <button class="icon-btn" onClick={() => editor.redo()} disabled={busy || !editor.canRedo.value} title={t.play.redo} aria-label={t.play.redo}>
          <Icon name="redo" />
        </button>
        <button
          class="icon-btn"
          onClick={async () => (await askClear()) && editor.clear()}
          disabled={busy || (!used && !editor.shape.value.wires)}
          title={t.play.clear}
          aria-label={t.play.clear}
        >
          <Icon name="trash" />
        </button>
      </TopBar>

      <div class="play-body">
        <div class={`stage${states ? ' has-check' : ''}`}>
          <Board editor={editor} expected={want} topInset={topInset} />
          <ViewTools />
          <button class="task-strip" onClick={() => (showSide.value = !showSide.value)}>
            <span class="task-text">{level.task}</span>
            <span class={`count${used && used <= level.goal ? ' good' : ''}`}>
              {used}/{level.goal}
            </span>
          </button>
          {banner}
          {states && (
            <CheckStrip
              states={states}
              busy={busy}
              note={busy ? null : stripNote.value}
              label={seq ? (i) => t.play.stepLabel(i + stripOffset.value) : t.play.rowLabel}
            />
          )}
          {busy && (
            <button
              class="skip-layer"
              aria-label={t.play.skip}
              title={t.play.skip}
              onClick={() => run.current && (run.current.skip = true)}
            />
          )}
          <ZoomTools editor={editor} />
          {level.gates.includes('DFF') && <ClockTools editor={editor} />}
        </div>

        <aside class={`side${showSide.value ? ' open' : ''}`}>
          <section class="task">
            <h2>{t.play.task}</h2>
            <p>{level.task}</p>
            <div class="meta">
              <span>{t.play.goal(level.goal)}</span>
              <span class={used && used <= level.goal ? 'good' : ''}>{t.play.used(used)}</span>
            </div>
            <HintPanel level={level} editor={editor} onPlaced={() => (showSide.value = false)} />
          </section>
          {seq ? (
            <>
              <Timeline
                title={t.play.example}
                inputs={level.inputs}
                outputs={level.outputs}
                steps={traceSteps(null, seq.example, seq)}
              />
              <Timeline
                title={t.play.yourRun}
                inputs={level.inputs}
                outputs={level.outputs}
                steps={live}
                now
                note={history.length ? undefined : t.play.liveHint}
              />
            </>
          ) : (
            <TruthTable
              inputs={level.inputs}
              outputs={level.outputs}
              rows={rows}
              target={level.target}
              current={row}
              onRow={(r) => editor.setRow(r)}
            />
          )}
          {allOk && <p class="all-ok">{seq ? t.play.seqOk : t.play.rowsOk}</p>}
          <Formula editor={editor} outputs={level.outputs} />
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
            <Icon name="table" /> {seq ? t.play.diagram : t.play.table}
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

/** Tekshiruv qatorlari (ketma-ket masalada — taktlar): kutmoqda / tekshirilmoqda / to'g'ri / xato. */
function CheckStrip({
  states,
  busy,
  note,
  label: cellLabel,
}: {
  states: RowState[];
  busy: boolean;
  note: string | null;
  label: (i: number) => string;
}) {
  const label = busy ? t.play.checking : states.includes('bad') ? '✗' : '✓';
  return (
    <div class={`check-strip${busy ? '' : ' done'}${states.includes('bad') ? ' bad' : ''}${note ? ' noted' : ''}`} role="status">
      <span class="check-label">{label}</span>
      <span class={`check-cells${states.length > 16 ? ' tiny' : ''}`}>
        {states.map((st, r) => (
          <i key={r} class={st} title={cellLabel(r)} />
        ))}
      </span>
      {note && <span class="check-note">{note}</span>}
    </div>
  );
}

/** Xotirali sxema: takt (vaqtni bir qadam oldinga) va vaqtni boshiga qaytarish. */
export function ClockTools({ editor }: { editor: Editor }) {
  const steps = editor.history.value.length;
  const busy = editor.busy.value;
  return (
    <div class="clock-tools">
      <button
        class="icon-btn"
        onClick={() => editor.resetClock()}
        disabled={!steps || busy}
        title={t.play.resetClock}
        aria-label={t.play.resetClock}
      >
        <Icon name="reset" />
      </button>
      <button class="btn clock-btn" onClick={() => editor.tick()} disabled={busy || steps >= MAX_TICKS} title={`${t.play.tick} (T)`}>
        <Icon name="clock" /> {t.play.tick}
        <span class="clock-count">{steps}</span>
      </button>
    </div>
  );
}

/**
 * Elementlarni ustunlarga joylaydi (simlar o'zgarmaydi); chiqishlar joyiga sig'dirishga harakat qiladi.
 * Bitta element bo'lsa ham: u chiqish pini ro'parasiga tushadi va chiqish simi to'g'ri chiziq bo'ladi.
 */
function arrange(editor: Editor) {
  const c = editor.circuit.value;
  if (!c.gates.length || editor.busy.peek()) return;
  const r = tidy(editor.spec.value, c, editor.outX.value, { fit: true });
  editor.outX.value = r.outX;
  editor.replace(r.circuit);
  editor.viewTouched = false;
  editor.fit();
  showToast(t.play.tidied, 'ok');
}

export function ZoomTools({ editor }: { editor: Editor }) {
  return (
    <div class="zoom-tools">
      <button
        class="icon-btn"
        onClick={() => arrange(editor)}
        disabled={!editor.shape.value.gates || editor.busy.value}
        title={t.play.tidy}
        aria-label={t.play.tidy}
      >
        <Icon name="tidy" />
      </button>
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
