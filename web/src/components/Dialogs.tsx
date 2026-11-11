// Brauzer oynalari (confirm, prompt) o'rniga — o'yin uslubidagi oynalar: barcha mavzularda bir xil,
// tugmalari o'yin tilida, Telegram ichida ham ishlaydi. Ilovada bitta ConfirmHost (app.tsx) chizadi.
import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
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

type Dialog = ({ kind: 'confirm' } & ConfirmOptions) | { kind: 'copy'; text: string };
type Pending = Dialog & { id: number; resolve: (yes: boolean) => void };

const pending = signal<Pending | null>(null);
let seq = 0;

function open(dialog: Dialog): Promise<boolean> {
  // Ikkinchi oyna birinchisining o'rnini egallaydi: birinchisiga «yo'q» javobi.
  pending.peek()?.resolve(false);
  return new Promise((resolve) => {
    pending.value = { ...dialog, id: ++seq, resolve };
  });
}

function answer(yes: boolean) {
  const p = pending.peek();
  if (!p) return;
  pending.value = null;
  p.resolve(yes);
}

/**
 * Brauzerning confirm() oynasi o'rniga. `true` — tasdiqlandi; yopilsa, Esc yoki boshqa ekranga
 * o'tilsa — `false`.
 */
export const askConfirm = (opts: ConfirmOptions) => open({ kind: 'confirm', ...opts });

/** Maydonni tozalash (daraja va qum qutisi) — amalni ↶ bilan qaytarish mumkin. */
export const askClear = () =>
  askConfirm({ title: t.play.clearTitle, text: t.play.clearConfirm, note: t.play.clearUndo, ok: t.play.clear, danger: true, icon: 'trash' });

/**
 * Avtomatik nusxalab bo'lmaganda (window.prompt o'rniga): matn belgilangan holda ko'rsatiladi,
 * o'yinchi uni o'zi nusxalaydi. Boshqa oyna ustida ham ochiladi (masalan, natija oynasidagi «Ulashish»).
 */
export const showCopy = (text: string) => void open({ kind: 'copy', text });

/** Ochiq oynani «yo'q» javobi bilan yopadi (app.tsx: boshqa ekranga o'tilganda). */
export const cancelConfirm = () => answer(false);

/**
 * Butun matn belgilangan holda: oyna ochilganda (focus hodisasini kutmasdan — brauzer oynasi fokusda
 * bo'lmasa u kelmaydi) va qayta fokusga kelganda.
 */
function CopyArea({ text }: { text: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <textarea
      ref={ref}
      class="copy-area"
      readOnly
      // Qatorlar o'raladi (~40 belgi oyna kengligida) — ko'pi bilan 8, qolgani ichida suriladi.
      rows={Math.min(8, text.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 40)), 0))}
      value={text}
      aria-label={t.share.copy}
      onFocus={(e) => e.currentTarget.select()}
    />
  );
}

export function ConfirmHost() {
  const p = pending.value;
  if (!p) return null;
  const no = () => answer(false);
  if (p.kind === 'copy') {
    return (
      <Modal key={p.id} class="confirm" onClose={no}>
        <div class="confirm-icon" aria-hidden="true">
          <Icon name="copy" />
        </div>
        <h2 class="confirm-title">{t.share.copy}</h2>
        <p class="confirm-text">{t.share.copyManual}</p>
        <CopyArea text={p.text} />
        <div class="modal-actions confirm-actions">
          <button class="btn" onClick={no}>
            {t.close}
          </button>
        </div>
      </Modal>
    );
  }
  return (
    <Modal key={p.id} class="confirm" onClose={no}>
      <div class={`confirm-icon${p.danger ? ' danger' : ''}`} aria-hidden="true">
        <Icon name={p.icon ?? 'hint'} />
      </div>
      <h2 class="confirm-title">{p.title}</h2>
      {p.text && <p class="confirm-text">{p.text}</p>}
      {p.note && <p class="muted small">{p.note}</p>}
      <div class="modal-actions confirm-actions">
        <button class="btn" onClick={no} autoFocus={p.danger}>
          {t.cancel}
        </button>
        <button class={p.danger ? 'btn danger solid' : 'btn primary'} onClick={() => answer(true)} autoFocus={!p.danger}>
          {p.ok}
        </button>
      </div>
    </Modal>
  );
}
