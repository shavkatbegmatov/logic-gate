import { busExamples } from '../board/bus';
import { GateIcon } from '../board/GateShape';
import { t } from '../i18n';
import { gateOutputValues, rowBits } from '../sim/sim';
import { BLOCKS, GATE_ARITY, isBlock, type GateType } from '../sim/types';
import { Modal } from './ui';

/** Daraja yangi element bilan tanishtirganda bir marta chiqadigan karta: belgi, izoh, to'liq jadval. */
export function GateIntro({ gates, onClose }: { gates: GateType[]; onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <h2 class="intro-title">{gates.length > 1 ? t.play.newGates : t.play.newGate}</h2>
      {gates.map((type) => {
        if (type === 'DFF') return <FlipFlopIntro key={type} />;
        const ex = busExamples(type);
        if (ex) return <BusBlockIntro key={type} type={type} ex={ex} />;
        const n = GATE_ARITY[type];
        const names = isBlock(type) ? BLOCKS[type].inputs : n === 1 ? ['A'] : ['A', 'B'];
        const outs = isBlock(type) ? BLOCKS[type].outputs : ['Q'];
        return (
          <div key={type} class="intro-gate">
            <GateIcon type={type} size={110} />
            <div class="intro-name">
              <b>{type}</b> — {t.gates[type].name}
            </div>
            <p>{t.gates[type].text}</p>
            <table class="truth intro-truth">
              <thead>
                <tr>
                  {names.map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                  {outs.map((x, i) => (
                    <th key={`o${x}`} class={i === 0 ? 'sep' : ''}>
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 1 << n }, (_, r) => {
                  const bits = rowBits(n, r);
                  const qs = gateOutputValues(type, bits);
                  return (
                    <tr key={r}>
                      {bits.map((b, k) => (
                        <td key={k} class={b ? 'one' : ''}>
                          {b}
                        </td>
                      ))}
                      {qs.map((q, i) => (
                        <td key={`o${i}`} class={`${i === 0 ? 'sep' : ''}${q ? ' one match' : ''}`}>
                          {q}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
      <div class="modal-actions">
        <button class="btn primary" onClick={onClose} autoFocus>
          {t.play.gotIt}
        </button>
      </div>
    </Modal>
  );
}

/** Shinali blok: to'liq jadval o'rniga misollar — shina ustuni son bilan (ADD4 ning to'liq jadvali 512 qator). */
function BusBlockIntro({ type, ex }: { type: GateType; ex: NonNullable<ReturnType<typeof busExamples>> }) {
  return (
    <div class="intro-gate">
      <GateIcon type={type} size={110} />
      <div class="intro-name">
        <b>{type}</b> — {t.gates[type].name}
      </div>
      <p>{t.gates[type].text}</p>
      <p class="muted">{t.play.busExamples}</p>
      <table class="truth intro-truth">
        <thead>
          <tr>
            {ex.ins.map((x) => (
              <th key={x}>{x}</th>
            ))}
            {ex.outs.map((x, i) => (
              <th key={`o${x}`} class={i === 0 ? 'sep' : ''}>
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ex.rows.map((r, n) => (
            <tr key={n}>
              {r.ins.map((v, k) => (
                <td key={k} class={v ? 'one' : ''}>
                  {v}
                </td>
              ))}
              {r.outs.map((v, i) => (
                <td key={`o${i}`} class={`${i === 0 ? 'sep' : ''}${v ? ' one match' : ''}`}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** D-trigger: jadval o'rniga "D → keyingi taktdagi Q" va takt haqida izoh. */
function FlipFlopIntro() {
  return (
    <div class="intro-gate">
      <GateIcon type="DFF" size={110} />
      <div class="intro-name">
        <b>DFF</b> — {t.gates.DFF.name}
      </div>
      <p>{t.gates.DFF.text}</p>
      <p class="muted">{t.play.clockText}</p>
      <table class="truth intro-truth">
        <thead>
          <tr>
            <th>D</th>
            <th class="sep">Q ({t.play.nextTick})</th>
          </tr>
        </thead>
        <tbody>
          {[0, 1].map((d) => (
            <tr key={d}>
              <td class={d ? 'one' : ''}>{d}</td>
              <td class={`sep${d ? ' one match' : ''}`}>{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
