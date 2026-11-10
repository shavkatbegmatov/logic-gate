package api

import (
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"

	"logicgate/server/internal/store"
)

// raw — javob tanasi baytlarda (keshdan kelgan javob bilan solishtirish uchun).
func (e *testEnv) raw(path, code string) string {
	e.t.Helper()
	req, _ := http.NewRequest("GET", e.srv.URL+path, nil)
	if code != "" {
		req.Header.Set("Authorization", "Bearer "+code)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		e.t.Fatal(err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return string(b)
}

func (e *testEnv) playerID(code string) string {
	e.t.Helper()
	_, out := e.do("GET", "/api/me", code, nil)
	return out["id"].(string)
}

// lbBuilds — nechta reyting hisoblash boshlangan.
func (e *testEnv) lbBuilds() int {
	e.api.lbMu.Lock()
	defer e.api.lbMu.Unlock()
	return e.api.lbBuilds
}

// lbSettle — fonda davom etayotgan hisoblash tugashini kutadi.
func (e *testEnv) lbSettle() {
	e.api.lbMu.Lock()
	wait := e.api.lbWait
	e.api.lbMu.Unlock()
	if wait != nil {
		<-wait
	}
}

// lbAge — keshni d ga eskirtiradi (soatni surish o'rniga).
func (e *testEnv) lbAge(d time.Duration) {
	e.api.lbMu.Lock()
	defer e.api.lbMu.Unlock()
	e.api.lbStarted = e.api.lbStarted.Add(-d)
	if e.api.lb != nil {
		e.api.lb.at = e.api.lb.at.Add(-d)
	}
}

// Reyting keshi: oynada bazaga qayta murojaat yo'q; yechim va taxallus qayta hisoblashni majburlamaydi
// (taxallus keshdagi yozuvda almashadi); muddat o'tgach eskisi beriladi va yangisi fonda hisoblanadi;
// o'yinchining o'z ko'rsatkichi esa har doim yangi.
func TestLeaderboardCache(t *testing.T) {
	e := newEnv(t)
	sols := solutions(t)
	ctx := t.Context()
	ali, vali := e.player("TEST_ALI"), e.player("TEST_VALI")
	valiID := e.playerID(vali)
	if status, _ := e.do("POST", "/api/levels/b1/solve", ali, map[string]any{"circuit": sols["b1"]}); status != 200 {
		t.Fatal("yechim")
	}

	first := e.raw("/api/leaderboard", ali)
	_, out := e.do("GET", "/api/leaderboard", ali, nil)
	if me := out["me"].(map[string]any); me["rank"] != 1.0 || me["nickname"] != "TEST_ALI" || me["me"] != true {
		t.Fatalf("me: %v", out)
	}
	// Keshdan kelgan javob bayt-bayt bir xil.
	if again := e.raw("/api/leaderboard", ali); again != first {
		t.Fatalf("keshdagi javob boshqacha:\n%s\n%s", first, again)
	}
	// Bazaga yozilgan yangi natija ro'yxatda darhol ko'rinmaydi (har so'rov qayta hisoblamaydi), lekin
	// o'yinchining o'z ko'rsatkichi va o'rni (keshdagilarga nisbatan) yangi.
	for _, lv := range []string{"b2", "b3"} {
		if _, _, err := e.api.store.SaveSolution(ctx, valiID, store.Solution{LevelID: lv, Gates: 1, Stars: 3, Circuit: "{}"}); err != nil {
			t.Fatal(err)
		}
	}
	_, out = e.do("GET", "/api/leaderboard", vali, nil)
	if top, me := out["top"].([]any), out["me"].(map[string]any); len(top) != 1 || me["rank"] != 1.0 || me["stars"] != 6.0 {
		t.Fatalf("keshdan: %v", out)
	}

	// API orqali yaxshilangan yechim ham qayta hisoblashni majburlamaydi.
	if status, _ := e.do("POST", "/api/levels/b1/solve", vali, map[string]any{"circuit": sols["b1"]}); status != 200 {
		t.Fatal("yechim 2")
	}
	if _, out = e.do("GET", "/api/leaderboard", ali, nil); len(out["top"].([]any)) != 1 || e.lbBuilds() != 1 {
		t.Fatalf("yechimdan keyin qayta hisoblandi: %d %v", e.lbBuilds(), out)
	}

	// Muddat o'tdi: bu so'rov eskisini oladi, yangisi fonda hisoblanadi; keyingisi — yangi reyting.
	e.lbAge(leaderboardCache)
	if _, out = e.do("GET", "/api/leaderboard", ali, nil); len(out["top"].([]any)) != 1 {
		t.Fatalf("eskisi kutilgan: %v", out)
	}
	e.lbSettle()
	_, out = e.do("GET", "/api/leaderboard", ali, nil)
	top := out["top"].([]any)
	if len(top) != 2 || top[0].(map[string]any)["nickname"] != "TEST_VALI" || out["me"].(map[string]any)["rank"] != 2.0 || e.lbBuilds() != 2 {
		t.Fatalf("yangilangan reyting: %d %v", e.lbBuilds(), out)
	}
	_, out = e.do("GET", "/api/leaderboard", vali, nil)
	if me := out["me"].(map[string]any); me["rank"] != 1.0 || me["stars"] != 9.0 || me["solved"] != 3.0 {
		t.Fatalf("Vali o'rni: %v", out)
	}

	// Taxallus: yangi nom keshdagi yozuvda darhol almashadi, reyting qayta hisoblanmaydi — nom
	// almashtirish + reyting so'rovini to'xtovsiz takrorlash bazaga yuk bermaydi.
	for i := range 20 {
		nick := fmt.Sprintf("TEST_ALI_%d", i%2)
		if status, _ := e.do("PATCH", "/api/me", ali, map[string]string{"nickname": nick}); status != 200 {
			t.Fatalf("taxallus: %d", status)
		}
		_, out = e.do("GET", "/api/leaderboard", ali, nil)
		if top := out["top"].([]any); top[1].(map[string]any)["nickname"] != nick || out["me"].(map[string]any)["nickname"] != nick {
			t.Fatalf("yangi taxallus: %v", out)
		}
	}
	if n := e.lbBuilds(); n != 2 {
		t.Fatalf("taxallus reytingni qayta hisoblatdi: %d", n)
	}

	// Juda eski holat berilmaydi: uzoq tanaffusdan keyingi so'rov yangisini kutadi.
	if _, _, err := e.api.store.SaveSolution(ctx, e.playerID(ali), store.Solution{LevelID: "b4", Gates: 1, Stars: 3, Circuit: "{}"}); err != nil {
		t.Fatal(err)
	}
	e.lbAge(leaderboardMaxStale)
	if _, out = e.do("GET", "/api/leaderboard", "", nil); out["top"].([]any)[1].(map[string]any)["stars"] != 6.0 || e.lbBuilds() != 3 {
		t.Fatalf("juda eski holat berildi: %d %v", e.lbBuilds(), out)
	}
}

// Keshdagi reyting (bitta o'tish + yuqori 50 tanlash + ikkilik qidiruv) SQL reyting bilan bir xil.
func TestLeaderboardMatchesSQL(t *testing.T) {
	e := newEnv(t)
	ctx := t.Context()
	levels := e.api.pack.Levels
	const n = 80
	for i := range n {
		id := fmt.Sprintf("p%03d", (i*37)%n) // id tartibi natija tartibiga bog'liq emas
		if err := e.api.store.CreatePlayer(ctx, id, []byte(id), "TEST_USER_"+id); err != nil {
			t.Fatal(err)
		}
		// Teng ko'rsatkich yo'q: (yechilgan, elementlar) har o'yinchida boshqacha.
		for k := range i%10 + 1 {
			if _, _, err := e.api.store.SaveSolution(ctx, id, store.Solution{LevelID: levels[k].ID, Gates: i + 1, Stars: 1, Circuit: "{}"}); err != nil {
				t.Fatal(err)
			}
		}
	}
	snap, err := e.api.cachedLeaderboard(ctx)
	if err != nil {
		t.Fatal(err)
	}
	want, err := e.api.store.Leaderboard(ctx, leaderboardSize)
	if err != nil || len(snap.top) != leaderboardSize || len(snap.scores) != n {
		t.Fatalf("top %d, scores %d, %v", len(snap.top), len(snap.scores), err)
	}
	for i := range want {
		if snap.top[i] != want[i] {
			t.Fatalf("%d-o'rin: %+v, SQL %+v", i+1, snap.top[i], want[i])
		}
	}
	for i := range n {
		id := fmt.Sprintf("p%03d", i)
		sc, ok, err := e.api.store.PlayerScore(ctx, id)
		r, err2 := e.api.store.Rank(ctx, id)
		if err != nil || err2 != nil || !ok || snap.rank(sc) != r.Rank {
			t.Fatalf("%s: o'rin %d, SQL %+v (%v %v)", id, snap.rank(sc), r, err, err2)
		}
	}
}

// Arxiv: umumiy statistika keshdan (TTL va kun bo'yicha), o'yinchining o'z natijalari esa har safar yangi.
func TestDailyArchiveCache(t *testing.T) {
	e := newEnv(t)
	sols := dailySolutions(t)
	ctx := t.Context()
	first := e.firstDay()
	alice, bob := e.player("TEST_ALICE"), e.player("TEST_BOB")
	bobID := e.playerID(bob)
	e.at(0)
	if status, _ := e.do("POST", fmt.Sprintf("/api/daily/%d/solve", first), alice, map[string]any{"circuit": sols[0]}); status != 200 {
		t.Fatal("yechim")
	}

	e.at(3)
	before := e.raw("/api/daily/archive", "")
	if again := e.raw("/api/daily/archive", ""); again != before {
		t.Fatalf("keshdagi javob boshqacha:\n%s\n%s", before, again)
	}
	oldest := func(code string) map[string]any {
		t.Helper()
		_, out := e.do("GET", "/api/daily/archive", code, nil)
		days := out["days"].([]any)
		return days[len(days)-1].(map[string]any)
	}
	// Bob natijasi bazaga to'g'ridan-to'g'ri: statistika keshdan (1 kishi), lekin Bobning o'zi natijasini ko'radi.
	if _, _, err := e.api.store.SaveDaily(ctx, bobID, first, store.Solution{Gates: 9, Stars: 1, Circuit: "{}"}); err != nil {
		t.Fatal(err)
	}
	if d := oldest(bob); d["solvers"] != 1.0 || d["me"].(map[string]any)["gates"] != 9.0 {
		t.Fatalf("Bob: %v", d)
	}
	// Kesh o'yinchi natijasi bilan "ifloslanmaydi".
	if d := oldest(""); d["me"] != nil || d["solvers"] != 1.0 {
		t.Fatalf("anonim: %v", d)
	}
	if d := oldest(alice); d["me"].(map[string]any)["stars"] != 3.0 {
		t.Fatalf("Alice: %v", d)
	}
	// TTL o'tgach — yangi statistika.
	e.api.archMu.Lock()
	e.api.archAt = time.Now().Add(-2 * archiveCacheTTL)
	e.api.archMu.Unlock()
	if d := oldest(""); d["solvers"] != 2.0 {
		t.Fatalf("TTL dan keyin: %v", d)
	}

	// Kun almashsa (Toshkent yarim tuni) kesh ham yangilanadi.
	today := e.at(4)
	_, out := e.do("GET", "/api/daily/archive", "", nil)
	newest := out["days"].([]any)[0].(map[string]any)
	if int(out["today"].(float64)) != today || int(newest["day"].(float64)) != today-1 || newest["solvers"] != 0.0 {
		t.Fatalf("yangi kun: %v", out)
	}
	// Kechagi masala API orqali yechilsa — arxiv statistikasi darhol yangilanadi.
	if status, out := e.do("POST", fmt.Sprintf("/api/daily/%d/solve", today-1), alice, map[string]any{"circuit": sols[3]}); status != 200 {
		t.Fatalf("kechagi masala: %d %v", status, out)
	}
	_, out = e.do("GET", "/api/daily/archive", "", nil)
	if newest := out["days"].([]any)[0].(map[string]any); newest["solvers"] != 1.0 {
		t.Fatalf("kechagi yechimdan keyin: %v", newest)
	}
}
