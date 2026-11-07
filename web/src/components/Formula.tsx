import { useMemo } from 'preact/hooks';
import type { Editor } from '../board/editor';
import { t } from '../i18n';
import { formulaLines } from '../sim/formula';

/** Yig'ilgan sxemaning Bul formulasi — har o'zgarishda yangilanadi (element sudralganda emas). */
export function Formula({ editor, outputs }: { editor: Editor; outputs: string[] }) {
  const topology = editor.topology.value;
  const lines = useMemo(() => formulaLines(editor.circuit.peek(), outputs), [topology, outputs.join()]);
  const empty = editor.circuit.peek().wires.length === 0;
  const notes = [t.play.formulaLegend];
  if (lines.some((l) => l.kind === 'tmp')) notes.push(t.play.formulaTmp);
  if (lines.some((l) => l.kind === 'next')) notes.push(t.play.formulaNext);
  return (
    <section class="formula">
      <h2>{t.play.formula}</h2>
      {empty ? (
        <p class="muted small">{t.play.formulaEmpty}</p>
      ) : (
        <>
          <div class="formula-lines">
            {lines.map((l) => (
              <div key={l.name} class={`f-line ${l.kind}`}>
                <span class="f-name">{l.name}</span>
                <span class="f-eq">=</span>
                <span class="f-expr">{l.expr}</span>
              </div>
            ))}
          </div>
          <p class="muted small formula-notes">{notes.join(' · ')}</p>
        </>
      )}
    </section>
  );
}
