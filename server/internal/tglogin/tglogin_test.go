package tglogin

import (
	"errors"
	"slices"
	"strings"
	"testing"
	"time"
)

func TestRequestLifecycle(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	h := New(func() time.Time { return now })

	r, err := h.Start(Login, "", "")
	if err != nil {
		t.Fatal(err)
	}
	// Telegram start parametri: faqat A-Z, a-z, 0-9, _ va - (64 tagacha); "auth_" bilan birga ham sig'adi.
	if len(r.ID) < 20 || len("auth_"+r.ID) > 64 || strings.Trim(r.ID, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-") != "" {
		t.Fatalf("id: %q", r.ID)
	}
	if !slices.Contains(r.Choices[:], r.Number) || r.Number < 10 || r.Number > 99 {
		t.Fatalf("raqam: %d %v", r.Number, r.Choices)
	}
	if r.Choices[0] == r.Choices[1] || r.Choices[1] == r.Choices[2] || r.Choices[0] == r.Choices[2] {
		t.Fatalf("tugmalar takrorlanadi: %v", r.Choices)
	}

	// Birinchi ochgan hisobga biriktiriladi; boshqasi ololmaydi, javob ham berolmaydi.
	if got, err := h.Open(r.ID, 42, "Ali"); err != nil || got.Chat != 42 || got.Name != "Ali" {
		t.Fatalf("ochish: %+v %v", got, err)
	}
	if _, err := h.Open(r.ID, 43, "Vali"); !errors.Is(err, ErrTaken) {
		t.Fatalf("boshqa hisob: %v", err)
	}
	if _, err := h.Answer(r.ID, 43, r.Number); !errors.Is(err, ErrTaken) {
		t.Fatalf("boshqa hisob javobi: %v", err)
	}
	// Qayta ochish (havolani yana bosdi) — o'sha hisob uchun mumkin.
	if _, err := h.Open(r.ID, 42, "Ali"); err != nil {
		t.Fatal(err)
	}
	got, err := h.Answer(r.ID, 42, r.Number)
	if err != nil || got.State != Approved {
		t.Fatalf("tasdiq: %+v %v", got, err)
	}
	// Javob berilgan so'rov qayta ochilmaydi va javobi o'zgarmaydi.
	if _, err := h.Open(r.ID, 42, "Ali"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("javobdan keyin ochish: %v", err)
	}
	if _, err := h.Answer(r.ID, 42, 0); !errors.Is(err, ErrNotFound) {
		t.Fatalf("ikkinchi javob: %v", err)
	}
	if st, ok := h.Get(r.ID); !ok || st.State != Approved {
		t.Fatalf("holat: %+v %v", st, ok)
	}
	h.Finish(r.ID)
	if _, ok := h.Get(r.ID); ok {
		t.Fatal("yopilgan so'rov qoldi")
	}
}

func TestWrongNumberAndNotMe(t *testing.T) {
	h := New(nil)
	r, _ := h.Start(Link, "p1", "Ali")
	h.Open(r.ID, 42, "")
	wrong := r.Choices[0]
	if wrong == r.Number {
		wrong = r.Choices[1]
	}
	if got, err := h.Answer(r.ID, 42, wrong); err != nil || got.State != Denied || got.Player != "p1" {
		t.Fatalf("noto'g'ri raqam: %+v %v", got, err)
	}
	// Noto'g'ri raqamdan keyin to'g'risini tanlab bo'lmaydi.
	if _, err := h.Answer(r.ID, 42, r.Number); !errors.Is(err, ErrNotFound) {
		t.Fatalf("taxmin: %v", err)
	}

	r2, _ := h.Start(Login, "", "")
	// Ochilmagan so'rovga javob berib bo'lmaydi.
	if _, err := h.Answer(r2.ID, 42, r2.Number); !errors.Is(err, ErrTaken) {
		t.Fatalf("ochilmagan: %v", err)
	}
	h.Open(r2.ID, 42, "")
	if got, _ := h.Answer(r2.ID, 42, 0); got.State != Denied {
		t.Fatalf("«Bu men emas»: %+v", got)
	}
}

func TestExpiry(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	h := New(func() time.Time { return now })
	r, _ := h.Start(Login, "", "")
	now = now.Add(TTL - time.Second)
	if _, ok := h.Get(r.ID); !ok {
		t.Fatal("muddatidan oldin yo'qoldi")
	}
	now = now.Add(time.Second)
	if _, ok := h.Get(r.ID); ok {
		t.Fatal("eskirgan so'rov qoldi")
	}
	if _, err := h.Open(r.ID, 42, ""); !errors.Is(err, ErrNotFound) {
		t.Fatalf("eskirgan: %v", err)
	}

	// To'lib qolganda eskirganlar tozalanadi, tirik so'rovlar esa chegaradan oshmaydi.
	for range maxPending {
		if _, err := h.Start(Login, "", ""); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := h.Start(Login, "", ""); !errors.Is(err, ErrBusy) {
		t.Fatalf("chegara: %v", err)
	}
	now = now.Add(TTL)
	if _, err := h.Start(Login, "", ""); err != nil {
		t.Fatalf("eskirganlar tozalanmadi: %v", err)
	}
}
