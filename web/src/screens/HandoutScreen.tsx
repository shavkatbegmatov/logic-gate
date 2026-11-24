import './Handout.css';
import { useSignal } from '@preact/signals';
import { classLink, teacherClasses } from '../classes';
import { QrCode } from '../components/QrCode';
import { Icon, TopBar } from '../components/ui';
import { t } from '../i18n';
import { go } from '../router';
import { inTelegram } from '../telegram';

type Mode = 'poster' | 'cards';
/** Bir varaqdagi kartochkalar: 2 × 4, har biri ~ A7. */
const CARDS = 8;

interface Sheet {
  name: string;
  code: string;
  link: string;
  host: string;
}

/**
 * O'qituvchi tarqatmasi: sinf havolasining QR-kodi bilan A4 plakat (devorga yoki proyektorga) va
 * qirqib tarqatiladigan 8 ta kartochka. O'qituvchi kaliti bu sahifada yo'q — proyektorda ko'rsatish xavfsiz.
 * Varaq ekranda ham qog'ozdagidek (yorug' «Daftar» ranglari), chop etishda — aynan A4.
 */
export function HandoutScreen({ code }: { code: string }) {
  const cls = teacherClasses.value.find((c) => c.code === code);
  const mode = useSignal<Mode>('poster');

  if (!cls) {
    return (
      <div class="screen">
        <TopBar title={t.handout.title} onBack={() => go('teacher')} />
        <div class="scroll">
          <div class="narrow">
            <div class="card">
              <p>{t.classes.noKey}</p>
              <button class="btn" onClick={() => go('teacher')}>
                {t.classes.add}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sheet: Sheet = { name: cls.name, code, link: classLink(code), host: location.host };

  return (
    <div class="screen">
      <TopBar title={t.handout.title} sub={cls.name} onBack={() => go(`teacher/${code}`)} />
      <div class="scroll">
        <div class="handout">
          <p class="muted handout-intro">{t.handout.intro}</p>
          <div class="handout-tools">
            <div class="lang-switch" role="group" aria-label={t.handout.title}>
              {(['poster', 'cards'] as const).map((m) => (
                <button key={m} class={mode.value === m ? 'on' : ''} aria-pressed={mode.value === m} onClick={() => (mode.value = m)}>
                  {m === 'poster' ? t.handout.poster : t.handout.cards}
                </button>
              ))}
            </div>
            {inTelegram ? (
              <p class="muted small">{t.handout.telegramHint}</p>
            ) : (
              <button class="btn primary" onClick={() => window.print()}>
                <Icon name="printer" /> {t.handout.print}
              </button>
            )}
          </div>
          <div class="handout-sheet" data-theme="daftar">
            {mode.value === 'poster' ? <Poster {...sheet} /> : <Cards {...sheet} />}
          </div>
        </div>
      </div>
    </div>
  );
}

const Brand = ({ class: cls }: { class: string }) => (
  <div class={cls}>
    <img src="/favicon.svg" alt="" />
    <b>{t.appName}</b>
  </div>
);

function Poster({ name, code, link, host }: Sheet) {
  return (
    <div class="poster">
      <div class="poster-top">
        <Brand class="poster-brand" />
        <span>{t.handout.game}</span>
      </div>
      <h2 class="poster-heading">{t.handout.heading}</h2>
      <div class="poster-class">{name}</div>
      <QrCode class="poster-qr" text={link} label={t.handout.qrLabel(code)} />
      <div class="poster-code">
        <span>{t.handout.code}</span>
        <b>{code}</b>
      </div>
      <div class="poster-url">{link.replace(/^https?:\/\//, '')}</div>
      <ol class="poster-steps">
        {t.handout.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <p class="poster-noqr">{t.handout.noQr(host)}</p>
    </div>
  );
}

function Cards({ name, code, link, host }: Sheet) {
  return (
    <div class="slips">
      {Array.from({ length: CARDS }, (_, i) => (
        // Ekran o'quvchisiga bitta kartochka yetadi — qolganlari nusxa.
        <div key={i} class="slip" aria-hidden={i > 0 ? 'true' : undefined}>
          <div class="slip-side">
            <QrCode class="slip-qr" text={link} label={t.handout.qrLabel(code)} />
            <Brand class="slip-brand" />
          </div>
          <div class="slip-text">
            <div class="slip-class">{name}</div>
            <div class="slip-code">
              <span>{t.handout.code}</span>
              <b>{code}</b>
            </div>
            <p>{t.handout.cardText}</p>
            <div class="slip-host">{host}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
