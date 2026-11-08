import { GateShape } from '../board/GateShape';
import { bounds, layout, outputColumn, portPoint, routePath, wireRoute } from '../board/geometry';
import type { Circuit, Gate, Level } from '../sim/types';

const EMPTY: Circuit = { gates: [], wires: [] };

/**
 * Darajaning kichik ko'rinishi (bosh ekrandagi "davom etish" kartochkasi): kirish va chiqish pinlari,
 * o'yinchi boshlagan sxema (qoralama) bo'lsa — u ham. Yechim ko'rsatilmaydi; sxema bo'sh bo'lsa,
 * o'rtada "?" turadi. Maydon bilan bir xil: plata yo'llari va element belgilari.
 */
export function MiniBoard({ level, circuit = EMPTY }: { level: Level; circuit?: Circuit }) {
  const lay = layout(level, outputColumn(level.goal));
  const gmap = new Map<string, Gate>(circuit.gates.map((g) => [g.id, g]));
  const b = bounds(circuit, lay);
  const pad = 10;
  const ys = [...lay.inputs.values(), ...lay.outputs.values()].map((p) => p.y);
  const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
  return (
    <svg
      class="mini-board"
      viewBox={`${b.minX - pad} ${b.minY - pad} ${b.maxX - b.minX + 2 * pad} ${b.maxY - b.minY + 2 * pad}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {circuit.wires.map((w) => {
        const a = portPoint(w.from, gmap, lay);
        const z = portPoint(w.to, gmap, lay);
        return a && z ? <path key={`${w.from}>${w.to}`} class="mini-wire" d={routePath(wireRoute(a, z))} /> : null;
      })}
      {circuit.gates.map((g) => (
        <g key={g.id} transform={`translate(${g.x},${g.y})`}>
          <GateShape type={g.type} />
        </g>
      ))}
      {circuit.gates.length === 0 && (
        <g class="mini-empty" transform={`translate(${lay.outX / 2},${midY})`}>
          <rect x={-46} y={-32} width={92} height={64} rx={12} />
          <text>?</text>
        </g>
      )}
      {[...lay.inputs].map(([name, p]) => (
        <g key={`in:${name}`} transform={`translate(${p.x},${p.y})`}>
          <line class="lead" x1={-14} y1={0} x2={0} y2={0} />
          <rect class="mini-pin" x={-76} y={-24} width={62} height={48} rx={10} />
          <text class="mini-name" x={-45}>
            {name}
          </text>
        </g>
      ))}
      {[...lay.outputs].map(([name, p]) => (
        <g key={`out:${name}`} transform={`translate(${p.x},${p.y})`}>
          <line class="lead" x1={0} y1={0} x2={14} y2={0} />
          <rect class="mini-pin" x={14} y={-24} width={62} height={48} rx={10} />
          <text class="mini-name" x={45}>
            {name}
          </text>
        </g>
      ))}
    </svg>
  );
}
