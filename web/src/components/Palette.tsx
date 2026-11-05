import { useSignal } from '@preact/signals';
import { useRef } from 'preact/hooks';
import { capture } from '../board/Board';
import type { Editor } from '../board/editor';
import { GateIcon } from '../board/GateShape';
import { t } from '../i18n';
import type { GateType } from '../sim/types';

interface Props {
  editor: Editor;
  gates: GateType[];
}

/** Elementlar palitrasi: bosilsa — ko'rinish markaziga, sudralsa — tashlangan joyga qo'shiladi. */
export function Palette({ editor, gates }: Props) {
  const ghost = useSignal<{ type: GateType; x: number; y: number } | null>(null);
  const start = useRef<{ type: GateType; x: number; y: number; moved: boolean } | null>(null);

  const onDown = (type: GateType) => (e: PointerEvent) => {
    capture(e.currentTarget as Element, e.pointerId);
    start.current = { type, x: e.clientX, y: e.clientY, moved: false };
  };

  const onMove = (e: PointerEvent) => {
    const s = start.current;
    if (!s) return;
    if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) s.moved = true;
    if (s.moved) ghost.value = { type: s.type, x: e.clientX, y: e.clientY };
  };

  const onUp = (e: PointerEvent) => {
    const s = start.current;
    start.current = null;
    ghost.value = null;
    if (!s || e.type !== 'pointerup') return;
    if (!s.moved) {
      editor.addGateAtCenter(s.type);
      return;
    }
    const r = editor.el?.getBoundingClientRect();
    if (r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
      const w = editor.toWorld(e.clientX - r.left, e.clientY - r.top);
      editor.addGate(s.type, w.x, w.y);
    }
  };

  return (
    <div class="palette" role="toolbar" aria-label={t.play.allowed}>
      {gates.map((type) => (
        <button
          key={type}
          class="palette-item"
          title={`${type} — ${t.gates[type].name}: ${t.gates[type].text}`}
          onPointerDown={onDown(type)}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              editor.addGateAtCenter(type);
            }
          }}
        >
          <GateIcon type={type} size={44} />
          <span class="palette-name">{type}</span>
          <span class="palette-sub">{t.gates[type].name}</span>
        </button>
      ))}
      {ghost.value && (
        <div class="palette-ghost" style={{ left: `${ghost.value.x}px`, top: `${ghost.value.y}px` }}>
          <GateIcon type={ghost.value.type} size={72} />
        </div>
      )}
    </div>
  );
}
