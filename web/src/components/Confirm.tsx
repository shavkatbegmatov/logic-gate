import { signal } from '@preact/signals';
import { t } from '../i18n';
import { Icon, type IconName, Modal } from './ui';

export interface ConfirmOptions {
  /** Oyna sarlavhasi — amalning nomi. */
  title: string;
  /** Asosiy savol yoki oqibat. */
  text?: string;
  /** Qo'shimcha izoh (xira, kichik harfda). */
  note?: string;
  /** Tasdiqlash tugmasidagi yozuv. */
  ok: string;
  /** Qaytarib bo'lmaydigan yoki ma'lumot o'chiradigan amal: qizil tugma, fokus «Bekor qilish» da. */
  danger?: boolean;
  icon?: IconName;
}

interface Pending extends ConfirmOptions {
  id: number;
  resolve: (yes: boolean) => void;
}

const pending = signal<Pending | null>(null);
let seq = 0;

/**
 * Brauzerning confirm() oynasi o'rniga — o'yin uslubidagi tasdiqlash oynasi (barcha mavzularda bir xil,
 * Telegram ichida ham ishlaydi). `true` — tasdiqlandi; yopilsa, Esc yoki boshqa ekranga o'tilsa — `false`.
 */
export function askConfirm(opts: ConfirmOptions): Promise<boolean> {
  // Ikkinchi savol birinchisining o'rnini egallaydi: birinchisiga «yo'q» javobi.
  pending.peek()?.resolve(false);
  return new Promise((resolve) => {
    pending.value = { ...opts, id: ++seq, resolve };
  });
}

/** Maydonni tozalash (daraja va qum qutisi) — amalni ↶ bilan qaytarish mumkin. */
export const askClear = () =>
  askConfirm({ title: t.play.clearTitle, text: t.play.clearConfirm, note: t.play.clearUndo, ok: t.play.clear, danger: true, icon: 'trash' });

function answer(yes: boolean) {
  const p = pending.peek();
  if (!p) return;
  pending.value = null;
  p.resolve(yes);
}

/** Ochiq savolni «yo'q» javobi bilan yopadi (app.tsx: boshqa ekranga o'tilganda). */
export const cancelConfirm = () => answer(false);

/** Ilovada bitta (app.tsx): ochiq savolni chizadi. */
export function ConfirmHost() {
  const p = pending.value;
  if (!p) return null;
  return (
    <Modal key={p.id} class="confirm" onClose={() => answer(false)}>
      <div class={`confirm-icon${p.danger ? ' danger' : ''}`} aria-hidden="true">
        <Icon name={p.icon ?? 'hint'} />
      </div>
      <h2 class="confirm-title">{p.title}</h2>
      {p.text && <p class="confirm-text">{p.text}</p>}
      {p.note && <p class="muted small">{p.note}</p>}
      <div class="modal-actions confirm-actions">
        <button class="btn" onClick={() => answer(false)} autoFocus={p.danger}>
          {t.cancel}
        </button>
        <button class={p.danger ? 'btn danger solid' : 'btn primary'} onClick={() => answer(true)} autoFocus={!p.danger}>
          {p.ok}
        </button>
      </div>
    </Modal>
  );
}
