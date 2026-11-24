package store

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"maps"
	"path/filepath"
	"slices"
	"testing"
	"time"
)

// Faqat vaqtinchalik baza va soxta ma'lumotlar (TEST_USER, TEST_TOKEN).

func testStore(t *testing.T) *Store {
	t.Helper()
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	return st
}

func tokenHash(n int) []byte {
	h := sha256.Sum256(fmt.Appendf(nil, "TEST_TOKEN_%d", n))
	return h[:]
}

// players — p1, p2, ... o'yinchilarini yaratadi (taxallus TEST_USER_n, token TEST_TOKEN_n xeshi).
func players(t *testing.T, st *Store, n int) {
	t.Helper()
	for i := 1; i <= n; i++ {
		if err := st.CreatePlayer(t.Context(), fmt.Sprintf("p%d", i), tokenHash(i), fmt.Sprintf("TEST_USER_%d", i)); err != nil {
			t.Fatal(err)
		}
	}
}

func solve(t *testing.T, st *Store, player, level string, gates, stars int) (Solution, bool) {
	t.Helper()
	best, improved, err := st.SaveSolution(t.Context(), player, Solution{
		LevelID: level, Gates: gates, Stars: stars, Circuit: fmt.Sprintf(`{"n":%d}`, gates),
	})
	if err != nil {
		t.Fatal(err)
	}
	return best, improved
}

func TestPlayerByToken(t *testing.T) {
	st := testStore(t)
	ctx := t.Context()
	players(t, st, 2)
	p, err := st.PlayerByToken(ctx, tokenHash(2))
	if err != nil || p.ID != "p2" || p.Nickname != "TEST_USER_2" || p.CreatedAt.IsZero() {
		t.Fatalf("token bo'yicha: %+v %v", p, err)
	}
	if _, err := st.PlayerByToken(ctx, tokenHash(3)); !errors.Is(err, ErrNotFound) {
		t.Fatalf("yo'q token: %v", err)
	}
	// Token xeshi takrorlanmaydi.
	if err := st.CreatePlayer(ctx, "p9", tokenHash(1), "TEST_USER_9"); err == nil {
		t.Fatal("bir xil token xeshi qabul qilindi")
	}
	if err := st.SetNickname(ctx, "p2", "TEST_USER_X"); err != nil {
		t.Fatal(err)
	}
	if p, _ := st.PlayerByToken(ctx, tokenHash(2)); p.Nickname != "TEST_USER_X" {
		t.Fatalf("taxallus: %+v", p)
	}
	if err := st.RenamePlayer(ctx, "yo'q", "TEST_USER_Y"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("yo'q o'yinchini qayta nomlash: %v", err)
	}
}

