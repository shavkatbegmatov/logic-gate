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

func (e *testEnv) lbCached() bool {
	e.api.lbMu.Lock()
	defer e.api.lbMu.Unlock()
	return e.api.lbData != nil
}

// Reyting va o'yinchi o'rni bitta keshdan: oynada bazaga qayta murojaat yo'q, yaxshilangan yechim va
// taxallus o'zgarishi keshni tozalaydi.
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
	// Bazaga to'g'ridan-to'g'ri yozilgan natija (keshni tozalamaydi) oynada ko'rinmaydi — ya'ni har so'rov
	// reytingni qayta hisoblamaydi. Keshda yo'q o'yinchi — me: null.
	for _, lv := range []string{"b2", "b3"} {
		if _, _, err := e.api.store.SaveSolution(ctx, valiID, store.Solution{LevelID: lv, Gates: 1, Stars: 3, Circuit: "{}"}); err != nil {
			t.Fatal(err)
		}
	}
	_, out = e.do("GET", "/api/leaderboard", vali, nil)
	if top := out["top"].([]any); len(top) != 1 || out["me"] != nil {
		t.Fatalf("keshdan: %v", out)
	}

	// API orqali yaxshilangan yechim keshni tozalaydi: Vali (9★) birinchi.
	if status, _ := e.do("POST", "/api/levels/b1/solve", vali, map[string]any{"circuit": sols["b1"]}); status != 200 {
		t.Fatal("yechim 2")
	}
	_, out = e.do("GET", "/api/leaderboard", ali, nil)
	top := out["top"].([]any)
	if len(top) != 2 || top[0].(map[string]any)["nickname"] != "TEST_VALI" || out["me"].(map[string]any)["rank"] != 2.0 {
		t.Fatalf("yangilangan reyting: %v", out)
	}
	_, out = e.do("GET", "/api/leaderboard", vali, nil)
	if me := out["me"].(map[string]any); me["rank"] != 1.0 || me["stars"] != 9.0 || me["solved"] != 3.0 {
		t.Fatalf("Vali o'rni: %v", out)
	}

	// Taxallus: o'sha nom keshni tozalamaydi, yangisi tozalaydi.
	if status, _ := e.do("PATCH", "/api/me", ali, map[string]string{"nickname": " TEST_ALI "}); status != 200 || !e.lbCached() {
		t.Fatalf("o'zgarmagan taxallus keshni tozaladi: %d", status)
	}
	if status, _ := e.do("PATCH", "/api/me", ali, map[string]string{"nickname": "TEST_ALI_2"}); status != 200 || e.lbCached() {
		t.Fatalf("yangi taxallus keshni tozalamadi: %d", status)
	}
	_, out = e.do("GET", "/api/leaderboard", ali, nil)
	if top := out["top"].([]any); top[1].(map[string]any)["nickname"] != "TEST_ALI_2" || out["me"].(map[string]any)["nickname"] != "TEST_ALI_2" {
		t.Fatalf("yangi taxallus: %v", out)
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
