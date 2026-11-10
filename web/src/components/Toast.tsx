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

/**
 * Xabarlar doim turadigan "jonli hudud" ichida: ekran o'quvchi hudud sahifada oldindan bo'lgandagina
 * undagi yangi matnni o'qiydi (xabar bilan birga paydo bo'lgan hududni ko'pincha o'tkazib yuboradi).
 */
export function Toast() {
  const t = toast.value;
  return (
    <div class="toast-region" role="status" aria-live="polite" aria-atomic="true">
      {t && (
        <div key={t.id} class={`toast toast-${t.kind}`} onClick={() => (toast.value = null)}>
          {t.text}
        </div>
      )}
    </div>
  );
}