func TestDeviceTokensAndTelegramLink(t *testing.T) {
	st := testStore(t)
	ctx := t.Context()
	players(t, st, 2)

	// Qurilma kaliti tiklash kodi kabi ishlaydi; asosiy kod ham ishlashda davom etadi.
	if err := st.AddToken(ctx, "p1", tokenHash(101)); err != nil {
		t.Fatal(err)
	}
	for _, n := range []int{1, 101} {
		if p, err := st.PlayerByToken(ctx, tokenHash(n)); err != nil || p.ID != "p1" {
			t.Fatalf("kalit %d: %+v %v", n, p, err)
		}
	}
	// Bir o'yinchida ko'pi bilan maxTokens ta kalit: eskilari o'chadi, oxirgisi qoladi.
	for i := range maxTokens + 5 {
		if err := st.AddToken(ctx, "p2", tokenHash(200+i)); err != nil {
			t.Fatal(err)
		}
	}
	var n int
	st.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM player_tokens WHERE player_id = 'p2'`).Scan(&n)
	if n != maxTokens {
		t.Fatalf("kalitlar soni: %d", n)
	}
	if p, err := st.PlayerByToken(ctx, tokenHash(200+maxTokens+4)); err != nil || p.ID != "p2" {
		t.Fatalf("oxirgi kalit: %+v %v", p, err)
	}

	// Telegram bog'lanishi: chat yozuvi bo'lmasa ham yaratiladi; yangi bog'lanish eskisini almashtiradi.
	if _, err := st.PlayerByChat(ctx, 42); !errors.Is(err, ErrNotFound) {
		t.Fatalf("bog'lanmagan: %v", err)
	}
	if ok, _ := st.TelegramLinked(ctx, "p1"); ok {
		t.Fatal("p1 bog'lanmagan edi")
	}
	if err := st.LinkChat(ctx, 42, "p1"); err != nil {
		t.Fatal(err)
	}
	if p, err := st.PlayerByChat(ctx, 42); err != nil || p.ID != "p1" || p.Nickname != "TEST_USER_1" {
		t.Fatalf("bog'langan: %+v %v", p, err)
	}
	if ok, _ := st.TelegramLinked(ctx, "p1"); !ok {
		t.Fatal("p1 bog'langan bo'lishi kerak")
	}
	if c, err := st.Chat(ctx, 42); err != nil || c.Lang != "uz" || c.Remind {
		t.Fatalf("yangi chat: %+v %v", c, err)
	}
	st.LinkChat(ctx, 42, "p2")
	if p, _ := st.PlayerByChat(ctx, 42); p.ID != "p2" {
		t.Fatalf("qayta bog'lash: %+v", p)
	}

	// Profil o'chirilsa — kalitlari ham, bog'lanish ham yo'qoladi.
	if _, err := st.DeletePlayer(ctx, "p2"); err != nil {
		t.Fatal(err)
	}
	if _, err := st.PlayerByToken(ctx, tokenHash(200+maxTokens+4)); !errors.Is(err, ErrNotFound) {
		t.Fatalf("o'chirilgan profil kaliti: %v", err)
	}
	st.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM player_tokens WHERE player_id = 'p2'`).Scan(&n)
	if n != 0 {
		t.Fatalf("kalitlar qoldi: %d", n)
	}
	if _, err := st.PlayerByChat(ctx, 42); !errors.Is(err, ErrNotFound) {
		t.Fatalf("o'chirilgan profilga bog'lanish: %v", err)
	}
}

func TestSaveSolutionKeepsBest(t *testing.T) {
	st := testStore(t)
	players(t, st, 1)
	if best, improved := solve(t, st, "p1", "b1", 5, 2); !improved || best.Gates != 5 || best.Stars != 2 {
		t.Fatalf("birinchi: %+v %v", best, improved)
	}
	if best, improved := solve(t, st, "p1", "b1", 4, 3); !improved || best.Gates != 4 || best.Stars != 3 {
		t.Fatalf("yaxshiroq: %+v %v", best, improved)
	}
	// Yomonroq va teng natija eng yaxshisini almashtirmaydi.
	for _, g := range []int{6, 4} {
		if best, improved := solve(t, st, "p1", "b1", g, 1); improved || best.Gates != 4 || best.Stars != 3 {
			t.Fatalf("%d element: %+v %v", g, best, improved)
		}
	}
	sols, err := st.Progress(t.Context(), "p1")
	if err != nil || len(sols) != 1 || sols[0].Circuit != `{"n":4}` || sols[0].Gates != 4 {
		t.Fatalf("progress: %+v %v", sols, err)
	}
	stats, err := st.LevelStats(t.Context(), "b1")
	if err != nil || stats.Solvers != 1 || stats.BestGates != 4 || !slices.Equal(stats.BestBy, []string{"TEST_USER_1"}) {
		t.Fatalf("daraja statistikasi: %+v %v", stats, err)
	}
}

