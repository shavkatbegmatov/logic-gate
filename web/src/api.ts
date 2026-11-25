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

export interface DeviceInfo {
  id: string;
  /** «Chrome · Android»; aniqlanmasa — bo'sh */
  label: string;
  createdAt: number;
  usedAt: number;
  current: boolean;
}

export interface PlayerInfo {
  id: string;
  nickname: string;
  createdAt: number;
  code?: string;
  /** Profil Telegram hisobiga bog'langanmi (faqat /me). */
  telegram?: boolean;
}

/** Telegram orqali kirish so'rovi: botni ochadigan havola va saytda ko'rinadigan raqam. */
export interface TgStart {
  id: string;
  url: string;
  number: number;
  /** Soniya. */
  expiresIn: number;
}

/**
 * So'rov holati: pending — tasdiq kutilmoqda, denied — rad etildi, linked — Telegram profilga bog'landi,
 * new — Telegram hali profilga bog'lanmagan (name — Telegram'dagi ism), ok — profil va qurilma kaliti.
 */
export type TgStatus =
  | { status: 'pending' }
  | { status: 'denied' }
  | { status: 'linked' }
  | { status: 'new'; name: string }
  | { status: 'ok'; player: PlayerInfo };

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
  /** Hozir davom etayotgan sinf musobaqasi (faqat a'zolarga). */
  contest?: Contest;
}

/** Sinf musobaqasi. remaining — tugashiga qolgan soniyalar (0 — tugagan; server soati bo'yicha). */
export interface Contest {
  id: number;
  title: string;
  levels: string[];
  startsAt: number;
  endsAt: number;
  remaining: number;
}

/** Musobaqa reytingi qatori: levels — daraja → yulduzlar (faqat musobaqa vaqtidagi yechimlar). */
export interface ContestEntry {
  rank: number;
  nickname: string;
  stars: number;
  solved: number;
  levels: Record<string, number>;
  me?: boolean;
}

export interface ContestBoard {
  code: string;
  name: string;
  contest: Contest;
  board: ContestEntry[];
}

export interface ContestSolveResult {
  gates: number;
  stars: number;
  improved: boolean;
  rank?: number;
  total?: number;
  solved?: number;
  /** shu darajadagi eng yaxshi natija (yulduz) */
  best?: number;
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
  /** Saytga Telegram orqali kirish so'rovi (link — ochiq profilni Telegram'ga bog'lash). */
  telegramStart: (link = false) => request<TgStart>('POST', link ? '/me/telegram' : '/auth/telegram'),
  telegramStatus: (id: string) => request<TgStatus>('GET', `/auth/telegram/${encodeURIComponent(id)}`),
  /** Telegram bog'lanmagan: shu taxallus bilan yangi profil (javobda tiklash kodi). */
  telegramNewPlayer: (id: string, nickname: string) =>
    request<{ status: 'ok'; created?: boolean; player: PlayerInfo }>('POST', `/auth/telegram/${encodeURIComponent(id)}/player`, { nickname }),
  /** Telegram bog'lanmagan: shu kodli profilga bog'lash. */
  telegramAttach: (id: string, code: string) =>
    request<{ status: 'linked' }>('POST', `/auth/telegram/${encodeURIComponent(id)}/attach`, undefined, code),
  /** Mini App: Telegram imzolagan initData bilan bog'langan profilga kirish (404 not_linked — bog'lanmagan). */
  telegramAppLogin: (initData: string) => request<{ player: PlayerInfo }>('POST', '/auth/telegram/app', { initData }),
  /** Mini App: ochiq profilni shu Telegram foydalanuvchisiga bog'lash. */
  telegramAppLink: (initData: string) => request<{ linked: boolean }>('POST', '/me/telegram/app', { initData }),
  /** Profilga Telegram orqali kirgan qurilmalar (viaCode — shu qurilma asosiy tiklash kodi bilan). */
  devices: () => request<{ devices: DeviceInfo[]; viaCode: boolean }>('GET', '/me/devices'),
  removeDevice: (id: string) => request<unknown>('DELETE', `/me/devices/${encodeURIComponent(id)}`),
  /** Boshqa hamma qurilmadan chiqish: tiklash kodi shu yangisiga almashadi, qurilma kalitlari o'chadi. */
  logoutOthers: (code: string) => request<unknown>('POST', '/me/logout-others', { code }),
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
  createContest: (code: string, key: string, body: { title: string; levels: string[]; minutes: number }) =>
    request<Contest>('POST', `${classPath(code)}/contests`, body, undefined, teacher(key)),
  stopContest: (code: string, key: string, id: number) =>
    request<{ ok: boolean }>('POST', `${classPath(code)}/contests/${id}/stop`, undefined, undefined, teacher(key)),
  /** Oxirgi musobaqa va reyting: o'qituvchi (kalit bilan, proyektor) yoki o'quvchi (a'zo). */
  teacherContest: (code: string, key: string) =>
    request<ContestBoard>('GET', `${classPath(code)}/contest/teacher`, undefined, undefined, teacher(key)),
  studentContest: (code: string) => request<ContestBoard>('GET', `${classPath(code)}/contest`),
  contestSolve: (code: string, id: number, level: string, circuit: Circuit) =>
    request<ContestSolveResult>('POST', `${classPath(code)}/contests/${id}/solve`, { level, circuit }),
  dailyLeaderboard: (day: number | 'today') =>
    request<{ day: number; number: number; top: DailyEntry[]; me: DailyEntry | null }>('GET', `/daily/${day}/leaderboard`),
};
