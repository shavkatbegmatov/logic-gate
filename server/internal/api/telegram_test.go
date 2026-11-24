package api

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"testing"

	"logicgate/server/internal/tglogin"
)

// fakeTelegram — bot o'rnida: initData "ok:<id>" ko'rinishida bo'lsa to'g'ri hisoblanadi.
type fakeTelegram struct {
	mu      sync.Mutex
	changes []bool
	blocked bool
}

func (f *fakeTelegram) VerifyInitData(s string) (int64, string, error) {
	switch s {
	case "ok:42":
		return 42, "ru", nil
	case "ok:43":
		return 43, "uz", nil
	}
	return 0, "", errors.New("yaroqsiz")
}

func (f *fakeTelegram) RemindChanged(_ context.Context, _ int64, _ string, on bool) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.changes = append(f.changes, on)
	return f.blocked && on, nil
}

func (f *fakeTelegram) StartLink(payload string) string {
	return "https://t.me/TestBot?start=" + payload
}

func TestTelegramRemind(t *testing.T) {
	e := newEnv(t)
	// Bot o'rnatilmagan — o'yin tugmani ko'rsatmaydi.
	if status, out := e.do("POST", "/api/telegram/remind", "", map[string]any{"initData": "ok:42"}); status != http.StatusNotFound || out["error"] != "telegram_off" {
		t.Fatalf("botsiz: %d %v", status, out)
	}

	tg := &fakeTelegram{}
	e.api.opts.Telegram = tg
	if status, out := e.do("POST", "/api/telegram/remind", "", map[string]any{"initData": "soxta"}); status != http.StatusUnauthorized || out["error"] != "bad_init_data" {
		t.Fatalf("soxta initData: %d %v", status, out)
	}
	if status, out := e.do("POST", "/api/telegram/remind", "", map[string]any{"initData": "ok:42"}); status != 200 || out["remind"] != false {
		t.Fatalf("holat: %d %v", status, out)
	}

	// Yoqish (tiklash kodi bilan — chat o'yinchiga bog'lanadi).
	code := e.player("Ali")
	if status, out := e.do("POST", "/api/telegram/remind", code, map[string]any{"initData": "ok:42", "on": true, "lang": "ru"}); status != 200 || out["remind"] != true {
		t.Fatalf("yoqish: %d %v", status, out)
	}
	c, err := e.api.store.Chat(context.Background(), 42)
	if err != nil || !c.Remind || c.Lang != "ru" || c.PlayerID == "" {
		t.Fatalf("chat: %+v %v", c, err)
	}
	if status, out := e.do("POST", "/api/telegram/remind", "", map[string]any{"initData": "ok:42", "on": false}); status != 200 || out["remind"] != false {
		t.Fatalf("o'chirish: %d %v", status, out)
	}

	// Bot foydalanuvchiga yoza olmasa — yoqilmaydi va o'yin buni aytadi.
	tg.blocked = true
	if status, out := e.do("POST", "/api/telegram/remind", "", map[string]any{"initData": "ok:43", "on": true}); status != http.StatusConflict || out["error"] != "bot_blocked" {
		t.Fatalf("bloklangan: %d %v", status, out)
	}
	if c, _ := e.api.store.Chat(context.Background(), 43); c.Remind {
		t.Fatal("bot yoza olmasa ham eslatma yoqilib qoldi")
	}
	if len(tg.changes) != 3 {
		t.Fatalf("xabarlar: %v", tg.changes)
	}
}

