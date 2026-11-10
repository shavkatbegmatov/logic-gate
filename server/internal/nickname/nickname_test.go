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

// Filtrni aylanib o'tish: to'liq kenglikdagi harflar oddiysiga aylanadi (va shunday saqlanadi),
// matematik harflar va bo'sh ko'rinadigan "harflar" rad etiladi.
func TestCleanDisguise(t *testing.T) {
	notAllowed := []string{
		"ｆｕｃｋ",     // to'liq kenglik
		"ａｄｍｉｎ",    // to'liq kenglik
		"ＦＵＣＫ ｙｏｕ", // to'liq kenglik, katta harf
		"аdmin",    // kirillcha a
		"ｘｕｙ１２３",   // to'liq kenglikdagi raqamlar ham
	}
	for _, in := range notAllowed {
		if _, err := Clean(in); !errors.Is(err, ErrNotAllowed) {
			t.Errorf("%q: %v", in, err)
		}
	}
	invalid := []string{
		"\U0001D41F\U0001D42E\U0001D41C\U0001D424", // matematik qalin f u c k
		"\U0001D400\U0001D401",                     // matematik A B (haqoratsiz ham)
		"Ali\U0001D7CE",                            // matematik raqam
		"\u3164\u3164",                             // hangul to'ldiruvchilari: bo'sh ko'rinadi
		"Ali\u3164",                                // "Ali" ga o'xshaydi
		"\u115F\u1160",                             // hangul boshlang'ich/o'rta to'ldiruvchilar
		"Ali\uFFA0",                                // yarim kenglikdagi to'ldiruvchi
		"\u2800\u2800",                             // Braille bo'sh katagi
		"a\u200Bdmin",                              // nol kenglikdagi bo'shliq
		"ad\u0332min",                              // qo'shiluvchi belgi
		"Ⓐdmin",
	}
	for _, in := range invalid {
		if _, err := Clean(in); !errors.Is(err, ErrInvalid) {
			t.Errorf("%q: %v", in, err)
		}
	}
	for in, want := range map[string]string{"Ａｌｉ\u3000Ｖａｌｉ": "Ali Vali", "ｐｌａｙｅｒ＿７": "player_7", "Ёқубжон": "Ёқубжон"} {
		if got, err := Clean(in); err != nil || got != want {
			t.Errorf("%q: %q %v", in, got, err)
		}
	}
	if !Offensive("ｆｕｃｋ") || Fold("ａ！～") != "a!~" {
		t.Error("Offensive/Fold to'liq kenglikni ko'rmadi")
	}
}
