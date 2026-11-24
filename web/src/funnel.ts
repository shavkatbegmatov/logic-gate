// O'yinchilar voronkasi (bot admin'ga haftalik hisobotda ko'rsatadi): qurilma har bosqichni serverga bir
// marta xabar qiladi — faqat bosqich nomi va manba (sayt yoki Telegram). Id, taxallus, natija va boshqa
// ma'lumot yuborilmaydi; qaysi bosqich yuborilgani faqat shu qurilmada saqlanadi.
import { effect } from '@preact/signals';
import { dailyHistory, today } from './daily';
import { freshDevice, progress } from './state';
import { load, save } from './storage';
import { inTelegram } from './telegram';

export type FunnelEvent = 'visit' | 'level1' | 'level3' | 'daily1' | 'return';
const ALL: FunnelEvent[] = ['visit', 'level1', 'level3', 'daily1', 'return'];
const KEY = 'lg.funnel.v1';

/** first — o'yin shu qurilmada birinchi ochilgan kun; sent — yuborilgan bosqichlar. */
interface FunnelState {
  first: number;
  sent: FunnelEvent[];
}

function clean(v: unknown): FunnelState | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.first !== 'number' || !Array.isArray(o.sent)) return null;
  return { first: o.first, sent: o.sent.filter((e): e is FunnelEvent => ALL.includes(e as FunnelEvent)) };
}

export type PostEvent = (event: FunnelEvent, src: 'web' | 'tg') => Promise<boolean>;

/** true — server qabul qildi yoki bu bosqichni bilmaydi (qayta yuborilmaydi); false — aloqa yo'q. */
const postEvent: PostEvent = async (event, src) => {
  try {
    const r = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, src }),
      keepalive: true,
    });
    return r.ok || r.status === 400;
  } catch {
    return false;
  }
};

/**
 * Voronka: ochilish, boshqa kuni qaytish, birinchi va uchinchi daraja, birinchi kunlik masala. Aloqa
 * bo'lmasa — keyingi ochilishda (yoki keyingi yechimda) qayta urinadi. Bu o'zgarishdan oldin o'ynagan
 * qurilmalar hisobga olinmaydi: voronkada faqat yangi kelganlar ko'rinsin.
 */
export function startFunnel(post: PostEvent = postEvent): void {
  const state: FunnelState = load<FunnelState | null>(KEY, null, clean) ?? {
    first: today(),
    sent: freshDevice ? [] : [...ALL],
  };
  save(KEY, state);
  const src = inTelegram ? 'tg' : 'web';
  const pending = new Set<FunnelEvent>();
  const send = (ev: FunnelEvent) => {
    if (state.sent.includes(ev) || pending.has(ev)) return;
    pending.add(ev);
    void post(ev, src).then((ok) => {
      pending.delete(ev);
      if (ok && !state.sent.includes(ev)) {
        state.sent.push(ev);
        save(KEY, state);
      }
    });
  };
  send('visit');
  if (today() > state.first) send('return');
  effect(() => {
    const solved = Object.keys(progress.value).length;
    if (solved >= 1) send('level1');
    if (solved >= 3) send('level3');
  });
  effect(() => {
    if (Object.keys(dailyHistory.value).length > 0) send('daily1');
  });
}