func TestTelegramLogin(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	// Bot o'rnatilmagan — saytdagi tugma xabar beradi.
	if status, out := e.do("POST", "/api/auth/telegram", "", nil); status != http.StatusNotFound || out["error"] != "telegram_off" {
		t.Fatalf("botsiz: %d %v", status, out)
	}
	hub := tglogin.New(nil)
	e.api.opts.Telegram, e.api.opts.Logins = &fakeTelegram{}, hub

	start := func(code string) (id string, number int) {
		t.Helper()
		path := "/api/auth/telegram"
		if code != "" {
			path = "/api/me/telegram"
		}
		status, out := e.do("POST", path, code, nil)
		if status != 200 {
			t.Fatalf("so'rov: %d %v", status, out)
		}
		id = out["id"].(string)
		if out["url"] != "https://t.me/TestBot?start=auth_"+id || out["expiresIn"].(float64) < 290 {
			t.Fatalf("havola: %v", out)
		}
		return id, int(out["number"].(float64))
	}
	// Bot o'rnida: so'rovni ochish va raqamni tanlash.
	answer := func(id string, chat int64, number int) {
		t.Helper()
		if _, err := hub.Open(id, chat, "Ali Valiyev"); err != nil {
			t.Fatal(err)
		}
		if _, err := hub.Answer(id, chat, number); err != nil {
			t.Fatal(err)
		}
	}
	status := func(id string) map[string]any {
		t.Helper()
		_, out := e.do("GET", "/api/auth/telegram/"+id, "", nil)
		return out
	}

	// 1. Bog'lanmagan Telegram: tasdiqdan keyin — yangi profil (taxallus Telegram ismidan taklif qilinadi).
	id, n := start("")
	if out := status(id); out["status"] != "pending" {
		t.Fatalf("kutish: %v", out)
	}
	// Tasdiqlanmagan so'rov bilan profil ochib bo'lmaydi.
	if st, out := e.do("POST", "/api/auth/telegram/"+id+"/player", "", map[string]string{"nickname": "Ali"}); st != http.StatusConflict {
		t.Fatalf("tasdiqsiz: %d %v", st, out)
	}
	answer(id, 42, n)
	if out := status(id); out["status"] != "new" || out["name"] != "Ali Valiyev" {
		t.Fatalf("yangi: %v", out)
	}
	if st, out := e.do("POST", "/api/auth/telegram/"+id+"/player", "", map[string]string{"nickname": "x"}); st != http.StatusBadRequest {
		t.Fatalf("yomon taxallus: %d %v", st, out)
	}
	st, out := e.do("POST", "/api/auth/telegram/"+id+"/player", "", map[string]string{"nickname": "Ali"})
	if st != http.StatusCreated || out["status"] != "ok" || out["created"] != true {
		t.Fatalf("yangi profil: %d %v", st, out)
	}
	ali := out["player"].(map[string]any)
	aliCode := ali["code"].(string)
	if _, me := e.do("GET", "/api/me", aliCode, nil); me["id"] != ali["id"] || me["telegram"] != true {
		t.Fatalf("yangi profil bog'lanmadi: %v", me)
	}
	if out := status(id); out["error"] != "login_expired" {
		t.Fatalf("so'rov yopilmadi: %v", out)
	}

	// 2. Bog'langan Telegram: boshqa brauzer shu profilga kiradi — o'z kaliti bilan (asosiy kod o'zgarmaydi).
	id, n = start("")
	answer(id, 42, n)
	out = status(id)
	p := out["player"].(map[string]any)
	token := p["code"].(string)
	if out["status"] != "ok" || p["id"] != ali["id"] || p["nickname"] != "Ali" || token == aliCode {
		t.Fatalf("kirish: %v", out)
	}
	for _, code := range []string{token, aliCode} {
		if st, me := e.do("GET", "/api/me", code, nil); st != 200 || me["id"] != ali["id"] {
			t.Fatalf("kalit ishlamadi: %d %v", st, me)
		}
	}
	// Kalit bir marta beriladi.
	if out := status(id); out["error"] != "login_expired" {
		t.Fatalf("kalit ikkinchi marta: %v", out)
	}

	// 3. Noto'g'ri raqam yoki «Bu men emas» — rad, keyin so'rov yo'q.
	id, n = start("")
	answer(id, 42, n%90+10) // boshqa raqam
	if out := status(id); out["status"] != "denied" {
		t.Fatalf("rad: %v", out)
	}
	if out := status(id); out["error"] != "login_expired" {
		t.Fatalf("raddan keyin: %v", out)
	}

	// 4. Bog'lanmagan Telegram, lekin o'quvchi avval o'ynagan: tiklash kodi bilan kirib, Telegram'ni bog'laydi.
	valiCode := e.player("Vali")
	id, n = start("")
	answer(id, 43, n)
	if out := status(id); out["status"] != "new" {
		t.Fatalf("43: %v", out)
	}
	if st, out := e.do("POST", "/api/auth/telegram/"+id+"/attach", "", nil); st != http.StatusUnauthorized {
		t.Fatalf("kodsiz bog'lash: %d %v", st, out)
	}
	if st, out := e.do("POST", "/api/auth/telegram/"+id+"/attach", valiCode, nil); st != 200 || out["status"] != "linked" {
		t.Fatalf("bog'lash: %d %v", st, out)
	}
	if p, err := e.api.store.PlayerByChat(ctx, 43); err != nil || p.Nickname != "Vali" {
		t.Fatalf("43 bog'lanmadi: %+v %v", p, err)
	}

	// 5. Sozlamalardan bog'lash: bot tasdiqda bog'laydi, brauzer «linked» ni ko'radi.
	if st, _ := e.do("POST", "/api/me/telegram", "", nil); st != http.StatusUnauthorized {
		t.Fatalf("profilsiz bog'lash: %d", st)
	}
	id, n = start(valiCode)
	if r, _ := hub.Get(id); r.Kind != tglogin.Link || r.Nickname != "Vali" {
		t.Fatalf("bog'lash so'rovi: %+v", r)
	}
	answer(id, 44, n)
	if out := status(id); out["status"] != "linked" {
		t.Fatalf("bog'landi: %v", out)
	}

	// 6. Mini App: imzolangan initData bilan bog'langan profilga darhol kiriladi.
	if st, out := e.do("POST", "/api/auth/telegram/app", "", map[string]string{"initData": "soxta"}); st != http.StatusUnauthorized {
		t.Fatalf("soxta initData: %d %v", st, out)
	}
	st, out = e.do("POST", "/api/auth/telegram/app", "", map[string]string{"initData": "ok:42"})
	if p := out["player"].(map[string]any); st != 200 || p["id"] != ali["id"] || p["code"] == aliCode {
		t.Fatalf("Mini App kirish: %d %v", st, out)
	}

	// 7. Profil o'chirilsa — uning qurilma kalitlari ham ishlamaydi.
	if _, err := e.api.store.DeletePlayer(ctx, ali["id"].(string)); err != nil {
		t.Fatal(err)
	}
	if st, _ := e.do("GET", "/api/me", token, nil); st != http.StatusUnauthorized {
		t.Fatalf("o'chirilgan profil kaliti: %d", st)
	}
}

