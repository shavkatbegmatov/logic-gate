package api

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"logicgate/levels"
	"logicgate/server/internal/sim"
	"logicgate/server/internal/store"
)

type testEnv struct {
	t   *testing.T
	srv *httptest.Server
	api *Server
}

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
	a := New(st, pack, slog.New(slog.NewTextHandler(io.Discard, nil)), Options{Version: "test-sha"})
	srv := httptest.NewServer(a.Handler())
	t.Cleanup(srv.Close)
	return &testEnv{t: t, srv: srv, api: a}
}

func (e *testEnv) do(method, path, code string, body any) (int, map[string]any) {
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
}

func TestSignupRateLimit(t *testing.T) {
	e := newEnv(t)
	limited := false
	for range 8 {
		status, _ := e.do("POST", "/api/players", "", map[string]string{"nickname": "Bot"})
		if status == http.StatusTooManyRequests {
			limited = true
			break
		}
	}
	if !limited {
		t.Fatal("ro'yxatdan o'tish cheklanmadi")
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

func TestVersion(t *testing.T) {
	e := newEnv(t)
	if status, out := e.do("GET", "/api/version", "", nil); status != 200 || out["version"] != "test-sha" {
		t.Fatalf("version: %d %v", status, out)
	}
}
