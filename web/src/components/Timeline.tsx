import { useEffect, useRef } from 'preact/hooks';
import { t } from '../i18n';
import { evaluate, machineOut, nextState, rowBits, type Compiled, type State } from '../sim/sim';
import type { Machine } from '../sim/types';

/** Vaqt diagrammasidagi bitta takt: kirishlar qatori, sxema chiqishlari va kutilgan chiqishlar. */
export interface Step {
  row: number;
  got?: (number | null)[];
  exp?: number[];
}

/**
 * Qatorlar ketma-ketligini boshlang'ich holatdan sxema (va avtomat, bo'lsa) orqali o'tkazadi:
 * har taktdagi chiqishlar. Oxirgi qadam — joriy (hali takt bosilmagan) holat.
 */
export function traceSteps(c: Compiled | null, rows: number[], m?: Machine): Step[] {
  const n = c?.spec.inputs.length ?? 0;
  let state: State = new Map();
  let s = 0;
  return rows.map((row) => {
    const step: Step = { row };
    if (c) {
      const ev = evaluate(c, rowBits(n, row), state);
      step.got = ev.outputs;
      state = nextState(c, ev.values);
    }
    if (m) {
      step.exp = machineOut(m, s, row);
      s = m.next[s][row];
    }
    return step;
  });
}

/** Ko'pi bilan shuncha takt ko'rsatiladi (oxirgilari). */
const SHOWN = 12;

/**
 * Vaqt diagrammasi: ustunlar — taktlar, qatorlar — kirishlar va chiqishlar. Kutilgan va sxemadagi
 * qiymatlar bo'lsa, ikkalasi ham ko'rsatiladi, farq qizil.
 */
export function Timeline({ title, inputs, outputs, steps, now, note }: {
  title: string;
  inputs: string[];
  outputs: string[];
  steps: Step[];
  /** Oxirgi ustun — joriy (takt hali bosilmagan) holat. */
  now?: boolean;
  note?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const offset = Math.max(0, steps.length - SHOWN);
  const shown = steps.slice(offset);
  const hasGot = shown.some((s) => s.got);
  const hasExp = shown.some((s) => s.exp);
  const n = inputs.length;

  // Yangi takt qo'shilganda oxirgi ustun ko'rinib tursin.
  useEffect(() => {
    const el = wrap.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [steps.length]);

  const cell = (v: number | null | undefined, cls = '') => (
    <td class={`${cls}${v ? ' one' : ''}`}>{v === null || v === undefined ? '?' : v}</td>
  );

  return (
    <section class="timeline">
      <h2>{title}</h2>
      <div class="timeline-wrap" ref={wrap}>
        <table class="wave">
          <thead>
            <tr>
              <th />
              {shown.map((_, i) => {
                const last = now && i === shown.length - 1;
                return (
                  <th key={i} class={last ? 'now' : ''} title={t.play.stepLabel(offset + i)}>
                    {last ? t.play.now : offset + i + 1}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {inputs.map((name, k) => (
              <tr key={name} class="wave-in">
                <th>{name}</th>
                {shown.map((s, i) => cell(rowBits(n, s.row)[k], now && i === shown.length - 1 ? 'now' : ''))}
              </tr>
            ))}
            {outputs.map((name, j) => [
              hasExp && (
                <tr key={`${name}e`} class="wave-exp sep">
                  <th>
                    {name}
                    {hasGot && <small> {t.play.expected.toLowerCase()}</small>}
                  </th>
                  {shown.map((s, i) => cell(s.exp?.[j], now && i === shown.length - 1 ? 'now' : ''))}
                </tr>
              ),
              hasGot && (
                <tr key={`${name}g`} class={`wave-got${hasExp ? '' : ' sep'}`}>
                  <th>
                    {name}
                    {hasExp && <small> {t.play.got.toLowerCase()}</small>}
                  </th>
                  {shown.map((s, i) => {
                    const v = s.got?.[j];
                    const e = s.exp?.[j];
                    const state = e === undefined || v === null || v === undefined ? '' : v === e ? 'match' : 'miss';
                    return cell(v, `${state}${now && i === shown.length - 1 ? ' now' : ''}`);
                  })}
                </tr>
              ),
            ])}
          </tbody>
        </table>
      </div>
      {note && <p class="muted small">{note}</p>}
    </section>
  );
}
