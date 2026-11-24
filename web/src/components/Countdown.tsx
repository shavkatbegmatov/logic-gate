import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { formatClock } from '../contest';

/** Hozirgi vaqt (ms), har soniyada yangilanadi — taymerlar uchun. */
export function useNow(): number {
  const now = useSignal(Date.now());
  useEffect(() => {
    const id = setInterval(() => (now.value = Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now.value;
}

/** Qolgan vaqt «m:ss» (endsAt — shu qurilma soati bo'yicha, ms). */
export function Countdown({ endsAt, class: cls }: { endsAt: number; class?: string }) {
  const now = useNow();
  const left = endsAt - now;
  return (
    <span class={`countdown${left <= 60_000 ? ' soon' : ''}${cls ? ` ${cls}` : ''}`} role="timer">
      {formatClock(left)}
    </span>
  );
}
