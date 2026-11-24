// O'yinchining ko'rinishi: kim o'ynayotgani bir qarashda bilinsin (bosh sahifa sarlavhasi, Sozlamalar).
// Avatar — taxallusning bosh harflari, rangi id'dan (bir profil hamma qurilmada bir xil rangda); ID — server
// id'sining boshi (`logicgate players` ro'yxatidagi bilan solishtirsa bo'ladi); reytingdagi o'rin — keshlangan.
import { signal } from '@preact/signals';
import { api } from './api';
import { profile, totalStars } from './state';
import { syncInFlight } from './sync';

/**
 * Avatar harfi rangi. Avatar ranglari mavzuga bog'liq emas (profil hamma uslubda bir xil rangda), shuning
 * uchun ular CSS mavzularida emas, shu yerda (CSS'da qattiq rang yo'q — theme.test.ts).
 */
export const AVATAR_INK = '#ffffff';

/** Avatar ranglari: AVATAR_INK harfi bilan WCAG AA (≥ 4.5:1) kontrastli to'q ohanglar (player.test.ts tekshiradi). */
export const AVATAR_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#dc2626',
  '#c2410c',
  '#0f766e',
  '#15803d',
  '#0e7490',
  '#4f46e5',
  '#9333ea',
];

/** Avatar harflari: ikki va undan ko'p so'z — birinchi ikkitasining bosh harfi, bitta so'z — birinchi harfi. */
export function initials(nickname: string): string {
  const firsts = nickname
    .split(/[\s._-]+/u)
    .map((w) => w.match(/[\p{L}\p{N}]/u)?.[0])
    .filter((c): c is string => !!c);
  return (firsts.length >= 2 ? firsts[0] + firsts[1] : (firsts[0] ?? '?')).toLocaleUpperCase();
}

/** id'dan doimiy rang (FNV-1a xeshi): bir xil ismli ikki o'yinchi odatda turli rangda bo'ladi. */
export function avatarColor(id: string): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return AVATAR_COLORS[(h >>> 0) % AVATAR_COLORS.length];
}

/** Ekrandagi qisqa ID — server id'sining boshi; to'liq id Sozlamalarda (nusxalash bilan). */
export const shortId = (id: string) => id.slice(0, 8);

const pad = (n: number) => String(n).padStart(2, '0');

/** Unix soniyadan sana: 23.11.2026 (qurilma vaqti bo'yicha). */
export function dateText(unix: number): string {
  const d = new Date(unix * 1000);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

interface RankInfo {
  id: string;
  /** null — hali reytingda yo'q (serverda yechimi yo'q). */
  rank: number | null;
  /** So'ralgan paytdagi yulduzlar: yangi yulduz olinsa, o'rin qayta so'raladi. */
  stars: number;
  at: number;
}

/** O'yinchining reytingdagi o'rni: bosh sahifaga har qaytishda reyting qayta so'ralmasin. */
export const myRank = signal<RankInfo | null>(null);

/** Shu vaqt ichida (va yulduzlar o'zgarmasa) o'rin qayta so'ralmaydi; serverdagi reyting keshi — 15 s. */
export const RANK_TTL = 60_000;

/** Joriy profilning o'rni: undefined — hali noma'lum (so'ralmagan, aloqa yo'q yoki boshqa profilniki). */
export function currentRank(): number | null | undefined {
  const r = myRank.value;
  const p = profile.value;
  return r && p && r.id === p.id ? r.rank : undefined;
}

/** Reyting javobidagi o'rinni keshga yozadi (Reyting ekrani ham chaqiradi — ikki marta so'ralmasin). */
export function setMyRank(id: string, rank: number | null) {
  // Javob kutilayotganda boshqa profilga o'tilgan bo'lsa — eskisining o'rni yangisiga yozilmaydi.
  if (profile.peek()?.id !== id) return;
  myRank.value = { id, rank, stars: totalStars.peek(), at: Date.now() };
}

/** O'rinni serverdan oladi, agar keshdagisi eskirgan bo'lsa. Aloqa bo'lmasa — jim (o'rin ko'rsatilmaydi). */
export async function refreshMyRank(now = Date.now()): Promise<void> {
  const p = profile.peek();
  if (!p) return;
  const cur = myRank.peek();
  if (cur && cur.id === p.id && cur.stars === totalStars.peek() && now - cur.at < RANK_TTL) return;
  // Ilova ochilganda natijalar hali yuborilayotgan bo'lishi mumkin: o'rin ulardan keyin so'raladi, aks holda
  // «reytingda yo'q» (yoki eski o'rin) bir daqiqaga keshda qolardi.
  await syncInFlight()?.catch(() => {});
  try {
    const r = await api.leaderboard();
    setMyRank(p.id, r.me?.rank ?? null);
  } catch {
    // Aloqa yo'q — keyingi safar.
  }
}