func TestLeaderboardAndRank(t *testing.T) {
	st := testStore(t)
	ctx := t.Context()
	players(t, st, 5)
	// p1: 6★ 2 daraja; p2: 6★ 2 daraja, lekin kamroq element — p2 yuqorida; p3: 6★ 3 daraja — eng yuqorida;
	// p4: 2★; p5: hech narsa yechmagan — reytingda yo'q.
	solve(t, st, "p1", "b1", 3, 3)
	solve(t, st, "p1", "b2", 3, 3)
	solve(t, st, "p2", "b1", 2, 3)
	solve(t, st, "p2", "b2", 2, 3)
	solve(t, st, "p3", "b1", 3, 2)
	solve(t, st, "p3", "b2", 3, 2)
	solve(t, st, "p3", "b3", 3, 2)
	solve(t, st, "p4", "b1", 9, 2)

	top, err := st.Leaderboard(ctx, 10)
	if err != nil {
		t.Fatal(err)
	}
	var order []string
	for i, e := range top {
		order = append(order, e.PlayerID)
		if e.Rank != i+1 {
			t.Fatalf("o'rin raqami: %+v", e)
		}
	}
	if !slices.Equal(order, []string{"p3", "p2", "p1", "p4"}) {
		t.Fatalf("tartib: %v", order)
	}
	if e := top[1]; e.Nickname != "TEST_USER_2" || e.Stars != 6 || e.Solved != 2 || e.Gates != 4 {
		t.Fatalf("p2 qatori: %+v", e)
	}
	// Rank, Scores va PlayerScore reyting bilan mos: Score.Compare bo'yicha saralangan tartib — o'sha.
	scores := map[string]Score{}
	if err := st.Scores(ctx, func(id []byte, sc Score) { scores[string(id)] = sc }); err != nil || len(scores) != 4 {
		t.Fatalf("Scores: %v %v", scores, err)
	}
	ids := slices.Collect(maps.Keys(scores))
	slices.SortFunc(ids, func(a, b string) int { return scores[a].Compare(scores[b]) })
	if !slices.Equal(ids, order) {
		t.Fatalf("Scores tartibi: %v", ids)
	}
	for _, want := range top {
		got, err := st.Rank(ctx, want.PlayerID)
		if err != nil || *got != want {
			t.Fatalf("Rank(%s): %+v %v, kutilgan %+v", want.PlayerID, got, err, want)
		}
		sc, ok, err := st.PlayerScore(ctx, want.PlayerID)
		if err != nil || !ok || sc != scores[want.PlayerID] ||
			int(sc.Stars) != want.Stars || int(sc.Solved) != want.Solved || int(sc.Gates) != want.Gates {
			t.Fatalf("PlayerScore(%s): %+v %v %v", want.PlayerID, sc, ok, err)
		}
	}
	if _, err := st.Rank(ctx, "p5"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("yechmagan o'yinchi: %v", err)
	}
	if sc, ok, err := st.PlayerScore(ctx, "p5"); ok || err != nil || sc != (Score{}) {
		t.Fatalf("yechmagan o'yinchi ko'rsatkichi: %+v %v %v", sc, ok, err)
	}
	if names, err := st.Nicknames(ctx, []string{"p1", "p4", "yo'q"}); err != nil || len(names) != 2 || names["p4"] != "TEST_USER_4" {
		t.Fatalf("Nicknames: %v %v", names, err)
	}
	if top2, _ := st.Leaderboard(ctx, 2); len(top2) != 2 || top2[1].PlayerID != "p2" {
		t.Fatalf("limit: %+v", top2)
	}
}

