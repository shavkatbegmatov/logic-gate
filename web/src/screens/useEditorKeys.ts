import { useEffect, useRef } from 'preact/hooks';
import type { Editor } from '../board/editor';

/**
 * Klaviatura: Delete — o'chirish, Ctrl+Z / Ctrl+Y — bekor qilish / qaytarish, Esc — tanlovni olib tashlash,
 * T — takt (xotirali sxemada).
 */
export function useEditorKeys(editor: Editor, opts: { clock?: boolean } = {}) {
  const clock = useRef(false);
  clock.current = !!opts.clock;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea, [role="dialog"], [role="alertdialog"]')) return;
      if (editor.busy.value) return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (editor.selection.value) {
          e.preventDefault();
          editor.removeSelection();
        }
      } else if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) editor.redo();
        else editor.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        editor.redo();
      } else if (e.key === 'Escape') {
        editor.selection.value = null;
        editor.pending.value = null;
      } else if (e.code === 'KeyT' && !mod && !e.altKey && !e.repeat && clock.current) {
        e.preventDefault();
        editor.tick();
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [editor]);
}
