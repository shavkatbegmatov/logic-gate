package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"logicgate/levels"
	"logicgate/server/internal/sim"
	"logicgate/server/internal/store"
)

type testEnv struct {
	t     *testing.T
	srv   *httptest.Server
	api   *Server
	daily *levels.Daily
	clock atomic.Int64 // Unix vaqt; 0 — haqiqiy soat
}

// setNow server soatini o'rnatadi (kunlik boshqotirma testlari uchun).
func (e *testEnv) setNow(t time.Time) { e.clock.Store(t.Unix()) }

func newEnv(t *testing.T) *testEnv {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	pack, err := levels.Load()
	if err != nil {
		t.Fatal(err)
	}
	daily, err := levels.LoadDaily()
	if err != nil {
		t.Fatal(err)
	}
	env := &testEnv{t: t, daily: daily}
	now := func() time.Time {
		if u := env.clock.Load(); u != 0 {
			return time.Unix(u, 0)
		}
		return time.Now()
	}
	env.api = New(st, pack, daily, slog.New(slog.NewTextHandler(io.Discard, nil)), Options{Version: "test-sha", Now: now})
	env.srv = httptest.NewServer(env.api.Handler())
	t.Cleanup(env.srv.Close)
	return env
}

func (e *testEnv) do(method, path, code string, body any) (int, map[string]any) {
	e.t.Helper()
	return e.doIP(method, path, code, "", body)
}