func TestTelegramAppLink(t *testing.T) {
	e := newEnv(t)
	e.api.opts.Telegram = &fakeTelegram{}
	code := e.player("Ali")
	// Bog'lanmagan Telegram — Mini App taxallus so'raydi (yoki bulutdagi kod bilan tiklanadi).
	if st, out := e.do("POST", "/api/auth/telegram/app", "", map[string]string{"initData": "ok:43"}); st != http.StatusNotFound || out["error"] != "not_linked" {
		t.Fatalf("bog'lanmagan: %d %v", st, out)
	}
	if st, out := e.do("POST", "/api/me/telegram/app", code, map[string]string{"initData": "soxta"}); st != http.StatusUnauthorized || out["error"] != "bad_init_data" {
		t.Fatalf("soxta: %d %v", st, out)
	}
	// Chat yozuvi yo'q (botga yozmagan, Mini App'ni ochgan) — yaratiladi va bog'lanadi.
	if st, out := e.do("POST", "/api/me/telegram/app", code, map[string]string{"initData": "ok:43"}); st != 200 || out["linked"] != true {
		t.Fatalf("bog'lash: %d %v", st, out)
	}
	if p, err := e.api.store.PlayerByChat(context.Background(), 43); err != nil || p.Nickname != "Ali" {
		t.Fatalf("bog'lanmadi: %+v %v", p, err)
	}
	if st, out := e.do("POST", "/api/auth/telegram/app", "", map[string]string{"initData": "ok:43"}); st != 200 || out["player"].(map[string]any)["nickname"] != "Ali" {
		t.Fatalf("keyingi ochilishda: %d %v", st, out)
	}
}
