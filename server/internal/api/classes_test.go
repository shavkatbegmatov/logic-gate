package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"logicgate/levels"
	"logicgate/server/internal/store"
)

// doKey — o'qituvchi kaliti bilan so'rov.
func (e *testEnv) doKey(method, path, key string) (int, map[string]any) {
	e.t.Helper()
	return e.doKeyBody(method, path, key, nil)
}

// doKeyBody — o'qituvchi kaliti va JSON tanasi bilan so'rov.
func (e *testEnv) doKeyBody(method, path, key string, body any) (int, map[string]any) {
	e.t.Helper()
	var rd io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	}
	req, _ := http.NewRequest(method, e.srv.URL+path, rd)
	if key != "" {
		req.Header.Set(keyHeader, key)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		e.t.Fatal(err)
	}
	defer resp.Body.Close()
	var out map[string]any
	json.NewDecoder(resp.Body).Decode(&out)
	return resp.StatusCode, out
}

func TestClassFlow(t *testing.T) {
	e := newEnv(t)
	sols := solutions(t)

	// O'qituvchi sinf yaratadi.
	if status, out := e.do("POST", "/api/classes", "", map[string]string{"name": "x"}); status != 400 || out["error"] != "bad_class_name" {
		t.Fatalf("qisqa nom: %d %v", status, out)
	}
	status, out := e.do("POST", "/api/classes", "", map[string]string{"name": "  8-B  sinf, 12-maktab "})
	if status != 201 || out["name"] != "8-B sinf, 12-maktab" {
		t.Fatalf("sinf yaratilmadi: %d %v", status, out)
	}
	code, key := out["code"].(string), out["key"].(string)
	if len(code) != classCodeLen || normalizeClassCode(code) != code || normalizeCode(key) == "" {
		t.Fatalf("kod/kalit: %q %q", code, key)
	}
	if status, out := e.do("GET", "/api/classes/"+code, "", nil); status != 200 || out["members"] != 0.0 || out["member"] != nil || out["key"] != nil {
		t.Fatalf("sinf ma'lumoti: %d %v", status, out)
	}
	if status, _ := e.do("GET", "/api/classes/ZZZZZZ", "", nil); status != 404 {
		t.Fatalf("yo'q sinf: %d", status)
	}

	ali := e.player("Ali")
	vali := e.player("Vali")
	// Kod kichik harf va bo'shliq bilan kiritilsa ham ishlaydi.
	loose := strings.ToLower(code[:3]) + " " + code[3:]
	if status, out := e.do("POST", "/api/classes/"+loose+"/join", ali, nil); status != 200 || out["member"] != true || out["members"] != 1.0 {
		t.Fatalf("qo'shilish: %d %v", status, out)
	}
	// Takroriy qo'shilish — xato emas, son o'zgarmaydi.
	if status, out := e.do("POST", "/api/classes/"+code+"/join", ali, nil); status != 200 || out["members"] != 1.0 {
		t.Fatalf("takroriy qo'shilish: %d %v", status, out)
	}
	if status, _ := e.do("POST", "/api/classes/"+code+"/join", "", nil); status != 401 {
		t.Fatalf("profilsiz qo'shilish: %d", status)
	}
	if status, out := e.do("GET", "/api/classes/"+code, ali, nil); status != 200 || out["member"] != true {
		t.Fatalf("a'zo belgisi: %d %v", status, out)
	}

	// Sinf reytingini faqat a'zolar ko'radi.
	if status, out := e.do("GET", "/api/classes/"+code+"/board", vali, nil); status != 403 || out["error"] != "not_member" {
		t.Fatalf("a'zo emas: %d %v", status, out)
	}
	if status, out := e.do("POST", "/api/levels/b1/solve", ali, map[string]any{"circuit": sols["b1"]}); status != 200 {
		t.Fatalf("yechim: %d %v", status, out)
	}
	e.do("POST", "/api/classes/"+code+"/join", vali, nil)
	status, out = e.do("GET", "/api/classes/"+code+"/board", vali, nil)
	top, _ := out["top"].([]any)
	if status != 200 || len(top) != 2 {
		t.Fatalf("sinf reytingi: %d %v", status, out)
	}
	first, second := top[0].(map[string]any), top[1].(map[string]any)
	if first["nickname"] != "Ali" || first["stars"] != 3.0 || first["me"] != nil || second["nickname"] != "Vali" || second["me"] != true {
		t.Fatalf("reyting tartibi: %v", top)
	}

	// Hisobot faqat o'qituvchi kaliti bilan.
	if status, _ := e.doKey("GET", "/api/classes/"+code+"/report", ""); status != 403 {
		t.Fatalf("kalitsiz hisobot: %d", status)
	}
	if status, _ := e.doKey("GET", "/api/classes/"+code+"/report", "AAAA-BBBB-CCCC-DDDD"); status != 403 {
		t.Fatalf("noto'g'ri kalit: %d", status)
	}
	status, out = e.doKey("GET", "/api/classes/"+code+"/report", strings.ToLower(key))
	members, _ := out["members"].([]any)
	if status != 200 || len(members) != 2 || out["name"] != "8-B sinf, 12-maktab" {
		t.Fatalf("hisobot: %d %v", status, out)
	}
	aliRow := members[0].(map[string]any)
	if aliRow["nickname"] != "Ali" || aliRow["levels"].(map[string]any)["b1"] != 3.0 || aliRow["dailyToday"] != 0.0 {
		t.Fatalf("Ali qatori: %v", aliRow)
	}
	valiID := members[1].(map[string]any)["id"].(string)

	// O'qituvchi o'quvchini chiqaradi; o'quvchi o'zi chiqib ketadi.
	if status, _ := e.doKey("DELETE", "/api/classes/"+code+"/members/"+valiID, key); status != 200 {
		t.Fatalf("chiqarish: %d", status)
	}
	if status, _ := e.do("GET", "/api/classes/"+code+"/board", vali, nil); status != 403 {
		t.Fatalf("chiqarilgan o'quvchi reytingni ko'rmoqda: %d", status)
	}
	if status, out := e.do("GET", "/api/me/classes", ali, nil); status != 200 || len(out["classes"].([]any)) != 1 {
		t.Fatalf("mening sinflarim: %d %v", status, out)
	}
	if status, _ := e.do("DELETE", "/api/classes/"+code+"/join", ali, nil); status != 200 {
		t.Fatalf("chiqib ketish: %d", status)
	}
	if status, out := e.do("GET", "/api/classes/"+code, "", nil); status != 200 || out["members"] != 0.0 {
		t.Fatalf("bo'sh sinf: %d %v", status, out)
	}

	// Sinfni o'chirish — faqat kalit bilan.
	if status, _ := e.doKey("DELETE", "/api/classes/"+code, ""); status != 403 {
		t.Fatalf("kalitsiz o'chirish: %d", status)
	}
	if status, _ := e.doKey("DELETE", "/api/classes/"+code, key); status != 200 {
		t.Fatalf("o'chirish: %d", status)
	}
	if status, _ := e.do("GET", "/api/classes/"+code, "", nil); status != 404 {
		t.Fatalf("o'chirilgan sinf: %d", status)
	}
	// O'quvchining natijasi qoladi.
	if status, out := e.do("GET", "/api/progress", ali, nil); status != 200 || !strings.Contains(mustJSON(out), "b1") {
		t.Fatalf("natija yo'qoldi: %d %v", status, out)
	}
}

