// Package nickname — o'yinchi taxallusini tekshirish: uzunlik, ruxsat etilgan belgilar va
// haqoratli so'zlar filtri. API ham, administrator buyruqlari ham shu qoidadan foydalanadi.
package nickname

import (
	"errors"
	"strings"
	"unicode"
	"unicode/utf8"
)

var (
	ErrInvalid    = errors.New("bad_nickname")         // uzunlik yoki belgilar noto'g'ri
	ErrNotAllowed = errors.New("nickname_not_allowed") // haqoratli yoki band so'z
)

// Clean bo'shliqlarni tartibga keltiradi va taxallusni tekshiradi (2–20 belgi). To'liq kenglikdagi
// lotin harf va raqamlar oddiysiga aylantirilib saqlanadi ("Ａｌｉ" → "Ali").
func Clean(s string) (string, error) {
	s = strings.Join(strings.Fields(Fold(s)), " ")
	n := utf8.RuneCountInString(s)
	if n < 2 || n > 20 {
		return "", ErrInvalid
	}
	for _, r := range s {
		if Disguised(r) || (!unicode.IsLetter(r) && !unicode.IsDigit(r) && !strings.ContainsRune(" _-.'ʻʼ`", r)) {
			return "", ErrInvalid
		}
	}
	if Offensive(s) {
		return "", ErrNotAllowed
	}
	return s, nil
}

// Fold to'liq kenglikdagi ASCII shakllarini (U+FF01–U+FF5E: "ａｄｍｉｎ") oddiy ASCII ga aylantiradi —
// ular boshqacha ko'rinmaydi, lekin so'zlar filtridan o'tib ketardi.
func Fold(s string) string {
	return strings.Map(func(r rune) rune {
		if r >= 0xFF01 && r <= 0xFF5E {
			return r - 0xFF01 + '!'
		}
		return r
	}, s)
}

// Disguised — harf yoki raqam hisoblansa ham, taxallus va matnda ruxsat etilmaydigan belgi:
//   - matematik harf-raqamlar (U+1D400–U+1D7FF, "𝐟𝐮𝐜𝐤") — oddiy harfni niqoblaydi, filtrdan o'tadi;
//   - bo'sh ko'rinadigan "harflar": hangul to'ldiruvchilari (U+115F, U+1160, U+3164, U+FFA0), Braille bo'sh
//     katagi (U+2800), Xitan kichik yozuvi to'ldiruvchisi (U+16FE4) va boshqa ko'rinmas belgilar —
//     taxallus bo'sh yoki "Ali" ga o'xshab, aslida boshqacha bo'lib qoladi.
func Disguised(r rune) bool {
	switch {
	case r >= 0x1D400 && r <= 0x1D7FF:
		return true
	case r == 0x115F, r == 0x1160, r == 0x3164, r == 0xFFA0, r == 0x2800, r == 0x16FE4:
		return true
	case r == 0x17B4, r == 0x17B5, r == 0x180E: // kxmer ko'rinmas unlilari, mo'g'ul unli ajratgichi
		return true
	}
	// Formatlash va boshqaruv belgilari (nol kenglikdagi bo'shliq, yo'nalish belgilari va h.k.).
	return unicode.In(r, unicode.Cf, unicode.Cc, unicode.Co)
}

// Ildizlar normallashtirilgan ko'rinishda: kichik lotin harflari, ajratuvchilarsiz.
// Qisqa yoki oddiy so'zlarning bir qismi bo'ladigan ildizlar ataylab olinmagan
// ("sik" — "sikl" da, "manda" — "komanda" da, "bla" — "korablya" da, "eban" — "Lebanon" da bor).
var bannedLatin = []string{
	// ingliz
	"fuck", "fuk", "shit", "bitch", "cunt", "whore", "slut", "nigger", "nigga", "faggot", "asshole",
	// rus (lotincha yozilgan)
	"xuy", "xuj", "xui", "pizd", "pisd", "blyat", "blyad", "bliat", "suka", "ebat", "yeban",
	"mudak", "mudil", "pidor", "pidar", "pidr", "gandon", "zalup", "shlyuh", "shluh", "dolboeb", "dalbaeb",
	// o'zbek
	"jalab", "qanjiq", "kanjik", "dalbayob", "dalbayop", "siktir", "sikay", "sikish", "sikam", "sikdi",
	"qotoq", "kotak", "itvachcha", "haromi", "harom zoda", "haromzoda",
	// boshqalarni chalg'itadigan rasmiy nomlar
	"admin", "moderator", "logicgate",
}

var bannedCyrillic = []string{
	"хуй", "хуе", "хуё", "хуя", "пизд", "ебат", "ебан", "ебл", "ёб", "блят", "бляд", "сука", "мудак", "мудил",
	"пидор", "пидар", "гандон", "залуп", "шлюх", "дроч", "далбаёб", "жалаб", "қанжиқ", "сиктир",
}

// Kirillcha va raqamli "niqoblar" lotincha harfga aylantiriladi.
var lookalike = map[rune]rune{
	'а': 'a', 'в': 'b', 'е': 'e', 'ё': 'e', 'к': 'k', 'м': 'm', 'н': 'h', 'о': 'o', 'р': 'p', 'с': 'c',
	'т': 't', 'у': 'y', 'х': 'x', 'з': 'z', 'и': 'i', 'л': 'l', 'д': 'd', 'б': 'b', 'п': 'p', 'ж': 'j',
	'0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's',
}

func compact(s string, mapLookalikes bool) string {
	var b strings.Builder
	for _, r := range strings.ToLower(Fold(s)) {
		if mapLookalikes {
			if m, ok := lookalike[r]; ok {
				r = m
			}
		}
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// Offensive taxallusda taqiqlangan ildiz bormi, tekshiradi (bo'shliq, nuqta, raqam bilan niqoblanganini ham).
func Offensive(s string) bool {
	cyr := compact(s, false)
	for _, w := range bannedCyrillic {
		if strings.Contains(cyr, w) {
			return true
		}
	}
	lat := compact(s, true)
	for _, w := range bannedLatin {
		if strings.Contains(lat, strings.ReplaceAll(w, " ", "")) {
			return true
		}
	}
	return false
}
