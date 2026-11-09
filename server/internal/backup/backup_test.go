package backup

import (
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"logicgate/server/internal/store"
)

func TestOnceAndPrune(t *testing.T) {
	tmp := t.TempDir()
	st, err := store.Open(filepath.Join(tmp, "live.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	ctx := context.Background()
	if err := st.CreatePlayer(ctx, "p1", []byte("hash"), "Ali"); err != nil {
		t.Fatal(err)
	}

	dir := filepath.Join(tmp, "backups")
	day := time.Date(2026, 11, 1, 22, 0, 0, 0, time.UTC)
	for i := range 5 {
		if _, err := Once(ctx, st, dir, 3, day.AddDate(0, 0, i)); err != nil {
			t.Fatal(err)
		}
	}
	// Bir kunda ikkinchi marta — yangi fayl qo'shilmaydi.
	if _, err := Once(ctx, st, dir, 3, day.AddDate(0, 0, 4).Add(time.Hour)); err != nil {
		t.Fatal(err)
	}

	names, _ := List(dir)
	want := []string{"logicgate-2026-11-03.db.gz", "logicgate-2026-11-04.db.gz", "logicgate-2026-11-05.db.gz"}
	if !slices.Equal(names, want) {
		t.Fatalf("nusxalar: %v", names)
	}
	entries, _ := os.ReadDir(dir)
	if len(entries) != 3 {
		t.Fatalf("vaqtinchalik fayllar qolgan: %v", entries)
	}

	// Nusxani ochib, ma'lumot borligini tekshirish.
	f, _ := os.Open(filepath.Join(dir, want[2]))
	zr, err := gzip.NewReader(f)
	if err != nil {
		t.Fatal(err)
	}
	restored := filepath.Join(tmp, "restored.db")
	out, _ := os.Create(restored)
	io.Copy(out, zr)
	out.Close()
	f.Close()
	rs, err := store.Open(restored)
	if err != nil {
		t.Fatal(err)
	}
	defer rs.Close()
	if p, err := rs.PlayerByToken(ctx, []byte("hash")); err != nil || p.Nickname != "Ali" {
		t.Fatalf("tiklangan bazada o'yinchi yo'q: %v %v", p, err)
	}
}

func testStore(t *testing.T) *store.Store {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "live.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	return st
}

// Avvalgi (yarmida uzilgan) nusxa olishdan qolgan vaqtinchalik fayllar o'chiriladi, boshqalari qoladi.
func TestLeftoversRemoved(t *testing.T) {
	st := testStore(t)
	dir := t.TempDir()
	leftovers := []string{".tmp-20261101T220000.db", "logicgate-2026-11-01.db.gz.tmp"}
	keep := []string{"notes.txt", "logicgate-2026-11-01.db.gz"}
	for _, n := range append(append([]string{}, leftovers...), keep...) {
		os.WriteFile(filepath.Join(dir, n), []byte("x"), 0o600)
	}
	path, err := Once(t.Context(), st, dir, 7, time.Date(2026, 11, 2, 22, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	entries, _ := os.ReadDir(dir)
	var names []string
	for _, e := range entries {
		names = append(names, e.Name())
	}
	want := []string{"logicgate-2026-11-01.db.gz", filepath.Base(path), "notes.txt"}
	if !slices.Equal(names, want) {
		t.Fatalf("papkada: %v, kutilgan %v", names, want)
	}
}

// Eskilarini o'chirish xatosi: nusxa yozilgan, xato ErrPrune; rejali nusxa ogohlantirish bilan
// Telegram'ga (Notify) baribir yuboriladi.
func TestPruneErrorIsWarning(t *testing.T) {
	st := testStore(t)
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "logicgate-2026-10-01.db.gz"), []byte("x"), 0o600)
	remove = func(string) error { return errors.New("TEST: ruxsat yo'q") }
	t.Cleanup(func() { remove = os.Remove })
	now := time.Date(2026, 11, 2, 22, 0, 0, 0, time.UTC)

	path, err := Once(t.Context(), st, dir, 1, now)
	if !errors.Is(err, ErrPrune) || path == "" {
		t.Fatalf("Once: %q %v", path, err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("nusxa yozilmagan: %v", err)
	}

	var logs bytes.Buffer
	log := slog.New(slog.NewTextHandler(&logs, nil))
	var notified []string
	cfg := Config{Dir: dir, Keep: 1, Notify: func(_ context.Context, p string) { notified = append(notified, p) }}
	scheduled(t.Context(), st, cfg, log, now.Add(24*time.Hour))
	if len(notified) != 1 || filepath.Base(notified[0]) != "logicgate-2026-11-03.db.gz" {
		t.Fatalf("Notify: %v", notified)
	}
	if out := logs.String(); !strings.Contains(out, "level=WARN") || strings.Contains(out, "level=ERROR") {
		t.Fatalf("log: %s", out)
	}
}

func TestNextRun(t *testing.T) {
	cases := []struct{ now, want string }{
		{"2026-11-05T21:59:00Z", "2026-11-05T22:00:00Z"},
		{"2026-11-05T22:00:00Z", "2026-11-06T22:00:00Z"},
		{"2026-11-05T23:30:00Z", "2026-11-06T22:00:00Z"},
	}
	for _, c := range cases {
		now, _ := time.Parse(time.RFC3339, c.now)
		if got := nextRun(now, 22).Format(time.RFC3339); got != c.want {
			t.Errorf("%s: %s, kutilgan %s", c.now, got, c.want)
		}
	}
}

func TestNeedsCatchUp(t *testing.T) {
	dir := t.TempDir()
	if !needsCatchUp(dir, time.Now()) {
		t.Fatal("bo'sh papka uchun nusxa kerak")
	}
	p := filepath.Join(dir, "logicgate-2026-11-05.db.gz")
	os.WriteFile(p, []byte("x"), 0o644)
	if needsCatchUp(dir, time.Now()) {
		t.Fatal("yangi nusxa bor — kerak emas")
	}
	old := time.Now().Add(-25 * time.Hour)
	os.Chtimes(p, old, old)
	if !needsCatchUp(dir, time.Now()) {
		t.Fatal("eski nusxa — kerak")
	}
}
