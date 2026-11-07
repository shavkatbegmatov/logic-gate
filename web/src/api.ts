import type { Circuit, GateType } from './sim/types';
import { profile } from './state';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public data: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

async function request<T>(method: string, path: string, body?: unknown, code?: string): Promise<T> {
  const headers: Record<string, string> = {};
  const token = code ?? profile.value?.code;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctl.signal,
    });
  } catch {
    throw new ApiError(0, 'network');
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'http', data);
  return data as T;
}

export interface PlayerInfo {
  id: string;
  nickname: string;
  createdAt: number;
  code?: string;
}

export interface LevelStats {
  solvers: number;
  bestGates: number;
  bestBy: string[];
}

export interface SolveResult {
  ok: true;
  gates: number;
  stars: number;
  improved: boolean;
  best: { gates: number; stars: number };
  level: LevelStats;
}

export interface RemoteSolution {
  levelId: string;
  gates: number;
  stars: number;
  circuit: Circuit;
  solvedAt: number;
}

export interface LeaderEntry {
  rank: number;
  nickname: string;
  stars: number;
  solved: number;
  gates: number;
  me?: boolean;
}

export interface DailyPuzzle {
  tier: number;
  inputs: string[];
  outputs: string[];
  gates: GateType[];
  goal: number;
  target: Record<string, string>;
  hint: { gates: Record<string, number>; first: string[] };
}

export interface DailyInfo {
  day: number;
  number: number;
  date: string;
  /** Keyingi masala vaqti (Unix soniya). */
  nextAt: number;
  puzzle: DailyPuzzle;
  solvers: number;
  bestGates: number;
  me: { rank: number; gates: number; stars: number } | null;
  streak: number;
}

export interface DailySolveResult {
  ok: true;
  day: number;
  gates: number;
  stars: number;
  improved: boolean;
  best: { rank: number; gates: number; stars: number };
  solvers: number;
  bestGates: number;
  streak: number;
  /** Seriya bugungi kunni ham o'z ichiga oladimi (bugun yechilganmi). */
  todaySolved?: boolean;
}

export interface DailyEntry {
  rank: number;
  nickname: string;
  gates: number;
  stars: number;
  me?: boolean;
}

export const api = {
  createPlayer: (nickname: string) => request<PlayerInfo>('POST', '/players', { nickname }),
  me: (code?: string) => request<PlayerInfo>('GET', '/me', undefined, code),
  rename: (nickname: string) => request<PlayerInfo>('PATCH', '/me', { nickname }),
  progress: () => request<{ levels: RemoteSolution[] }>('GET', '/progress'),
  solve: (levelId: string, circuit: Circuit) =>
    request<SolveResult>('POST', `/levels/${encodeURIComponent(levelId)}/solve`, { circuit }),
  levelStats: (levelId: string) => request<LevelStats>('GET', `/levels/${encodeURIComponent(levelId)}/stats`),
  leaderboard: () => request<{ top: LeaderEntry[]; me: LeaderEntry | null }>('GET', '/leaderboard'),
  daily: () => request<DailyInfo>('GET', '/daily'),
  /** Telegram ichida: kunlik eslatma holati (on yo'q) yoki uni o'zgartirish. Profil bo'lsa, chat unga bog'lanadi. */
  telegramRemind: (initData: string, on?: boolean, lang?: string) =>
    request<{ remind: boolean }>('POST', '/telegram/remind', on === undefined ? { initData } : { initData, on, lang }),
  solveDaily: (day: number, circuit: Circuit) => request<DailySolveResult>('POST', `/daily/${day}/solve`, { circuit }),
  dailyLeaderboard: (day: number | 'today') =>
    request<{ day: number; number: number; top: DailyEntry[]; me: DailyEntry | null }>('GET', `/daily/${day}/leaderboard`),
};
