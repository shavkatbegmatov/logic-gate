import { useEffect } from 'preact/hooks';
import type { Editor } from '../board/editor';

/** Klaviatura: Delete — o'chirish, Ctrl+Z / Ctrl+Y — bekor qilish / qaytarish, Esc — tanlovni olib tashlash. */
export function useEditorKeys(editor: Editor) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea, [role="dialog"]')) return;
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
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [editor]);
}
