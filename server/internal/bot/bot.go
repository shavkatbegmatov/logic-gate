package bot

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"

	"logicgate/levels"
	"logicgate/server/internal/store"
)

type Config struct {
	Token      string // LG_TELEGRAM_TOKEN; bo'sh bo'lsa bot o'chirilgan
	API        string // Bot API manzili (testlarda soxta server)
	Admin      int64  // zaxira nusxa va /stats oladigan chat (LG_TELEGRAM_ADMIN)
	Site       string // o'yin manzili (Mini App)
	App        string // Mini App qisqa nomi: t.me/<bot>/<app>
	RemindHour int    // kunlik eslatma soati, Toshkent vaqti
}

type Bot struct {
	cfg   Config
	tg    *Client
	st    *store.Store
	daily *levels.Daily
	log   *slog.Logger
	now   func() time.Time
	// username — getMe dan; Mini App havolasi uchun (Run boshida, goroutine'lardan oldin yoziladi).
	username string
	// pause — xabarlar orasidagi tanaffus (Telegram cheklovi ~30 xabar/s); testlarda 0.
	pause time.Duration
}

func New(cfg Config, st *store.Store, daily *levels.Daily, log *slog.Logger) *Bot {
	if cfg.App == "" {
		cfg.App = "play"
	}
	return &Bot{cfg: cfg, tg: NewClient(cfg.API, cfg.Token), st: st, daily: daily, log: log, now: time.Now, pause: 50 * time.Millisecond}
}

const (
	metaOffset    = "tg_offset"
	metaRemindDay = "tg_remind_day"
	// Eslatma kechikib qolsa (server o'chiq bo'lgan), shu soatdan keyin o'sha kuni yuborilmaydi.
	remindLateHour = 21
)

// Run bot ishini boshlaydi va ctx bekor qilinguncha davom etadi: getMe, buyruqlar menyusi,
// kunlik eslatma va yangilanishlarni olish.
func (b *Bot) Run(ctx context.Context) {
	for wait := 5 * time.Second; ; wait = min(wait*2, 5*time.Minute) {
		me, err := b.tg.GetMe(ctx)
		if err == nil {
			b.username = me.Username
			break
		}
		b.log.Warn("telegram getMe", "err", err)
		if !sleep(ctx, wait) {
			return
		}
	}
	if err := b.tg.DeleteWebhook(ctx); err != nil {
		b.log.Warn("telegram deleteWebhook", "err", err)
	}
	for _, lang := range []string{"uz", "ru"} {
		code := lang
		if lang == "uz" {
			code = "" // standart menyu
		}
		if err := b.tg.SetMyCommands(ctx, t(lang).Commands, code); err != nil {
			b.log.Warn("telegram setMyCommands", "err", err)
		}
	}
	b.log.Info("telegram bot ishga tushdi", "bot", b.username, "remindHour", b.cfg.RemindHour)
	go b.remindLoop(ctx)
	b.poll(ctx)
}

func sleep(ctx context.Context, d time.Duration) bool {
	if d <= 0 {
		return ctx.Err() == nil
	}
	select {
	case <-ctx.Done():
		return false
	case <-time.After(d):
		return true
	}
}

// poll — long polling. Qayta deploy paytida ikki nusxa bir vaqtda so'rasa, Telegram 409 qaytaradi —
// kutib, qayta urinadi (eski konteyner tez orada to'xtaydi).
func (b *Bot) poll(ctx context.Context) {
	var offset int64
	if v, err := b.st.Meta(ctx, metaOffset); err == nil && v != "" {
		offset, _ = strconv.ParseInt(v, 10, 64)
	}
	backoff := time.Second
	for ctx.Err() == nil {
		ups, err := b.tg.GetUpdates(ctx, offset, 50)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			b.log.Warn("telegram getUpdates", "err", err)
			if !sleep(ctx, backoff) {
				return
			}
			backoff = min(backoff*2, time.Minute)
			continue
		}
		backoff = time.Second
		for _, u := range ups {
			b.Handle(ctx, u)
			offset = u.UpdateID + 1
		}
		if len(ups) > 0 {
			if err := b.st.SetMeta(ctx, metaOffset, strconv.FormatInt(offset, 10)); err != nil {
				b.log.Warn("telegram offset", "err", err)
			}
		}
	}
}

