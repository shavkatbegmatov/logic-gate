package bot

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"logicgate/levels"
	"logicgate/server/internal/store"
)

const testToken = "123456:TEST-token_abc"

type call struct {
	Method string
	Params map[string]any
	File   string // sendDocument: fayl mazmuni
}

// fakeAPI — Bot API o'rnida: so'rovlarni yozib boradi; blocked dagi chatlarga xabar 403 bilan qaytadi.
type fakeAPI struct {
	mu      sync.Mutex
	calls   []call
	blocked map[int64]bool
}

func (f *fakeAPI) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	method, ok := strings.CutPrefix(r.URL.Path, "/bot"+testToken+"/")
	if !ok {
		http.Error(w, `{"ok":false,"error_code":401,"description":"Unauthorized"}`, 401)
		return
	}
	c := call{Method: method, Params: map[string]any{}}
	if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/") {
		r.ParseMultipartForm(1 << 20)
		for k, v := range r.MultipartForm.Value {
			c.Params[k] = v[0]
		}
		if fh := r.MultipartForm.File["document"]; len(fh) > 0 {
			fl, _ := fh[0].Open()
			b, _ := io.ReadAll(fl)
			c.File = fh[0].Filename + ":" + string(b)
		}
	} else {
		json.NewDecoder(r.Body).Decode(&c.Params)
	}
	f.mu.Lock()
	f.calls = append(f.calls, c)
	blocked := f.blocked[int64(num(c.Params["chat_id"]))]
	f.mu.Unlock()
	switch {
	case method == "getMe":
		w.Write([]byte(`{"ok":true,"result":{"id":1,"is_bot":true,"username":"LogicGateUzBot"}}`))
	case method == "sendMessage" && blocked:
		w.Write([]byte(`{"ok":false,"error_code":403,"description":"Forbidden: bot was blocked by the user"}`))
	case method == "sendMessage":
		w.Write([]byte(`{"ok":true,"result":{"message_id":7,"chat":{"id":1,"type":"private"}}}`))
	default:
		w.Write([]byte(`{"ok":true,"result":true}`))
	}
}

func num(v any) float64 {
	switch x := v.(type) {
	case float64:
		return x
	case string:
		n, _ := strconv.ParseFloat(x, 64)
		return n
	}
	return 0
}

func (f *fakeAPI) take(method string) []call {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []call
	for _, c := range f.calls {
		if c.Method == method {
			out = append(out, c)
		}
	}
	return out
}

