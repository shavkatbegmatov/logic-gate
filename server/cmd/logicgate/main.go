// logicgate — Logic Gate o'yini serveri.
//
//	logicgate                  serverni ishga tushirish
//	logicgate backup <fayl>    bazaning nusxasini yozish
//	logicgate version          versiyani chiqarish
//	logicgate health           ishlab turgan serverni tekshirish (Docker HEALTHCHECK uchun)
//
// Sozlamalar: -addr, -db, -static bayroqlari yoki LG_ADDR, LG_DB, LG_STATIC muhit o'zgaruvchilari.
// LG_TRUST_PROXY=private — Docker tarmog'idagi proksining X-Real-IP sarlavhasiga ishonish.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"logicgate/levels"
	"logicgate/server/internal/api"
	"logicgate/server/internal/store"
	"logicgate/server/internal/web"
)

// version build vaqtida -ldflags "-X main.version=..." orqali o'rnatiladi.
var version = "dev"

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func main() {
	log := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo}))
	dbPath := env("LG_DB", "data/logicgate.db")

	if len(os.Args) > 1 && !strings.HasPrefix(os.Args[1], "-") {
		switch os.Args[1] {
		case "version":
			fmt.Println(version)
			return
		case "health":
			if err := health(env("LG_ADDR", "127.0.0.1:8080")); err != nil {
				fmt.Fprintln(os.Stderr, err)
				os.Exit(1)
			}
			return
		case "backup":
			if len(os.Args) != 3 {
				fmt.Fprintln(os.Stderr, "foydalanish: logicgate backup <fayl>")
				os.Exit(2)
			}
			if err := backup(dbPath, os.Args[2]); err != nil {
				log.Error("zaxira nusxa", "err", err)
				os.Exit(1)
			}
			return
		default:
			fmt.Fprintf(os.Stderr, "noma'lum buyruq: %s\n", os.Args[1])
			os.Exit(2)
		}
	}

	addr := flag.String("addr", env("LG_ADDR", "127.0.0.1:8080"), "tinglash manzili")
	db := flag.String("db", dbPath, "SQLite fayli")
	static := flag.String("static", os.Getenv("LG_STATIC"), "frontend fayllari papkasi (Nginx bo'lmaganda)")
	flag.Parse()

	if err := run(log, *addr, *db, *static); err != nil {
		log.Error("server to'xtadi", "err", err)
		os.Exit(1)
	}
}

func backup(dbPath, dest string) error {
	st, err := store.Open(dbPath)
	if err != nil {
		return err
	}
	defer st.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	return st.Backup(ctx, dest)
}

// health server /healthz ga javob beradimi, tekshiradi.
func health(addr string) error {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return err
	}
	if host == "" || host == "0.0.0.0" || host == "::" {
		host = "127.0.0.1"
	}
	client := http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("http://" + net.JoinHostPort(host, port) + "/healthz")
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("healthz: %s", resp.Status)
	}
	return nil
}

func run(log *slog.Logger, addr, dbPath, staticDir string) error {
	pack, err := levels.Load()
	if err != nil {
		return err
	}
	st, err := store.Open(dbPath)
	if err != nil {
		return err
	}
	defer st.Close()

	opts := api.Options{TrustPrivateProxies: os.Getenv("LG_TRUST_PROXY") == "private", Version: version}
	var handler http.Handler = api.New(st, pack, log, opts).Handler()
	if staticDir != "" {
		handler = withStatic(handler, staticDir)
	}

	srv := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	errc := make(chan error, 1)
	go func() { errc <- srv.ListenAndServe() }()
	log.Info("server ishga tushdi", "addr", addr, "db", dbPath, "version", version, "levels", len(pack.Levels))

	select {
	case err := <-errc:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
		log.Info("to'xtatilmoqda")
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}

// withStatic — Nginx bo'lmaganda (Docker, lokal sinov) frontend fayllarini ham shu server uzatadi.
func withStatic(api http.Handler, dir string) http.Handler {
	files := web.Static(dir)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") || r.URL.Path == "/healthz" {
			api.ServeHTTP(w, r)
			return
		}
		files.ServeHTTP(w, r)
	})
}