// Handle bitta yangilanishni qayta ishlaydi (faqat shaxsiy chatlar).
func (b *Bot) Handle(ctx context.Context, u Update) {
	switch {
	case u.Message != nil && u.Message.Chat.Type == "private" && u.Message.From != nil:
		b.onMessage(ctx, u.Message)
	case u.CallbackQuery != nil:
		b.onCallback(ctx, u.CallbackQuery)
	}
}

// command — "/start@LogicGateUzBot abc" → "/start".
func command(text string) string {
	f := strings.Fields(text)
	if len(f) == 0 || !strings.HasPrefix(f[0], "/") {
		return ""
	}
	cmd, _, _ := strings.Cut(f[0], "@")
	return strings.ToLower(cmd)
}

// chatLang — chatning tili; yangi chat o'zbekchadan boshlanadi (o'yin kabi: Telegram tiliga qaralmaydi).
func (b *Bot) chatLang(ctx context.Context, chat int64) string {
	if c, err := b.st.Chat(ctx, chat); err == nil && c.Lang != "" {
		return c.Lang
	}
	return "uz"
}

func otherLang(lang string) string {
	if lang == "ru" {
		return "uz"
	}
	return "ru"
}

func (b *Bot) onMessage(ctx context.Context, m *Message) {
	chat := m.Chat.ID
	if err := b.st.UpsertChat(ctx, chat, "uz"); err != nil {
		b.log.Error("telegram chat", "err", err)
		return
	}
	lang := b.chatLang(ctx, chat)
	tx := t(lang)
	var err error
	switch command(m.Text) {
	case "/start":
		_, err = b.tg.SendMessage(ctx, chat, tx.Welcome, b.mainKeyboard(lang, b.reminding(ctx, chat)))
	case "/til", "/lang":
		lang = otherLang(lang)
		if err = b.st.SetLang(ctx, chat, lang); err == nil {
			_, err = b.tg.SendMessage(ctx, chat, t(lang).Welcome, b.mainKeyboard(lang, b.reminding(ctx, chat)))
		}
	case "/eslatma", "/remind":
		on := !b.reminding(ctx, chat)
		if err = b.st.SetRemind(ctx, chat, lang, on); err == nil {
			err = b.sendRemindStatus(ctx, chat, lang, on)
		}
	case "/id":
		_, err = b.tg.SendMessage(ctx, chat, fmt.Sprintf(tx.ID, chat), nil)
	case "/stats":
		if b.cfg.Admin != 0 && chat == b.cfg.Admin {
			_, err = b.tg.SendMessage(ctx, chat, b.statsText(ctx), nil)
			break
		}
		fallthrough
	default:
		_, err = b.tg.SendMessage(ctx, chat, tx.Help, b.mainKeyboard(lang, b.reminding(ctx, chat)))
	}
	if err != nil {
		b.sendFailed(ctx, chat, err)
	}
}

func (b *Bot) reminding(ctx context.Context, chat int64) bool {
	c, err := b.st.Chat(ctx, chat)
	return err == nil && c.Remind && !c.Blocked
}

func (b *Bot) sendFailed(ctx context.Context, chat int64, err error) {
	if Blocked(err) {
		b.st.SetBlocked(ctx, chat)
		return
	}
	b.log.Warn("telegram xabar yuborilmadi", "chat", chat, "err", err)
}

