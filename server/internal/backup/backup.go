// Package backup — SQLite bazasining kunlik zaxira nusxasi. Server ichida ishlaydi, shuning uchun
// tashqi cron yoki shell kerak emas (distroless konteyner, Coolify).
package backup

import (
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"logicgate/server/internal/store"
)

const (
	prefix = "logicgate-"
	suffix = ".db.gz"
)

type Config struct {
	Dir  string // nusxalar papkasi; bo'sh bo'lsa zaxira o'chirilgan
	Keep int    // nechta oxirgi nusxa saqlanadi
	Hour int    // kunlik nusxa vaqti, UTC soati (0–23)
	// Notify — nusxa yozilgandan keyin (masalan, Telegram'ga yuborish — serverdan tashqaridagi nusxa).
	Notify func(ctx context.Context, path string)
}

// Once bazaning gzip qilingan nusxasini dir ga yozadi va eng yangi keep tasidan boshqasini o'chiradi.
// Bir kunda qayta chaqirilsa, o'sha kungi nusxa yangilanadi.
func Once(ctx context.Context, st *store.Store, dir string, keep int, now time.Time) (string, error) {
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return "", err
	}
	final := filepath.Join(dir, prefix+now.UTC().Format("2006-01-02")+suffix)
	raw := filepath.Join(dir, ".tmp-"+now.UTC().Format("20060102T150405")+".db")
	os.Remove(raw)
	defer os.Remove(raw)
	if err := st.Backup(ctx, raw); err != nil {
		return "", fmt.Errorf("VACUUM INTO: %w", err)
	}
	if err := gzipFile(raw, final+".tmp"); err != nil {
		os.Remove(final + ".tmp")
		return "", err
	}
	if err := os.Rename(final+".tmp", final); err != nil {
		return "", err
	}
	return final, prune(dir, keep)
}

func gzipFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o640)
	if err != nil {
		return err
	}
	zw, _ := gzip.NewWriterLevel(out, gzip.BestCompression)
	if _, err := io.Copy(zw, in); err != nil {
		out.Close()
		return err
	}
	if err := zw.Close(); err != nil {
		out.Close()
		return err
	}
	if err := out.Sync(); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

// List nusxalarni eskidan yangiga qarab qaytaradi (sana fayl nomida).
func List(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	var names []string
	for _, e := range entries {
		if n := e.Name(); !e.IsDir() && strings.HasPrefix(n, prefix) && strings.HasSuffix(n, suffix) {
			names = append(names, n)
		}
	}
	slices.Sort(names)
	return names, nil
}

func prune(dir string, keep int) error {
	if keep < 1 {
		keep = 1
	}
	names, err := List(dir)
	if err != nil {
		return err
	}
	for _, n := range names[:max(0, len(names)-keep)] {
		if err := os.Remove(filepath.Join(dir, n)); err != nil {
			return err
		}
	}
	return nil
}

// nextRun — hour soatining keyingi boshlanishi (UTC).
func nextRun(now time.Time, hour int) time.Time {
	now = now.UTC()
	t := time.Date(now.Year(), now.Month(), now.Day(), hour, 0, 0, 0, time.UTC)
	if !t.After(now) {
		t = t.Add(24 * time.Hour)
	}
	return t
}

// needsCatchUp — oxirgi 24 soat ichida nusxa yo'q bo'lsa true.
func needsCatchUp(dir string, now time.Time) bool {
	names, err := List(dir)
	if err != nil || len(names) == 0 {
		return true
	}
	info, err := os.Stat(filepath.Join(dir, names[len(names)-1]))
	return err != nil || now.Sub(info.ModTime()) > 24*time.Hour
}

// Run ctx bekor qilinguncha har kuni nusxa oladi. Ishga tushganda oxirgi 24 soatda nusxa bo'lmasa,
// bir daqiqadan keyin darhol oladi (yangi deploy'dan keyin ham himoya bo'lsin).
func Run(ctx context.Context, st *store.Store, cfg Config, log *slog.Logger) {
	do := func() {
		path, err := Once(ctx, st, cfg.Dir, cfg.Keep, time.Now())
		if err != nil {
			log.Error("zaxira nusxa olinmadi", "err", err)
			return
		}
		log.Info("zaxira nusxa olindi", "file", path)
		if cfg.Notify != nil {
			cfg.Notify(ctx, path)
		}
	}
	if needsCatchUp(cfg.Dir, time.Now()) {
		select {
		case <-ctx.Done():
			return
		case <-time.After(time.Minute):
			do()
		}
	}
	for {
		wait := time.Until(nextRun(time.Now(), cfg.Hour))
		select {
		case <-ctx.Done():
			return
		case <-time.After(wait):
			do()
		}
	}
}
