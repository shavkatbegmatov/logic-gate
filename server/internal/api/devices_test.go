package api

import (
	"net/http"
	"testing"
)

func TestDeviceLabel(t *testing.T) {
	cases := []struct {
		ua   string
		app  bool
		want string
	}{
		{"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", false, "Chrome · Windows"},
		{"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0", false, "Edge · Windows"},
		{"Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 YaBrowser/24.10.1 Mobile Safari/537.36", false, "Yandex Browser · Android"},
		{"Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1", false, "Safari · iOS"},
		{"Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0", false, "Firefox · macOS"},
		{"Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36", true, "Telegram · Android"},
		{"Go-http-client/1.1", false, ""},
	}
	for _, c := range cases {
		if got := deviceLabel(c.ua, c.app); got != c.want {
			t.Errorf("%q: %q, kutilgan %q", c.ua, got, c.want)
		}
	}
}

// Faqat soxta ma'lumotlar: TEST profil, soxta initData.
func TestDevices(t *testing.T) {
	e := newEnv(t)
	e.api.opts.Telegram = &fakeTelegram{}
	code := e.player("TEST_USER")
	if st, out := e.do("POST", "/api/me/telegram/app", code, map[string]string{"initData": "ok:42"}); st != 200 || out["linked"] != true {
		t.Fatalf("bog'lash: %d %v", st, out)
	}
	login := func() string {
		t.Helper()
		st, out := e.do("POST", "/api/auth/telegram/app", "", map[string]string{"initData": "ok:42"})
		if st != 200 {
			t.Fatalf("Mini App kirish: %d %v", st, out)
		}
		return out["player"].(map[string]any)["code"].(string)
	}
	devices := func(code string) ([]map[string]any, bool) {
		t.Helper()
		st, out := e.do("GET", "/api/me/devices", code, nil)
		if st != 200 {
			t.Fatalf("ro'yxat: %d %v", st, out)
		}
		var list []map[string]any
		for _, d := range out["devices"].([]any) {
			list = append(list, d.(map[string]any))
		}
		return list, out["viaCode"] == true
	}
	t1, t2 := login(), login()

	// Asosiy kod bilan: ikkala qurilma, hech biri «shu qurilma» emas.
	list, viaCode := devices(code)
	if len(list) != 2 || !viaCode || list[0]["current"] == true || list[1]["current"] == true || list[0]["label"] != "Telegram" {
		t.Fatalf("asosiy koddan: %v %v", list, viaCode)
	}
	// Qurilma kaliti bilan: o'zi belgilanadi.
	list, viaCode = devices(t1)
	var self, other string
	for _, d := range list {
		if d["current"] == true {
			self = d["id"].(string)
		} else {
			other = d["id"].(string)
		}
		if d["createdAt"].(float64) <= 0 || d["usedAt"].(float64) <= 0 {
			t.Fatalf("vaqtlar: %v", d)
		}
	}
	if viaCode || self == "" || other == "" || len(self) != 16 {
		t.Fatalf("kalitdan: %v %v", list, viaCode)
	}

	// O'zini o'chirib bo'lmaydi; boshqasini — bo'ladi, keyin u ishlamaydi.
	if st, out := e.do("DELETE", "/api/me/devices/"+self, t1, nil); st != http.StatusBadRequest || out["error"] != "current_device" {
		t.Fatalf("o'zini: %d %v", st, out)
	}
	if st, out := e.do("DELETE", "/api/me/devices/"+other, t1, nil); st != http.StatusNoContent {
		t.Fatalf("o'chirish: %d %v", st, out)
	}
	if st, _ := e.do("GET", "/api/me", t2, nil); st != http.StatusUnauthorized {
		t.Fatalf("o'chirilgan kalit: %d", st)
	}
	for _, id := range []string{other, "zz", "0011"} {
		if st, out := e.do("DELETE", "/api/me/devices/"+id, t1, nil); st != http.StatusNotFound || out["error"] != "no_device" {
			t.Fatalf("yo'q qurilma %q: %d %v", id, st, out)
		}
	}
	// Boshqa o'yinchi begona qurilmani o'chira olmaydi.
	stranger := e.player("TEST_OTHER")
	if st, _ := e.do("DELETE", "/api/me/devices/"+self, stranger, nil); st != http.StatusNotFound {
		t.Fatalf("begona: %d", st)
	}

	// Boshqa hamma qurilmadan chiqish: kod mijozdan, formati tekshiriladi.
	if st, out := e.do("POST", "/api/me/logout-others", t1, map[string]string{"code": "yomon"}); st != http.StatusBadRequest || out["error"] != "bad_code" {
		t.Fatalf("yomon kod: %d %v", st, out)
	}
	fresh := newCode()
	if st, out := e.do("POST", "/api/me/logout-others", t1, map[string]string{"code": fresh}); st != http.StatusNoContent {
		t.Fatalf("chiqish: %d %v", st, out)
	}
	for _, old := range []string{code, t1} {
		if st, _ := e.do("GET", "/api/me", old, nil); st != http.StatusUnauthorized {
			t.Fatalf("eski kod ishlayapti: %d", st)
		}
	}
	if st, me := e.do("GET", "/api/me", fresh, nil); st != 200 || me["nickname"] != "TEST_USER" {
		t.Fatalf("yangi kod: %d %v", st, me)
	}
	if list, viaCode := devices(fresh); len(list) != 0 || !viaCode {
		t.Fatalf("chiqqandan keyin: %v %v", list, viaCode)
	}
	// Telegram bog'lanishi qoladi: egasi Telegram orqali qayta kira oladi.
	if login() == "" {
		t.Fatal("Telegram orqali qayta kirish")
	}
}
