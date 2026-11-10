// localStorage xususiy rejimda yoki bloklangan bo'lishi mumkin — har bir murojaat himoyalangan.

const kind = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

/**
 * Saqlangan qiymat. clean — shaklini tekshiradi (noto'g'ri qismlarni tashlaydi, umuman yaroqsiz bo'lsa
 * null). clean bo'lmasa, hech bo'lmasa turi fallback bilan bir xil bo'lishi shart (massiv o'rniga son
 * kelib qolsa, ilova ochilishidayoq to'xtamasin).
 */
export function load<T>(key: string, fallback: T, clean?: (v: unknown) => T | null): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const v: unknown = JSON.parse(raw);
    if (clean) return clean(v) ?? fallback;
    return fallback === null || kind(v) === kind(fallback) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    if (value === undefined || value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Saqlab bo'lmadi — o'yin xotirada davom etadi.
  }
}

const timers = new Map<string, { timer: ReturnType<typeof setTimeout>; value: unknown }>();

/** Tez-tez o'zgaradigan qiymatlar (qoralamalar) uchun kechiktirilgan saqlash. */
export function saveLater(key: string, value: unknown, ms = 400): void {
  clearTimeout(timers.get(key)?.timer);
  timers.set(key, {
    value,
    timer: setTimeout(() => {
      timers.delete(key);
      save(key, value);
    }, ms),
  });
}

/** Kutilayotgan barcha yozuvlarni darhol saqlaydi. */
export function flushSaves(): void {
  for (const [key, { timer, value }] of timers) {
    clearTimeout(timer);
    save(key, value);
  }
  timers.clear();
}

// Sahifa yopilsa, yangilansa yoki telefonda boshqa ilovaga o'tilsa — oxirgi o'zgarish yo'qolmasin.
if (typeof addEventListener === 'function') {
  addEventListener('pagehide', flushSaves);
  addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushSaves());
}