func (b *Bot) onCallback(ctx context.Context, cb *CallbackQuery) {
	chat := cb.From.ID
	if lang, ok := strings.CutPrefix(cb.Data, "lang:"); ok && (lang == "uz" || lang == "ru") {
		// Til tugmasi: tanlangan tilda salomlashuv qayta yuboriladi.
		b.st.UpsertChat(ctx, chat, lang)
		if err := b.st.SetLang(ctx, chat, lang); err != nil {
			b.log.Error("telegram til", "err", err)
		}
		b.tg.AnswerCallback(ctx, cb.ID, "")
		if _, err := b.tg.SendMessage(ctx, chat, t(lang).Welcome, b.mainKeyboard(lang, b.reminding(ctx, chat))); err != nil {
			b.sendFailed(ctx, chat, err)
		}
		return
	}
	action, ok := strings.CutPrefix(cb.Data, "remind:")
	if !ok {
		b.tg.AnswerCallback(ctx, cb.ID, "")
		return
	}
	on := action == "on"
	lang := b.chatLang(ctx, chat)
	tx := t(lang)
	if err := b.st.SetRemind(ctx, chat, lang, on); err != nil {
		b.log.Error("telegram eslatma", "err", err)
		b.tg.AnswerCallback(ctx, cb.ID, "")
		return
	}
	note := tx.CallbackOff
	if on {
		note = tx.CallbackOn
	}
	if err := b.tg.AnswerCallback(ctx, cb.ID, note); err != nil {
		b.log.Warn("telegram answerCallback", "err", err)
	}
	// Xabardagi tugmalar yangi holatga moslanadi (boshqa tugmalar o'zgarmaydi).
	if m := cb.Message; m != nil && m.ReplyMarkup != nil {
		kb := Keyboard{}
		for _, row := range m.ReplyMarkup.InlineKeyboard {
			next := make([]Button, len(row))
			for i, btn := range row {
				if strings.HasPrefix(btn.CallbackData, "remind:") {
					btn = b.remindButton(lang, on)
				}
				next[i] = btn
			}
			kb.InlineKeyboard = append(kb.InlineKeyboard, next)
		}
		if err := b.tg.EditReplyMarkup(ctx, m.Chat.ID, m.MessageID, &kb); err != nil {
			b.log.Warn("telegram editMarkup", "err", err)
		}
	}
}

func (b *Bot) remindButton(lang string, on bool) Button {
	if on {
		return Button{Text: t(lang).RemindOff, CallbackData: "remind:off"}
	}
	return Button{Text: t(lang).RemindOn, CallbackData: "remind:on"}
}

// mainKeyboard — o'yinni Mini App sifatida ochish, eslatmani yoqish/o'chirish va tilni almashtirish.
func (b *Bot) mainKeyboard(lang string, reminding bool) *Keyboard {
	return &Keyboard{InlineKeyboard: [][]Button{
		{{Text: t(lang).Play, WebApp: &WebApp{URL: b.cfg.Site}}},
		{b.remindButton(lang, reminding)},
		{{Text: t(lang).SwitchLang, CallbackData: "lang:" + otherLang(lang)}},
	}}
}

// appLink — Mini App'ni kerakli sahifada ochadigan havola (t.me/<bot>/<app>?startapp=…).
func (b *Bot) appLink(param string) string {
	if b.username == "" {
		return b.cfg.Site + "/#/" + param
	}
	return fmt.Sprintf("https://t.me/%s/%s?startapp=%s", b.username, b.cfg.App, param)
}

func (b *Bot) sendRemindStatus(ctx context.Context, chat int64, lang string, on bool) error {
	tx := t(lang)
	text := tx.RemindDisabled
	if on {
		text = fmt.Sprintf(tx.RemindEnabled, b.cfg.RemindHour)
	}
	_, err := b.tg.SendMessage(ctx, chat, text, b.mainKeyboard(lang, on))
	return err
}

// VerifyInitData — api.Telegram interfeysi uchun.
func (b *Bot) VerifyInitData(initData string) (int64, string, error) {
	return VerifyInitData(initData, b.cfg.Token, b.now())
}

// RemindChanged o'yin ichidan eslatma yoqilganda/o'chirilganda foydalanuvchiga xabar yuboradi.
// blocked — bot foydalanuvchiga yoza olmaydi (botni bloklagan yoki ruxsat bermagan).
func (b *Bot) RemindChanged(ctx context.Context, chat int64, lang string, on bool) (blocked bool, err error) {
	err = b.sendRemindStatus(ctx, chat, lang, on)
	if Blocked(err) {
		b.st.SetBlocked(ctx, chat)
		return true, nil
	}
	return false, err
}

// ── Kunlik eslatma ──────────────────────────────────────────

// nextReminder — keyingi eslatmagacha qancha kutish (0 — hozir yuborish kerak).
func (b *Bot) nextReminder(ctx context.Context) time.Duration {
	now := b.now().In(levels.Tashkent)
	day := levels.DayOf(now)
	sent, _ := b.st.Meta(ctx, metaRemindDay)
	at := time.Date(now.Year(), now.Month(), now.Day(), b.cfg.RemindHour, 0, 0, 0, levels.Tashkent)
	if sent != strconv.Itoa(day) {
		if now.Before(at) {
			return at.Sub(now)
		}
		if now.Hour() < remindLateHour {
			return 0
		}
	}
	return at.Add(24 * time.Hour).Sub(now)
}

