import './Sandbox.css';
import { useSignal } from '@preact/signals';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import { Board } from '../board/Board';
import { Editor } from '../board/editor';
import { outputColumn } from '../board/geometry';
import { MAX_LENGTH } from '../boolexpr';
import { buildFromFormula, type BuildError, type BuildResult } from '../formula-build';
import { askClear } from '../components/Dialogs';
import { showToast } from '../components/Toast';
import { GateList } from '../components/GateList';
import { ShareButtons } from '../components/ShareButtons';
import { encodePuzzle, LIMITS, markCreated, puzzleFromCircuit, type CreateError } from '../custom';
import { Palette } from '../components/Palette';
import { Formula } from '../components/Formula';
import { Timeline, traceSteps } from '../components/Timeline';
import { TruthTable } from '../components/TruthTable';
import { ViewTools } from '../components/ViewTools';
import { Icon, Modal, TopBar } from '../components/ui';
import { t } from '../i18n';
import { go, replaceRoute } from '../router';
import { ALL_GATE_TYPES, type Circuit, type Spec } from '../sim/types';
import { KEYS, profile } from '../state';
import { load, saveLater } from '../storage';
import { ClockTools, ZoomTools } from './Workbench';
import { useEditorKeys } from './useEditorKeys';

const INPUT_NAMES = ['A', 'B', 'C', 'D', 'E'];
const OUTPUT_NAMES = ['Q1', 'Q2', 'Q3', 'Q4'];

interface Saved {
  inputs: number;
  outputs: number;
  circuit: Circuit;
}

const specFor = (inputs: number, outputs: number): Spec => ({
  inputs: INPUT_NAMES.slice(0, inputs),
  outputs: OUTPUT_NAMES.slice(0, outputs),
  gates: ALL_GATE_TYPES,
});

export function Sandbox({ formula }: { formula?: string }) {
  const editor = useMemo(() => {
    const saved = load<Saved>(KEYS.sandbox, { inputs: 2, outputs: 1, circuit: { gates: [], wires: [] } });
    const ed = new Editor();
    const ins = Math.min(5, Math.max(1, saved.inputs | 0));
    const outs = Math.min(4, Math.max(1, saved.outputs | 0));
    // Chiqishlar ustuni — eng o'ngdagi elementdan o'ngda (formuladan yig'ilgan chuqur sxema): load o'zi moslaydi.
    ed.load(specFor(ins, outs), saved.circuit, outputColumn(4));
    ed.onChange = (circuit) => {
      const spec = ed.spec.value;
      saveLater(KEYS.sandbox, { inputs: spec.inputs.length, outputs: spec.outputs.length, circuit });
    };
    return ed;
  }, []);
  const hasDff = editor.shape.value.dff;
  useEditorKeys(editor, { clock: hasDff });
  const showSide = useSignal(false);
  const creating = useSignal(false);
  // Qo'llanmadagi kalkulyatordan: #/sandbox/<formula> — oyna shu formula bilan ochiladi.
  const formulaOpen = useSignal<string | null>(formula ?? null);
  useEffect(() => {
    if (formula === undefined) return;
    formulaOpen.value = formula;
    // Sahifa yangilansa, oyna qayta ochilmasin; o'sha havola yana ochilsa — oyna yana chiqsin.
    replaceRoute('sandbox');
  }, [formula]);

  const spec = editor.spec.value;
  // Vaqt diagrammasi butun takt tarixini qayta o'tadi (999 taktgacha) — faqat sxema yoki tarix o'zgarganda.
  const compiled = editor.compiled.value;
  const history = editor.history.value;
  const row = editor.row.value;
  const steps = useMemo(() => (hasDff ? traceSteps(compiled, [...history, row]) : []), [hasDff, compiled, history, row]);
  const resize = (di: number, dout: number) => {
    const ins = Math.min(5, Math.max(1, spec.inputs.length + di));
    const outs = Math.min(4, Math.max(1, spec.outputs.length + dout));
    if (ins !== spec.inputs.length || outs !== spec.outputs.length) {
      editor.setSpec(specFor(ins, outs));
      editor.fit();
    }
  };

  return (
    <div class="screen play sandbox">
      <TopBar title={t.sandbox.title} onBack={() => go('')}>
        <button class="icon-btn" onClick={() => (formulaOpen.value = '')} aria-label={t.formula.button} title={t.formula.button}>
          <Icon name="formula" />
        </button>
        <button class="icon-btn" onClick={() => editor.undo()} disabled={!editor.canUndo.value} aria-label={t.play.undo} title={t.play.undo}>
          <Icon name="undo" />
        </button>
        <button class="icon-btn" onClick={() => editor.redo()} disabled={!editor.canRedo.value} aria-label={t.play.redo} title={t.play.redo}>
          <Icon name="redo" />
        </button>
        <button class="icon-btn" onClick={async () => (await askClear()) && editor.clear()} aria-label={t.play.clear} title={t.play.clear}>
          <Icon name="trash" />
        </button>
      </TopBar>
      <div class="play-body">
        <div class="stage">
          <Board editor={editor} />
          <ViewTools />
          <ZoomTools editor={editor} />
          {hasDff && <ClockTools editor={editor} />}
        </div>
        <aside class={`side${showSide.value ? ' open' : ''}`}>
          <section class="task">
            <p class="muted">{t.sandbox.text}</p>
            <Stepper label={t.sandbox.inputs} value={spec.inputs.length} onDec={() => resize(-1, 0)} onInc={() => resize(1, 0)} />
            <Stepper label={t.sandbox.outputs} value={spec.outputs.length} onDec={() => resize(0, -1)} onInc={() => resize(0, 1)} />
            <button class="btn small formula-btn" onClick={() => (formulaOpen.value = '')}>
              <Icon name="formula" /> {t.formula.button}
            </button>
          </section>
          <TruthTable
            inputs={spec.inputs}
            outputs={spec.outputs}
            rows={editor.table.value}
            current={editor.row.value}
            onRow={(r) => editor.setRow(r)}
          />
          {hasDff && (
            <Timeline
              title={t.play.yourRun}
              inputs={spec.inputs}
              outputs={spec.outputs}
              steps={steps}
              now
              note={history.length ? undefined : t.play.liveHint}
            />
          )}
          <Formula editor={editor} outputs={spec.outputs} />
          <GateList gates={ALL_GATE_TYPES} />
          <button class="btn ghost small side-close" onClick={() => (showSide.value = false)}>
            {t.close}
          </button>
        </aside>
      </div>
      <div class="play-bottom">
        <Palette editor={editor} gates={ALL_GATE_TYPES} />
        <div class="actions">
          <button class="btn table-toggle" onClick={() => (showSide.value = !showSide.value)}>
            <Icon name="table" /> {t.play.table}
          </button>
          <button class="btn primary" onClick={() => (creating.value = true)}>
            <Icon name="share" /> {t.custom.create}
          </button>
        </div>
      </div>
      {creating.value && <CreateModal editor={editor} onClose={() => (creating.value = false)} />}
      {formulaOpen.value !== null && (
        <FormulaModal editor={editor} initial={formulaOpen.value} onClose={() => (formulaOpen.value = null)} />
      )}
    </div>
  );
}

