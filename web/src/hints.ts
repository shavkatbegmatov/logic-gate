// Bosqichli maslahat: avval yo'nalish, keyin 3 ★ yechim tarkibi, oxirida birinchi element (maydonga qo'yish bilan).
import { t } from './i18n';
import type { Circuit, GateType, Level } from './sim/types';

export type HintStep =
  | { kind: 'text'; text: string }
  | { kind: 'place'; text: string; type: GateType; sources: string[] };

export function hintSteps(level: Level): HintStep[] {
  const steps: HintStep[] = [];
  if (level.hint) steps.push({ kind: 'text', text: level.hint });
  if (level.hints) {
    const parts = Object.entries(level.hints.gates).map(([g, n]) => `${n} × ${g}`);
    steps.push({ kind: 'text', text: t.hints.gates(parts.join(', ')) });
    const [type, ...sources] = level.hints.first as [GateType, ...string[]];
    steps.push({ kind: 'place', text: t.hints.first(type, busNames(sources, level.buses)), type, sources });
  }
  return steps;
}

/** Matn uchun: shinaning hamma bitlari ketma-ket kelsa — shina nomi (A3 A2 A1 A0 → A). */
function busNames(sources: string[], buses: Level['buses']): string[] {
  const out: string[] = [];
  for (let i = 0; i < sources.length; ) {
    const bus = Object.entries(buses ?? {}).find(([, pins]) => pins.every((p, j) => sources[i + j] === p));
    out.push(bus ? bus[0] : sources[i]);
    i += bus ? bus[1].length : 1;
  }
  return out;
}

/** Maydonda shu turdagi, aynan shu kirishlarga ulangan element bormi (kirishlar tartibi ahamiyatsiz). */
export function hasGate(circuit: Circuit, type: GateType, sources: string[]): boolean {
  const want = sources.map((s) => `in:${s}`).sort().join();
  return circuit.gates.some((g) => {
    if (g.type !== type) return false;
    const got = sources.map((_, i) => circuit.wires.find((w) => w.to === `${g.id}:${i}`)?.from ?? '');
    return got.sort().join() === want;
  });
}
