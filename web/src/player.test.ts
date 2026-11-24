import { beforeEach, describe, expect, it, vi } from 'vitest';

// Server o'rnida: reyting so'rovlari soni va javobi (faqat soxta ma'lumot).
let calls = 0;
let reply: { me: { rank: number } | null } | Error = { me: { rank: 7 } };
vi.mock('./api', async (orig) => {
  const real = await orig<typeof import('./api')>();
  return {
    ...real,
    api: {
      leaderboard: async () => {
        calls++;
        if (reply instanceof Error) throw reply;
        return { top: [], me: reply.me && { rank: reply.me.rank, nickname: 'TEST_USER', stars: 3, solved: 1, gates: 1, me: true } };
      },
    },
  };
});

const { profile, progress } = await import('./state');
const { AVATAR_COLORS, AVATAR_INK, RANK_TTL, avatarColor, currentRank, dateText, initials, myRank, refreshMyRank, setMyRank, shortId } =
  await import('./player');

const circuit = { gates: [], wires: [] };

beforeEach(() => {
  calls = 0;
  reply = { me: { rank: 7 } };
  myRank.value = null;
  progress.value = {};
  profile.value = { id: 'aaaa1111bbbb2222', nickname: 'TEST_USER', code: 'TEST-CODE-0000-0000' };
});

describe("o'yinchi belgisi", () => {
  it('avatar harflari', () => {
    expect(initials('Shavkat Begmatov')).toBe('SB');
    expect(initials('SHAVKAT BEGMATOV')).toBe('SB');
    expect(initials('shavkat')).toBe('S');
    expect(initials('Shavkat mobi')).toBe('SM');
    expect(initials('ali_vali')).toBe('AV');
    expect(initials('Иван Петров')).toBe('ИП');
    expect(initials("O'yinchi 17")).toBe('O1');
    expect(initials('  ')).toBe('?');
  });

  it("rang id'dan doimiy va palitradan; turli id'lar turli ranglarga taqsimlanadi", () => {
    expect(avatarColor('aaaa1111bbbb2222')).toBe(avatarColor('aaaa1111bbbb2222'));
    const used = new Set(Array.from({ length: 200 }, (_, i) => avatarColor(i.toString(16).padStart(16, '0'))));
    for (const c of used) expect(AVATAR_COLORS).toContain(c);
    expect(used.size).toBe(AVATAR_COLORS.length);
  });

  it('har bir avatar rangida harf (AVATAR_INK) WCAG AA (≥ 4.5:1) kontrastli', () => {
    const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ink = lum(AVATAR_INK);
    for (const hex of AVATAR_COLORS) {
      const [hi, lo] = [Math.max(ink, lum(hex)), Math.min(ink, lum(hex))];
      expect((hi + 0.05) / (lo + 0.05), hex).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('qisqa ID va sana', () => {
    expect(shortId('36800f3a6257b361')).toBe('36800f3a');
    const unix = new Date(2026, 10, 3, 12).getTime() / 1000;
    expect(dateText(unix)).toBe('03.11.2026');
  });
});

describe("reytingdagi o'rin", () => {
  it('bir marta so\'raladi; muddati o\'tsa yoki yulduz qo\'shilsa — qayta', async () => {
    await refreshMyRank();
    await refreshMyRank();
    expect(calls).toBe(1);
    expect(currentRank()).toBe(7);

    await refreshMyRank(Date.now() + RANK_TTL + 1);
    expect(calls).toBe(2);

    progress.value = { b1: { stars: 3, gates: 1, circuit, at: 1, synced: true } };
    await refreshMyRank();
    expect(calls).toBe(3);
  });

  it("hali reytingda yo'q — null; aloqa yo'q — noma'lum (undefined), xato chiqmaydi", async () => {
    reply = { me: null };
    await refreshMyRank();
    expect(currentRank()).toBeNull();

    myRank.value = null;
    reply = new Error('network');
    await expect(refreshMyRank()).resolves.toBeUndefined();
    expect(currentRank()).toBeUndefined();
  });

  it("boshqa profilniki ko'rsatilmaydi; javob kutilayotganda profil almashsa — yozilmaydi", async () => {
    setMyRank('aaaa1111bbbb2222', 3);
    profile.value = { id: 'cccc3333dddd4444', nickname: 'TEST_USER_2', code: 'TEST-CODE-1111-1111' };
    expect(currentRank()).toBeUndefined();

    const pending = refreshMyRank();
    profile.value = { id: 'eeee5555ffff6666', nickname: 'TEST_USER_3', code: 'TEST-CODE-2222-2222' };
    await pending;
    expect(myRank.value?.id).toBe('aaaa1111bbbb2222');
    expect(currentRank()).toBeUndefined();
  });

  it("profilsiz — so'ralmaydi", async () => {
    profile.value = null;
    await refreshMyRank();
    expect(calls).toBe(0);
  });
});
