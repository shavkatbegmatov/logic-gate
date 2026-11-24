package bot

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log/slog"
	"mime"
	"mime/multipart"
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
	"logicgate/server/internal/tglogin"
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
	b.setUsername("LogicGateUzBot")
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

// SendDocument faylni xotiraga o'qimay, oqim bilan yuboradi: aniq Content-Length (chunked emas) va
// to'g'ri multipart forma.
func TestSendDocumentStreams(t *testing.T) {
	content := make([]byte, 3<<20)
	for i := range content {
		content[i] = byte(i*7 + i>>9)
	}
	path := filepath.Join(t.TempDir(), "logicgate-2026-11-09.db.gz")
	if err := os.WriteFile(path, content, 0o600); err != nil {
		t.Fatal(err)
	}
	type got struct {
		contentLength int64
		chunked       bool
		body          []byte
		ctype         string
	}
	ch := make(chan got, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		ch <- got{r.ContentLength, len(r.TransferEncoding) > 0, b, r.Header.Get("Content-Type")}
		w.Write([]byte(`{"ok":true,"result":{}}`))
	}))
	defer srv.Close()

	if err := NewClient(srv.URL, testToken).SendDocument(context.Background(), 99, path, "💾 TEST <izoh>"); err != nil {
		t.Fatal(err)
	}
	g := <-ch
	if g.chunked || g.contentLength != int64(len(g.body)) || g.contentLength <= int64(len(content)) {
		t.Fatalf("uzunlik: Content-Length=%d, tana=%d, chunked=%v", g.contentLength, len(g.body), g.chunked)
	}
	mt, params, err := mime.ParseMediaType(g.ctype)
	if err != nil || mt != "multipart/form-data" {
		t.Fatalf("Content-Type: %q %v", g.ctype, err)
	}
	form, err := multipart.NewReader(bytes.NewReader(g.body), params["boundary"]).ReadForm(64 << 20)
	if err != nil {
		t.Fatal(err)
	}
	defer form.RemoveAll()
	if form.Value["chat_id"][0] != "99" || form.Value["caption"][0] != "💾 TEST <izoh>" {
		t.Fatalf("maydonlar: %v", form.Value)
	}
	fh := form.File["document"]
	if len(fh) != 1 || fh[0].Filename != "logicgate-2026-11-09.db.gz" {
		t.Fatalf("fayl: %+v", fh)
	}
	f, _ := fh[0].Open()
	defer f.Close()
	if b, _ := io.ReadAll(f); !bytes.Equal(b, content) {
		t.Fatalf("fayl mazmuni boshqacha: %d bayt", len(b))
	}
}

