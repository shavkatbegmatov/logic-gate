package bot

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"sync"
	"time"

	"logicgate/levels"
)

// ── Haftalik hisobot ────────────────────────────────────────
// Har dushanba 10:00 da (Toshkent) admin'ga o'tgan 7 kun haqida qisqa hisobot.

const (
	metaReportDay = "tg_report_day"
	reportHour    = 10
)

// nextReport — keyingi hisobotgacha kutish (0 — hozir). Dushanba 10:00 dan keyin, o'sha kuni yuborilmagan bo'lsa.
func (b *Bot) nextReport(ctx context.Context) time.Duration {
	now := b.now().In(levels.Tashkent)
	day := levels.DayOf(now)
	sent, _ := b.st.Meta(ctx, metaReportDay)
	at := time.Date(now.Year(), now.Month(), now.Day(), reportHour, 0, 0, 0, levels.Tashkent)
	if now.Weekday() == time.Monday && sent != strconv.Itoa(day) && !now.Before(at) {
		return 0
	}
	days := (int(time.Monday) - int(now.Weekday()) + 7) % 7
	next := at.AddDate(0, 0, days)
	if !next.After(now) {
		next = next.AddDate(0, 0, 7)
	}
	return next.Sub(now)
}

func (b *Bot) reportLoop(ctx context.Context) {
	for {
		if !sleep(ctx, b.nextReport(ctx)) {
			return
		}
		if err := b.SendWeeklyReport(ctx); err != nil {
			b.log.Warn("telegram haftalik hisobot", "err", err)
			if !sleep(ctx, 30*time.Minute) {
				return
			}
		}
	}
}

// SendWeeklyReport admin'ga haftalik hisobotni yuboradi va kunni belgilaydi.
func (b *Bot) SendWeeklyReport(ctx context.Context) error {
	if b.cfg.Admin == 0 {
		return nil
	}
	now := b.now()
	today := levels.DayOf(now)
	w, err := b.st.Weekly(ctx, today, now)
	if err != nil {
		return err
	}
	top, err := b.st.Leaderboard(ctx, 3)
	if err != nil {
		return err
	}
	var sb strings.Builder
	fmt.Fprintf(&sb, "📈 Logic Gate — haftalik hisobot\n\n")
	fmt.Fprintf(&sb, "O'yinchilar: %d (yangi: %d)\n", w.Players, w.NewPlayers)
	fmt.Fprintf(&sb, "7 kunda faol: %d\n", w.Active)
	fmt.Fprintf(&sb, "Kunlik masala: %d ta yechim, %d kishi\n", w.DailySolves, w.DailySolvers)
	fmt.Fprintf(&sb, "Darajalar yechildi: %d\n", w.LevelSolves)
	fmt.Fprintf(&sb, "Bot: %d obunachi, %d eslatma", w.Chats, w.Subscribers)
	if len(top) > 0 {
		sb.WriteString("\n\n🏆 Reyting:")
		for _, e := range top {
			fmt.Fprintf(&sb, "\n%d. %s — %d ★", e.Rank, e.Nickname, e.Stars)
		}
	}
	if _, err := b.tg.SendMessage(ctx, b.cfg.Admin, sb.String(), nil); err != nil {
		return err
	}
	return b.st.SetMeta(ctx, metaReportDay, strconv.Itoa(today))
}

// ── Xatolar haqida ogohlantirish ─────────────────────────────

// Alerts — ERROR darajadagi log yozuvlarini to'playdi; bot ularni admin'ga 10 daqiqada ko'pi bilan
// bitta xabarda yuboradi. Botning o'z yuborish xatolari Warn darajasida — aylanib qolmaydi.
type Alerts struct {
	mu    sync.Mutex
	count int
	last  string
	// O'yinchilar brauzeridan kelgan xatolar (api: "brauzer xatosi") — alohida: tashqaridan keladigan
	// matn server xatolarini xabardan siqib chiqarmasin.
	clientCount int
	clientLast  string
}

// ClientErrorMsg — api paketi brauzer xatolarini shu xabar bilan yozadi (server/internal/api/clienterr.go).
const ClientErrorMsg = "brauzer xatosi"

func NewAlerts() *Alerts { return &Alerts{} }

// Wrap log handler'ini o'raydi: yozuvlar odatdagidek chiqadi, xatolar esa sanaladi.
func (a *Alerts) Wrap(h slog.Handler) slog.Handler { return &alertHandler{Handler: h, a: a} }

func (a *Alerts) take() (n int, last string, cn int, clast string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	n, last, cn, clast = a.count, a.last, a.clientCount, a.clientLast
	a.count, a.last, a.clientCount, a.clientLast = 0, "", 0, ""
	return n, last, cn, clast
}

type alertHandler struct {
	slog.Handler
	a *Alerts
}

func (h *alertHandler) Handle(ctx context.Context, r slog.Record) error {
	if r.Level >= slog.LevelError {
		var sb strings.Builder
		sb.WriteString(r.Message)
		r.Attrs(func(at slog.Attr) bool {
			sb.WriteString(" " + at.Key + "=" + at.Value.String())
			return sb.Len() < 300
		})
		msg := sb.String()
		if len(msg) > 300 {
			msg = msg[:300] + "…"
		}
		h.a.mu.Lock()
		if r.Message == ClientErrorMsg {
			h.a.clientCount++
			h.a.clientLast = msg
		} else {
			h.a.count++
			h.a.last = msg
		}
		h.a.mu.Unlock()
	}
	return h.Handler.Handle(ctx, r)
}

func (h *alertHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &alertHandler{Handler: h.Handler.WithAttrs(attrs), a: h.a}
}

func (h *alertHandler) WithGroup(name string) slog.Handler {
	return &alertHandler{Handler: h.Handler.WithGroup(name), a: h.a}
}

// SetAlerts — main log handler'ini o'ragan Alerts ni beradi; Run ularni yuborishni boshlaydi.
func (b *Bot) SetAlerts(a *Alerts) { b.alerts = a }

// FlushAlerts to'plangan xatolar haqida admin'ga xabar yuboradi (bo'lsa).
func (b *Bot) FlushAlerts(ctx context.Context) {
	if b.alerts == nil || b.cfg.Admin == 0 {
		return
	}
	n, last, cn, clast := b.alerts.take()
	if n == 0 && cn == 0 {
		return
	}
	text := alertText(n, last, cn, clast)
	if _, err := b.tg.SendMessage(ctx, b.cfg.Admin, text, nil); err != nil {
		b.log.Warn("telegram ogohlantirish yuborilmadi", "err", err)
	}
}

// alertText — ogohlantirish matni: server xatolari birinchi, brauzer xatolari alohida qatorda.
func alertText(n int, last string, cn int, clast string) string {
	var parts []string
	if n > 0 {
		parts = append(parts, fmt.Sprintf("⚠️ Logic Gate serverida %d ta xato (oxirgi 10 daqiqada).\nOxirgisi: %s", n, last))
	}
	if cn > 0 {
		parts = append(parts, fmt.Sprintf("🌐 O'yinchilar brauzerida %d ta xato (oxirgi 10 daqiqada).\nOxirgisi: %s", cn, clast))
	}
	return strings.Join(parts, "\n\n")
}

func (b *Bot) alertLoop(ctx context.Context) {
	for sleep(ctx, 10*time.Minute) {
		b.FlushAlerts(ctx)
	}
}
