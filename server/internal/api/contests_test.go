package api

import (
	"net/http"
	"strconv"
	"testing"
	"time"
)

// Faqat soxta ma'lumot: TEST_USER taxalluslari, sinf «TEST sinf».
func TestClassContest(t *testing.T) {
	e := newEnv(t)
	sols := solutions(t)
	now := time.Now()
	e.setNow(now)

	_, cls := e.do("POST", "/api/classes", "", map[string]string{"name": "TEST sinf"})
	code, key := cls["code"].(string), cls["key"].(string)
	base := "/api/classes/" + code
	ali, vali, sami := e.player("TEST_USER_A"), e.player("TEST_USER_B"), e.player("TEST_USER_C")
	for _, c := range []string{ali, vali} {
		if st, out := e.do("POST", base+"/join", c, nil); st != 200 {
			t.Fatalf("qo'shilish: %d %v", st, out)
		}
	}

	// Musobaqa yo'q.
	if st, out := e.do("GET", base+"/contest", ali, nil); st != http.StatusNotFound || out["error"] != "no_contest" {
		t.Fatalf("musobaqasiz: %d %v", st, out)
	}
	// Faqat o'qituvchi boshlaydi; noto'g'ri vaqt yoki darajalar — rad.
	body := map[string]any{"title": "Juma musobaqasi", "levels": []string{"b2", "b1"}, "minutes": 10}
	if st, _ := e.doKeyBody("POST", base+"/contests", "", body); st != http.StatusForbidden {
		t.Fatalf("kalitsiz: %d", st)
	}
	for _, bad := range []map[string]any{
		{"levels": []string{"b1"}, "minutes": 1},
		{"levels": []string{"b1"}, "minutes": 121},
		{"levels": []string{}, "minutes": 10},
		{"levels": []string{"yoq"}, "minutes": 10},
	} {
		if st, out := e.doKeyBody("POST", base+"/contests", key, bad); st != http.StatusBadRequest {
			t.Fatalf("%v: %d %v", bad, st, out)
		}
	}
	st, ct := e.doKeyBody("POST", base+"/contests", key, body)
	if st != http.StatusCreated || ct["remaining"].(float64) != 600 || ct["levels"].([]any)[0] != "b1" {
		t.Fatalf("boshlash: %d %v", st, ct)
	}
	id := ct["id"].(float64)
	cbase := base + "/contests/" + ftoa(id)
	if st, out := e.doKeyBody("POST", base+"/contests", key, body); st != http.StatusConflict || out["error"] != "contest_active" {
		t.Fatalf("ikkinchisi: %d %v", st, out)
	}

	// O'quvchilar musobaqani sinflar ro'yxatida va sinf sahifasida ko'radi.
	if _, out := e.do("GET", "/api/me/classes", ali, nil); out["classes"].([]any)[0].(map[string]any)["contest"] == nil {
		t.Fatalf("me/classes: %v", out)
	}
	if _, out := e.do("GET", base, ali, nil); out["contest"] == nil {
		t.Fatalf("sinf sahifasi: %v", out)
	}

	solve := func(code, level string, wantStatus int) map[string]any {
		t.Helper()
		st, out := e.do("POST", cbase+"/solve", code, map[string]any{"level": level, "circuit": sols[level]})
		if st != wantStatus {
			t.Fatalf("%s %s: %d %v", code, level, st, out)
		}
		return out
	}
	// A'zo bo'lmagan — rad; musobaqada yo'q daraja — rad; noto'g'ri sxema — 422.
	solve(sami, "b1", http.StatusForbidden)
	solve(ali, "b3", http.StatusNotFound)
	if st, _ := e.do("POST", cbase+"/solve", ali, map[string]any{"level": "b1", "circuit": map[string]any{"gates": []any{}, "wires": []any{}}}); st != http.StatusUnprocessableEntity {
		t.Fatalf("noto'g'ri sxema: %d", st)
	}

	e.setNow(now.Add(time.Minute))
	out := solve(vali, "b1", 200)
	if out["stars"] != 3.0 || out["rank"] != 1.0 || out["total"] != 3.0 || out["improved"] != true {
		t.Fatalf("birinchi yechim: %v", out)
	}
	e.setNow(now.Add(2 * time.Minute))
	solve(ali, "b1", 200)
	solve(ali, "b2", 200)
	// Xuddi shu yechim qayta — yaxshilanmadi.
	if out := solve(ali, "b2", 200); out["improved"] != false || out["rank"] != 1.0 {
		t.Fatalf("takror: %v", out)
	}

	// Reyting: o'quvchi o'zini ko'radi; o'qituvchi — proyektor uchun (o'zi yo'q).
	_, board := e.do("GET", base+"/contest", vali, nil)
	rows := board["board"].([]any)
	first, second := rows[0].(map[string]any), rows[1].(map[string]any)
	if first["nickname"] != "TEST_USER_A" || first["stars"] != 6.0 || first["solved"] != 2.0 || second["me"] != true || second["rank"] != 2.0 {
		t.Fatalf("reyting: %v", rows)
	}
	if first["levels"].(map[string]any)["b2"] != 3.0 {
		t.Fatalf("darajalar: %v", first)
	}
	if st, _ := e.doKey("GET", base+"/contest/teacher", "XXXX-XXXX-XXXX-XXXX"); st != http.StatusForbidden {
		t.Fatalf("noto'g'ri kalit: %d", st)
	}
	st, tb := e.doKey("GET", base+"/contest/teacher", key)
	if st != 200 || len(tb["board"].([]any)) != 2 || tb["board"].([]any)[1].(map[string]any)["me"] != nil {
		t.Fatalf("o'qituvchi reytingi: %d %v", st, tb)
	}

	// Muddatidan oldin tugatish: keyin yechim qabul qilinmaydi (bir oz kechikkani — qabul), ro'yxatda yo'qoladi.
	if st, _ := e.doKey("POST", cbase+"/stop", key); st != 200 {
		t.Fatalf("tugatish: %d", st)
	}
	solve(vali, "b2", 200) // contestGrace ichida
	e.setNow(now.Add(2*time.Minute + contestGrace + time.Second))
	if out := solve(vali, "b2", http.StatusConflict); out["error"] != "contest_over" {
		t.Fatalf("tugagandan keyin: %v", out)
	}
	if _, out := e.do("GET", "/api/me/classes", ali, nil); out["classes"].([]any)[0].(map[string]any)["contest"] != nil {
		t.Fatalf("tugagan musobaqa ro'yxatda: %v", out)
	}
	_, board = e.do("GET", base+"/contest", ali, nil)
	if board["contest"].(map[string]any)["remaining"] != 0.0 {
		t.Fatalf("natijalar: %v", board)
	}
	// Tugagach yangisini boshlasa bo'ladi.
	if st, out := e.doKeyBody("POST", base+"/contests", key, body); st != http.StatusCreated {
		t.Fatalf("yangi musobaqa: %d %v", st, out)
	}
}

func ftoa(f float64) string { return strconv.FormatInt(int64(f), 10) }
