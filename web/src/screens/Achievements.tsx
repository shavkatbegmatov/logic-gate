import { states } from '../achievements';
import { Icon, TopBar } from '../components/ui';
import { t } from '../i18n';
import { go } from '../router';

export function Achievements() {
  const list = states.value;
  const done = list.filter((s) => s.done).length;
  return (
    <div class="screen">
      <TopBar title={t.achievements.title} sub={t.achievements.summary(done, list.length)} onBack={() => go('')} />
      <div class="scroll">
        <div class="achievements">
          {list.map(({ a, n, max, done }) => (
            <div key={a.id} class={`achievement${done ? ' done' : ''}`}>
              <span class="ach-icon" aria-hidden="true">
                <Icon name={a.icon} />
              </span>
              <div class="ach-body">
                <strong>{a.title()}</strong>
                <span class="muted">{a.text()}</span>
                {!done && max > 1 && (
                  <span class="ach-progress" role="progressbar" aria-valuenow={n} aria-valuemax={max}>
                    <i style={{ width: `${(n / max) * 100}%` }} />
                    <b>
                      {n}/{max}
                    </b>
                  </span>
                )}
              </div>
              {done && <span class="ach-check">✓</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