func (b *Bot) remindLoop(ctx context.Context) {
	for {
		wait := b.nextReminder(ctx)
		if !sleep(ctx, wait) {
			return
		}
		if err := b.SendReminders(ctx); err != nil {
			b.log.Error("telegram eslatma", "err", err)
			// Baza xatosi bo'lsa ham to'xtovsiz qayta urinmasin.
			if !sleep(ctx, 10*time.Minute) {
				return
			}
		}
	}
}

// SendReminders bugungi masala haqida eslatma yuboradi: yoqqan, bloklamagan va hali yechmaganlarga.
// Kuniga bir marta (yuborilgan kun bazada belgilanadi).
func (b *Bot) SendReminders(ctx context.Context) error {
	day := levels.DayOf(b.now())
	if err := b.st.SetMeta(ctx, metaRemindDay, strconv.Itoa(day)); err != nil {
		return err
	}
	p, ok := b.daily.For(day)
	if !ok {
		return errors.New("bugungi masala yo'q")
	}
	targets, err := b.st.ReminderTargets(ctx, day)
	if err != nil {
		return err
	}
	solvers, _, err := b.st.DailyStats(ctx, day)
	if err != nil {
		return err
	}
	sent, failed := 0, 0
	for _, c := range targets {
		tx := t(c.Lang)
		tier := ""
		if p.Tier >= 0 && p.Tier < len(tx.Tiers) {
			tier = tx.Tiers[p.Tier]
		}
		text := fmt.Sprintf(tx.Daily, b.daily.Number(day), tier) + "\n"
		streak := 0
		if c.PlayerID != "" {
			streak, _ = b.st.DailyStreak(ctx, c.PlayerID, day)
		}
		switch {
		case streak >= 2:
			text += fmt.Sprintf(tx.Streak, streak)
		case solvers > 0:
			text += fmt.Sprintf(tx.Solvers, solvers)
		default:
			text += tx.First
		}
		kb := &Keyboard{InlineKeyboard: [][]Button{
			{{Text: tx.Solve, URL: b.appLink("daily")}},
			{b.remindButton(c.Lang, true)},
		}}
		_, err := b.tg.SendMessage(ctx, c.ChatID, text, kb)
		var apiErr *APIError
		if errors.As(err, &apiErr) && apiErr.Code == 429 {
			sleep(ctx, time.Duration(apiErr.RetryAfter+1)*time.Second)
			_, err = b.tg.SendMessage(ctx, c.ChatID, text, kb)
		}
		if err != nil {
			failed++
			b.sendFailed(ctx, c.ChatID, err)
		} else {
			sent++
		}
		if !sleep(ctx, b.pause) {
			return ctx.Err()
		}
	}
	b.log.Info("kunlik eslatma", "day", day, "sent", sent, "failed", failed)
	return nil
}

// ── Admin ───────────────────────────────────────────────────

func (b *Bot) statsText(ctx context.Context) string {
	s, err := b.st.Stats(ctx, levels.DayOf(b.now()), b.now())
	if err != nil {
		return "Statistika olinmadi: " + err.Error()
	}
	return fmt.Sprintf("📊 Logic Gate\nO'yinchilar: %d (7 kunda faol: %d)\nBugungi masalani yechgan: %d\nBot obunachilari: %d, eslatma: %d",
		s.Players, s.ActiveWeek, s.DailyToday, s.Chats, s.Subscribers)
}

// SendBackup — kunlik zaxira nusxani admin'ga fayl qilib yuboradi (backup.Config.Notify).
func (b *Bot) SendBackup(ctx context.Context, path string) {
	if b.cfg.Admin == 0 {
		return
	}
	info, err := os.Stat(path)
	if err != nil {
		b.log.Warn("telegram zaxira", "err", err)
		return
	}
	caption := "💾 " + info.Name() + "\n" + b.statsText(ctx)
	// Bot API fayl chegarasi 50 MB.
	if info.Size() > 45<<20 {
		_, err = b.tg.SendMessage(ctx, b.cfg.Admin, caption+"\n\nNusxa Telegram'ga sig'maydi ("+strconv.FormatInt(info.Size()>>20, 10)+" MB) — serverdan oling.", nil)
	} else {
		err = b.tg.SendDocument(ctx, b.cfg.Admin, path, caption)
	}
	if err != nil {
		b.log.Warn("telegram zaxira yuborilmadi", "err", err)
		return
	}
	b.log.Info("zaxira nusxa Telegram'ga yuborildi", "file", info.Name())
}
