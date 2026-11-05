// localStorage xususiy rejimda yoki bloklangan bo'lishi mumkin — har bir murojaat himoyalangan.

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
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

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Tez-tez o'zgaradigan qiymatlar (qoralamalar) uchun kechiktirilgan saqlash. */
export function saveLater(key: string, value: unknown, ms = 400): void {
  clearTimeout(timers.get(key));
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      save(key, value);
    }, ms),
  );
}
