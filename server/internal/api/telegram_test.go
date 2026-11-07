package api

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"testing"
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
