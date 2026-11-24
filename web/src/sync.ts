// Lokal progress va server o'rtasidagi sinxronlash. O'yin serversiz ham to'liq ishlaydi.
import { signal } from '@preact/signals';
import { resetAchievements } from './achievements';
import { api, ApiError, type SolveResult } from './api';
import { resetCustom } from './custom-store';
import { resetDaily, syncDaily, unsyncRecentDaily } from './daily';
import { t } from './i18n';
import { resetLessons } from './lessons';
import { levelById } from './levels';
import { resetMapSeen } from './levelmap';
import { KEYS, markSynced, profile, progress, resetLocalProgress } from './state';
import type { Circuit } from './sim/types';
import { save } from './storage';
import { setMyTasks } from './tasks';

export function errorText(e: unknown): string {
  if (!(e instanceof ApiError) || e.code === 'network') return t.network;
  if (e.code === 'bad_nickname') return t.badNickname;
  if (e.code === 'nickname_not_allowed') return t.nicknameNotAllowed;
  if (e.code === 'rate_limited') return t.rateLimited;
  if (e.code === 'unauthorized') return t.settings.badCode;
  if (t.classes.errors[e.code]) return t.classes.errors[e.code];
  return t.network;
}

/** Yangi ochilgan profilning tiklash kodi — o'quvchi uni darhol ko'rib, yozib olsin (NewProfileCode). */
export const newProfileCode = signal<string | null>(null);

/** Server bilmaydigan (o'chirilgan) profilning taxallusi — o'quvchi kod bilan kirishi yoki yangisini ochishi kerak (LostProfile). */
export const lostProfile = signal<string | null>(null);

export async function createProfile(nickname: string) {
  const p = await api.createPlayer(nickname);
  profile.value = { id: p.id, nickname: p.nickname, code: p.code! };
  newProfileCode.value = p.code!;
  syncProgress().catch(() => {});
}

/** Tiklash kodi ko'rinishi: XXXX-XXXX-XXXX-XXXX (bo'shliq, chiziqcha va kichik harflar farq qilmaydi). */
export function formatCode(code: string): string {
  return (code.replace(/[^0-9a-z]/gi, '').toUpperCase().match(/.{1,4}/g) ?? []).join('-');
}

/** Kod to'liq kiritilganmi (16 belgi; bo'shliq va chiziqchalar hisobga olinmaydi) — «Tiklash» tugmasi uchun. */
export function codeComplete(code: string): boolean {
  return code.replace(/[^0-9a-z]/gi, '').length === 16;
}

/**
 * Qurilmadagi o'yinchi ma'lumotlari: natijalar, qoralamalar, kunlik masalalar, yutuqlar, vazifalar,
 * o'qilgan xulosalar va sertifikatdagi ism (keyingi o'quvchiga oldingisining haqiqiy ismi chiqmasin).
 */
export function clearPlayerData() {
  resetLocalProgress();
  resetDaily();
  resetCustom();
  resetAchievements();
  resetLessons();
  resetMapSeen();
  save(KEYS.certName, null);
  setMyTasks([]);
}

/**
 * Tiklash kodi bilan profilga kirish. Qurilmada boshqa profil ochiq bo'lsa (maktabdagi umumiy kompyuter),
 * avval uning yuborilmagan natijalari o'z hisobiga jo'natiladi, keyin qurilmadan tozalanadi — ikki
 * o'quvchining natijalari aralashmaydi. Profilsiz o'ynalgan natijalar esa shu profilga qo'shiladi.
 * onlyIfEmpty: server javobini kutish paytida profil paydo bo'lsa (o'quvchi yangisini ochdi) — hech narsa
 * o'zgarmaydi va false qaytadi.
 */
export async function restoreProfile(code: string, onlyIfEmpty = false): Promise<boolean> {
  const me = await api.me(code);
  const current = profile.value;
  if (onlyIfEmpty && current) return false;
  if (current && current.id !== me.id) {
    await syncProgress().catch(() => {});
    clearPlayerData();
  }
  profile.value = { id: me.id, nickname: me.nickname, code: formatCode(code) };
  await syncProgress();
  return true;
}

export async function renameProfile(nickname: string) {
  const me = await api.rename(nickname);
  if (profile.value) profile.value = { ...profile.value, nickname: me.nickname };
}

let syncing: Promise<void> | null = null;

/** Hozir ketayotgan sinxronlash (yo'q bo'lsa — null): natijalar yuborilgach so'raladigan narsalar kutadi. */
export const syncInFlight = (): Promise<void> | null => syncing;

