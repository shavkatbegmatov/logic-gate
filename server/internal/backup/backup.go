// Package backup — SQLite bazasining kunlik zaxira nusxasi. Server ichida ishlaydi, shuning uchun
// tashqi cron yoki shell kerak emas (distroless konteyner, Coolify).
package backup

import (
	"compress/gzip"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/fs"
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
	// Vaqtinchalik fayllar: .tmp-<vaqt>-<tasodifiy>.db (VACUUM INTO) va .tmp-<vaqt>-<tasodifiy>.db.gz
	// (gzip qilinayotgan nusxa). Nomi har ishga tushishda boshqa: bir vaqtda ikki nusxa olinsa (qo'lda `logicgate backup`
	// rejali nusxa paytida yoki deploy'da eski va yangi konteyner) bir-birining faylini ishlatmaydi.
	tmpPrefix = ".tmp-"
	oldTmpGz  = ".tmp" // avvalgi versiyaning gzip fayli: logicgate-….db.gz.tmp
	// staleTmp — bundan eski vaqtinchalik fayl yarmida uzilgan nusxadan qolgan; yangirog'i boshqa ishlab
	// turgan nusxa olishniki bo'lishi mumkin — unga tegilmaydi.
	staleTmp = time.Hour
)

// ErrPrune — nusxa yozildi, lekin eskilari o'chirilmadi. Nusxaning o'zi yaroqli: faqat ogohlantirish.
var ErrPrune = errors.New("eski nusxalar o'chirilmadi")

// remove — fayl o'chirish (testlarda xatoni tekshirish uchun almashtiriladi).
var remove = os.Remove

type Config struct {
	Dir  string // nusxalar papkasi; bo'sh bo'lsa zaxira o'chirilgan
	Keep int    // nechta oxirgi nusxa saqlanadi
	Hour int    // kunlik nusxa vaqti, UTC soati (0–23)
	// Notify — nusxa yozilgandan keyin (masalan, Telegram'ga yuborish — serverdan tashqaridagi nusxa).
	Notify func(ctx context.Context, path string)
}

// Once bazaning gzip qilingan nusxasini dir ga yozadi va eng yangi keep tasidan boshqasini o'chiradi.
// Bir kunda qayta chaqirilsa, o'sha kungi nusxa yangilanadi. Eskilarini o'chirib bo'lmasa — nusxa yo'li
// va ErrPrune bilan o'ralgan xato qaytadi (nusxa yozilgan).
func Once(ctx context.Context, st *store.Store, dir string, keep int, now time.Time) (string, error) {
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return "", err
	}
	removeLeftovers(dir, time.Now())
	final := filepath.Join(dir, prefix+now.UTC().Format("2006-01-02")+suffix)
	var rnd [6]byte
	rand.Read(rnd[:])
	tmp := filepath.Join(dir, tmpPrefix+now.UTC().Format("20060102T150405")+"-"+hex.EncodeToString(rnd[:]))
	raw, gz := tmp+".db", tmp+suffix
	defer os.Remove(raw)
	if err := st.Backup(ctx, raw); err != nil {
		return "", fmt.Errorf("VACUUM INTO: %w", err)
	}
	if err := gzipFile(raw, gz); err != nil {
		os.Remove(gz)
		return "", err
	}
	// Bir kunda ikkinchi nusxa (yoki bir vaqtdagi ikkinchisi) o'sha kungi faylni almashtiradi — ikkalasi ham to'liq.
	if err := os.Rename(gz, final); err != nil {
		os.Remove(gz)
		return "", err
	}
	if err := prune(dir, keep); err != nil {
		return final, fmt.Errorf("%w: %w", ErrPrune, err)
	}
	return final, nil
}

// removeLeftovers — avvalgi (yarmida uzilgan) nusxa olishdan qolgan vaqtinchalik fayllarni o'chiradi.
// Faqat staleTmp dan eskilarini: yangisi hozir boshqa jarayonda yozilayotgan bo'lishi mumkin.
func removeLeftovers(dir string, now time.Time) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, e := range entries {
		n := e.Name()
		if e.IsDir() || !(strings.HasPrefix(n, tmpPrefix) || (strings.HasPrefix(n, prefix) && strings.HasSuffix(n, suffix+oldTmpGz))) {
			continue
		}
		if info, err := e.Info(); err == nil && now.Sub(info.ModTime()) > staleTmp {
			os.Remove(filepath.Join(dir, n))
		}
	}
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
		// Bir vaqtdagi boshqa nusxa olish uni allaqachon o'chirgan bo'lishi mumkin — xato emas.
		if err := remove(filepath.Join(dir, n)); err != nil && !errors.Is(err, fs.ErrNotExist) {
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

// scheduled — bitta rejali nusxa: Once, log va Notify. Eskilarini o'chirish xatosi faqat ogohlantirish —
// yozilgan nusxa "olinmadi" deb hisoblanmaydi va Telegram'ga baribir yuboriladi.
func scheduled(ctx context.Context, st *store.Store, cfg Config, log *slog.Logger, now time.Time) {
	path, err := Once(ctx, st, cfg.Dir, cfg.Keep, now)
	switch {
	case errors.Is(err, ErrPrune):
		log.Warn("zaxira nusxa olindi, lekin eskilari o'chirilmadi", "file", path, "err", err)
	case err != nil:
		log.Error("zaxira nusxa olinmadi", "err", err)
		return
	default:
		log.Info("zaxira nusxa olindi", "file", path)
	}
	if cfg.Notify != nil {
		cfg.Notify(ctx, path)
	}
}

// Run ctx bekor qilinguncha har kuni nusxa oladi. Ishga tushganda oxirgi 24 soatda nusxa bo'lmasa,
// bir daqiqadan keyin darhol oladi (yangi deploy'dan keyin ham himoya bo'lsin).
func Run(ctx context.Context, st *store.Store, cfg Config, log *slog.Logger) {
	do := func() { scheduled(ctx, st, cfg, log, time.Now()) }
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