func setup(t *testing.T) (*Bot, *fakeAPI, *store.Store) {
	t.Helper()
	fake := &fakeAPI{blocked: map[int64]bool{}}
	srv := httptest.NewServer(fake)
	t.Cleanup(srv.Close)
	st, err := store.Open(filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	daily, err := levels.LoadDaily()
	if err != nil {
		t.Fatal(err)
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	b := New(Config{Token: testToken, API: srv.URL, Admin: 99, Site: "https://logic.noesis.uz", RemindHour: 9}, st, daily, log)
	b.pause = 0
	b.username = "LogicGateUzBot"
	// Kunlik masalalar ro'yxatining birinchi kuni (testlar sanaga bog'liq bo'lmasin).
	start, err := time.ParseInLocation(time.DateOnly, daily.Start, levels.Tashkent)
	if err != nil {
		t.Fatal(err)
	}
	b.now = func() time.Time { return start.Add(10 * time.Hour) }
	return b, fake, st
}

func keyboard(t *testing.T, c call) [][]map[string]any {
	t.Helper()
	raw, _ := json.Marshal(c.Params["reply_markup"])
	var kb struct {
		InlineKeyboard [][]map[string]any `json:"inline_keyboard"`
	}
	json.Unmarshal(raw, &kb)
	return kb.InlineKeyboard
}

func TestStartAndRemindButton(t *testing.T) {
	b, fake, st := setup(t)
	ctx := context.Background()
	b.Handle(ctx, Update{Message: &Message{
		From: &User{ID: 42, LanguageCode: "ru"}, Chat: Chat{ID: 42, Type: "private"}, Text: "/start@LogicGateUzBot",
	}})
	msgs := fake.take("sendMessage")
	if len(msgs) != 1 || num(msgs[0].Params["chat_id"]) != 42 || !strings.Contains(msgs[0].Params["text"].(string), "Logic Gate") {
		t.Fatalf("/start javobi: %+v", msgs)
	}
	kb := keyboard(t, msgs[0])
	if kb[0][0]["web_app"].(map[string]any)["url"] != "https://logic.noesis.uz" || kb[1][0]["callback_data"] != "remind:on" {
		t.Fatalf("tugmalar: %v", kb)
	}
	// Telegram ilovasi ruscha bo'lsa ham, bot o'yin kabi o'zbekchadan boshlaydi.
	if c, err := st.Chat(ctx, 42); err != nil || c.Lang != "uz" || c.Remind {
		t.Fatalf("chat: %+v %v", c, err)
	}
	if kb[2][0]["callback_data"] != "lang:ru" {
		t.Fatalf("til tugmasi: %v", kb[2])
	}
	// Til tugmasi: ruschaga o'tadi va salomlashuv ruscha qayta keladi.
	b.Handle(ctx, Update{CallbackQuery: &CallbackQuery{ID: "cb0", From: User{ID: 42}, Data: "lang:ru"}})
	if c, _ := st.Chat(ctx, 42); c.Lang != "ru" {
		t.Fatal("til almashmadi")
	}
	if m := fake.take("sendMessage"); !strings.Contains(m[len(m)-1].Params["text"].(string), "Привет") {
		t.Fatalf("ruscha salomlashuv: %v", m[len(m)-1].Params["text"])
	}

	// Tugma: eslatma yoqiladi, tugma "o'chirish" ga almashadi.
	b.Handle(ctx, Update{CallbackQuery: &CallbackQuery{
		ID: "cb1", From: User{ID: 42, LanguageCode: "ru"}, Data: "remind:on",
		Message: &Message{MessageID: 7, Chat: Chat{ID: 42}, ReplyMarkup: b.mainKeyboard("ru", false)},
	}})
	if c, _ := st.Chat(ctx, 42); !c.Remind {
		t.Fatal("eslatma yoqilmadi")
	}
	if ans := fake.take("answerCallbackQuery"); len(ans) != 2 || ans[1].Params["text"] != "Напоминание включено ✅" {
		t.Fatalf("javob: %+v", ans)
	}
	edits := fake.take("editMessageReplyMarkup")
	if len(edits) != 1 || keyboard(t, edits[0])[1][0]["callback_data"] != "remind:off" || keyboard(t, edits[0])[0][0]["web_app"] == nil {
		t.Fatalf("tugmalar yangilanmadi: %+v", edits)
	}

	// /eslatma — holatni almashtiradi.
	b.Handle(ctx, Update{Message: &Message{From: &User{ID: 42}, Chat: Chat{ID: 42, Type: "private"}, Text: "/eslatma"}})
	if c, _ := st.Chat(ctx, 42); c.Remind {
		t.Fatal("/eslatma o'chirmadi")
	}
	// Guruhdagi xabarlarga javob berilmaydi.
	n := len(fake.take("sendMessage"))
	b.Handle(ctx, Update{Message: &Message{From: &User{ID: 5}, Chat: Chat{ID: -100, Type: "group"}, Text: "/start"}})
	if len(fake.take("sendMessage")) != n {
		t.Fatal("guruhga javob berildi")
	}
	// /stats — faqat admin'ga.
	b.Handle(ctx, Update{Message: &Message{From: &User{ID: 99}, Chat: Chat{ID: 99, Type: "private"}, Text: "/stats"}})
	b.Handle(ctx, Update{Message: &Message{From: &User{ID: 42}, Chat: Chat{ID: 42, Type: "private"}, Text: "/stats"}})
	all := fake.take("sendMessage")
	if !strings.Contains(all[len(all)-2].Params["text"].(string), "O'yinchilar") || strings.Contains(all[len(all)-1].Params["text"].(string), "O'yinchilar") {
		t.Fatal("/stats faqat admin uchun bo'lishi kerak")
	}
}

func TestReminders(t *testing.T) {
	b, fake, st := setup(t)
	ctx := context.Background()
	day := levels.DayOf(b.now())
	sol := store.Solution{Gates: 3, Stars: 3, Circuit: "{}", SolvedAt: b.now()}
	for _, p := range []string{"p1", "p2"} {
		if err := st.CreatePlayer(ctx, p, []byte(p), p); err != nil {
			t.Fatal(err)
		}
	}
	// p1 bugun yechgan; p2 kecha va o'tgan kuni yechgan (seriya 2), bugun hali yo'q.
	st.SaveDaily(ctx, "p1", day, sol)
	st.SaveDaily(ctx, "p2", day-1, sol)
	st.SaveDaily(ctx, "p2", day-2, sol)
	chats := []struct {
		id     int64
		remind bool
		player string
	}{{1, true, "p1"}, {2, true, "p2"}, {3, true, ""}, {4, true, ""}, {5, false, ""}, {6, true, ""}}
	for _, c := range chats {
		st.SetRemind(ctx, c.id, "uz", c.remind)
		if c.player != "" {
			st.LinkChat(ctx, c.id, c.player)
		}
	}
	st.SetBlocked(ctx, 4)
	fake.blocked[6] = true

	if err := b.SendReminders(ctx); err != nil {
		t.Fatal(err)
	}
	msgs := fake.take("sendMessage")
	var to []int64
	for _, m := range msgs {
		to = append(to, int64(num(m.Params["chat_id"])))
	}
	if !slices.Equal(to, []int64{2, 3, 6}) {
		t.Fatalf("eslatma oluvchilar: %v (kutilgan 2, 3, 6)", to)
	}
	if txt := msgs[0].Params["text"].(string); !strings.Contains(txt, "Kunlik boshqotirma #1") || !strings.Contains(txt, "Seriyangiz: 2 kun") {
		t.Fatalf("seriyali eslatma: %q", txt)
	}
	if txt := msgs[1].Params["text"].(string); !strings.Contains(txt, "Bugun 1 kishi yechdi") {
		t.Fatalf("oddiy eslatma: %q", txt)
	}
	if u := keyboard(t, msgs[0])[0][0]["url"]; u != "https://t.me/LogicGateUzBot/play?startapp=daily" {
		t.Fatalf("Yechish havolasi: %v", u)
	}
	if c, _ := st.Chat(ctx, 6); !c.Blocked {
		t.Fatal("403 dan keyin chat bloklangan deb belgilanmadi")
	}
	if v, _ := st.Meta(ctx, metaRemindDay); v != strconv.Itoa(day) {
		t.Fatalf("yuborilgan kun: %q", v)
	}
}

func TestNextReminder(t *testing.T) {
	b, _, st := setup(t)
	ctx := context.Background()
	base := time.Date(2026, 11, 8, 0, 0, 0, 0, levels.Tashkent)
	cases := []struct {
		hour int
		sent bool
		want time.Duration
	}{
		{8, false, time.Hour},       // hali vaqti kelmagan
		{10, false, 0},              // kechikkan — hozir
		{10, true, 23 * time.Hour},  // bugun yuborilgan — ertaga
		{22, false, 11 * time.Hour}, // 9:00 + 12 soatdan kech — ertaga
	}
	for _, c := range cases {
		now := base.Add(time.Duration(c.hour) * time.Hour)
		b.now = func() time.Time { return now }
		v := ""
		if c.sent {
			v = strconv.Itoa(levels.DayOf(now))
		}
		st.SetMeta(ctx, metaRemindDay, v)
		if got := b.nextReminder(ctx); got != c.want {
			t.Errorf("soat %d, yuborilgan=%v: %v, kutilgan %v", c.hour, c.sent, got, c.want)
		}
	}
}

// sign — Telegram kabi initData tuzadi.
func sign(token string, vals url.Values) string {
	keys := make([]string, 0, len(vals))
	for k := range vals {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var lines []string
	for _, k := range keys {
		lines = append(lines, k+"="+vals.Get(k))
	}
	secret := hmac.New(sha256.New, []byte("WebAppData"))
	secret.Write([]byte(token))
	mac := hmac.New(sha256.New, secret.Sum(nil))
	mac.Write([]byte(strings.Join(lines, "\n")))
	vals.Set("hash", hex.EncodeToString(mac.Sum(nil)))
	return vals.Encode()
}

func TestVerifyInitData(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	vals := func(at time.Time) url.Values {
		return url.Values{
			"user":      {`{"id":555,"first_name":"Ali","language_code":"ru"}`},
			"auth_date": {strconv.FormatInt(at.Unix(), 10)},
			"query_id":  {"AAE"},
			"signature": {"abc"},
		}
	}
	good := sign(testToken, vals(now.Add(-time.Hour)))
	if id, lang, err := VerifyInitData(good, testToken, now); err != nil || id != 555 || lang != "ru" {
		t.Fatalf("to'g'ri ma'lumot: %d %s %v", id, lang, err)
	}
	if _, _, err := VerifyInitData(good, "boshqa:token", now); err == nil {
		t.Fatal("boshqa token bilan qabul qilindi")
	}
	tampered := strings.Replace(good, "555", "556", 1)
	if _, _, err := VerifyInitData(tampered, testToken, now); err == nil {
		t.Fatal("o'zgartirilgan ma'lumot qabul qilindi")
	}
	old := sign(testToken, vals(now.Add(-49*time.Hour)))
	if _, _, err := VerifyInitData(old, testToken, now); err == nil {
		t.Fatal("eskirgan ma'lumot qabul qilindi")
	}
	if _, _, err := VerifyInitData("", testToken, now); err == nil {
		t.Fatal("bo'sh ma'lumot qabul qilindi")
	}
}

func TestSendBackupAndTokenInErrors(t *testing.T) {
	b, fake, _ := setup(t)
	path := filepath.Join(t.TempDir(), "logicgate-2026-11-08.db.gz")
	os.WriteFile(path, []byte("ZAXIRA"), 0o600)
	b.SendBackup(context.Background(), path)
	docs := fake.take("sendDocument")
	if len(docs) != 1 || num(docs[0].Params["chat_id"]) != 99 || docs[0].File != "logicgate-2026-11-08.db.gz:ZAXIRA" ||
		!strings.Contains(docs[0].Params["caption"].(string), "logicgate-2026-11-08.db.gz") {
		t.Fatalf("zaxira: %+v", docs)
	}

	// Aloqa xatosida token xato matniga chiqmasin (u log'ga yoziladi).
	c := NewClient("http://127.0.0.1:1", testToken)
	_, err := c.GetMe(context.Background())
	if err == nil || strings.Contains(err.Error(), testToken) || !strings.Contains(err.Error(), "***") {
		t.Fatalf("xato matni: %v", err)
	}
}

// Telegram yuboradigan haqiqiy shakldagi callback (JSON) — tugmalar bilan va tugmalarsiz.
func TestCallbackFromRawJSON(t *testing.T) {
	b, fake, st := setup(t)
	ctx := context.Background()
	const withMarkup = `{"update_id":5,"callback_query":{"id":"q1","from":{"id":42,"is_bot":false,"first_name":"Ali","language_code":"ru"},
		"message":{"message_id":77,"from":{"id":1,"is_bot":true,"first_name":"Logic Gate","username":"LogicGateUzBot"},
		"chat":{"id":42,"first_name":"Ali","type":"private"},"date":1700000000,"text":"Salom!",
		"reply_markup":{"inline_keyboard":[[{"text":"🎮 O'ynash","web_app":{"url":"https://logic.noesis.uz"}}],
		[{"text":"🔔 Har kuni eslatish","callback_data":"remind:on"}],[{"text":"🇷🇺 Русский","callback_data":"lang:ru"}]]}},
		"chat_instance":"-1","data":"remind:on"}}`
	var u Update
	if err := json.Unmarshal([]byte(withMarkup), &u); err != nil {
		t.Fatal(err)
	}
	b.Handle(ctx, u)
	edits := fake.take("editMessageReplyMarkup")
	if len(edits) != 1 || num(edits[0].Params["chat_id"]) != 42 || num(edits[0].Params["message_id"]) != 77 {
		t.Fatalf("tahrir: %+v", edits)
	}
	kb := keyboard(t, edits[0])
	if kb[0][0]["web_app"] == nil || kb[1][0]["callback_data"] != "remind:off" || kb[2][0]["callback_data"] != "lang:ru" {
		t.Fatalf("tugmalar: %v", kb)
	}
	if c, _ := st.Chat(ctx, 42); !c.Remind {
		t.Fatal("eslatma yoqilmadi")
	}

	// Tugmalarsiz xabar — asosiy tugmalar qayta quriladi (o'chirish holatida).
	const noMarkup = `{"update_id":6,"callback_query":{"id":"q2","from":{"id":42,"is_bot":false,"first_name":"Ali"},
		"message":{"message_id":78,"chat":{"id":42,"type":"private"},"date":1700000000,"text":"Salom!"},"data":"remind:off"}}`
	u = Update{}
	json.Unmarshal([]byte(noMarkup), &u)
	b.Handle(ctx, u)
	edits = fake.take("editMessageReplyMarkup")
	if len(edits) != 2 || num(edits[1].Params["message_id"]) != 78 || keyboard(t, edits[1])[1][0]["callback_data"] != "remind:on" {
		t.Fatalf("tugmalarsiz xabar: %+v", edits)
	}
}

// Eslatma soati kech bo'lsa ham (masalan, 21:00) yuboriladi; tasdiq xabari tez-tez yuborilmaydi.
func TestLateReminderHourAndConfirmThrottle(t *testing.T) {
	b, fake, st := setup(t)
	ctx := context.Background()
	b.cfg.RemindHour = 21
	now := time.Date(2026, 11, 8, 21, 30, 0, 0, levels.Tashkent)
	b.now = func() time.Time { return now }
	st.SetMeta(ctx, metaRemindDay, "")
	if got := b.nextReminder(ctx); got != 0 {
		t.Fatalf("21:30 da kutish: %v", got)
	}
	b.RemindChanged(ctx, 7, "uz", true)
	b.RemindChanged(ctx, 7, "uz", false)
	if n := len(fake.take("sendMessage")); n != 1 {
		t.Fatalf("30 s ichida %d ta tasdiq", n)
	}
	now = now.Add(31 * time.Second)
	b.RemindChanged(ctx, 7, "uz", true)
	if n := len(fake.take("sendMessage")); n != 2 {
		t.Fatalf("30 s dan keyin: %d", n)
	}
}

func TestInlineShare(t *testing.T) {
	b, fake, st := setup(t)
	ctx := context.Background()
	b.Handle(ctx, Update{InlineQuery: &InlineQuery{ID: "iq1", From: User{ID: 42}}})
	ans := fake.take("answerInlineQuery")
	if len(ans) != 1 {
		t.Fatalf("javob: %+v", ans)
	}
	raw, _ := json.Marshal(ans[0].Params["results"])
	var res []InlineResult
	json.Unmarshal(raw, &res)
	if len(res) != 2 || !strings.HasPrefix(res[0].ID, "daily-") || res[1].ID != "invite" {
		t.Fatalf("natijalar: %+v", res)
	}
	if !strings.Contains(res[0].InputMessageContent.MessageText, "Kunlik boshqotirma #1") ||
		res[0].ReplyMarkup.InlineKeyboard[0][0].URL != "https://t.me/LogicGateUzBot/play?startapp=daily" ||
		res[1].ReplyMarkup.InlineKeyboard[0][0].URL != "https://t.me/LogicGateUzBot/play" {
		t.Fatalf("kartalar: %+v", res)
	}

	// O'yinga bog'langan va bugun yechgan — natijasi bilan.
	st.CreatePlayer(ctx, "p1", []byte("p1"), "Ali")
	st.SetRemind(ctx, 42, "uz", false)
	st.LinkChat(ctx, 42, "p1")
	st.SaveDaily(ctx, "p1", levels.DayOf(b.now()), store.Solution{Gates: 4, Stars: 3, Circuit: "{}", SolvedAt: b.now()})
	b.Handle(ctx, Update{InlineQuery: &InlineQuery{ID: "iq2", From: User{ID: 42}}})
	raw, _ = json.Marshal(fake.take("answerInlineQuery")[1].Params["results"])
	json.Unmarshal(raw, &res)
	if !strings.Contains(res[0].InputMessageContent.MessageText, "★★★ — 4 ta element") {
		t.Fatalf("natija bilan: %q", res[0].InputMessageContent.MessageText)
	}
}

func TestWeeklyReportAndAlerts(t *testing.T) {
	b, fake, st := setup(t)
	ctx := context.Background()
	st.CreatePlayer(ctx, "p1", []byte("p1"), "Ali")
	if err := b.SendWeeklyReport(ctx); err != nil {
		t.Fatal(err)
	}
	msgs := fake.take("sendMessage")
	if len(msgs) != 1 || num(msgs[0].Params["chat_id"]) != 99 || !strings.Contains(msgs[0].Params["text"].(string), "O'yinchilar: 1 (yangi: 1)") {
		t.Fatalf("hisobot: %+v", msgs)
	}

	// Dushanba 10:00 dan keyin — hozir; yuborilgan bo'lsa — keyingi dushanba; yakshanba — ertaga.
	mon := time.Date(2026, 11, 9, 11, 0, 0, 0, levels.Tashkent)
	b.now = func() time.Time { return mon }
	st.SetMeta(ctx, metaReportDay, "")
	if got := b.nextReport(ctx); got != 0 {
		t.Fatalf("dushanba 11:00: %v", got)
	}
	st.SetMeta(ctx, metaReportDay, strconv.Itoa(levels.DayOf(mon)))
	if got := b.nextReport(ctx); got != 7*24*time.Hour-time.Hour {
		t.Fatalf("yuborilgandan keyin: %v", got)
	}
	sun := time.Date(2026, 11, 8, 22, 0, 0, 0, levels.Tashkent)
	b.now = func() time.Time { return sun }
	if got := b.nextReport(ctx); got != 12*time.Hour {
		t.Fatalf("yakshanba 22:00: %v", got)
	}

	// Xatolar: ikkitasi bitta xabarda, keyin hisob nolga tushadi.
	alerts := NewAlerts()
	b.SetAlerts(alerts)
	logger := slog.New(alerts.Wrap(slog.NewTextHandler(io.Discard, nil)))
	logger.Error("birinchi", "err", "a")
	logger.With("k", "v").Error("ikkinchi", "err", "b")
	logger.Warn("ogohlantirish emas")
	b.FlushAlerts(ctx)
	b.FlushAlerts(ctx)
	got := fake.take("sendMessage")
	if len(got) != 2 || !strings.Contains(got[1].Params["text"].(string), "2 ta xato") || !strings.Contains(got[1].Params["text"].(string), "ikkinchi err=b") {
		t.Fatalf("ogohlantirish: %+v", got[1:])
	}

	// Brauzer xatolari alohida qatorda: ular server xatosini "Oxirgisi" dan siqib chiqarmaydi.
	logger.Error("server buzildi", "err", "db")
	logger.Error(ClientErrorMsg, "error", "TypeError: x")
	logger.Error(ClientErrorMsg, "error", "TypeError: y")
	b.FlushAlerts(ctx)
	got = fake.take("sendMessage")
	text := got[len(got)-1].Params["text"].(string)
	if !strings.Contains(text, "serverida 1 ta xato") || !strings.Contains(text, "server buzildi err=db") ||
		!strings.Contains(text, "brauzerida 2 ta xato") || !strings.Contains(text, "error=TypeError: y") {
		t.Fatalf("server va brauzer xatolari: %q", text)
	}
	// Faqat brauzer xatosi — server qatori yo'q.
	logger.Error(ClientErrorMsg, "error", "z")
	b.FlushAlerts(ctx)
	got = fake.take("sendMessage")
	if text := got[len(got)-1].Params["text"].(string); strings.Contains(text, "serverida") || !strings.Contains(text, "brauzerida 1 ta xato") {
		t.Fatalf("faqat brauzer: %q", text)
	}
}
