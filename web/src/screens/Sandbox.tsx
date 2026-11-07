import { useSignal } from '@preact/signals';
import { useMemo } from 'preact/hooks';
import { Board } from '../board/Board';
import { Editor } from '../board/editor';
import { outputColumn } from '../board/geometry';
import { GateList } from '../components/GateList';
import { Palette } from '../components/Palette';
import { TruthTable } from '../components/TruthTable';
import { Icon, TopBar } from '../components/ui';
import { t } from '../i18n';
import { go } from '../router';
import { GATE_TYPES, type Circuit, type Spec } from '../sim/types';
import { KEYS } from '../state';
import { load, saveLater } from '../storage';
import { ZoomTools } from './Workbench';
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
  gates: GATE_TYPES,
});

export function Sandbox() {
  const editor = useMemo(() => {
    const saved = load<Saved>(KEYS.sandbox, { inputs: 2, outputs: 1, circuit: { gates: [], wires: [] } });
    const ed = new Editor();
    const ins = Math.min(5, Math.max(1, saved.inputs | 0));
    const outs = Math.min(4, Math.max(1, saved.outputs | 0));
    ed.load(specFor(ins, outs), saved.circuit, outputColumn(4));
    ed.onChange = (circuit) => {
      const spec = ed.spec.value;
      saveLater(KEYS.sandbox, { inputs: spec.inputs.length, outputs: spec.outputs.length, circuit });
    };
    return ed;
  }, []);
  useEditorKeys(editor);
  const showSide = useSignal(false);

  const spec = editor.spec.value;
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
        <button class="icon-btn" onClick={() => editor.undo()} disabled={!editor.canUndo.value} aria-label={t.play.undo} title={t.play.undo}>
          <Icon name="undo" />
        </button>
        <button class="icon-btn" onClick={() => editor.redo()} disabled={!editor.canRedo.value} aria-label={t.play.redo} title={t.play.redo}>
          <Icon name="redo" />
        </button>
        <button class="icon-btn" onClick={() => confirm(t.play.clearConfirm) && editor.clear()} aria-label={t.play.clear} title={t.play.clear}>
          <Icon name="trash" />
        </button>
      </TopBar>
      <div class="play-body">
        <div class="stage">
          <Board editor={editor} />
          <ZoomTools editor={editor} />
        </div>
        <aside class={`side${showSide.value ? ' open' : ''}`}>
          <section class="task">
            <p class="muted">{t.sandbox.text}</p>
            <Stepper label={t.sandbox.inputs} value={spec.inputs.length} onDec={() => resize(-1, 0)} onInc={() => resize(1, 0)} />
            <Stepper label={t.sandbox.outputs} value={spec.outputs.length} onDec={() => resize(0, -1)} onInc={() => resize(0, 1)} />
          </section>
          <TruthTable
            inputs={spec.inputs}
            outputs={spec.outputs}
            rows={editor.table.value}
            current={editor.row.value}
            onRow={(r) => editor.setRow(r)}
          />
          <GateList gates={GATE_TYPES} />
          <button class="btn ghost small side-close" onClick={() => (showSide.value = false)}>
            {t.close}
          </button>
        </aside>
      </div>
      <div class="play-bottom">
        <Palette editor={editor} gates={GATE_TYPES} />
        <div class="actions mobile-only">
          <button class="btn table-toggle" onClick={() => (showSide.value = !showSide.value)}>
            <Icon name="table" /> {t.play.table}
          </button>
        </div>
      </div>
    </div>
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