function formulaError(e: BuildError): string {
  const f = t.formula.errors;
  switch (e.code) {
    case 'char':
    case 'unexpected':
      return f[e.code](e.pos + 1);
    case 'long':
      return f.long;
    case 'const':
      return f.const(e.value);
    default:
      return f[e.code];
  }
}

// Kirishlar A–E (formula-build.ts) — hammasi tugmada.
const FORMULA_SYMBOLS = ['¬', '∧', '∨', '⊕', '(', ')', 'A', 'B', 'C', 'D', 'E'];

/** Kutilmagan xato ham ekranni yiqitmasin (masalan, juda chuqur ifoda) — oddiy xato sifatida. */
function safeBuild(src: string, spec: Spec): BuildResult {
  try {
    return buildFromFormula(src, { minInputs: spec.inputs.length, outputs: spec.outputs });
  } catch {
    return { ok: false, error: { code: 'long', pos: 0 } };
  }
}

/** Formuladan sxema: ifoda yoziladi, oldindan nechta element bo'lishi ko'rinadi, "Yig'ish" — maydonga. */
function FormulaModal({ editor, initial, onClose }: { editor: Editor; initial: string; onClose: () => void }) {
  const text = useSignal(initial);
  const input = useRef<HTMLInputElement>(null);
  const spec = editor.spec.value;
  const res = text.value.trim() ? safeBuild(text.value, spec) : null;
  const hasCircuit = editor.circuit.value.gates.length > 0 || editor.circuit.value.wires.length > 0;

  const insert = (sym: string) => {
    const el = input.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    el.setRangeText(sym, start, el.selectionEnd ?? start, 'end');
    text.value = el.value;
    el.focus();
  };

  const build = () => {
    if (!res?.ok) return;
    const v = res.value;
    editor.outX.value = Math.max(editor.outX.value, v.outX);
    // Bitta "bekor qilish" qadami: kirishlar soni va sxema birga.
    editor.replace(v.circuit, v.inputs.length !== spec.inputs.length ? specFor(v.inputs.length, spec.outputs.length) : undefined);
    editor.fit();
    showToast(t.formula.built, 'ok');
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <h2>{t.formula.title}</h2>
      <p class="muted">{t.formula.text}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          build();
        }}
      >
        <input
          ref={input}
          maxLength={MAX_LENGTH}
          class="text-input formula-input"
          type="text"
          value={text.value}
          placeholder={t.formula.placeholder}
          aria-label={t.formula.title}
          autoFocus
          autoComplete="off"
          spellcheck={false}
          autoCapitalize="characters"
          onInput={(e) => (text.value = (e.currentTarget as HTMLInputElement).value)}
        />
        <div class="formula-syms" role="group" aria-label={t.formula.symbols}>
          {FORMULA_SYMBOLS.map((s) => (
            <button key={s} type="button" class="formula-sym" onClick={() => insert(s)}>
              {s}
            </button>
          ))}
        </div>
        <p class="muted small">{t.formula.syntax}</p>
        {res && (
          <p class={res.ok ? 'small' : 'form-error'} role="status">
            {res.ok
              ? res.value.circuit.gates.length
                ? t.formula.preview(res.value.circuit.gates.length, res.value.inputs.length)
                : t.formula.wire
              : formulaError(res.error)}
          </p>
        )}
        {res?.ok && res.value.rename.length > 0 && (
          <p class="muted small">{t.formula.rename(res.value.rename.map(([a, b]) => `${a} → ${b}`).join(', '))}</p>
        )}
        {res?.ok && hasCircuit && <p class="muted small">{t.formula.replace}</p>}
        <div class="modal-actions">
          <button type="button" class="btn" onClick={onClose}>
            {t.close}
          </button>
          <button class="btn primary" disabled={!res?.ok}>
            {t.formula.build}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function createError(err: CreateError): string {
  if (err.code === 'empty') return t.custom.empty;
  if (err.code === 'too_complex') return t.custom.tooComplex;
  if (err.code === 'unconnected_output' && err.ref) return t.unconnectedOutput(err.ref);
  return t.errors[err.code];
}

