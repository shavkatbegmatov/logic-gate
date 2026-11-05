package backup

import (
	"compress/gzip"
	"context"
	"io"
	"os"
	"path/filepath"
	"slices"
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
