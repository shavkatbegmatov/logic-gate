package nickname

import (
	"errors"
	"testing"
)

func TestClean(t *testing.T) {
	ok := map[string]string{
		"  Ali  Valiyev ": "Ali Valiyev",
		"Oʻgʻiloy":        "Oʻgʻiloy",
		"Sikllar ustasi":  "Sikllar ustasi", // "sikl" — oddiy so'z
		"Komanda_7":       "Komanda_7",      // "manda" emas
		"Корабля":         "Корабля",        // "бля" emas
		"Kosmos-2026":     "Kosmos-2026",
		"Sabina":          "Sabina",
		"Musk.":           "Musk.",
		"Fizik":           "Fizik",
		"Qo'chqor":        "Qo'chqor",
		"Ёқубжон":         "Ёқубжон",
		"Dilshod O'g'li":  "Dilshod O'g'li",
		"Hakimov 99":      "Hakimov 99",
		"Shohruh":         "Shohruh",
		"Suhrob":          "Suhrob",
		"Azizbek":         "Azizbek",
		"Lebanon":         "Lebanon",
		"Nguyen Huy":      "Nguyen Huy",
	}
	for in, want := range ok {
		got, err := Clean(in)
		if err != nil || got != want {
			t.Errorf("%q: %q, %v", in, got, err)
		}
	}

	bad := []string{"f.u.c.k", "FUCK you", "xuy123", "Хуй", "х у й", "SUKA", "сука", "dalbayob", "Jalab",
		"Qanjiq", "Admin", "moderator", "p1zd", "BLYAT", "бл**ть", "sh1t", "Siktir", "Pidor"}
	for _, in := range bad {
		if _, err := Clean(in); err == nil {
			t.Errorf("%q qabul qilindi", in)
		}
	}
	// "бл**ть" — yulduzcha ruxsat etilmagan belgi, demak ErrInvalid; qolganlari ErrNotAllowed.
	if _, err := Clean("xuy123"); !errors.Is(err, ErrNotAllowed) {
		t.Errorf("xuy123: %v", err)
	}
	for _, in := range []string{"a", "<script>", "123456789012345678901"} {
		if _, err := Clean(in); !errors.Is(err, ErrInvalid) {
			t.Errorf("%q: %v", in, err)
		}
	}
}
