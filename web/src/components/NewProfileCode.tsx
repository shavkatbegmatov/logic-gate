import { useRef } from 'preact/hooks';
import { copyText, selectContents } from '../clipboard';
import { t } from '../i18n';
import { newProfileCode } from '../sync';
import { showToast } from './Toast';
import { Icon, Modal } from './ui';

/**
 * Profil ochilgan zahoti — tiklash kodi. Maktabda o'quvchi har darsda boshqa kompyuterga o'tirishi
 * mumkin: kod faqat Sozlamalarda tursa, uni hech kim ko'rmaydi va profil yo'qoladi.
 */
export function NewProfileCode() {
  const ref = useRef<HTMLElement>(null);
  const code = newProfileCode.value;
  if (!code) return null;
  const close = () => (newProfileCode.value = null);
  const copy = async () => {
    if (await copyText(code)) {
      showToast(t.settings.copied, 'ok');
    } else if (ref.current) {
      selectContents(ref.current);
      showToast(t.settings.copyManual, 'info');
    }
  };
  return (
    <Modal onClose={close}>
      <h2>{t.profileCode.title}</h2>
      <p>{t.profileCode.text}</p>
      <div class="code-box">
        <code ref={ref}>{code}</code>
        <button class="icon-btn" onClick={copy} title={t.settings.copy} aria-label={t.settings.copy}>
          <Icon name="copy" />
        </button>
      </div>
      <p class="muted small">{t.profileCode.hint}</p>
      <div class="modal-actions">
        <button class="btn primary" onClick={close}>
          {t.profileCode.ok}
        </button>
      </div>
    </Modal>
  );
}
