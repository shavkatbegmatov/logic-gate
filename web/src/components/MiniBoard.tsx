import { bundles, pinGroups } from '../board/bus';
import { GateShape } from '../board/GateShape';
import { bounds, BUS_IN_X, BUS_OUT_X, layout, outputColumn } from '../board/geometry';
import { routeAll, routeD } from '../board/routing';
import type { Circuit, Gate, Level } from '../sim/types';
import { activeBoardMode, activeTheme, isAaaTheme } from '../theme';

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
  const bund = bundles(circuit.wires, gmap, level.buses);
  const routed = routeAll(circuit.wires, gmap, lay, false, bund.rep);
  const junctions = new Set(routed.dots.map(({ at }) => `${at.x},${at.y}`));
  const sharp = (p: { x: number; y: number }) => junctions.has(`${p.x},${p.y}`);
  const b = bounds(circuit, lay);
  const theme = activeTheme.value;
  // Maydondagi kabi: real va «Haqiqiy plata» da mikrosxemalar, «Chizma» da to'g'ri burchakli simlar.
  const chip = theme === 'haqiqiy' || (activeBoardMode.value !== 'schematic' && isAaaTheme(theme));
  const cut = theme === 'chizma' ? 0 : undefined;
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
        if (!r || bund.rep[i] !== i) return null;
        const cls = bund.bus.has(i) ? 'mini-wire bus' : 'mini-wire';
        return <path key={`${w.from}>${w.to}`} class={cls} d={routeD(r, routed.hops[i], sharp, cut)} />;
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
      {/* Shina — bitta keng pin (maydondagi kabi). */}
      {pinGroups(level.inputs, level.buses).map(({ name, pins, bus }) => {
        const p = lay.inputs.get(pins[0])!;
        const x0 = bus ? BUS_IN_X : -76;
        return (
          <g key={`in:${name}`} transform={`translate(${p.x},${p.y})`}>
            <line class="lead" x1={-14} y1={0} x2={0} y2={0} />
            <rect class="mini-pin" x={x0} y={-24} width={-14 - x0} height={48} rx={10} />
            <text class="mini-name" x={(x0 - 14) / 2}>
              {name}
            </text>
          </g>
        );
      })}
      {pinGroups(level.outputs, level.buses).map(({ name, pins, bus }) => {
        const p = lay.outputs.get(pins[0])!;
        const x1 = bus ? BUS_OUT_X : 76;
        return (
          <g key={`out:${name}`} transform={`translate(${p.x},${p.y})`}>
            <line class="lead" x1={0} y1={0} x2={14} y2={0} />
            <rect class="mini-pin" x={14} y={-24} width={x1 - 14} height={48} rx={10} />
            <text class="mini-name" x={(x1 + 14) / 2}>
              {name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