// doIP — so'rov boshqa mijoz manzilidan (test serveri lokal: X-Real-IP ga ishonadi).
func (e *testEnv) doIP(method, path, code, ip string, body any) (int, map[string]any) {
	e.t.Helper()
	var rd io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	}
	req, _ := http.NewRequest(method, e.srv.URL+path, rd)
	if code != "" {
		req.Header.Set("Authorization", "Bearer "+code)
	}
	if ip != "" {
		req.Header.Set("X-Real-IP", ip)
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

func (e *testEnv) player(nick string) string {
	e.t.Helper()
	status, out := e.do("POST", "/api/players", "", map[string]string{"nickname": nick})
	if status != http.StatusCreated {
		e.t.Fatalf("o'yinchi yaratilmadi: %d %v", status, out)
	}
	return out["code"].(string)
}

func solutions(t *testing.T) map[string]sim.Circuit {
	raw, err := os.ReadFile("../../../levels/solutions.json")
	if err != nil {
		t.Fatal(err)
	}
	var sols map[string]sim.Circuit
	json.Unmarshal(raw, &sols)
	return sols
}

func TestPlayerFlow(t *testing.T) {
	e := newEnv(t)
	code := e.player("  Ali  Valiyev ")

	if status, out := e.do("GET", "/api/me", code, nil); status != 200 || out["nickname"] != "Ali Valiyev" {
		t.Fatalf("me: %d %v", status, out)
	}
	// Kodni kichik harf va defissiz kiritish ham ishlaydi.
	loose := bytes.ToLower([]byte(code))
	loose = bytes.ReplaceAll(loose, []byte("-"), nil)
	if status, _ := e.do("GET", "/api/me", string(loose), nil); status != 200 {
		t.Fatalf("normallashtirilgan kod: %d", status)
	}
	if status, _ := e.do("GET", "/api/me", "", nil); status != 401 {
		t.Fatalf("tokensiz: %d", status)
	}
	if status, _ := e.do("GET", "/api/me", "AAAA-BBBB-CCCC-DDDD", nil); status != 401 {
		t.Fatalf("noto'g'ri kod: %d", status)
	}
	if status, out := e.do("PATCH", "/api/me", code, map[string]string{"nickname": "Oʻgʻiloy"}); status != 200 || out["nickname"] != "Oʻgʻiloy" {
		t.Fatalf("patch: %d %v", status, out)
	}
	for _, bad := range []string{"a", "<script>", "123456789012345678901"} {
		if status, _ := e.do("POST", "/api/players", "", map[string]string{"nickname": bad}); status != 400 {
			t.Errorf("%q taxallusi qabul qilindi: %d", bad, status)
		}
	}
	// Haqoratli taxallus alohida kod bilan rad etiladi (yaratishda ham, o'zgartirishda ham).
	if status, out := e.do("PATCH", "/api/me", code, map[string]string{"nickname": "x.u.y"}); status != 400 || out["error"] != "nickname_not_allowed" {
		t.Errorf("haqoratli taxallus: %d %v", status, out)
	}
}

func TestSolveAndLeaderboard(t *testing.T) {
	e := newEnv(t)
	sols := solutions(t)
	ali := e.player("Ali")
	vali := e.player("Vali")

	// Noto'g'ri yechim: b1 da NOT o'rniga to'g'ridan-to'g'ri sim.
	status, out := e.do("POST", "/api/levels/b1/solve", ali, map[string]any{
		"circuit": sim.Circuit{Wires: []sim.Wire{{From: "in:A", To: "out:Q"}}},
	})
	if status != 422 || out["error"] != "wrong_answer" {
		t.Fatalf("noto'g'ri yechim: %d %v", status, out)
	}
	// Ulanmagan sxema.
	status, out = e.do("POST", "/api/levels/b1/solve", ali, map[string]any{"circuit": sim.Circuit{}})
	if status != 422 || out["error"] != "unconnected_output" {
		t.Fatalf("ulanmagan: %d %v", status, out)
	}
	if status, _ := e.do("POST", "/api/levels/zz/solve", ali, map[string]any{"circuit": sim.Circuit{}}); status != 404 {
		t.Fatalf("noma'lum daraja: %d", status)
	}

	// x2 ni avval 5 element bilan (2★), keyin 4 bilan (3★) yechish.
	x2 := sols["x2"]
	worse := sim.Circuit{
		Gates: append([]sim.Gate{{ID: "extra", Type: "NOT"}}, x2.Gates...),
		Wires: append([]sim.Wire{{From: "in:A", To: "extra:0"}}, x2.Wires...),
	}
	status, out = e.do("POST", "/api/levels/x2/solve", ali, map[string]any{"circuit": worse})
	if status != 200 || out["stars"].(float64) != 2 || out["improved"] != true {
		t.Fatalf("5 elementli: %d %v", status, out)
	}
	status, out = e.do("POST", "/api/levels/x2/solve", ali, map[string]any{"circuit": x2})
	if status != 200 || out["stars"].(float64) != 3 || out["improved"] != true {
		t.Fatalf("4 elementli: %d %v", status, out)
	}
	// Yomonroq yechim eng yaxshisini almashtirmaydi.
	status, out = e.do("POST", "/api/levels/x2/solve", ali, map[string]any{"circuit": worse})
	best := out["best"].(map[string]any)
	if status != 200 || out["improved"] != false || best["gates"].(float64) != 4 {
		t.Fatalf("yomonroq: %d %v", status, out)
	}

	e.do("POST", "/api/levels/b1/solve", vali, map[string]any{"circuit": sols["b1"]})
	e.do("POST", "/api/levels/b2/solve", vali, map[string]any{"circuit": sols["b2"]})

	status, out = e.do("GET", "/api/progress", ali, nil)
	lv := out["levels"].([]any)
	if status != 200 || len(lv) != 1 || lv[0].(map[string]any)["circuit"] == nil {
		t.Fatalf("progress: %d %v", status, out)
	}

	status, out = e.do("GET", "/api/leaderboard", vali, nil)
	top := out["top"].([]any)
	if status != 200 || len(top) != 2 {
		t.Fatalf("reyting: %d %v", status, out)
	}
	first := top[0].(map[string]any)
	if first["nickname"] != "Vali" || first["stars"].(float64) != 6 || first["me"] != true {
		t.Fatalf("1-o'rin: %v", first)
	}
	if me := out["me"].(map[string]any); me["rank"].(float64) != 1 {
		t.Fatalf("me: %v", me)
	}

	status, out = e.do("GET", "/api/levels/x2/stats", "", nil)
	if status != 200 || out["solvers"].(float64) != 1 || out["bestGates"].(float64) != 4 {
		t.Fatalf("stats: %d %v", status, out)
	}
	// Taqsimot: har o'yinchining faqat eng yaxshi yechimi hisoblanadi (Ali — 4 element).
	if sp := fmt.Sprint(out["spread"]); sp != "[[4 1]]" {
		t.Fatalf("spread: %s", sp)
	}
	status, out = e.do("POST", "/api/levels/x2/solve", vali, map[string]any{"circuit": worse})
	if sp := fmt.Sprint(out["level"].(map[string]any)["spread"]); status != 200 || sp != "[[4 1] [5 1]]" {
		t.Fatalf("spread 2: %d %s", status, sp)
	}

	// Xotira darajasi: to'g'ridan-to'g'ri sim kechikish emas — eng qisqa farq (1-taktda A = 1).
	status, out = e.do("POST", "/api/levels/s1/solve", ali, map[string]any{
		"circuit": sim.Circuit{Wires: []sim.Wire{{From: "in:A", To: "out:Q"}}},
	})
	if trace, _ := out["trace"].([]any); status != 422 || out["error"] != "wrong_answer" || len(trace) != 1 || trace[0].(float64) != 1 {
		t.Fatalf("s1 noto'g'ri: %d %v", status, out)
	}
	status, out = e.do("POST", "/api/levels/s5/solve", ali, map[string]any{"circuit": sols["s5"]})
	if status != 200 || out["stars"].(float64) != 3 || out["gates"].(float64) != 5 {
		t.Fatalf("s5: %d %v", status, out)
	}
}

// Sinf rejimi: 40 o'quvchi bitta maktab NAT manzilidan bir vaqtda sinf havolasini ochadi, profil yaratadi
// va sinfga qo'shiladi — mijoz (web/src) shu oqimda yuboradigan so'rovlar bilan.
func TestClassroomLimits(t *testing.T) {
	e := newEnv(t)
	const school = "203.0.113.50"
	_, out := e.doIP("POST", "/api/classes", "", "198.51.100.1", map[string]string{"name": "7-A sinf"})
	class := "/api/classes/" + out["code"].(string)

	requests := 0
	step := func(method, path, code string) map[string]any {
		t.Helper()
		requests++
		status, out := e.doIP(method, path, code, school, nil)
		if status >= 400 {
			t.Fatalf("%d-so'rov %s %s: %d %v", requests, method, path, status, out)
		}
		return out
	}
	for i := range 40 {
		step("GET", class, "") // havola ochildi (profil hali yo'q)
		requests++
		status, out := e.doIP("POST", "/api/players", "", school, map[string]string{"nickname": fmt.Sprintf("TEST_USER %d", i+1)})
		if status != http.StatusCreated {
			t.Fatalf("%d-o'quvchi profili: %d %v", i+1, status, out)
		}
		code := out["code"].(string)
		step("GET", "/api/progress", code) // syncProgress
		step("GET", class, code)           // profil paydo bo'ldi — sinf qayta yuklanadi
		step("GET", "/api/me/classes", code)
		step("GET", "/api/progress", code) // qo'shilishdan oldin sinxronlash
		if out := step("POST", class+"/join", code); out["member"] != true {
			t.Fatalf("qo'shilish: %v", out)
		}
		step("GET", class, code)
		step("GET", class+"/board", code)
		step("GET", "/api/me/classes", code)
	}
	if requests != 400 {
		t.Fatalf("so'rovlar soni: %d", requests)
	}

	// Cheklov baribir bor: bir IP dan to'xtovsiz so'rovlar tez orada 429 oladi.
	limited := false
	for range 2000 {
		if status, _ := e.doIP("GET", "/api/version", "", school, nil); status == http.StatusTooManyRequests {
			limited = true
			break
		}
	}
	if !limited {
		t.Fatal("umumiy cheklov ishlamadi")
	}
	// Ro'yxatdan o'tish: boshqa IP dan sinfga yetadigan (40+) profil, keyin 429.
	created := 0
	for range 60 {
		status, _ := e.doIP("POST", "/api/players", "", "203.0.113.51", map[string]string{"nickname": "TEST_BOT"})
		if status == http.StatusTooManyRequests {
			break
		}
		created++
	}
	if created < 40 || created > 51 {
		t.Fatalf("bir IP dan %d ta profil yaratildi", created)
	}
}

func TestCodes(t *testing.T) {
	seen := map[string]bool{}
	for range 100 {
		c := newCode()
		if len(c) != 19 || normalizeCode(c) == "" || seen[c] {
			t.Fatalf("yomon kod %q", c)
		}
		seen[c] = true
	}
	if normalizeCode("abcd-efgh-jkmn-pqrs") != "ABCDEFGHJKMNPQRS" {
		t.Fatal("normallashtirish")
	}
	if normalizeCode("oooo iiii llll 0000") != "0000111111110000" {
		t.Fatal("o/i/l almashtirish")
	}
	if normalizeCode("short") != "" || normalizeCode("UUUU-UUUU-UUUU-UUUU") != "" {
		t.Fatal("yaroqsiz kod qabul qilindi")
	}
}

func TestLimiter(t *testing.T) {
	l := newLimiter(1, 3)
	for i := range 3 {
		if !l.allow("ip") {
			t.Fatalf("%d-so'rov rad etildi", i)
		}
	}
	if l.allow("ip") {
		t.Fatal("4-so'rov o'tib ketdi")
	}
	if !l.allow("boshqa") {
		t.Fatal("boshqa IP rad etildi")
	}
}

func TestClientIP(t *testing.T) {
	cases := []struct {
		remote, real string
		trustPrivate bool
		want         string
	}{
		{"127.0.0.1:5000", "203.0.113.7", false, "203.0.113.7"},
		{"172.18.0.5:5000", "203.0.113.7", false, "172.18.0.5"},
		{"172.18.0.5:5000", "203.0.113.7", true, "203.0.113.7"},
		{"198.51.100.2:5000", "203.0.113.7", true, "198.51.100.2"},
		{"10.0.1.3:5000", "", true, "10.0.1.3"},
		// X-Real-IP faqat haqiqiy IP bo'lsa olinadi, aks holda — ulanish manzili.
		{"127.0.0.1:5000", "not-an-ip", false, "127.0.0.1"},
		{"127.0.0.1:5000", "203.0.113.7, 10.0.0.1", false, "127.0.0.1"},
		{"172.18.0.5:5000", "203.0.113.7:443", true, "172.18.0.5"},
		{"127.0.0.1:5000", " 203.0.113.8 ", false, "203.0.113.8"},
		{"127.0.0.1:5000", "::ffff:203.0.113.9", false, "203.0.113.9"},
		// IPv6 — /64 tarmoq bo'yicha.
		{"[2001:db8:1:2:aaaa:bbbb:cccc:dddd]:5000", "", false, "2001:db8:1:2::/64"},
		{"[::1]:5000", "2001:db8:1:2::1", false, "2001:db8:1:2::/64"},
		{"[::1]:5000", "2001:db8:1:3::1", false, "2001:db8:1:3::/64"},
		{"[::1]:5000", "garbage", false, "::/64"},
	}
	for _, tc := range cases {
		s := &Server{opts: Options{TrustPrivateProxies: tc.trustPrivate}}
		r := httptest.NewRequest("GET", "/", nil)
		r.RemoteAddr = tc.remote
		if tc.real != "" {
			r.Header.Set("X-Real-IP", tc.real)
		}
		if got := s.clientIP(r); got != tc.want {
			t.Errorf("%+v: %s", tc, got)
		}
	}
}

// Bitta /64 ichida manzilni almashtirish yangi (to'la) bucket bermaydi.
func TestIPv6Prefix(t *testing.T) {
	e := newEnv(t)
	created := 0
	for i := range 60 {
		ip := fmt.Sprintf("2001:db8:aa:bb:%x::%x", i, i+1)
		status, _ := e.doIP("POST", "/api/players", "", ip, map[string]string{"nickname": "TEST_USER"})
		if status == http.StatusTooManyRequests {
			break
		}
		created++
	}
	if created < 40 || created > 51 {
		t.Fatalf("bitta /64 dan %d ta profil", created)
	}
	if status, _ := e.doIP("POST", "/api/players", "", "2001:db8:aa:bc::1", map[string]string{"nickname": "TEST_USER"}); status != http.StatusCreated {
		t.Fatalf("boshqa /64: %d", status)
	}
}

// Sinf kodlari va tokenlarni terib topish auth cheklovi bilan sekinlashadi; to'g'ri kod/token unga
// ta'sir qilmaydi va uni sarflamaydi.
func TestEnumerationSlowdown(t *testing.T) {
	e := newEnv(t)
	_, out := e.doIP("POST", "/api/classes", "", "198.51.100.1", map[string]string{"name": "7-A sinf"})
	code := out["code"].(string)
	student := e.player("TEST_USER")
	if status, _ := e.do("POST", "/api/classes/"+code+"/join", student, nil); status != 200 {
		t.Fatalf("qo'shilish: %d", status)
	}
	missing := func(i int) string {
		c := fmt.Sprintf("ZZZZ%02d", i)
		if c == code {
			c = "YYYY00"
		}
		return c
	}

	// To'g'ri kod va token: qancha so'ralsa ham cheklov sarflanmaydi.
	const good = "203.0.113.20"
	for range 30 {
		if status, out := e.doIP("GET", "/api/classes/"+code, student, good, nil); status != 200 || out["member"] != true {
			t.Fatalf("to'g'ri kod: %d %v", status, out)
		}
	}
	if e.api.auth.blocked(good) {
		t.Fatal("to'g'ri so'rovlar auth cheklovini sarfladi")
	}

	// Yo'q sinf kodlari: 10 tagacha 404, keyin 429 — GET va qo'shilishda ham.
	const bad = "203.0.113.21"
	var got []int
	for i := range 12 {
		status, _ := e.doIP("GET", "/api/classes/"+missing(i), "", bad, nil)
		got = append(got, status)
	}
	if fmt.Sprint(got) != "[404 404 404 404 404 404 404 404 404 404 429 429]" {
		t.Fatalf("yo'q kodlar: %v", got)
	}
	if status, _ := e.doIP("POST", "/api/classes/"+missing(50)+"/join", student, bad, nil); status != http.StatusTooManyRequests {
		t.Fatalf("yo'q sinfga qo'shilish: %d", status)
	}
	// Noto'g'ri formatdagi kod hech narsa bildirmaydi — 404 (cheklov tugagan bo'lsa ham).
	if status, _ := e.doIP("GET", "/api/classes/abc", "", bad, nil); status != 404 {
		t.Fatalf("noto'g'ri format: %d", status)
	}
	// To'g'ri kod shu IP dan ham ishlaydi.
	if status, _ := e.doIP("GET", "/api/classes/"+code, "", bad, nil); status != 200 {
		t.Fatalf("to'g'ri kod cheklangan IP dan: %d", status)
	}
	if status, out := e.doIP("POST", "/api/classes/"+code+"/join", student, bad, nil); status != 200 || out["member"] != true {
		t.Fatalf("to'g'ri kodga qo'shilish: %d %v", status, out)
	}

	// Ixtiyoriy token: topilmagani auth cheklovini sarflaydi; u tugagach token umuman tekshirilmaydi —
	// me/member maydonlari kod to'g'riligini bildirmaydi.
	const guess = "203.0.113.22"
	for i := range 10 {
		wrong := fmt.Sprintf("AAAA-BBBB-CCCC-%04d", i)
		if status, out := e.doIP("GET", "/api/classes/"+code, wrong, guess, nil); status != 200 || out["member"] != nil {
			t.Fatalf("noto'g'ri token: %d %v", status, out)
		}
	}
	if !e.api.auth.blocked(guess) {
		t.Fatal("noto'g'ri tokenlar auth cheklovini sarflamadi")
	}
	if status, out := e.doIP("GET", "/api/classes/"+code, student, guess, nil); status != 200 || out["member"] != nil {
		t.Fatalf("cheklangan IP dan to'g'ri token tekshirilmasligi kerak: %d %v", status, out)
	}
	if _, out := e.doIP("GET", "/api/classes/"+code, student, good, nil); out["member"] != true {
		t.Fatalf("boshqa IP dan a'zolik ko'rinishi kerak: %v", out)
	}
}

func TestLimiterBlocked(t *testing.T) {
	l := newLimiter(1, 2)
	if l.blocked("ip") {
		t.Fatal("yangi kalit bloklangan")
	}
	l.allow("ip")
	l.allow("ip")
	if !l.blocked("ip") {
		t.Fatal("tugagan bucket bloklanmagan")
	}
	// blocked token sarflamaydi.
	l2 := newLimiter(1, 1)
	for range 5 {
		l2.blocked("ip")
	}
	if !l2.allow("ip") {
		t.Fatal("blocked token sarfladi")
	}
}

// Rad etilgan taxallus (va buzuq so'rov) ro'yxatdan o'tish cheklovini sarflamaydi: maktabda bitta NAT
// ortidagi bir necha o'quvchining xato taxallusi qolganlarini to'sib qo'ymasin.
func TestSignupLimitOnlyForCreated(t *testing.T) {
	e := newEnv(t)
	const school = "203.0.113.7"
	for i := range 60 {
		var body any = map[string]string{"nickname": []string{"Ali!", "x", "Vali 🙂", "Sardor#7", "xuy123", "ｆｕｃｋ"}[i%6]}
		if i%10 == 9 {
			body = "buzuq so'rov"
		}
		if status, out := e.doIP("POST", "/api/players", "", school, body); status != http.StatusBadRequest {
			t.Fatalf("%d: %d %v", i, status, out)
		}
	}
	for i := range 45 {
		if status, out := e.doIP("POST", "/api/players", "", school, map[string]string{"nickname": fmt.Sprintf("TEST_USER %d", i)}); status != http.StatusCreated {
			t.Fatalf("%d-o'quvchi: %d %v", i+1, status, out)
		}
	}
	// Cheklov baribir ishlaydi: yaratilganlar uni sarflaydi.
	limited := false
	for range 10 {
		if status, _ := e.doIP("POST", "/api/players", "", school, map[string]string{"nickname": "TEST_BOT"}); status == http.StatusTooManyRequests {
			limited = true
			break
		}
	}
	if !limited {
		t.Fatal("ro'yxatdan o'tish cheklovi ishlamadi")
	}
}

// Mijoz uzilgan (kontekst bekor qilingan) so'rov — 500 va ERROR log (admin'ga ogohlantirish) emas.
func TestCanceledRequestIsNotAnError(t *testing.T) {
	st, err := store.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	pack, _ := levels.Load()
	daily, _ := levels.LoadDaily()
	var logs bytes.Buffer
	var mu sync.Mutex
	s := New(st, pack, daily, slog.New(slog.NewTextHandler(&lockedWriter{w: &logs, mu: &mu}, &slog.HandlerOptions{Level: slog.LevelDebug})), Options{})
	h := s.Handler()
	req := httptest.NewRequest("POST", "/api/players", strings.NewReader(`{"nickname":"TEST_USER"}`))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	var created struct{ Code string }
	json.Unmarshal(rec.Body.Bytes(), &created)
	if rec.Code != http.StatusCreated || created.Code == "" {
		t.Fatalf("o'yinchi: %d", rec.Code)
	}
	for _, path := range []string{"/api/me", "/api/progress", "/api/levels/b1/stats", "/api/daily", "/api/daily/archive", "/api/leaderboard"} {
		ctx, cancel := context.WithCancel(context.Background())
		cancel() // mijoz bitta SQLite ulanishini kutib turgan paytda uzildi
		req := httptest.NewRequest("GET", path, nil).WithContext(ctx)
		req.Header.Set("Authorization", "Bearer "+created.Code)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code == http.StatusInternalServerError || (path == "/api/me" && rec.Code != statusClientClosed) {
			t.Errorf("%s: %d %s", path, rec.Code, rec.Body.String())
		}
	}
	// Fondagi reyting hisoblash tugasin (log yozuvchisi test tugaguncha bo'sh qolsin).
	s.lbMu.Lock()
	wait := s.lbWait
	s.lbMu.Unlock()
	if wait != nil {
		<-wait
	}
	mu.Lock()
	defer mu.Unlock()
	if out := logs.String(); strings.Contains(out, "level=ERROR") || strings.Contains(out, "level=WARN") || !strings.Contains(out, "so'rov uzildi") {
		t.Fatalf("log:\n%s", out)
	}
}

type lockedWriter struct {
	w  io.Writer
	mu *sync.Mutex
}

func (l *lockedWriter) Write(p []byte) (int, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.w.Write(p)
}

// Yechim ixcham ko'rinishda saqlanadi: uzun id lar va o'nlik kasrli koordinatalar bilan to'ldirilgan
// sxema qisqa id (g1, g2, …) va butun koordinatalar bilan qaytadi, qayta yuborilsa — o'sha natija.
func TestStoredCircuitCompact(t *testing.T) {
	e := newEnv(t)
	sols := solutions(t)
	code := e.player("TEST_SIZE")
	base := sols["x2"]
	ren := map[string]string{}
	var c sim.Circuit
	for i, g := range base.Gates {
		id := fmt.Sprintf("%016d", i)
		ren[g.ID] = id
		c.Gates = append(c.Gates, sim.Gate{ID: id, Type: g.Type, X: -99999.99999999999, Y: 12.345678901234567})
	}
	port := func(p string) string {
		id, idx, ok := strings.Cut(p, ":")
		if n, found := ren[id]; found {
			if ok {
				return n + ":" + idx
			}
			return n
		}
		return p
	}
	for _, w := range base.Wires {
		c.Wires = append(c.Wires, sim.Wire{From: port(w.From), To: port(w.To)})
	}
	sent, _ := json.Marshal(c)
	body := map[string]any{"circuit": map[string]any{"gates": c.Gates, "wires": c.Wires, "junk": strings.Repeat("x", 1000)}}
	if status, out := e.do("POST", "/api/levels/x2/solve", code, body); status != 200 {
		t.Fatalf("yechim: %d %v", status, out)
	}
	_, out := e.do("GET", "/api/progress", code, nil)
	stored, _ := json.Marshal(out["levels"].([]any)[0].(map[string]any)["circuit"])
	var back sim.Circuit
	json.Unmarshal(stored, &back)
	for i, g := range back.Gates {
		if g.ID != fmt.Sprintf("g%d", i+1) || g.X != -sim.StoreCoord || g.Y != 12 {
			t.Fatalf("saqlangan element: %+v", g)
		}
	}
	if len(stored) >= len(sent) || strings.Contains(string(stored), "junk") || strings.Contains(string(stored), "000000") {
		t.Fatalf("saqlangan sxema ixcham emas (%d → %d): %s", len(sent), len(stored), stored)
	}
	// Ixcham sxema o'sha sxema: qayta yuborilsa ham to'g'ri, o'sha element soni.
	if status, out := e.do("POST", "/api/levels/x2/solve", code, map[string]any{"circuit": back}); status != 200 || out["gates"].(float64) != float64(len(base.Gates)) {
		t.Fatalf("qayta yuborish: %d %v", status, out)
	}
}

// Hajm chegarasi: eng katta to'g'ri sxema (64 element, hamma kirish ulangan, chekka koordinatalar) sig'adi,
// undan kattasi rad etiladi.
func TestStoredCircuitCap(t *testing.T) {
	long := ""
	pack, _ := levels.Load()
	for _, l := range pack.Levels {
		for _, in := range l.Inputs {
			if len(in) > len(long) {
				long = in
			}
		}
	}
	worst := sim.Circuit{}
	for i := range sim.MaxGates {
		id := fmt.Sprintf("gate_%011d", i)
		worst.Gates = append(worst.Gates, sim.Gate{ID: id, Type: "XNOR", X: -1e5, Y: -1e5})
		worst.Wires = append(worst.Wires, sim.Wire{From: "in:" + long, To: id + ":0"}, sim.Wire{From: "in:" + long, To: id + ":1"})
	}
	for i := range 4 {
		worst.Wires = append(worst.Wires, sim.Wire{From: fmt.Sprintf("gate_%011d", 63-i), To: fmt.Sprintf("out:%s%d", long, i)})
	}
	if s, ok := storedCircuit(worst); !ok {
		t.Fatalf("eng katta to'g'ri sxema sig'madi: %d bayt", len(s))
	}
	for range 3 * sim.MaxGates {
		worst.Gates = append(worst.Gates, sim.Gate{ID: "x", Type: "XNOR", X: -1e5, Y: -1e5})
	}
	if s, ok := storedCircuit(worst); ok {
		t.Fatalf("chegaradan katta sxema qabul qilindi: %d bayt", len(s))
	}
}

func TestVersion(t *testing.T) {
	e := newEnv(t)
	if status, out := e.do("GET", "/api/version", "", nil); status != 200 || out["version"] != "test-sha" {
		t.Fatalf("version: %d %v", status, out)
	}
}

func TestFunnelEvent(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	for _, body := range []map[string]string{
		{"event": "visit", "src": "web"},
		{"event": "visit", "src": "tg"},
		{"event": "level1"},                        // manba yo'q — sayt
		{"event": "return", "src": "boshqa narsa"}, // noma'lum manba — sayt
	} {
		if st, out := e.do("POST", "/api/events", "", body); st != http.StatusNoContent {
			t.Fatalf("%v: %d %v", body, st, out)
		}
	}
	if st, out := e.do("POST", "/api/events", "", map[string]string{"event": "hack"}); st != http.StatusBadRequest || out["error"] != "bad_event" {
		t.Fatalf("noma'lum bosqich: %d %v", st, out)
	}
	day := levels.DayOf(time.Now())
	f, err := e.api.store.Funnel(ctx, day-1, day, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if f.Events["visit"] != 2 || f.TG["visit"] != 1 || f.Events["level1"] != 1 || f.Events["return"] != 1 || f.TG["return"] != 0 || f.Events["hack"] != 0 {
		t.Fatalf("hisoblagichlar: %+v", f)
	}
}
