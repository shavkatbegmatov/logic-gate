// logicgate — Logic Gate o'yini serveri.
//
//	logicgate                  serverni ishga tushirish
//	logicgate backup [fayl]    bazaning nusxasini yozish (faylsiz — LG_BACKUP_DIR ga, aylanish bilan)
//	logicgate version          versiyani chiqarish
//	logicgate health           ishlab turgan serverni tekshirish (Docker HEALTHCHECK uchun)
//	logicgate players [qidiruv]       o'yinchilar ro'yxati (moderatsiya)
//	logicgate rename <id> <taxallus>  o'yinchi taxallusini o'zgartirish (moderatsiya)
//
// Sozlamalar: -addr, -db, -static bayroqlari yoki LG_ADDR, LG_DB, LG_STATIC muhit o'zgaruvchilari.
// LG_TRUST_PROXY=private — Docker tarmog'idagi proksining X-Real-IP sarlavhasiga ishonish.
// LG_BACKUP_DIR — kunlik zaxira nusxalar papkasi (bo'sh bo'lsa o'chirilgan), LG_BACKUP_KEEP — nechta
// nusxa saqlanadi (7), LG_BACKUP_HOUR — UTC soati (22 = Toshkentda 03:00).
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
	"strconv"
	"strings"
	"syscall"
	"time"

	"logicgate/levels"
	"logicgate/server/internal/api"
	"logicgate/server/internal/backup"
	"logicgate/server/internal/bot"
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
			if len(os.Args) > 3 {
				fmt.Fprintln(os.Stderr, "foydalanish: logicgate backup [fayl]")
				os.Exit(2)
			}
			dest := ""
			if len(os.Args) == 3 {
				dest = os.Args[2]
			}
			path, err := backupNow(dbPath, dest, backupConfig())
			if errors.Is(err, backup.ErrPrune) {
				// Nusxa yozilgan — eskilarini o'chirib bo'lmagani faqat ogohlantirish.
				log.Warn("zaxira nusxa", "err", err)
			} else if err != nil {
				log.Error("zaxira nusxa", "err", err)
				os.Exit(1)
			}
			fmt.Println(path)
			return
		case "players", "rename", "delete":
			cmd := cmdPlayers
			switch os.Args[1] {
			case "rename":
				cmd = cmdRename
			case "delete":
				cmd = cmdDelete
			}
			if err := cmd(os.Stdout, dbPath, os.Args[2:]); err != nil {
				fmt.Fprintln(os.Stderr, err)
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

func backupConfig() backup.Config {
	return backup.Config{
		Dir:  os.Getenv("LG_BACKUP_DIR"),
		Keep: envInt("LG_BACKUP_KEEP", 7),
		Hour: envInt("LG_BACKUP_HOUR", 22) % 24,
	}
}

func botConfig() bot.Config {
	admin, _ := strconv.ParseInt(os.Getenv("LG_TELEGRAM_ADMIN"), 10, 64)
	return bot.Config{
		Token:      strings.TrimSpace(os.Getenv("LG_TELEGRAM_TOKEN")),
		API:        os.Getenv("LG_TELEGRAM_API"),
		Admin:      admin,
		Site:       strings.TrimRight(env("LG_SITE_URL", "https://logic.noesis.uz"), "/"),
		App:        env("LG_TELEGRAM_APP", "play"),
		RemindHour: envInt("LG_REMIND_HOUR", 9) % 24,
	}
}

func envInt(key string, def int) int {
	if n, err := strconv.Atoi(os.Getenv(key)); err == nil && n >= 0 {
		return n
	}
	return def
}

// backupNow dest ga yoki (dest bo'sh bo'lsa) cfg.Dir ga aylanish bilan nusxa yozadi.
func backupNow(dbPath, dest string, cfg backup.Config) (string, error) {
	st, err := store.Open(dbPath)
	if err != nil {
		return "", err
	}
	defer st.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	if dest != "" {
		return dest, st.Backup(ctx, dest)
	}
	if cfg.Dir == "" {
		return "", errors.New("fayl ko'rsatilmagan va LG_BACKUP_DIR o'rnatilmagan")
	}
	return backup.Once(ctx, st, cfg.Dir, cfg.Keep, time.Now())
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
	daily, err := levels.LoadDaily()
	if err != nil {
		return err
	}
	st, err := store.Open(dbPath)
	if err != nil {
		return err
	}
	defer st.Close()

	opts := api.Options{TrustPrivateProxies: os.Getenv("LG_TRUST_PROXY") == "private", Version: version}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Telegram bot — LG_TELEGRAM_TOKEN o'rnatilgan bo'lsa. Token faqat muhitdan o'qiladi va log'ga yozilmaydi.
	var tgBot *bot.Bot
	if cfg := botConfig(); cfg.Token != "" {
		if v := os.Getenv("LG_TELEGRAM_ADMIN"); v != "" && cfg.Admin == 0 {
			log.Warn("LG_TELEGRAM_ADMIN raqam emas — zaxira nusxa va /stats o'chirilgan", "value", v)
		}
		// Server xatolari (ERROR log) admin'ga Telegram orqali ham boradi.
		alerts := bot.NewAlerts()
		log = slog.New(alerts.Wrap(log.Handler()))
		tgBot = bot.New(cfg, st, daily, log)
		tgBot.SetAlerts(alerts)
		opts.Telegram = tgBot
	}
	var handler http.Handler = api.New(st, pack, daily, log, opts).Handler()
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

	bots := make(chan struct{})
	if tgBot != nil {
		go func() {
			defer close(bots)
			tgBot.Run(ctx)
		}()
	} else {
		close(bots)
	}

	backups := make(chan struct{})
	if cfg := backupConfig(); cfg.Dir != "" {
		if tgBot != nil {
			cfg.Notify = tgBot.SendBackup
		}
		go func() {
			defer close(backups)
			backup.Run(ctx, st, cfg, log)
		}()
		log.Info("kunlik zaxira yoqilgan", "dir", cfg.Dir, "keep", cfg.Keep, "hourUTC", cfg.Hour)
	} else {
		close(backups)
	}
	prunes := make(chan struct{})
	go func() {
		defer close(prunes)
		pruneLoop(ctx, st, log)
	}()
	// Baza yopilishidan oldin nusxa olish to'xtatiladi va boshlangani tugashi kutiladi.
	// stop() bu yerda ham chaqiriladi: server xato bilan to'xtasa, ctx hali bekor qilinmagan bo'ladi.
	defer func() {
		stop()
		<-backups
		<-bots
		<-prunes
	}()

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

// emptyPlayerAge — shuncha vaqtdan beri bo'sh (hech narsa yechmagan, sinf va Telegram'siz) va kirmagan
// profil o'chiriladi: ro'yxatdan o'tish cheklovi ostida yaratilgan keraksiz profillar baza hajmini
// cheksiz oshirmasin.
const emptyPlayerAge = 90 * 24 * time.Hour

// pruneLoop — bo'sh profillarni ishga tushganda va keyin har kuni o'chiradi (store.PruneEmptyPlayers).
func pruneLoop(ctx context.Context, st *store.Store, log *slog.Logger) {
	for {
		pctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
		n, err := st.PruneEmptyPlayers(pctx, time.Now().Add(-emptyPlayerAge))
		cancel()
		switch {
		case err != nil && ctx.Err() == nil:
			log.Warn("bo'sh profillar o'chirilmadi", "deleted", n, "err", err)
		case n > 0:
			log.Info("bo'sh profillar o'chirildi", "deleted", n)
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(24 * time.Hour):
		}
	}
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