// Tashlab ketilgan bo'sh profillar o'chadi; biror narsasi bor yoki yaqinda kirgan o'yinchiga tegilmaydi.
func TestDeletePlayer(t *testing.T) {
	st := testStore(t)
	ctx := t.Context()
	players(t, st, 2)
	solve(t, st, "p1", "b1", 1, 3)
	solve(t, st, "p1", "b2", 2, 2)
	solve(t, st, "p2", "b1", 1, 3)
	if _, _, err := st.SaveDaily(ctx, "p1", 20400, Solution{Gates: 3, Stars: 3, Circuit: "{}"}); err != nil {
		t.Fatal(err)
	}
	if err := st.CreateClass(ctx, "ABC123", "TEST sinf", []byte("TEST_KEY_HASH")); err != nil {
		t.Fatal(err)
	}
	if err := st.JoinClass(ctx, "ABC123", "p1", 10); err != nil {
		t.Fatal(err)
	}
	if err := st.UpsertChat(ctx, 1, "uz"); err != nil {
		t.Fatal(err)
	}
	if err := st.LinkChat(ctx, 1, "p1"); err != nil {
		t.Fatal(err)
	}

	r, err := st.DeletePlayer(ctx, "p1")
	if err != nil || r.Nickname != "TEST_USER_1" || r.Stars != 5 || r.Solved != 2 {
		t.Fatalf("o'chirish: %+v %v", r, err)
	}
	// Bog'langan hamma narsa ketdi, boshqa o'yinchiga tegilmadi.
	for _, q := range []string{
		`SELECT COUNT(*) FROM players WHERE id = 'p1'`,
		`SELECT COUNT(*) FROM solutions WHERE player_id = 'p1'`,
		`SELECT COUNT(*) FROM daily_solutions WHERE player_id = 'p1'`,
		`SELECT COUNT(*) FROM class_members WHERE player_id = 'p1'`,
	} {
		var n int
		if err := st.db.QueryRowContext(ctx, q).Scan(&n); err != nil || n != 0 {
			t.Fatalf("%s: %d %v", q, n, err)
		}
	}
	if c, err := st.Chat(ctx, 1); err != nil || c.PlayerID != "" {
		t.Fatalf("chat: %+v %v", c, err)
	}
	if p, err := st.PlayerByToken(ctx, tokenHash(2)); err != nil || p.ID != "p2" {
		t.Fatalf("p2: %+v %v", p, err)
	}
	if _, err := st.DeletePlayer(ctx, "p1"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("qayta o'chirish: %v", err)
	}
}

func TestPruneEmptyPlayers(t *testing.T) {
	st := testStore(t)
	ctx := t.Context()
	players(t, st, 8)
	const empty = 1200 // bir nechta bo'lak (pruneBatch)
	for i := range empty {
		if err := st.CreatePlayer(ctx, fmt.Sprintf("e%04d", i), tokenHash(100+i), "TEST_USER"); err != nil {
			t.Fatal(err)
		}
	}
	now := time.Now()
	old := now.Add(-100 * 24 * time.Hour).Unix()
	if _, err := st.db.ExecContext(ctx, `UPDATE players SET created_at = ?, last_seen_at = ?`, old, old); err != nil {
		t.Fatal(err)
	}
	solve(t, st, "p2", "b1", 2, 3)
	if _, _, err := st.SaveDaily(ctx, "p3", 20400, Solution{Gates: 3, Stars: 3, Circuit: "{}"}); err != nil {
		t.Fatal(err)
	}
	if err := st.CreateClass(ctx, "ABC123", "TEST sinf", []byte("TEST_KEY_HASH")); err != nil {
		t.Fatal(err)
	}
	if err := st.JoinClass(ctx, "ABC123", "p4", 10); err != nil {
		t.Fatal(err)
	}
	for _, chat := range []int64{1, 2} { // 2 — o'yinchiga bog'lanmagan chat (player_id NULL)
		if err := st.UpsertChat(ctx, chat, "uz"); err != nil {
			t.Fatal(err)
		}
	}
	if err := st.LinkChat(ctx, 1, "p5"); err != nil {
		t.Fatal(err)
	}
	st.db.ExecContext(ctx, `UPDATE players SET last_seen_at = ? WHERE id = 'p6'`, now.Unix())                             // yaqinda kirgan
	st.db.ExecContext(ctx, `UPDATE players SET created_at = ?, last_seen_at = ? WHERE id = 'p7'`, now.Unix(), now.Unix()) // yangi

	n, err := st.PruneEmptyPlayers(ctx, now.Add(-90*24*time.Hour))
	if err != nil || n != empty+2 {
		t.Fatalf("o'chirildi %d, %v", n, err)
	}
	var left []string
	rows, _ := st.db.QueryContext(ctx, `SELECT id FROM players ORDER BY id`)
	for rows.Next() {
		var id string
		rows.Scan(&id)
		left = append(left, id)
	}
	rows.Close()
	if !slices.Equal(left, []string{"p2", "p3", "p4", "p5", "p6", "p7"}) {
		t.Fatalf("qolganlar: %v", left)
	}
	if c, err := st.Chat(ctx, 1); err != nil || c.PlayerID != "p5" {
		t.Fatalf("chat: %+v %v", c, err)
	}
	// Ikkinchi marta — o'chiradigani yo'q.
	if n, err := st.PruneEmptyPlayers(ctx, now.Add(-90*24*time.Hour)); n != 0 || err != nil {
		t.Fatalf("qayta: %d %v", n, err)
	}
}

