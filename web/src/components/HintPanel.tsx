import { useSignal } from '@preact/signals';
import type { Editor } from '../board/editor';
import { hasGate, hintSteps } from '../hints';
import { t } from '../i18n';
import type { Level } from '../sim/types';
import { hintStep, setHintStep } from '../state';
import { Icon } from './ui';

/**
 * Bosqichli maslahat: har bosishda bitta keyingi ishora ochiladi. Ochilganlari saqlanadi —
 * darajaga qaytganda ham ko'rinib turadi.
 */
export function HintPanel({ level, editor, onPlaced }: { level: Level; editor: Editor; onPlaced?: () => void }) {
  const steps = hintSteps(level);
  const shown = useSignal(Math.min(hintStep(level.id), steps.length));
  if (!steps.length) return null;

  const reveal = () => {
    shown.value = Math.min(shown.value + 1, steps.length);
    setHintStep(level.id, shown.value);
  };

  const circuit = editor.circuit.value;
  const busy = editor.busy.value;

  return (
    <div class="hints">
      {steps.slice(0, shown.value).map((s, i) => (
        <div key={i} class="hint">
          <p>{s.text}</p>
          {s.kind === 'place' &&
            (hasGate(circuit, s.type, s.sources) ? (
              <span class="hint-done">✓ {t.hints.placed}</span>
            ) : (
              <button
                class="btn small"
                disabled={busy}
                onClick={() => {
                  editor.placeGate(s.type, s.sources);
                  if (!editor.viewTouched) editor.fit();
                  onPlaced?.();
                }}
              >
                {t.hints.place}
              </button>
            ))}
        </div>
      ))}
      {shown.value < steps.length && (
        <button class="btn ghost small" onClick={reveal}>
          <Icon name="hint" /> {shown.value === 0 ? t.hints.show : t.hints.next(shown.value + 1, steps.length)}
        </button>
      )}
    </div>
  );
}
