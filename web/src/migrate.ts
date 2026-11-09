// Eski manzildan (logic-gate.170.168.6.82.sslip.io) asosiy manzilga ko'chish.
// localStorage har bir manzilga alohida — shuning uchun natijalar havola orqali olib o'tiladi.
//
// Bu modul ilova holati (state.ts va boshqalar) localStorage'ni o'qishidan OLDIN bajarilishi kerak:
// main.tsx da birinchi import. U ilova modullarini import qilmaydi.

const SITE = (import.meta.env.VITE_SITE_URL as string | undefined) ?? '';
const PREFIX = 'lg.';
const IMPORT_HASH = '#/import/';

/** Asosiy manzil hosti (masalan, logic.noesis.uz). */
export function siteHost(): string | null {
  try {
    return new URL(SITE).host;
  } catch {
    return null;
  }
}

const isLocal = (host: string) => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);

/** Sahifa eski (asosiy bo'lmagan) manzilda ochilganmi. Lokal ishlab chiqishda — yo'q. */
export function onOldHost(host = location.host): boolean {
  const site = siteHost();
  return !!site && host !== site && !isLocal(host);
}

// ── Kodlash ────────────────────────────────────────────────

function encode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(code: string): string | null {
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'key' | 'length'>;

function readAll(store: Store): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    // Kunlik masala keshi ko'chirilmaydi: yangi manzil uni o'zi oladi.
    if (!k || !k.startsWith(PREFIX) || k === 'lg.dailyPuzzle.v1') continue;
    try {
      out[k] = JSON.parse(store.getItem(k) ?? 'null');
    } catch {
      // Buzilgan yozuv — o'tkazib yuboriladi.
    }
  }
  return out;
}

/** Bu brauzerda o'yinning ahamiyatli natijalari bormi (ko'chirishga arziydimi). */
export function hasProgress(store: Store = localStorage): boolean {
  const d = readAll(store);
  const nonEmpty = (v: unknown) => !!v && typeof v === 'object' && Object.keys(v as object).length > 0;
  const custom = d['lg.custom.v1'] as { solved?: object; created?: number } | undefined;
  const sandbox = d['lg.sandbox.v1'] as { circuit?: { gates?: unknown[] } } | undefined;
  return (
    nonEmpty(d['lg.progress.v1']) ||
    !!d['lg.profile.v1'] ||
    nonEmpty(d['lg.daily.v1']) ||
    nonEmpty(custom?.solved) ||
    (custom?.created ?? 0) > 0 ||
    (sandbox?.circuit?.gates?.length ?? 0) > 0
  );
}

/** Asosiy manzilga natijalar bilan o'tish havolasi. */
export function moveUrl(store: Store = localStorage): string {
  return `${SITE}/${IMPORT_HASH}${encode(JSON.stringify(readAll(store)))}`;
}

// ── Birlashtirish ─────────────────────────────────────────
// Yangi manzilda ham natijalar bo'lishi mumkin — har biri uchun yaxshirog'i qoladi.

type Rec = Record<string, unknown>;
const isObj = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Kalit bo'yicha: elementlari kam (gates) bo'lgani yutadi.
 * resync — eski manzildan kelgan g'olib natija "yuborilmagan" deb belgilanadi (boshqa profilga
 * tegishli bo'lgani uchun joriy profilga ham yuborilishi kerak).
 */
function mergeBest(a: unknown, b: unknown, resync = false): unknown {
  const mark = (v: unknown) => (resync && isObj(v) && 'synced' in v ? { ...v, synced: false } : v);
  if (!isObj(b)) return a;
  if (!isObj(a)) return resync ? Object.fromEntries(Object.entries(b).map(([k, v]) => [k, mark(v)])) : b;
  const out: Rec = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const cur = out[k] as { gates?: number } | undefined;
    const inc = v as { gates?: number };
    if (!cur || (typeof inc?.gates === 'number' && inc.gates < (cur.gates ?? Infinity))) out[k] = mark(v);
  }
  return out;
}

