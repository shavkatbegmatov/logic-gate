import { t } from '../i18n';
import { lostProfile } from '../sync';
import { JoinForm } from './JoinForm';
import { Modal } from './ui';

/**
 * Qurilmadagi profil serverda yo'q (masalan, dublikat sifatida o'chirilgan). Natijalar qurilmada qolgan:
 * o'quvchi asosiy profilining kodi bilan kiradi (natijalar unga qo'shiladi) yoki yangi profil ochadi.
 * Yopilsa — profilsiz o'ynashda davom etadi (Sozlamalarda keyin kirsa bo'ladi).
 */
export function LostProfile() {
  const nickname = lostProfile.value;
  if (!nickname) return null;
  const close = () => (lostProfile.value = null);
  return (
    <Modal onClose={close} class="lost-profile">
      <h2>{t.lostProfile.title}</h2>
      <p>{t.lostProfile.text(nickname)}</p>
      <JoinForm compact startWithCode nickname={nickname} codeHint={t.lostProfile.codeHint} hint={t.lostProfile.newHint} onJoined={close} />
      <div class="modal-actions">
        <button class="btn" onClick={close}>
          {t.lostProfile.later}
        </button>
      </div>
    </Modal>
  );
}
