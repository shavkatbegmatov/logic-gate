// Lokal progress va server o'rtasidagi sinxronlash. O'yin serversiz ham to'liq ishlaydi.
import { api, ApiError, type SolveResult } from './api';
import { t } from './i18n';
import { levelById } from './levels';
import { markSynced, profile, progress } from './state';
import type { Circuit } from './sim/types';

export function errorText(e: unknown): string {
  if (!(e instanceof ApiError) || e.code === 'network') return t.network;
  if (e.code === 'bad_nickname') return t.badNickname;
  if (e.code === 'nickname_not_allowed') return t.nicknameNotAllowed;
  if (e.code === 'rate_limited') return t.rateLimited;
  if (e.code === 'unauthorized') return t.settings.badCode;
  return t.network;
}

export async function createProfile(nickname: string) {
  const p = await api.createPlayer(nickname);
  profile.value = { id: p.id, nickname: p.nickname, code: p.code! };
  syncProgress().catch(() => {});
}

export async function restoreProfile(code: string) {
  const me = await api.me(code);
  const clean = code.replace(/[^0-9a-z]/gi, '').toUpperCase();
  profile.value = { id: me.id, nickname: me.nickname, code: clean.match(/.{1,4}/g)!.join('-') };
  await syncProgress();
}

export async function renameProfile(nickname: string) {
  const me = await api.rename(nickname);
  if (profile.value) profile.value = { ...profile.value, nickname: me.nickname };
}

let syncing: Promise<void> | null = null;

/** Serverdagi yaxshiroq natijalarni oladi va yuborilmagan lokal natijalarni jo'natadi. */
export function syncProgress(): Promise<void> {
  if (!profile.value) return Promise.resolve();
  syncing ??= doSync().finally(() => (syncing = null));
  return syncing;
}

async function doSync() {
  const { levels: remote } = await api.progress();
  const next = { ...progress.value };
  for (const r of remote) {
    if (!levelById(r.levelId)) continue;
    const local = next[r.levelId];
    if (!local || r.gates < local.gates) {
      next[r.levelId] = { stars: r.stars, gates: r.gates, circuit: r.circuit, at: r.solvedAt * 1000, synced: true };
    } else if (r.gates === local.gates) {
      next[r.levelId] = { ...local, synced: true };
    }
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
      else throw e;
    }
  }
}

/** Yechimni serverga yuboradi. Profil yo'q bo'lsa yoki aloqa bo'lmasa, null qaytaradi. */
export async function submitSolve(levelId: string, circuit: Circuit): Promise<SolveResult | null> {
  if (!profile.value) return null;
  try {
    const res = await api.solve(levelId, circuit);
    markSynced(levelId);
    return res;
  } catch {
    return null;
  }
}
