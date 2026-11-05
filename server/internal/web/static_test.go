package web

import (
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func setup(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	write := func(name, body string) {
		p := filepath.Join(dir, filepath.FromSlash(name))
		os.MkdirAll(filepath.Dir(p), 0o755)
		if err := os.WriteFile(p, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write("index.html", "<!doctype html>index")
	write("assets/app-123.js", "console.log('app')")
	f, _ := os.Create(filepath.Join(dir, "assets", "app-123.js.gz"))
	gz := gzip.NewWriter(f)
	gz.Write([]byte("console.log('app')"))
	gz.Close()
	f.Close()
	return dir
}

func get(h http.Handler, path, enc string) *httptest.ResponseRecorder {
	req := httptest.NewRequest("GET", path, nil)
	if enc != "" {
		req.Header.Set("Accept-Encoding", enc)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestStatic(t *testing.T) {
	h := Static(setup(t))

	rec := get(h, "/assets/app-123.js", "gzip, br")
	if rec.Code != 200 || rec.Header().Get("Content-Encoding") != "gzip" {
		t.Fatalf("gzip berilmadi: %d %v", rec.Code, rec.Header())
	}
	zr, err := gzip.NewReader(rec.Body)
	if err != nil {
		t.Fatal(err)
	}
	if body, _ := io.ReadAll(zr); string(body) != "console.log('app')" {
		t.Fatalf("tana: %q", body)
	}
	if !strings.Contains(rec.Header().Get("Content-Type"), "javascript") {
		t.Errorf("Content-Type: %s", rec.Header().Get("Content-Type"))
	}
	if !strings.Contains(rec.Header().Get("Cache-Control"), "immutable") {
		t.Errorf("assets keshlanmaydi: %s", rec.Header().Get("Cache-Control"))
	}

	rec = get(h, "/assets/app-123.js", "")
	if rec.Header().Get("Content-Encoding") != "" || rec.Body.String() != "console.log('app')" {
		t.Fatalf("gzip'siz mijoz: %v %q", rec.Header(), rec.Body.String())
	}

	for _, p := range []string{"/", "/level/b1", "/../../etc/passwd", "/assets/"} {
		rec = get(h, p, "")
		if rec.Code != 200 || !strings.Contains(rec.Body.String(), "index") {
			t.Errorf("%s: %d %q", p, rec.Code, rec.Body.String())
		}
		if rec.Header().Get("Cache-Control") != "no-cache" || rec.Header().Get("Content-Security-Policy") == "" {
			t.Errorf("%s sarlavhalari: %v", p, rec.Header())
		}
	}

	req := httptest.NewRequest("POST", "/", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusMethodNotAllowed {
		t.Errorf("POST: %d", rr.Code)
	}
}
