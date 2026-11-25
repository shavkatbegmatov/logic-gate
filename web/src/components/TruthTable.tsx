import { groupValue, pinGroups } from '../board/bus';
import { t } from '../i18n';
import { rowBits } from '../sim/sim';
import type { Spec } from '../sim/types';

interface Props {
  inputs: string[];
  outputs: string[];
  /** Sxema natijalari: rows[r][i]; null — chiqish ulanmagan. */
  rows: (number | null)[][];
  /** Kutilgan qiymatlar (darajada): target[chiqish] = "0101…". */
  target?: Record<string, string>;
  current: number;
  onRow: (r: number) => void;
  /** Shinalar: bitta ustun, qiymati — son (4 bitli shina 4 ta ustun o'rniga). */
  buses?: Spec['buses'];
}

const cell = (v: number | null) => (v === null ? '?' : String(v));

export function TruthTable({ inputs, outputs, rows, target, current, onRow, buses }: Props) {
  const n = inputs.length;
  const ins = pinGroups(inputs, buses);
  const outs = pinGroups(outputs, buses);
  // Shina ustuni: son (bitlar emas) — «one» rangi 0 dan boshqa qiymatda.
  const cls = (v: number | null, bus: boolean, base = '') => `${base}${v ? ' one' : ''}${bus ? ' num' : ''}`.trim();
  return (
    <div class="truth-wrap">
      <table class="truth">
        <thead>
          {target && (
            <tr class="truth-group">
              <th colSpan={ins.length}>{t.play.inputs}</th>
              {outs.map((o) => (
                <th key={o.name} colSpan={2} class="sep">
                  {o.name}
                </th>
              ))}
              <th />
            </tr>
          )}
          <tr>
            {ins.map((g) => (
              <th key={g.name}>{g.name}</th>
            ))}
            {outs.map((o) =>
              target ? (
                [
                  <th key={`${o.name}e`} class="sep sub">
                    {t.play.expected}
                  </th>,
                  <th key={`${o.name}g`} class="sub">
                    {t.play.got}
                  </th>,
                ]
              ) : (
                <th key={o.name} class="sep">
                  {o.name}
                </th>
              ),
            )}
            {target && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((got, r) => {
            const bits = rowBits(n, r);
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
                {ins.map((g, k) => {
                  const v = groupValue(bits, g.idx);
                  return (
                    <td key={k} class={cls(v, g.bus)}>
                      {v}
                    </td>
                  );
                })}
                {outs.map((o, i) => {
                  const gv = groupValue(got, o.idx);
                  if (!exp) {
                    return (
                      <td key={i} class={cls(gv, o.bus, 'sep')}>
                        {cell(gv)}
                      </td>
                    );
                  }
                  const ev = groupValue(exp, o.idx);
                  // Shina: biror biti hali ulanmagan bo'lsa ham, ma'lum bitlaridan biri xato — xato.
                  const miss = o.idx.some((j) => got[j] !== null && got[j] !== exp[j]);
                  return [
                    <td key={`${i}e`} class={cls(ev, o.bus, 'sep')}>
                      {ev}
                    </td>,
                    <td key={`${i}g`} class={cls(gv, o.bus, `got${miss ? ' miss' : gv === null ? '' : ' match'}`)}>
                      {cell(gv)}
                    </td>,
                  ];
                })}
                {exp && <td class="mark">{ok === null ? '' : ok ? '✓' : '✗'}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
