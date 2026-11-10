import { GateShape } from '../board/GateShape';
import { bounds, layout, outputColumn } from '../board/geometry';
import { routeAll, routeD } from '../board/routing';
import type { Circuit, Gate, Level } from '../sim/types';
import { activeTheme } from '../theme';

const EMPTY: Circuit = { gates: [], wires: [] };

/**
 * Darajaning kichik ko'rinishi (bosh ekrandagi "davom etish" kartochkasi): kirish va chiqish pinlari,
 * o'yinchi boshlagan sxema (qoralama) bo'lsa — u ham. Yechim ko'rsatilmaydi; sxema bo'sh bo'lsa,
 * o'rtada "?" turadi. Maydon bilan bir xil: plata yo'llari va element belgilari.
 */
export function MiniBoard({ level, circuit = EMPTY }: { level: Level; circuit?: Circuit }) {
  const lay = layout(level, outputColumn(level.goal));
  const gmap = new Map<string, Gate>(circuit.gates.map((g) => [g.id, g]));
  // Maydon bilan bir xil yo'llar: ko'prikchalar va tarmoqlanish nuqtalari bilan.
  const routed = routeAll(circuit.wires, gmap, lay);
  const junctions = new Set(routed.dots.map(({ at }) => `${at.x},${at.y}`));
  const sharp = (p: { x: number; y: number }) => junctions.has(`${p.x},${p.y}`);
  const b = bounds(circuit, lay);
  // Maydondagi kabi: «Haqiqiy plata» da mikrosxemalar, «Chizma» da to'g'ri burchakli simlar.
  const chip = activeTheme.value === 'haqiqiy';
  const cut = activeTheme.value === 'chizma' ? 0 : undefined;
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
      {circuit.wires.map((w, i) => {
        const r = routed.routes[i];
        return r ? <path key={`${w.from}>${w.to}`} class="mini-wire" d={routeD(r, routed.hops[i], sharp, cut)} /> : null;
      })}
      {routed.dots.map(({ net, at }) => (
        <circle key={`${net}@${at.x},${at.y}`} class="mini-dot" cx={at.x} cy={at.y} r={4} />
      ))}
      {circuit.gates.map((g) => (
        <g key={g.id} transform={`translate(${g.x},${g.y})`}>
          <GateShape type={g.type} chip={chip} />
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