/** resync — yangi manzilda boshqa profil bor: eski manzil natijalari unga yuborilishi kerak. */
export function merge(key: string, mine: unknown, theirs: unknown, resync = false): unknown {
  if (key === 'lg.progress.v1' || key === 'lg.daily.v1') {
    if (mine === null || mine === undefined) return resync ? mergeBest({}, theirs, true) : theirs;
    return mergeBest(mine, theirs, resync);
  }
  if (mine === null || mine === undefined) return theirs;
  switch (key) {
    case 'lg.custom.v1': {
      const a = (isObj(mine) ? mine : {}) as { solved?: Rec; created?: number };
      const b = (isObj(theirs) ? theirs : {}) as { solved?: Rec; created?: number };
      return { solved: mergeBest(a.solved ?? {}, b.solved ?? {}), created: Math.max(a.created ?? 0, b.created ?? 0) };
    }
    case 'lg.achievements.v1':
    case 'lg.settings.v1':
      // Yangi manzildagi qiymat ustun; unda yo'q maydonlar (masalan, tanlangan til) eskisidan olinadi.
      return isObj(theirs) && isObj(mine) ? { ...theirs, ...mine } : mine;
    case 'lg.intro.v1':
      return Array.isArray(mine) && Array.isArray(theirs) ? [...new Set([...mine, ...theirs])] : mine;
    case 'lg.hints.v1': {
      if (!isObj(mine) || !isObj(theirs)) return mine;
      const out: Rec = { ...theirs };
      for (const [k, v] of Object.entries(mine)) out[k] = Math.max(Number(v) || 0, Number(out[k]) || 0);
      return out;
    }
    default:
      // Profil, sozlamalar, qoralamalar, qum quti — yangi manzildagisi saqlanadi.
      return mine;
  }
}

/** Havoladagi natijalarni joriy localStorage bilan birlashtiradi; yozilgan kalitlar sonini qaytaradi. */
export function importData(code: string, store: Store = localStorage): number {
  const json = decode(code);
  if (!json) return 0;
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return 0;
  }
  if (!isObj(data)) return 0;
  const read = (key: string): unknown => {
    try {
      return JSON.parse(store.getItem(key) ?? 'null');
    } catch {
      return null; // Buzilgan — ustiga yoziladi.
    }
  };
  // Yangi manzilda o'z profili qoladi. Eski manzildagi natijalar boshqa profilda (yoki profilsiz) bo'lsa,
  // ular "yuborilgan" belgisi bilan kelib, joriy profilga hech qachon yuborilmay qolardi.
  const mineProfile = read('lg.profile.v1');
  const theirsProfile = data['lg.profile.v1'];
  const resync = isObj(mineProfile) && (!isObj(theirsProfile) || theirsProfile.id !== mineProfile.id);
  let n = 0;
  for (const [key, theirs] of Object.entries(data)) {
    if (!key.startsWith(PREFIX)) continue;
    const mine = read(key);
    const next = merge(key, mine, theirs, resync);
    if (next === mine) continue;
    try {
      store.setItem(key, JSON.stringify(next));
      n++;
    } catch {
      // Joy yo'q yoki bloklangan — davom etiladi.
    }
  }
  return n;
}

// ── Ishga tushishda ───────────────────────────────────────

/** Ko'chirilgan natijalar soni (bosh sahifa xabari uchun); -1 — ko'chirish bo'lmadi. */
export let imported = -1;

function boot() {
  if (typeof location === 'undefined') return;
  try {
    if (location.hash.startsWith(IMPORT_HASH)) {
      imported = importData(location.hash.slice(IMPORT_HASH.length));
      // Natijalar (ichida tiklash kodi ham bo'lishi mumkin) brauzer tarixida qolmasin.
      history.replaceState(null, '', `${location.pathname}${location.search}#/`);
    } else if (onOldHost() && !hasProgress()) {
      // Eski manzilga birinchi marta kelgan (masalan, eski havola orqali) — natijasi yo'q, darhol yangi manzilga.
      location.replace(`${SITE}/${location.hash}`);
    }
  } catch {
    // localStorage yoki history bloklangan — ilova odatdagidek ishlaydi.
  }
}

boot();
