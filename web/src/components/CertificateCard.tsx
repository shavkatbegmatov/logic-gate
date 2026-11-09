import { certificateData } from '../certificate-data';
import { t } from '../i18n';
import { chapterLevels, chapters } from '../levels';
import { go } from '../router';
import { progress } from '../state';
import { Icon } from './ui';

/** Yutuqlar ekranidagi kirish: sertifikat holati (sertifikat ekrani alohida bo'lakda yuklanadi). */
export function CertificateCard() {
  const d = certificateData(progress.value, chapters, chapterLevels);
  return (
    <button class={`cert-card${d.unlocked ? ' open' : ''}`} onClick={() => go('certificate')}>
      <span class="ach-icon" aria-hidden="true">
        <Icon name={d.unlocked ? 'medal' : 'lock'} />
      </span>
      <span class="ach-body">
        <strong>{t.certificate.title}</strong>
        <span class="muted">
          {d.complete ? t.certificate.cardAll : d.unlocked ? t.certificate.cardSome(d.doneChapters, d.chapters.length) : t.certificate.cardLocked}
        </span>
      </span>
      <span class="cert-go" aria-hidden="true">
        →
      </span>
    </button>
  );
}
