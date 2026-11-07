import { GateIcon } from '../board/GateShape';
import { t } from '../i18n';
import { applyGate, rowBits } from '../sim/sim';
import { GATE_ARITY, type GateType } from '../sim/types';
import { Modal } from './ui';

/** Daraja yangi element bilan tanishtirganda bir marta chiqadigan karta: belgi, izoh, to'liq jadval. */
export function GateIntro({ gates, onClose }: { gates: GateType[]; onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <h2 class="intro-title">{gates.length > 1 ? t.play.newGates : t.play.newGate}</h2>
      {gates.map((type) => {
        if (type === 'DFF') return <FlipFlopIntro key={type} />;
        const n = GATE_ARITY[type];
        const names = n === 1 ? ['A'] : ['A', 'B'];
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
                  <th class="sep">Q</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 1 << n }, (_, r) => {
                  const bits = rowBits(n, r);
                  const q = applyGate(type, bits[0], bits[1] ?? 0);
                  return (
                    <tr key={r}>
                      {bits.map((b, k) => (
                        <td key={k} class={b ? 'one' : ''}>
                          {b}
                        </td>
                      ))}
                      <td class={`sep${q ? ' one match' : ''}`}>{q}</td>
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
