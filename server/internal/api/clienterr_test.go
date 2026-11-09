package api

import (
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

// recordLog — log yozuvlarini yig'adi (testda tekshirish uchun).
type recordLog struct {
	mu   sync.Mutex
	recs []slog.Record
}

func (h *recordLog) Enabled(context.Context, slog.Level) bool { return true }
func (h *recordLog) Handle(_ context.Context, r slog.Record) error {
	h.mu.Lock()
	h.recs = append(h.recs, r)
	h.mu.Unlock()
	return nil
}
func (h *recordLog) WithAttrs([]slog.Attr) slog.Handler { return h }
func (h *recordLog) WithGroup(string) slog.Handler      { return h }

func (h *recordLog) errors() []map[string]string {
	h.mu.Lock()
	defer h.mu.Unlock()
	var out []map[string]string
	for _, r := range h.recs {
		if r.Level < slog.LevelError {
			continue
		}
		m := map[string]string{"_": r.Message}
		r.Attrs(func(a slog.Attr) bool {
			m[a.Key] = a.Value.String()
			return true
		})
		out = append(out, m)
	}
	return out
}

func TestClientErrors(t *testing.T) {
	e := newEnv(t)
	logs := &recordLog{}
	e.api.log = slog.New(logs)
	ip := 0
	post := func(body string) int {
		ip++ // har so'rov — boshqa IP: cheklov alohida tekshiriladi
		req := httptest.NewRequest("POST", "/api/client-errors", strings.NewReader(body))
		req.RemoteAddr = "203.0.113." + string(rune('0'+ip%10)) + ":1234"
		rec := httptest.NewRecorder()
		e.api.clientError(rec, req)
		return rec.Code
	}
	report := `{"msg":"TypeError: x is undefined\nsecond line","stack":"at f (https://logic.noesis.uz/assets/index-A.js:1:2)\nat g","route":"sandbox/ABC","version":"2.5.0","ua":"Mozilla","tg":true}`

	if code := post(report); code != http.StatusNoContent {
		t.Fatalf("birinchi xabar: %d", code)
	}
	errs := logs.errors()
	if len(errs) != 1 || errs[0]["error"] != "TypeError: x is undefined second line" || errs[0]["route"] != "sandbox" {
		t.Fatalf("log: %v", errs)
	}
	if errs[0]["tg"] != "true" || errs[0]["repeat"] != "0" || !strings.Contains(errs[0]["stack"], "\nat g") {
		t.Fatalf("maydonlar: %v", errs[0])
	}

	// Takror — log'ga yozilmaydi, lekin sanaladi; 6 soatdan keyin yana yoziladi (repeat bilan).
	post(report)
	post(report)
	if n := len(logs.errors()); n != 1 {
		t.Fatalf("takror yozildi: %d", n)
	}
	post(`{"msg":"ReferenceError: y"}`)
	if n := len(logs.errors()); n != 2 {
		t.Fatalf("boshqa xato yozilmadi: %d", n)
	}
	e.setNow(time.Now().Add(7 * time.Hour))
	post(report)
	if errs := logs.errors(); len(errs) != 3 || errs[2]["repeat"] != "2" {
		t.Fatalf("6 soatdan keyin: %v", errs)
	}

	if code := post(`{"msg":"  "}`); code != http.StatusBadRequest {
		t.Fatalf("bo'sh xabar: %d", code)
	}
	if code := post(`not json`); code != http.StatusBadRequest {
		t.Fatalf("noto'g'ri JSON: %d", code)
	}

	// Bir IP dan: 5 tagacha birdaniga, keyin 429.
	codes := []int{}
	for range 7 {
		rec := httptest.NewRecorder()
		e.api.clientError(rec, httptest.NewRequest("POST", "/api/client-errors", strings.NewReader(`{"msg":"z"}`)))
		codes = append(codes, rec.Code)
	}
	if codes[4] != http.StatusNoContent || codes[6] != http.StatusTooManyRequests {
		t.Fatalf("cheklov: %v", codes)
	}

	// Marshrut orqali ham ishlaydi.
	status, _ := e.do("POST", "/api/client-errors", "", map[string]string{"msg": "via mux"})
	if status != http.StatusNoContent && status != http.StatusTooManyRequests {
		t.Fatalf("marshrut: %d", status)
	}
}
