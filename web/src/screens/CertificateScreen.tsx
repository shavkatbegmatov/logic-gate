import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { CERT_H, CERT_W, certificateData, drawCertificate, loadCertFonts, type CertData, type CertLabels } from '../certificate';
import { Icon, TopBar } from '../components/ui';
import { dayLabel, todaySig } from '../daily';
import { lang, t } from '../i18n';
import { chapterLevels, chapters } from '../levels';
import { go } from '../router';
import { profile, progress } from '../state';
import { load, save } from '../storage';
import { inTelegram } from '../telegram';

/** Sertifikatdagi ism — faqat shu qurilmada (taxallus emas, haqiqiy ism yozilishi mumkin). */
const NAME_KEY = 'lg.certName.v1';
const MAX_NAME = 40;

function labels(d: CertData): CertLabels {
  const c = t.certificate;
  const year = new Date(todaySig.value * 86400000).getUTCFullYear();
  return {
    title: c.title,
    given: c.given,
    reason: d.complete ? c.reasonAll(d.total) : c.reasonSome(d.doneChapters, d.chapters.length),
    stats: c.stats(d.stars, d.maxStars, d.solved, d.total),
    date: `${dayLabel(todaySig.value)} ${year}`,
    site: location.host,
  };
}

/** Sertifikat: ism, tugatilgan bo'limlar, yulduzlar; PNG, ulashish, chop etish. */
export function CertificateScreen() {
  const data = certificateData(progress.value, chapters, chapterLevels);
  const name = useSignal<string>(load<string>(NAME_KEY, '') || profile.value?.nickname || '');
  const fonts = useSignal(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadCertFonts().then(() => (fonts.value = true));
  }, []);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!fonts.value || !data.unlocked || !ctx) return;
    drawCertificate(ctx, data, name.value.trim() || t.certificate.anon, labels(data));
  }, [fonts.value, name.value, lang.value, data.solved, data.stars, data.unlocked]);

  // toBlob hech narsa qaytarmaydi — natija faqat callback'da keladi.
  const blob = () =>
    new Promise<Blob | null>((ok) => {
      const c = canvas.current;
      if (c) c.toBlob(ok, 'image/png');
      else ok(null);
    });

  const download = async () => {
    const b = await blob();
    if (!b) return;
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url;
    a.download = t.certificate.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const shareFile = () => new File([], t.certificate.fileName, { type: 'image/png' });
  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [shareFile()] });
  const share = async () => {
    const b = await blob();
    if (!b) return;
    try {
      await navigator.share({ files: [new File([b], t.certificate.fileName, { type: 'image/png' })], text: t.certificate.shareText });
    } catch {
      // bekor qilindi
    }
  };

  // Eng ko'p yechilgan, lekin tugamagan bo'lim — "nima qolgan" ko'rsatish uchun.
  const next = data.chapters
    .map((c) => {
      const lv = chapterLevels(chapters[c.n - 1].id);
      return { c, solved: lv.filter((l) => progress.value[l.id]).length, total: lv.length };
    })
    .filter((x) => !x.c.done)
    .sort((a, b) => b.solved / b.total - a.solved / a.total)[0];

  return (
    <div class="screen cert-screen">
      <TopBar title={t.certificate.title} onBack={() => go('achievements')} />
      <div class="scroll">
        <div class="cert">
          {!data.unlocked ? (
            <section class="card cert-locked">
              <p>
                <Icon name="lock" /> {t.certificate.locked}
              </p>
              {next && <p class="muted">{t.certificate.lockedProgress(next.solved, next.total, next.c.title)}</p>}
              <button class="btn primary" onClick={() => go('levels')}>
                {t.home.levels}
              </button>
            </section>
          ) : (
            <>
              <label class="cert-form">
                <span class="field-label">{t.certificate.nameLabel}</span>
                <input
                  type="text"
                  maxLength={MAX_NAME}
                  placeholder={t.certificate.namePlaceholder}
                  value={name.value}
                  onInput={(e) => {
                    name.value = (e.currentTarget as HTMLInputElement).value;
                    save(NAME_KEY, name.value.trim() || null);
                  }}
                />
              </label>
              <canvas ref={canvas} width={CERT_W} height={CERT_H} role="img" aria-label={t.certificate.title} />
              {inTelegram ? (
                <p class="muted small cert-hint">{t.certificate.telegramHint}</p>
              ) : (
                <div class="cert-actions">
                  <button class="btn primary" onClick={download}>
                    <Icon name="download" /> {t.certificate.download}
                  </button>
                  {canShare && (
                    <button class="btn" onClick={share}>
                      <Icon name="share" /> {t.certificate.share}
                    </button>
                  )}
                  <button class="btn" onClick={() => window.print()}>
                    <Icon name="printer" /> {t.certificate.print}
                  </button>
                </div>
              )}
              {!data.complete && <p class="muted small">{t.certificate.more}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
