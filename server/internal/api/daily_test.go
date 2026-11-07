package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"

	"logicgate/levels"
	"logicgate/server/internal/sim"
)

func dailySolutions(t *testing.T) []sim.Circuit {
	raw, err := os.ReadFile("../../../levels/daily-solutions.json")
	if err != nil {
		t.Fatal(err)
	}
	var sols []sim.Circuit
	json.Unmarshal(raw, &sols)
	return sols
}

// firstDay — birinchi masala kuni.
func (e *testEnv) firstDay() int {
	start, _ := time.ParseInLocation(time.DateOnly, e.daily.Start, levels.Tashkent)
	return levels.DayOf(start)
}

// at soatni birinchi kundan n kun keyingi tush paytiga qo'yadi va o'sha kunni qaytaradi.
func (e *testEnv) at(n int) int {
	day := e.firstDay() + n
	e.setNow(levels.DayStart(day).Add(12 * time.Hour))
	return day
}

// padded — to'g'ri yechimga keraksiz element qo'shib, elementlar sonini oshiradi.
func padded(c sim.Circuit, gateType string) sim.Circuit {
	out := sim.Circuit{Gates: append([]sim.Gate{}, c.Gates...), Wires: append([]sim.Wire{}, c.Wires...)}
	out.Gates = append(out.Gates, sim.Gate{ID: "pad", Type: gateType})
	out.Wires = append(out.Wires, sim.Wire{From: "in:A", To: "pad:0"})
	if gateType != "NOT" {
		out.Wires = append(out.Wires, sim.Wire{From: "in:B", To: "pad:1"})
	}
	return out
}

func TestDailyFlow(t *testing.T) {
	e := newEnv(t)
	sols := dailySolutions(t)
	day := e.at(3)
	sol := sols[3]
	puzzle, _ := e.daily.For(day)

	status, out := e.do("GET", "/api/daily", "", nil)
	if status != 200 || int(out["day"].(float64)) != day || out["number"].(float64) != 4 || out["me"] != nil {
		t.Fatalf("GET /api/daily: %d %v", status, out)
	}
	p := out["puzzle"].(map[string]any)
	if int(p["goal"].(float64)) != puzzle.Goal || p["target"] == nil || out["streak"].(float64) != 0 {
		t.Fatalf("masala: %v", out)
	}
	if int64(out["nextAt"].(float64)) != levels.DayStart(day+1).Unix() {
		t.Fatalf("nextAt: %v", out["nextAt"])
	}

	alice, bob := e.player("Alice"), e.player("Bob")
	path := fmt.Sprintf("/api/daily/%d/solve", day)

	// Bob birinchi, lekin ortiqcha element bilan; Alice keyin, eng kam element bilan — u yuqorida.
	status, out = e.do("POST", path, bob, map[string]any{"circuit": padded(sol, puzzle.Gates[0])})
	if status != 200 || out["stars"].(float64) != 2 || out["streak"].(float64) != 1 {
		t.Fatalf("bob: %d %v", status, out)
	}
	status, out = e.do("POST", path, alice, map[string]any{"circuit": sol})
	best := out["best"].(map[string]any)
	if status != 200 || out["stars"].(float64) != 3 || best["rank"].(float64) != 1 || out["solvers"].(float64) != 2 {
		t.Fatalf("alice: %d %v", status, out)
	}
	// Yomonroq yechim natijani buzmaydi.
	status, out = e.do("POST", path, alice, map[string]any{"circuit": padded(sol, puzzle.Gates[0])})
	if status != 200 || out["improved"].(bool) || out["best"].(map[string]any)["gates"].(float64) != float64(puzzle.Goal) {
		t.Fatalf("alice yomonroq: %d %v", status, out)
	}

	status, out = e.do("GET", fmt.Sprintf("/api/daily/%d/leaderboard", day), bob, nil)
	top := out["top"].([]any)
	if status != 200 || len(top) != 2 || top[0].(map[string]any)["nickname"] != "Alice" || out["me"].(map[string]any)["rank"].(float64) != 2 {
		t.Fatalf("reyting: %d %v", status, out)
	}
	_, out = e.do("GET", "/api/daily", alice, nil)
	if me := out["me"].(map[string]any); me["rank"].(float64) != 1 || out["streak"].(float64) != 1 {
		t.Fatalf("alice /daily: %v", out)
	}

	// Noto'g'ri sxema va noto'g'ri kunlar.
	status, out = e.do("POST", path, alice, map[string]any{"circuit": sim.Circuit{}})
	if status != http.StatusUnprocessableEntity {
		t.Fatalf("bo'sh sxema: %d %v", status, out)
	}
	if status, _ = e.do("POST", fmt.Sprintf("/api/daily/%d/solve", day+1), alice, map[string]any{"circuit": sols[4]}); status != 404 {
		t.Fatalf("ertangi kun: %d", status)
	}
	if status, _ = e.do("GET", fmt.Sprintf("/api/daily/%d/leaderboard", day+1), "", nil); status != 404 {
		t.Fatalf("ertangi reyting: %d", status)
	}
	if status, _ = e.do("POST", fmt.Sprintf("/api/daily/%d/solve", day-2), alice, map[string]any{"circuit": sols[1]}); status != http.StatusConflict {
		t.Fatalf("eski kun: %d", status)
	}
	if status, _ = e.do("POST", "/api/daily/abc/solve", alice, map[string]any{"circuit": sol}); status != 404 {
		t.Fatalf("noto'g'ri kun: %d", status)
	}
}