// Brauzer xatosi matni tashqaridan keladi: admin xabarida havolalar bosiladigan bo'lmasin (HTML <code>,
// ko'rinish o'chirilgan) va matndagi teglar ishlamasin.
func TestAlertLinksNotClickable(t *testing.T) {
	b, fake, _ := setup(t)
	alerts := NewAlerts()
	b.SetAlerts(alerts)
	logger := slog.New(alerts.Wrap(slog.NewTextHandler(io.Discard, nil)))
	logger.Error(ClientErrorMsg, "error", `<a href="https://evil.example/x">bos</a> https://evil.example/login & evil.com`)
	b.FlushAlerts(context.Background())
	msgs := fake.take("sendMessage")
	if len(msgs) != 1 {
		t.Fatalf("xabarlar: %+v", msgs)
	}
	p := msgs[0].Params
	if p["parse_mode"] != "HTML" || p["link_preview_options"].(map[string]any)["is_disabled"] != true {
		t.Fatalf("parametrlar: %v", p)
	}
	text := p["text"].(string)
	start, end := strings.Index(text, "<code>"), strings.LastIndex(text, "</code>")
	if start < 0 || end < start || strings.Count(text, "<") != 2 {
		t.Fatalf("matn <code> ichida emas yoki teglar zararsizlantirilmagan: %q", text)
	}
	inside := text[start:end]
	if !strings.Contains(inside, "https://evil.example/login &amp; evil.com") || !strings.Contains(inside, "&lt;a href=&#34;https://evil.example/x&#34;&gt;") {
		t.Fatalf("code ichidagi matn: %q", inside)
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

func TestAuthConfirm(t *testing.T) {
	b, fake, st := setup(t)
	ctx := context.Background()
	hub := tglogin.New(nil)
	b.SetLogins(hub)
	if got := b.StartLink("auth_x"); got != "https://t.me/LogicGateUzBot?start=auth_x" {
		t.Fatalf("havola: %s", got)
	}
	for i, nick := range []string{"TEST_USER", "TEST_USER_2"} {
		h := sha256.Sum256([]byte(nick))
		if err := st.CreatePlayer(ctx, "p"+strconv.Itoa(i+1), h[:], nick); err != nil {
			t.Fatal(err)
		}
	}
	open := func(chat int64, id string) call {
		t.Helper()
		b.Handle(ctx, Update{Message: &Message{
			From: &User{ID: chat, FirstName: "Ali", LastName: "Valiyev"}, Chat: Chat{ID: chat, Type: "private"}, Text: "/start auth_" + id,
		}})
		m := fake.take("sendMessage")
		return m[len(m)-1]
	}
	press := func(chat int64, id string, n int) string {
		t.Helper()
		b.Handle(ctx, Update{CallbackQuery: &CallbackQuery{
			ID: "cb", From: User{ID: chat}, Data: "auth:" + id + ":" + strconv.Itoa(n), Message: &Message{MessageID: 7, Chat: Chat{ID: chat}},
		}})
		e := fake.take("editMessageText")
		if len(e) == 0 || num(e[len(e)-1].Params["message_id"]) != 7 || e[len(e)-1].Params["reply_markup"] != nil {
			t.Fatalf("xabar yangilanmadi: %+v", e)
		}
		return e[len(e)-1].Params["text"].(string)
	}
	tx := t2(t, "uz")

	// 1. Kirish, Telegram bog'lanmagan: uchta raqam tugmasi (biri to'g'ri) va «Bu men emas».
	r, _ := hub.Start(tglogin.Login, "", "")
	m := open(42, r.ID)
	if text := m.Params["text"].(string); !strings.Contains(text, tx.AuthLoginNew) || !strings.Contains(text, tx.AuthPick) {
		t.Fatalf("matn: %s", text)
	}
	kb := keyboard(t, m)
	if len(kb) != 2 || len(kb[0]) != 3 || kb[1][0]["callback_data"] != "auth:"+r.ID+":0" {
		t.Fatalf("tugmalar: %v", kb)
	}
	for i, n := range r.Choices {
		if kb[0][i]["text"] != strconv.Itoa(n) || kb[0][i]["callback_data"] != "auth:"+r.ID+":"+strconv.Itoa(n) {
			t.Fatalf("raqam tugmasi %d: %v", i, kb[0][i])
		}
	}
	if got, _ := hub.Get(r.ID); got.Chat != 42 || got.Name != "Ali Valiyev" {
		t.Fatalf("so'rov biriktirilmadi: %+v", got)
	}
	// Havola boshqa hisobga o'tib qolsa — u so'rovni ololmaydi.
	if text := open(43, r.ID).Params["text"]; text != tx.AuthTaken {
		t.Fatalf("boshqa hisob: %v", text)
	}
	if text := press(42, r.ID, r.Number); text != tx.AuthApproved {
		t.Fatalf("tasdiq: %s", text)
	}
	if got, _ := hub.Get(r.ID); got.State != tglogin.Approved {
		t.Fatalf("holat: %+v", got)
	}

	// 2. Bog'lash: noto'g'ri raqam — rad, bog'lanmaydi; to'g'ri raqam — bot darhol bog'laydi.
	r, _ = hub.Start(tglogin.Link, "p1", "TEST_USER")
	if text := open(42, r.ID).Params["text"].(string); !strings.Contains(text, "«TEST_USER»") || strings.Contains(text, "Hozir bu Telegram") {
		t.Fatalf("bog'lash matni: %s", text)
	}
	wrong := r.Choices[0]
	if wrong == r.Number {
		wrong = r.Choices[1]
	}
	if text := press(42, r.ID, wrong); text != tx.AuthWrong {
		t.Fatalf("noto'g'ri raqam: %s", text)
	}
	if _, err := st.PlayerByChat(ctx, 42); err == nil {
		t.Fatal("noto'g'ri raqam bilan bog'landi")
	}
	r, _ = hub.Start(tglogin.Link, "p1", "TEST_USER")
	open(42, r.ID)
	if text := press(42, r.ID, r.Number); !strings.Contains(text, "«TEST_USER»") || !strings.HasPrefix(text, "✅") {
		t.Fatalf("bog'landi: %s", text)
	}
	if p, err := st.PlayerByChat(ctx, 42); err != nil || p.ID != "p1" {
		t.Fatalf("bog'lanmadi: %+v %v", p, err)
	}

	// 3. Endi kirish so'rovida profil nomi ko'rinadi; boshqa profilga bog'lashda — almashishi aytiladi.
	r, _ = hub.Start(tglogin.Login, "", "")
	if text := open(42, r.ID).Params["text"].(string); !strings.Contains(text, "«TEST_USER» profiliga") {
		t.Fatalf("kirish matni: %s", text)
	}
	if text := press(42, r.ID, 0); text != tx.AuthDenied {
		t.Fatalf("«Bu men emas»: %s", text)
	}
	r, _ = hub.Start(tglogin.Link, "p2", "TEST_USER_2")
	if text := open(42, r.ID).Params["text"].(string); !strings.Contains(text, "«TEST_USER_2»") || !strings.Contains(text, "Hozir bu Telegram «TEST_USER» profiliga") {
		t.Fatalf("almashtirish matni: %s", text)
	}

	// 4. Eskirgan yoki noma'lum so'rov.
	if text := open(42, "yoq").Params["text"]; text != tx.AuthExpired {
		t.Fatalf("noma'lum: %v", text)
	}
	if text := press(42, "yoq", 12); text != tx.AuthExpired {
		t.Fatalf("noma'lum tugma: %s", text)
	}
	// Oddiy /start — salomlashuv (so'rov emas).
	b.Handle(ctx, Update{Message: &Message{From: &User{ID: 42}, Chat: Chat{ID: 42, Type: "private"}, Text: "/start c_ABCDEF"}})
	if m := fake.take("sendMessage"); !strings.Contains(m[len(m)-1].Params["text"].(string), "Logic Gate") {
		t.Fatalf("oddiy /start: %v", m[len(m)-1].Params["text"])
	}
}

// t2 — bot matnlari (testdagi t bilan to'qnashmasin).
func t2(_ *testing.T, lang string) texts { return t(lang) }