func TestClassTasks(t *testing.T) {
	e := newEnv(t)
	_, out := e.do("POST", "/api/classes", "", map[string]string{"name": "9-A sinf"})
	code, key := out["code"].(string), out["key"].(string)
	path := "/api/classes/" + code + "/tasks"
	today := levels.DayOf(time.Now())

	// Faqat o'qituvchi kaliti bilan.
	if status, _ := e.doKeyBody("POST", path, "", map[string]any{"levels": []string{"b1"}}); status != 403 {
		t.Fatalf("kalitsiz vazifa: %d", status)
	}
	for name, body := range map[string]map[string]any{
		"bo'sh":      {"levels": []string{}},
		"noma'lum":   {"levels": []string{"b1", "zz"}},
		"ko'p":       {"levels": []string{"b1", "b2", "b3", "b4", "b5", "b6", "x1", "x2", "x3", "x4", "x5", "x6", "s1"}},
		"yomon nom":  {"title": "<script>", "levels": []string{"b1"}},
		"o'tgan kun": {"levels": []string{"b1"}, "due": today - 1},
		"juda uzoq":  {"levels": []string{"b1"}, "due": today + 400},
	} {
		if status, out := e.doKeyBody("POST", path, key, body); status != 400 {
			t.Errorf("%s: %d %v", name, status, out)
		}
	}
	// Darajalar o'yindagi tartibda va takrorlarsiz saqlanadi.
	status, out := e.doKeyBody("POST", path, key, map[string]any{
		"title": "  Uyga  vazifa: XOR ", "levels": []string{"x2", "b1", "x2"}, "due": today + 3,
	})
	if status != 201 || out["title"] != "Uyga vazifa: XOR" || fmt.Sprint(out["levels"]) != "[b1 x2]" || out["due"] != float64(today+3) {
		t.Fatalf("vazifa: %d %v", status, out)
	}
	firstID := int(out["id"].(float64))
	if status, out := e.doKeyBody("POST", path, key, map[string]any{"levels": []string{"b2"}}); status != 201 || out["title"] != "" || out["due"] != nil {
		t.Fatalf("nomsiz, muddatsiz: %d %v", status, out)
	}

	// O'quvchi sinf sahifasida va "mening sinflarim"da ko'radi; yangisi birinchi.
	ali := e.player("Ali")
	e.do("POST", "/api/classes/"+code+"/join", ali, nil)
	status, out = e.do("GET", "/api/classes/"+code, "", nil)
	if tasks, _ := out["tasks"].([]any); status != 200 || len(tasks) != 2 || fmt.Sprint(tasks[0].(map[string]any)["levels"]) != "[b2]" {
		t.Fatalf("sinf vazifalari: %d %v", status, out)
	}
	status, out = e.do("GET", "/api/me/classes", ali, nil)
	if cl := out["classes"].([]any); status != 200 || len(cl[0].(map[string]any)["tasks"].([]any)) != 2 {
		t.Fatalf("mening sinflarim: %d %v", status, out)
	}
	if status, out := e.doKey("GET", "/api/classes/"+code+"/report", key); status != 200 || len(out["tasks"].([]any)) != 2 {
		t.Fatalf("hisobotda vazifalar: %d %v", status, out)
	}

	// O'chirish: faqat kalit bilan, yo'q vazifa — 404.
	del := fmt.Sprintf("%s/%d", path, firstID)
	if status, _ := e.doKey("DELETE", del, ""); status != 403 {
		t.Fatalf("kalitsiz o'chirish: %d", status)
	}
	if status, _ := e.doKey("DELETE", del, key); status != 200 {
		t.Fatalf("o'chirish: %d", status)
	}
	for _, p := range []string{del, path + "/abc", path + "/99999999999999999999"} {
		if status, _ := e.doKey("DELETE", p, key); status != 404 {
			t.Fatalf("%s: %d", p, status)
		}
	}

	// Sinfda ko'pi bilan maxTasks ta vazifa.
	for i := 1; i < maxTasks; i++ {
		if status, out := e.doKeyBody("POST", path, key, map[string]any{"levels": []string{"b1"}}); status != 201 {
			t.Fatalf("%d-vazifa: %d %v", i, status, out)
		}
	}
	if status, out := e.doKeyBody("POST", path, key, map[string]any{"levels": []string{"b1"}}); status != 409 || out["error"] != "too_many_tasks" {
		t.Fatalf("chegara: %d %v", status, out)
	}
}

