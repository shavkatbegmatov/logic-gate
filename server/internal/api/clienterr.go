package api

import (
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode"

	"logicgate/server/internal/bot"
)

// Brauzer xatolari: o'yin o'z kodidagi kutilmagan xatolarni yuboradi (web/src/errors.ts). Server ularni
// ERROR darajasida log'ga yozadi — bot admin'ga xuddi server xatolari kabi ogohlantiradi. Bir xil
// xato 6 soatda bir marta yoziladi (orada nechta takrorlangani keyingi yozuvda). Shaxsiy ma'lumot
// yo'q: o'yinchi, IP, sinf kodi yuborilmaydi — faqat xabar, stek, ekran nomi, versiya va brauzer.

const (
	clientErrEvery = 6 * time.Hour
	clientErrKeys  = 500 // xotirada saqlanadigan turli xatolar (to'lsa — tozalanadi)
)

type clientErrors struct {
	mu   sync.Mutex
	seen map[string]*clientErrSeen
}

type clientErrSeen struct {
	at      time.Time
	skipped int
}

// clip — bir qatorga keltiradi (boshqaruv belgilarisiz) va uzunligini cheklaydi.
func clip(s string, max int, oneLine bool) string {
	s = strings.Map(func(r rune) rune {
		if r == '\n' || r == '\r' || r == '\t' {
			if oneLine {
				return ' '
			}
			return r
		}
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, strings.TrimSpace(s))
	if r := []rune(s); len(r) > max {
		s = string(r[:max]) + "…"
	}
	return s
}

// firstFrame — stekning joy ko'rsatilgan birinchi qatori (…:12:34), bo'lmasa — bo'sh.
func firstFrame(stack string) string {
	for _, line := range strings.Split(stack, "\n") {
		if frameRe.MatchString(line) {
			return strings.TrimSpace(line)
		}
	}
	return ""
}

var frameRe = regexp.MustCompile(`:\d+:\d+\)?\s*$`)

func (s *Server) clientError(w http.ResponseWriter, r *http.Request) {
	if !s.reports.allow(s.clientIP(r)) {
		writeErr(w, http.StatusTooManyRequests, "rate_limited")
		return
	}
	var req struct {
		Msg     string `json:"msg"`
		Stack   string `json:"stack"`
		Route   string `json:"route"`
		Version string `json:"version"`
		UA      string `json:"ua"`
		Tg      bool   `json:"tg"`
	}
	if !decode(w, r, &req) {
		return
	}
	msg := clip(req.Msg, 300, true)
	if msg == "" {
		writeErr(w, http.StatusBadRequest, "bad_report")
		return
	}
	stack := clip(req.Stack, 1500, false)
	route := strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' {
			return r
		}
		return -1
	}, req.Route)
	if len(route) > 20 {
		route = route[:20]
	}
	// Bir xil xato: xabar va stekdagi birinchi kadr (joyi). Chrome'da stekning birinchi qatori —
	// xabarning o'zi ("TypeError: …"), shuning uchun fayl:qator:ustun bor birinchi qator olinadi.
	key := msg + "|" + firstFrame(stack)

	now := s.now()
	s.cerr.mu.Lock()
	if s.cerr.seen == nil {
		s.cerr.seen = map[string]*clientErrSeen{}
	}
	prev := s.cerr.seen[key]
	// Xarita to'lsa — faqat yangi xato kelganda tozalanadi (takrorlar sanog'i bekorga yo'qolmasin).
	if prev == nil && len(s.cerr.seen) >= clientErrKeys {
		s.cerr.seen = map[string]*clientErrSeen{}
	}
	if prev != nil && now.Sub(prev.at) < clientErrEvery {
		prev.skipped++
		s.cerr.mu.Unlock()
		w.WriteHeader(http.StatusNoContent)
		return
	}
	repeat := 0
	if prev != nil {
		repeat = prev.skipped
	}
	s.cerr.seen[key] = &clientErrSeen{at: now}
	s.cerr.mu.Unlock()

	s.log.Error(bot.ClientErrorMsg, "error", msg, "route", route, "version", clip(req.Version, 20, true),
		"tg", req.Tg, "repeat", repeat, "ua", clip(req.UA, 200, true), "stack", stack)
	w.WriteHeader(http.StatusNoContent)
}