func TestDailyStreak(t *testing.T) {
	e := newEnv(t)
	sols := dailySolutions(t)
	code := e.player("Streaker")
	var lastTodaySolved bool
	solve := func(n int) float64 {
		day := e.firstDay() + n
		status, out := e.do("POST", fmt.Sprintf("/api/daily/%d/solve", day), code, map[string]any{"circuit": sols[n]})
		if status != 200 {
			t.Fatalf("%d-kun: %d %v", n, status, out)
		}
		lastTodaySolved = out["todaySolved"].(bool)
		return out["streak"].(float64)
	}
	streak := func() float64 {
		_, out := e.do("GET", "/api/daily", code, nil)
		return out["streak"].(float64)
	}

	e.at(0)
	if s := solve(0); s != 1 {
		t.Fatalf("1-kun seriya %v", s)
	}
	e.at(1)
	if s := streak(); s != 1 {
		t.Fatalf("ertasi kuni, yechilmagan: seriya %v (kechagisi saqlanishi kerak)", s)
	}
	if s := solve(1); s != 2 {
		t.Fatalf("2-kun seriya %v", s)
	}
	// 2-kun yechilmagan: 3-kuni seriya uzilgan. Kechagi (2-kun) masalani kech yuborish qabul qilinadi
	// va oraliqni to'ldiradi.
	e.at(3)
	if s := streak(); s != 0 {
		t.Fatalf("bir kun o'tkazib yuborilgach seriya %v", s)
	}
	if s := solve(2); s != 3 {
		t.Fatalf("kechagi masala: seriya %v", s)
	}
	if lastTodaySolved {
		t.Fatal("bugun hali yechilmagan, todaySolved false bo'lishi kerak")
	}
	if s := solve(3); s != 4 {
		t.Fatalf("bugungi masala: seriya %v", s)
	}
	if !lastTodaySolved {
		t.Fatal("bugungi masala yechildi, todaySolved true bo'lishi kerak")
	}
	// Bugungisidan keyin kechagini qayta yuborish: seriya bugunni ham o'z ichiga oladi.
	if s := solve(2); s != 4 || !lastTodaySolved {
		t.Fatalf("kechagini qayta yuborish: seriya %v, todaySolved %v", s, lastTodaySolved)
	}
	// Ikki kun o'tsa — seriya uziladi.
	e.at(6)
	if s := streak(); s != 0 {
		t.Fatalf("ikki kundan keyin seriya %v", s)
	}
}