func TestClassTasksCascade(t *testing.T) {
	st, err := store.Open(filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	ctx := t.Context()
	st.CreateClass(ctx, "ABCDEF", "Sinf", []byte("k"))
	if err := st.CreateTask(ctx, &store.ClassTask{ClassID: "ABCDEF", Levels: []string{"b1"}}, 5); err != nil {
		t.Fatal(err)
	}
	st.DeleteClass(ctx, "ABCDEF")
	if list, err := st.ClassTasks(ctx, "ABCDEF"); err != nil || len(list) != 0 {
		t.Fatalf("sinf bilan vazifalar ham o'chishi kerak: %v %v", list, err)
	}
}

func TestClassFull(t *testing.T) {
	st, err := store.Open(filepath.Join(t.TempDir(), "c.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	ctx := t.Context()
	st.CreatePlayer(ctx, "p1", []byte("h1"), "Ali")
	st.CreatePlayer(ctx, "p2", []byte("h2"), "Vali")
	st.CreateClass(ctx, "ABCDEF", "Sinf", []byte("k"))
	if err := st.JoinClass(ctx, "ABCDEF", "p1", 1); err != nil {
		t.Fatal(err)
	}
	if err := st.JoinClass(ctx, "ABCDEF", "p2", 1); !errors.Is(err, store.ErrClassFull) {
		t.Fatalf("to'lgan sinf: %v", err)
	}
	// A'zo qayta qo'shilsa — xato emas.
	if err := st.JoinClass(ctx, "ABCDEF", "p1", 1); err != nil {
		t.Fatal(err)
	}
}

func TestClassCodeAndName(t *testing.T) {
	for in, want := range map[string]string{"abcdef": "ABCDEF", "ab cd-ef": "ABCDEF", "oil234": "011234", "ABCDE": "", "ABCDEFG": "", "ABCDÉF": "", "ABCDU1": ""} {
		if got := normalizeClassCode(in); got != want {
			t.Errorf("%q → %q, kutilgan %q", in, got, want)
		}
	}
	for _, ok := range []string{"8-B sinf", "№12 maktab (informatika)", "Oʻzbek tili", "«Robototexnika» to'garagi"} {
		if _, err := cleanClassName(ok); err != nil {
			t.Errorf("%q rad etildi: %v", ok, err)
		}
	}
	for _, bad := range []string{"a", strings.Repeat("x", 51), "<b>sinf</b>", "sinf; DROP"} {
		if _, err := cleanClassName(bad); err == nil {
			t.Errorf("%q qabul qilindi", bad)
		}
	}
	for range 100 {
		if c := newClassCode(); normalizeClassCode(c) != c {
			t.Fatalf("yaratilgan kod normal emas: %q", c)
		}
	}
}

func mustJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}