func TestDaily(t *testing.T) {
	st := testStore(t)
	ctx := t.Context()
	players(t, st, 3)
	const day = 20400
	save := func(player string, day, gates int) (DailyEntry, bool) {
		t.Helper()
		best, improved, err := st.SaveDaily(ctx, player, day, Solution{Gates: gates, Stars: 3, Circuit: "{}"})
		if err != nil {
			t.Fatal(err)
		}
		return best, improved
	}
	if best, improved := save("p1", day, 5); !improved || best.Rank != 1 || best.Gates != 5 {
		t.Fatalf("p1: %+v %v", best, improved)
	}
	if best, improved := save("p2", day, 3); !improved || best.Rank != 1 {
		t.Fatalf("p2: %+v %v", best, improved)
	}
	if _, improved := save("p1", day, 6); improved {
		t.Fatal("yomonroq natija saqlandi")
	}
	save("p1", day, 4)
	save("p3", day, 3) // p2 bilan teng — avval yechgan (yoki id bo'yicha) yuqorida

	top, err := st.DailyLeaderboard(ctx, day, 10)
	if err != nil {
		t.Fatal(err)
	}
	var order []string
	for _, e := range top {
		order = append(order, fmt.Sprintf("%s:%d", e.PlayerID, e.Gates))
	}
	if fmt.Sprint(order) != "[p2:3 p3:3 p1:4]" {
		t.Fatalf("kunlik reyting: %v", order)
	}
	if e, err := st.DailyRank(ctx, day, "p1"); err != nil || e.Rank != 3 || e.Gates != 4 {
		t.Fatalf("DailyRank: %+v %v", e, err)
	}
	if _, err := st.DailyRank(ctx, day-1, "p1"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("yechilmagan kun: %v", err)
	}
	if solvers, best, err := st.DailyStats(ctx, day); err != nil || solvers != 3 || best != 3 {
		t.Fatalf("DailyStats: %d %d %v", solvers, best, err)
	}
	if spread, _ := st.DailySpread(ctx, day); fmt.Sprint(spread) != "[{3 2} {4 1}]" {
		t.Fatalf("DailySpread: %v", spread)
	}

	// Arxiv: kunlar statistikasi va o'yinchining o'z natijalari.
	save("p1", day-2, 7)
	stats, err := st.DailyStatsRange(ctx, day-5, day)
	if err != nil || len(stats) != 2 || stats[day] != (DayStats{Solvers: 3, BestGates: 3}) || stats[day-2] != (DayStats{Solvers: 1, BestGates: 7}) {
		t.Fatalf("DailyStatsRange: %v %v", stats, err)
	}
	if stats, _ := st.DailyStatsRange(ctx, day-1, day-1); len(stats) != 0 {
		t.Fatalf("bo'sh oraliq: %v", stats)
	}
	mine, err := st.PlayerDailies(ctx, "p1", day-5, day-1)
	if err != nil || len(mine) != 1 || mine[day-2].Gates != 7 {
		t.Fatalf("PlayerDailies: %v %v", mine, err)
	}

	// Seriya: bugun va kecha uzluksiz; bugun yechilmagan bo'lsa ham kechagigacha saqlanadi.
	save("p3", day-1, 3)
	if n, _ := st.DailyStreak(ctx, "p3", day); n != 2 {
		t.Fatalf("p3 seriya: %d", n)
	}
	if n, _ := st.DailyStreak(ctx, "p3", day+1); n != 2 {
		t.Fatalf("p3 ertasi kuni: %d", n)
	}
	if n, _ := st.DailyStreak(ctx, "p1", day); n != 1 {
		t.Fatalf("p1 seriya (oraliq bor): %d", n)
	}
	if n, _ := st.DailyStreak(ctx, "p2", day+2); n != 0 {
		t.Fatalf("p2 uzilgan seriya: %d", n)
	}
}

