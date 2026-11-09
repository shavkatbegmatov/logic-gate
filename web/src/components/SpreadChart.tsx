import { t } from '../i18n';
import { percent, spreadView, type Spread } from '../spread';

/** Yechimdan keyin: boshqa o'yinchilar nechta element ishlatgani va sizning o'rningiz. */
export function SpreadChart({ spread, mine }: { spread?: Spread; mine: number }) {
  const v = spreadView(spread, mine);
  if (!v) return null;
  const peak = Math.max(...v.cols.map((c) => c.count));
  return (
    <figure class="spread" aria-label={t.spread.label(v.total)}>
      <figcaption class="muted small">{t.spread.title}</figcaption>
      <div class="spread-bars">
        {v.cols.map((c) => (
          <div key={c.label} class={`spread-col${c.mine ? ' mine' : ''}`} title={t.spread.col(c.label, c.count)}>
            <span class="spread-you">{c.mine ? t.spread.you : ''}</span>
            <div class="spread-track">
              {c.count > 0 && <div class="spread-bar" style={{ height: `${Math.max(8, (c.count / peak) * 100)}%` }} />}
            </div>
            <span class="spread-x">{c.label}</span>
          </div>
        ))}
      </div>
      {v.fewer > 0 && <p class="muted small">{t.spread.fewer(percent(v.fewer, v.total))}</p>}
    </figure>
  );
}