/** Serverdagi yaxshiroq natijalarni oladi va yuborilmagan lokal natijalarni jo'natadi. */
export function syncProgress(): Promise<void> {
  if (!profile.value) return Promise.resolve();
  syncing ??= doSync()
    .then(syncDaily)
    .finally(() => (syncing = null));
  return syncing;
}

async function doSync() {
  const asked = profile.value;
  let remote: Awaited<ReturnType<typeof api.progress>>['levels'];
  try {
    remote = (await api.progress()).levels;
  } catch (e) {
    // Server profilni bilmaydi: dublikat sifatida o'chirilgan, uzoq vaqt bo'sh turib tozalangan yoki baza
    // zaxiradan tiklangan. Kutish paytida boshqa profilga o'tilmagan bo'lsa — qurilma profilsiz qoladi.
    if (e instanceof ApiError && e.status === 401 && asked && profile.value?.id === asked.id) return forgetLostProfile(asked.nickname);
    throw e;
  }
  const next = { ...progress.value };
  const known = new Map(remote.map((r) => [r.levelId, r.gates]));
  for (const r of remote) {
    if (!levelById(r.levelId)) continue;
    const local = next[r.levelId];
    if (!local || r.gates < local.gates) {
      next[r.levelId] = { stars: r.stars, gates: r.gates, circuit: r.circuit, at: r.solvedAt * 1000, synced: true };
    } else if (r.gates === local.gates) {
      next[r.levelId] = { ...local, synced: true };
    }
  }
  // "Yuborilgan" deb belgilangan, lekin server bilmaydigan (yoki yomonrog'ini biladigan) natija — masalan,
  // baza zaxiradan tiklangandan keyin: qayta yuboriladi.
  for (const [id, p] of Object.entries(next)) {
    const g = known.get(id);
    if (p.synced && levelById(id) && p.circuit.gates.length && (g === undefined || g > p.gates)) next[id] = { ...p, synced: false };
  }
  progress.value = next;

  for (const [id, p] of Object.entries(progress.value)) {
    if (p.synced || !levelById(id)) continue;
    try {
      await api.solve(id, p.circuit);
      markSynced(id);
    } catch (e) {
      // Server sxemani rad etsa (masalan, daraja o'zgargan), qayta-qayta yubormaslik uchun belgilaymiz.
      if (e instanceof ApiError && e.status === 422) markSynced(id);
      // Faqat shu natijaga tegishli rad javobi (masalan, keshdagi yangi versiya biladigan, server esa
      // hali bilmaydigan daraja — 404): keyingi safar yana urinamiz, qolganlari esa kutib qolmasin.
      else if (skippable(e)) continue;
      else throw e;
    }
  }
}

/**
 * Serverda yo'q profil qurilmadan olib tashlanadi, natijalar esa joyida qoladi. Ilgari shu taxallus bilan
 * yangisi jimgina ochilardi — o'chirilgan dublikat keyingi ochilishda reytingga qaytib kelardi. Endi
 * o'quvchi o'zi tanlaydi (LostProfile oynasi): asosiy profilining kodi bilan kirsa — natijalar o'shanga
 * qo'shiladi, yangisini ochsa — unga yuboriladi (server bilmaydigan «yuborilgan» natijalar doSync'da
 * qayta yuboriladi, bugungi va kechagi kunlik masala — shu yerda belgilanadi).
 */
function forgetLostProfile(nickname: string) {
  profile.value = null;
  unsyncRecentDaily();
  setMyTasks([]); // sinf a'zoligi profil bilan birga o'chgan
  lostProfile.value = nickname;
}

/** Boshqa natijalarga ta'sir qilmaydigan xato: 4xx, lekin aloqa, kirish yoki cheklov emas. */
export function skippable(e: unknown): boolean {
  return e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 429;
}

/**
 * Daraja natijasini serverga yuboradi: har doim qurilmadagi eng yaxshi sxema (yo'q bo'lsa — fallback).
 * Server eng yaxshisini bilgandagina "yuborilgan" deb belgilanadi. Profil yoki aloqa bo'lmasa — null.
 */
export async function submitSolve(levelId: string, fallback: Circuit): Promise<SolveResult | null> {
  if (!profile.value) return null;
  const local = progress.value[levelId];
  try {
    const res = await api.solve(levelId, local?.circuit ?? fallback);
    if (!local || res.best.gates <= local.gates) markSynced(levelId);
    return res;
  } catch {
    return null;
  }
}
