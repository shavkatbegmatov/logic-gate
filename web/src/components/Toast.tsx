import { signal } from '@preact/signals';

interface ToastData {
  text: string;
  kind: 'info' | 'error' | 'ok';
  id: number;
}

const toast = signal<ToastData | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

export function showToast(text: string, kind: ToastData['kind'] = 'info', ms = 3200) {
  clearTimeout(timer);
  toast.value = { text, kind, id: Date.now() };
  timer = setTimeout(() => (toast.value = null), ms);
}

export function Toast() {
  const t = toast.value;
  if (!t) return null;
  return (
    <div key={t.id} class={`toast toast-${t.kind}`} role="status" onClick={() => (toast.value = null)}>
      {t.text}
    </div>
  );
}
