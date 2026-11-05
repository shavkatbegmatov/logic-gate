package api

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"unicode"
)

// Crockford base32: o'qishda adashtiradigan I, L, O, U harflari yo'q.
const codeAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

// newCode 80 bitli tasodifiy tiklash kodini yaratadi: XXXX-XXXX-XXXX-XXXX.
func newCode() string {
	var b [10]byte
	rand.Read(b[:])
	var sb strings.Builder
	var acc, bits uint
	for _, x := range b {
		acc = acc<<8 | uint(x)
		bits += 8
		for bits >= 5 {
			bits -= 5
			if sb.Len() == 4 || sb.Len() == 9 || sb.Len() == 14 {
				sb.WriteByte('-')
			}
			sb.WriteByte(codeAlphabet[(acc>>bits)&31])
		}
	}
	return sb.String()
}

// normalizeCode foydalanuvchi kiritgan kodni kanonik ko'rinishga keltiradi.
// Noto'g'ri bo'lsa, bo'sh satr qaytaradi.
func normalizeCode(s string) string {
	var sb strings.Builder
	for _, r := range strings.ToUpper(s) {
		switch r {
		case '-', ' ':
			continue
		case 'O':
			r = '0'
		case 'I', 'L':
			r = '1'
		}
		if r > unicode.MaxASCII || !strings.ContainsRune(codeAlphabet, r) {
			return ""
		}
		sb.WriteRune(r)
	}
	if sb.Len() != 16 {
		return ""
	}
	return sb.String()
}

func hashCode(normalized string) []byte {
	h := sha256.Sum256([]byte(normalized))
	return h[:]
}

func newID() string {
	var b [8]byte
	rand.Read(b[:])
	return hex.EncodeToString(b[:])
}
