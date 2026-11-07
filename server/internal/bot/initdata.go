package bot

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

var ErrInitData = errors.New("telegram initData yaroqsiz")

// initDataTTL — Mini App ma'lumoti shu muddatgacha qabul qilinadi (ilova uzoq ochiq turishi mumkin).
const initDataTTL = 7 * 24 * time.Hour

// VerifyInitData Mini App'ning Telegram.WebApp.initData satrini bot tokeni bilan tekshiradi:
// secret = HMAC-SHA256("WebAppData", token), hash = HMAC-SHA256(secret, "k=v\n…" — hash'dan boshqa
// barcha maydonlar alifbo tartibida). To'g'ri bo'lsa — foydalanuvchi id va tili.
func VerifyInitData(initData, token string, now time.Time) (userID int64, lang string, err error) {
	vals, err := url.ParseQuery(initData)
	if err != nil || token == "" {
		return 0, "", ErrInitData
	}
	hash := vals.Get("hash")
	if hash == "" {
		return 0, "", ErrInitData
	}
	keys := make([]string, 0, len(vals))
	for k := range vals {
		if k != "hash" {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)
	lines := make([]string, len(keys))
	for i, k := range keys {
		lines[i] = k + "=" + vals.Get(k)
	}
	secret := hmac.New(sha256.New, []byte("WebAppData"))
	secret.Write([]byte(token))
	mac := hmac.New(sha256.New, secret.Sum(nil))
	mac.Write([]byte(strings.Join(lines, "\n")))
	want, err := hex.DecodeString(hash)
	if err != nil || !hmac.Equal(mac.Sum(nil), want) {
		return 0, "", ErrInitData
	}
	at, err := strconv.ParseInt(vals.Get("auth_date"), 10, 64)
	if err != nil || now.Sub(time.Unix(at, 0)) > initDataTTL {
		return 0, "", ErrInitData
	}
	var u User
	if err := json.Unmarshal([]byte(vals.Get("user")), &u); err != nil || u.ID == 0 {
		return 0, "", ErrInitData
	}
	return u.ID, langOf(u.LanguageCode), nil
}

// langOf — Telegram tili bo'yicha o'yin tili: rus tilidagilar uchun ruscha, qolganlar uchun o'zbekcha.
func langOf(code string) string {
	if strings.HasPrefix(code, "ru") {
		return "ru"
	}
	return "uz"
}