/** Qum qutidagi sxemadan masala yaratib, havolasini ulashish. */
function CreateModal({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const title = useSignal('');
  const counted = useRef(false);
  const res = puzzleFromCircuit(editor.spec.value, editor.circuit.value, {
    title: title.value,
    by: profile.value?.nickname ?? '',
  });
  if (!res.ok) {
    return (
      <Modal onClose={onClose}>
        <h2>{t.custom.createTitle}</h2>
        <p>{createError(res.error)}</p>
        <div class="modal-actions">
          <button class="btn primary" onClick={onClose} autoFocus>
            {t.close}
          </button>
        </div>
      </Modal>
    );
  }
  const p = res.puzzle;
  const code = encodePuzzle(p);
  // Bir oynada necha marta ulashilsa ham, bitta masala yaratilgan hisoblanadi.
  const mark = () => {
    if (!counted.current) {
      counted.current = true;
      markCreated();
    }
  };
  return (
    <Modal onClose={onClose}>
      <h2>{t.custom.createTitle}</h2>
      <p class="muted">{p.seq ? t.custom.createTextSeq : t.custom.createText}</p>
      <input
        class="text-input"
        type="text"
        maxLength={LIMITS.title}
        placeholder={t.custom.titlePlaceholder}
        value={title.value}
        onInput={(e) => (title.value = (e.currentTarget as HTMLInputElement).value)}
        aria-label={t.custom.titlePlaceholder}
      />
      <p class="muted small">{t.custom.summary(p.inputs.length, p.outputs.length, p.goal, p.gates.join(', '))}</p>
      <div onClickCapture={mark}>
        <ShareButtons text={t.custom.shareText(p.title, p.goal)} path={`#/p/${code}`} />
      </div>
      <div class="modal-actions">
        <button class="btn" onClick={onClose}>
          {t.close}
        </button>
        <button
          class="btn primary"
          onClick={() => {
            mark();
            go(`p/${code}`);
          }}
        >
          {t.custom.try}
        </button>
      </div>
    </Modal>
  );
}

function Stepper({ label, value, onDec, onInc }: { label: string; value: number; onDec: () => void; onInc: () => void }) {
  return (
    <div class="stepper">
      <span>{label}</span>
      <button class="icon-btn" onClick={onDec} aria-label={`${label} −`}>
        <Icon name="minus" />
      </button>
      <b>{value}</b>
      <button class="icon-btn" onClick={onInc} aria-label={`${label} +`}>
        <Icon name="plus" />
      </button>
    </div>
  );
}
