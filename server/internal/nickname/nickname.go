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

// Clean bo'shliqlarni tartibga keltiradi va taxallusni tekshiradi (2–20 belgi).
func Clean(s string) (string, error) {
	s = strings.Join(strings.Fields(s), " ")
	n := utf8.RuneCountInString(s)
	if n < 2 || n > 20 {
		return "", ErrInvalid
	}
	for _, r := range s {
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) && !strings.ContainsRune(" _-.'ʻʼ`", r) {
			return "", ErrInvalid
		}
	}
	if Offensive(s) {
		return "", ErrNotAllowed
	}
	return s, nil
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
	for _, r := range strings.ToLower(s) {
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
