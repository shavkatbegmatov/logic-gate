import { GateIcon } from '../board/GateShape';
import { t } from '../i18n';
import { applyGate, gateOutputValues, rowBits } from '../sim/sim';
import { BLOCKS, GATE_ARITY, isBlock, type GateType } from '../sim/types';

/** "00→0 01→0 10→0 11→1" ko'rinishidagi qisqa haqiqat jadvali. */
function truthLine(type: GateType): string {
  if (type === 'DFF') return `D → Q ${t.play.nextTick}: 0→0  1→1`;
  if (isBlock(type)) {
    // Blok: "A B Ci → S Co" sarlavhasi va har qator bitlari.
    const b = BLOCKS[type];
    const n = b.inputs.length;
    const rows = Array.from({ length: 1 << n }, (_, r) => `${rowBits(n, r).join('')}→${gateOutputValues(type, rowBits(n, r)).join('')}`);
    return `${b.inputs.join(' ')} → ${b.outputs.join(' ')}:  ${rows.join('  ')}`;
  }
  if (GATE_ARITY[type] === 1) return [0, 1].map((a) => `${a}→${applyGate(type, a, 0)}`).join('  ');
  return [0, 1, 2, 3].map((r) => `${r >> 1}${r & 1}→${applyGate(type, r >> 1, r & 1)}`).join('  ');
}

/** Ruxsat etilgan elementlar tavsifi: sensorli ekranda `title` ko'rinmaydi, shuning uchun panelda. */
export function GateList({ gates }: { gates: GateType[] }) {
  return (
    <section class="gate-list">
      <h2>{t.play.allowed}</h2>
      {gates.map((type) => (
        <div key={type} class="gate-info">
          <GateIcon type={type} size={44} />
          <div>
            <div>
              <b>{type}</b> <span class="muted">— {t.gates[type].name}</span>
            </div>
            <div class="gate-text">{t.gates[type].text}</div>
            <code class="gate-truth">{truthLine(type)}</code>
          </div>
        </div>
      ))}
    </section>
  );
}
