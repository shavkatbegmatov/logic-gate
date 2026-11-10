import { t } from '../i18n';
import { rowBits } from '../sim/sim';

interface Props {
  inputs: string[];
  outputs: string[];
  /** Sxema natijalari: rows[r][i]; null — chiqish ulanmagan. */
  rows: (number | null)[][];
  /** Kutilgan qiymatlar (darajada): target[chiqish] = "0101…". */
  target?: Record<string, string>;
  current: number;
  onRow: (r: number) => void;
}

const cell = (v: number | null) => (v === null ? '?' : String(v));

export function TruthTable({ inputs, outputs, rows, target, current, onRow }: Props) {
  const n = inputs.length;
  return (
    <div class="truth-wrap">
      <table class="truth">
        <thead>
          {target && (
            <tr class="truth-group">
              <th colSpan={n}>{t.play.inputs}</th>
              {outputs.map((o) => (
                <th key={o} colSpan={2} class="sep">
                  {o}
                </th>
              ))}
              <th />
            </tr>
          )}
          <tr>
            {inputs.map((name) => (
              <th key={name}>{name}</th>
            ))}
            {outputs.map((o) =>
              target ? (
                [
                  <th key={`${o}e`} class="sep sub">
                    {t.play.expected}
                  </th>,
                  <th key={`${o}g`} class="sub">
                    {t.play.got}
                  </th>,
                ]
              ) : (
                <th key={o} class="sep">
                  {o}
                </th>
              ),
            )}
            {target && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((got, r) => {
            const exp = target ? outputs.map((o) => Number(target[o][r])) : null;
            // Chiqish hali ulanmagan bo'lsa — qator neytral (o'yin boshida hammasi qizil bo'lmasin);
            // ma'lum qiymatlardan biri noto'g'ri bo'lsa — xato.
            const ok = !exp
              ? null
              : exp.some((v, i) => got[i] !== null && got[i] !== v)
                ? false
                : got.every((g) => g !== null)
                  ? true
                  : null;
            return (
              <tr
                key={r}
                class={`${r === current ? 'cur' : ''}${ok === true ? ' ok' : ok === false ? ' bad' : ''}`}
                onClick={() => onRow(r)}
                // Klaviatura: Tab bilan qatorga, Enter/Probel — shu qator kirishlari maydonga qo'yiladi.
                tabIndex={0}
                aria-current={r === current ? 'true' : undefined}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    e.preventDefault();
                    onRow(r);
                  }
                }}
              >
                {rowBits(n, r).map((b, k) => (
                  <td key={k} class={b ? 'one' : ''}>
                    {b}
                  </td>
                ))}
                {outputs.map((_, i) =>
                  exp ? (
                    [
                      <td key={`${i}e`} class={`sep${exp[i] ? ' one' : ''}`}>
                        {exp[i]}
                      </td>,
                      <td
                        key={`${i}g`}
                        class={`got${got[i] === null ? '' : got[i] === exp[i] ? ' match' : ' miss'}${got[i] ? ' one' : ''}`}
                      >
                        {cell(got[i])}
                      </td>,
                    ]
                  ) : (
                    <td key={i} class={`sep${got[i] ? ' one' : ''}`}>
                      {cell(got[i])}
                    </td>
                  ),
                )}
                {exp && <td class="mark">{ok === null ? '' : ok ? '✓' : '✗'}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
