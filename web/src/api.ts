import type { Circuit, GateType, Machine } from './sim/types';
import type { Spread } from './spread';
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

async function request<T>(method: string, path: string, body?: unknown, code?: string, extra?: Record<string, string>): Promise<T> {
  const headers: Record<string, string> = { ...extra };
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
  /** [element soni, o'yinchilar] — har o'yinchining eng yaxshi yechimi bo'yicha. */
  spread?: Spread;
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
  /** Oddiy kun: haqiqat jadvali. */
  target?: Record<string, string>;
  /** Xotira kuni (yakshanba): kerakli avtomat; namunani o'yin o'zi quradi. */
  seq?: Machine;
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
  /** Natija hali qabul qilinadimi (bugun va kecha); false — arxivdagi yopiq kun, faqat mashq. */
  open?: boolean;
}

/** Arxivdagi kun (yangisi birinchi). */
export interface ArchiveDay {
  day: number;
  number: number;
  date: string;
  tier: number;
  seq?: boolean;
  goal: number;
  solvers: number;
  bestGates: number;
  me: { gates: number; stars: number } | null;
  open?: boolean;
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
  spread?: Spread;
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

/** Sinf (o'qituvchi yaratadi). key — faqat yaratilganda qaytadi. */
export interface ClassInfo {
  code: string;
  name: string;
  members: number;
  member?: boolean;
  key?: string;
  tasks?: ClassTask[];
}

/** O'qituvchi bergan vazifa. due — Toshkent kuni (yo'q — muddatsiz). */
export interface ClassTask {
  id: number;
  title: string;
  levels: string[];
  due?: number;
  createdAt: number;
}

export interface ClassEntry {
  rank: number;
  nickname: string;
  stars: number;
  solved: number;
  me?: boolean;
}

export interface ClassMember {
  id: string;
  nickname: string;
  joinedAt: number;
  lastSeen: number;
  /** daraja → yulduzlar */
  levels: Record<string, number>;
  dailyToday: number;
  dailyWeek: number;
}

export interface ClassReport {
  code: string;
  name: string;
  createdAt: number;
  today: number;
  now: number;
  members: ClassMember[];
  tasks?: ClassTask[];
}

const classPath = (code: string) => `/classes/${encodeURIComponent(code)}`;
const teacher = (key: string) => ({ 'X-Class-Key': key });

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
  dailyDay: (day: number) => request<DailyInfo>('GET', `/daily/${day}`),
  dailyArchive: () => request<{ today: number; days: ArchiveDay[] }>('GET', '/daily/archive'),
  /** Telegram ichida: kunlik eslatma holati (on yo'q) yoki uni o'zgartirish. Profil bo'lsa, chat unga bog'lanadi. */
  telegramRemind: (initData: string, on?: boolean, lang?: string) =>
    request<{ remind: boolean }>('POST', '/telegram/remind', on === undefined ? { initData } : { initData, on, lang }),
  solveDaily: (day: number, circuit: Circuit) => request<DailySolveResult>('POST', `/daily/${day}/solve`, { circuit }),
  createClass: (name: string) => request<ClassInfo>('POST', '/classes', { name }),
  classInfo: (code: string) => request<ClassInfo>('GET', classPath(code)),
  joinClass: (code: string) => request<ClassInfo>('POST', `${classPath(code)}/join`),
  leaveClass: (code: string) => request<{ ok: boolean }>('DELETE', `${classPath(code)}/join`),
  classBoard: (code: string) => request<{ code: string; name: string; top: ClassEntry[] }>('GET', `${classPath(code)}/board`),
  myClasses: () => request<{ classes: ClassInfo[] }>('GET', '/me/classes'),
  classReport: (code: string, key: string) =>
    request<ClassReport>('GET', `${classPath(code)}/report`, undefined, undefined, teacher(key)),
  removeMember: (code: string, key: string, id: string) =>
    request<{ ok: boolean }>('DELETE', `${classPath(code)}/members/${encodeURIComponent(id)}`, undefined, undefined, teacher(key)),
  deleteClass: (code: string, key: string) => request<{ ok: boolean }>('DELETE', classPath(code), undefined, undefined, teacher(key)),
  createTask: (code: string, key: string, body: { title: string; levels: string[]; due: number }) =>
    request<ClassTask>('POST', `${classPath(code)}/tasks`, body, undefined, teacher(key)),
  deleteTask: (code: string, key: string, id: number) =>
    request<{ ok: boolean }>('DELETE', `${classPath(code)}/tasks/${id}`, undefined, undefined, teacher(key)),
  dailyLeaderboard: (day: number | 'today') =>
    request<{ day: number; number: number; top: DailyEntry[]; me: DailyEntry | null }>('GET', `/daily/${day}/leaderboard`),
};
