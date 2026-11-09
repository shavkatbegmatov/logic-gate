import { useEffect } from 'preact/hooks';
import { CHANGELOG } from '../changelog';
import { TopBar } from '../components/ui';
import { lang, t } from '../i18n';
import { go } from '../router';
import { APP_VERSION, markNewsSeen } from '../version';

/** "YYYY-MM-DD" → "9-noyabr 2026" / "9 ноября 2026". */
function dateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${t.daily.date(d, m - 1)} ${y}`;
}

/** Yangiliklar: versiyalar va ulardagi o'zgarishlar, sodda tilda. */
export function NewsScreen() {
  useEffect(() => markNewsSeen(), []);
  const l = lang.value === 'ru' ? 'ru' : 'uz';
  return (
    <div class="screen">
      <TopBar title={t.news.title} sub={t.settings.version(APP_VERSION)} onBack={() => go('')} />
      <div class="scroll">
        <div class="narrow news">
          {CHANGELOG.map((r) => (
            <section key={r.version} class={`card release${r.version === APP_VERSION ? ' current' : ''}`}>
              <header>
                <h2>{t.news.version(r.version)}</h2>
                <span class="muted small">{dateLabel(r.date)}</span>
                {r.version === APP_VERSION && <span class="badge">{t.news.current}</span>}
              </header>
              <ul>
                {r[l].map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