func TestClassMembership(t *testing.T) {
	st := testStore(t)
	ctx := t.Context()
	players(t, st, 3)
	if err := st.CreateClass(ctx, "ABC123", "TEST sinf", []byte("TEST_KEY_HASH")); err != nil {
		t.Fatal(err)
	}
	if _, err := st.ClassByID(ctx, "ZZZ999"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("yo'q sinf: %v", err)
	}
	for _, p := range []string{"p1", "p2", "p2"} {
		if err := st.JoinClass(ctx, "ABC123", p, 10); err != nil {
			t.Fatal(err)
		}
	}
	if err := st.JoinClass(ctx, "ABC123", "p3", 2); !errors.Is(err, ErrClassFull) {
		t.Fatalf("to'lgan sinf: %v", err)
	}
	c, err := st.ClassByID(ctx, "ABC123")
	if err != nil || c.Members != 2 || c.Name != "TEST sinf" || string(c.KeyHash) != "TEST_KEY_HASH" {
		t.Fatalf("sinf: %+v %v", c, err)
	}
	for p, want := range map[string]bool{"p1": true, "p2": true, "p3": false} {
		if got, err := st.IsClassMember(ctx, "ABC123", p); err != nil || got != want {
			t.Fatalf("%s a'zomi: %v %v", p, got, err)
		}
	}
	if list, err := st.PlayerClasses(ctx, "p1"); err != nil || len(list) != 1 || list[0].ID != "ABC123" || list[0].Members != 2 {
		t.Fatalf("PlayerClasses: %+v %v", list, err)
	}

	// Sinf reytingi: yechganlar yuqorida, hech narsa yechmaganlar ham ro'yxatda; sinfdan tashqaridagilar yo'q.
	solve(t, st, "p2", "b1", 2, 3)
	solve(t, st, "p3", "b1", 2, 3)
	board, err := st.ClassBoard(ctx, "ABC123")
	if err != nil || len(board) != 2 || board[0].PlayerID != "p2" || board[0].Stars != 3 || board[1].PlayerID != "p1" || board[1].Rank != 2 {
		t.Fatalf("ClassBoard: %+v %v", board, err)
	}

	if err := st.LeaveClass(ctx, "ABC123", "p1"); err != nil {
		t.Fatal(err)
	}
	if c, _ := st.ClassByID(ctx, "ABC123"); c.Members != 1 {
		t.Fatalf("chiqqandan keyin: %+v", c)
	}
	// Sinf o'chirilsa — a'zoliklar ham, natijalar qoladi.
	if err := st.DeleteClass(ctx, "ABC123"); err != nil {
		t.Fatal(err)
	}
	if list, _ := st.PlayerClasses(ctx, "p2"); len(list) != 0 {
		t.Fatalf("o'chirilgan sinf a'zoligi qoldi: %+v", list)
	}
	if sols, _ := st.Progress(context.Background(), "p2"); len(sols) != 1 {
		t.Fatalf("natija yo'qoldi: %+v", sols)
	}
}

func TestFunnelCounts(t *testing.T) {
	st := testStore(t)
	ctx := t.Context()
	for _, e := range []struct {
		day     int
		ev, src string
	}{
		{100, EvVisit, "web"}, {100, EvVisit, "web"}, {100, EvVisit, "tg"}, {100, EvLevel1, "web"},
		{103, EvVisit, "web"}, {103, EvReturn, "tg"},
		{93, EvVisit, "web"}, // oraliqdan tashqarida
	} {
		if err := st.CountEvent(ctx, e.day, e.ev, e.src); err != nil {
			t.Fatal(err)
		}
	}
	players(t, st, 2)
	f, err := st.Funnel(ctx, 96, 103, time.Now().Add(-time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if f.Events[EvVisit] != 4 || f.TG[EvVisit] != 1 || f.Events[EvLevel1] != 1 || f.Events[EvReturn] != 1 || f.TG[EvReturn] != 1 || f.Profiles != 2 {
		t.Fatalf("voronka: %+v", f)
	}
	if f, _ := st.Funnel(ctx, 96, 103, time.Now().Add(time.Hour)); f.Profiles != 0 {
		t.Fatalf("profillar oraliqdan tashqarida: %+v", f)
	}
}

func TestContests(t *testing.T) {
	st := testStore(t)
	ctx := t.Context()
	players(t, st, 3)
	if err := st.CreateClass(ctx, "CLS001", "TEST sinf", tokenHash(90)); err != nil {
		t.Fatal(err)
	}
	for _, p := range []string{"p1", "p2", "p3"} {
		st.JoinClass(ctx, "CLS001", p, 10)
	}
	start := time.Unix(1_800_000_000, 0)
	c := &Contest{ClassID: "CLS001", Title: "TEST", Levels: []string{"b1", "b2"}, StartsAt: start, EndsAt: start.Add(10 * time.Minute)}
	if err := st.CreateContest(ctx, c, 2); err != nil || c.ID == 0 {
		t.Fatalf("yaratish: %v %+v", err, c)
	}
	if err := st.CreateContest(ctx, &Contest{ClassID: "CLS001", Levels: []string{"b1"}, StartsAt: start.Add(time.Minute), EndsAt: start.Add(time.Hour)}, 2); !errors.Is(err, ErrContestActive) {
		t.Fatalf("davom etayotganida: %v", err)
	}
	// Eng yaxshi natija qoladi; teng yulduzda avvalroq erishgan yuqorida; hech narsa yechmagan — oxirida.
	at := func(m int) time.Time { return start.Add(time.Duration(m) * time.Minute) }
	st.SaveContestSolve(ctx, c.ID, "p1", "b1", 4, 2, at(1))
	if ok, _ := st.SaveContestSolve(ctx, c.ID, "p1", "b1", 3, 3, at(3)); !ok {
		t.Fatal("yaxshiroq yechim yozilmadi")
	}
	if ok, _ := st.SaveContestSolve(ctx, c.ID, "p1", "b1", 5, 1, at(4)); ok {
		t.Fatal("yomonroq yechim yozildi")
	}
	st.SaveContestSolve(ctx, c.ID, "p2", "b1", 3, 3, at(2))
	st.SaveContestSolve(ctx, c.ID, "p2", "x9", 3, 3, at(2)) // musobaqada yo'q daraja — hisobga kirmaydi
	board, err := st.ContestBoard(ctx, c)
	if err != nil {
		t.Fatal(err)
	}
	if len(board) != 3 || board[0].PlayerID != "p2" || board[0].Stars != 3 || board[1].PlayerID != "p1" || board[1].Rank != 2 ||
		board[2].PlayerID != "p3" || board[2].Solved != 0 || board[0].Levels["b1"] != 3 {
		t.Fatalf("reyting: %+v", board)
	}

	// Tugatish, keyin yangisi; sinfda ko'pi bilan keep ta qoladi (eng eskisi natijalari bilan o'chadi).
	if err := st.StopContest(ctx, "CLS001", c.ID, at(5)); err != nil {
		t.Fatal(err)
	}
	if got, _ := st.LatestContest(ctx, "CLS001"); got.ID != c.ID || got.Active(at(6)) || !got.EndsAt.Equal(at(5)) {
		t.Fatalf("tugatilgan: %+v", got)
	}
	for i := range 2 {
		n := &Contest{ClassID: "CLS001", Levels: []string{"b1"}, StartsAt: at(10 + i*20), EndsAt: at(15 + i*20)}
		if err := st.CreateContest(ctx, n, 2); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := st.ContestByID(ctx, "CLS001", c.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("eski musobaqa qoldi: %v", err)
	}
	var n int
	st.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM contest_solves WHERE contest_id = ?`, c.ID).Scan(&n)
	if n != 0 {
		t.Fatalf("eski natijalar qoldi: %d", n)
	}
}
