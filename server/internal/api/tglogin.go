package api

import (
	"errors"
	"net/http"
	"time"

	"logicgate/server/internal/nickname"
	"logicgate/server/internal/store"
	"logicgate/server/internal/tglogin"
)

// Saytga Telegram orqali kirish (tglogin paketi — so'rovlar, bot — tasdiqlash):
//
//	POST /api/auth/telegram              — kirish so'rovi: {id, url, number, expiresIn}
//	POST /api/me/telegram                — ochiq profilni Telegram'ga bog'lash so'rovi (xuddi shunday javob)
//	GET  /api/auth/telegram/{id}         — holat: pending | denied | linked | new {name} | ok {player}
//	POST /api/auth/telegram/{id}/player  — Telegram bog'lanmagan: yangi profil {nickname} → ok {player}
//	POST /api/auth/telegram/{id}/attach  — Telegram bog'lanmagan: tiklash kodi bilan ochilgan profilga bog'lash
//	POST /api/auth/telegram/app          — Mini App: {initData} → bog'langan profil {player} (not_linked — yo'q)
//	POST /api/me/telegram/app            — Mini App: {initData} → ochiq profil shu Telegram'ga bog'lanadi
//
// Brauzer profil kalitini (qurilma kaliti — tiklash kodi kabi ishlaydi) faqat bir marta, so'rov yopilayotganda oladi.

type tgStartJSON struct {
	ID        string `json:"id"`
	URL       string `json:"url"`
	Number    int    `json:"number"`
	ExpiresIn int    `json:"expiresIn"` // soniya
}

// tgLogins — bot va kirish so'rovlari o'rnatilgan bo'lsa ular, aks holda telegram_off javobi.
func (s *Server) tgLogins(w http.ResponseWriter) (*tglogin.Hub, bool) {
	if s.opts.Telegram == nil || s.opts.Logins == nil {
		writeErr(w, http.StatusNotFound, "telegram_off")
		return nil, false
	}
	return s.opts.Logins, true
}

func (s *Server) startTelegramLogin(w http.ResponseWriter, r *http.Request, kind tglogin.Kind, p *store.Player) {
	hub, ok := s.tgLogins(w)
	if !ok {
		return
	}
	if !s.tglogin.allow(s.clientIP(r)) {
		writeErr(w, http.StatusTooManyRequests, "rate_limited")
		return
	}
	var player, nick string
	if p != nil {
		player, nick = p.ID, p.Nickname
	}
	req, err := hub.Start(kind, player, nick)
	if err != nil {
		writeErr(w, http.StatusServiceUnavailable, "busy")
		return
	}
	url := s.opts.Telegram.StartLink("auth_" + req.ID)
	if url == "" {
		// Bot hali Telegram'ga ulanmagan (getMe javob bermagan).
		hub.Finish(req.ID)
		writeErr(w, http.StatusServiceUnavailable, "telegram_unavailable")
		return
	}
	writeJSON(w, http.StatusOK, tgStartJSON{
		ID: req.ID, URL: url, Number: req.Number, ExpiresIn: int(time.Until(req.Expires).Seconds()),
	})
}

func (s *Server) telegramLogin(w http.ResponseWriter, r *http.Request) {
	s.startTelegramLogin(w, r, tglogin.Login, nil)
}

func (s *Server) telegramLink(w http.ResponseWriter, r *http.Request) {
	s.startTelegramLogin(w, r, tglogin.Link, playerFrom(r))
}

// approvedLogin — tasdiqlangan kirish so'rovi (player va attach uchun); bo'lmasa javob yozilgan.
func (s *Server) approvedLogin(w http.ResponseWriter, r *http.Request) (*tglogin.Hub, tglogin.Request, bool) {
	hub, ok := s.tgLogins(w)
	if !ok {
		return nil, tglogin.Request{}, false
	}
	req, found := hub.Get(r.PathValue("id"))
	if !found {
		writeErr(w, http.StatusNotFound, "login_expired")
		return nil, req, false
	}
	if req.Kind != tglogin.Login || req.State != tglogin.Approved {
		writeErr(w, http.StatusConflict, "not_approved")
		return nil, req, false
	}
	return hub, req, true
}

func (s *Server) telegramLoginStatus(w http.ResponseWriter, r *http.Request) {
	hub, ok := s.tgLogins(w)
	if !ok {
		return
	}
	req, found := hub.Get(r.PathValue("id"))
	if !found {
		writeErr(w, http.StatusNotFound, "login_expired")
		return
	}
	switch {
	case req.State == tglogin.Pending:
		writeJSON(w, http.StatusOK, map[string]string{"status": "pending"})
	case req.State == tglogin.Denied:
		hub.Finish(req.ID)
		writeJSON(w, http.StatusOK, map[string]string{"status": "denied"})
	case req.Kind == tglogin.Link:
		// Bot tasdiq paytida bog'lab qo'ygan.
		hub.Finish(req.ID)
		writeJSON(w, http.StatusOK, map[string]string{"status": "linked"})
	default:
		p, err := s.store.PlayerByChat(r.Context(), req.Chat)
		if errors.Is(err, store.ErrNotFound) {
			// Telegram hali profilga bog'lanmagan: brauzer yangi profil ochadi yoki kod bilan kirib bog'laydi.
			writeJSON(w, http.StatusOK, map[string]string{"status": "new", "name": req.Name})
			return
		}
		if err != nil {
			s.internal(w, r, err)
			return
		}
		s.finishWithToken(w, r, hub, req.ID, p, http.StatusOK)
	}
}

// finishWithToken — so'rovni yopadi va brauzerga profil hamda uning qurilma kalitini beradi.
func (s *Server) finishWithToken(w http.ResponseWriter, r *http.Request, hub *tglogin.Hub, id string, p *store.Player, status int) {
	code := newCode()
	if err := s.store.AddToken(r.Context(), p.ID, hashCode(normalizeCode(code)), deviceLabel(r.UserAgent(), false)); err != nil {
		s.internal(w, r, err)
		return
	}
	hub.Finish(id)
	writeJSON(w, status, map[string]any{
		"status": "ok",
		"player": playerJSON{ID: p.ID, Nickname: p.Nickname, CreatedAt: p.CreatedAt.Unix(), Code: code},
	})
}

// telegramLoginPlayer — Telegram bog'lanmagan: shu taxallus bilan yangi profil ochiladi va bog'lanadi.
// Javobda haqiqiy tiklash kodi (oddiy ro'yxatdan o'tishdagidek).
func (s *Server) telegramLoginPlayer(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Nickname string `json:"nickname"`
	}
	if !decode(w, r, &body) {
		return
	}
	hub, req, ok := s.approvedLogin(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	// Shu orada (boshqa qurilmadan) bog'langan bo'lsa — o'sha profilga kiriladi, ikkinchisi ochilmaydi.
	if p, err := s.store.PlayerByChat(ctx, req.Chat); err == nil {
		s.finishWithToken(w, r, hub, req.ID, p, http.StatusOK)
		return
	} else if !errors.Is(err, store.ErrNotFound) {
		s.internal(w, r, err)
		return
	}
	nick, err := nickname.Clean(body.Nickname)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if !s.signup.allow(s.clientIP(r)) {
		writeErr(w, http.StatusTooManyRequests, "rate_limited")
		return
	}
	id, code := newID(), newCode()
	if err := s.store.CreatePlayer(ctx, id, hashCode(normalizeCode(code)), nick); err != nil {
		s.internal(w, r, err)
		return
	}
	if err := s.store.LinkChat(ctx, req.Chat, id); err != nil {
		s.internal(w, r, err)
		return
	}
	hub.Finish(req.ID)
	writeJSON(w, http.StatusCreated, map[string]any{
		"status":  "ok",
		"created": true, // brauzer tiklash kodini darhol ko'rsatadi (qurilma kaliti emas, haqiqiy kod)
		"player":  playerJSON{ID: id, Nickname: nick, CreatedAt: time.Now().Unix(), Code: code},
	})
}

// telegramLoginAttach — Telegram bog'lanmagan: o'quvchi tiklash kodi bilan o'z profiliga kirdi (so'rov
// shu kod bilan keladi) — Telegram o'sha profilga bog'lanadi. Keyingi safar kod kerak bo'lmaydi.
func (s *Server) telegramLoginAttach(w http.ResponseWriter, r *http.Request) {
	hub, req, ok := s.approvedLogin(w, r)
	if !ok {
		return
	}
	if err := s.store.LinkChat(r.Context(), req.Chat, playerFrom(r).ID); err != nil {
		s.internal(w, r, err)
		return
	}
	hub.Finish(req.ID)
	writeJSON(w, http.StatusOK, map[string]string{"status": "linked"})
}

// telegramAppLogin — Mini App: Telegram imzolagan initData bilan bog'langan profilga kirish (bulutdagi
// kod yo'q yoki o'qilmadi). Tasdiq kerak emas — initData'ni faqat shu foydalanuvchining Telegram'i beradi.
func (s *Server) telegramAppLogin(w http.ResponseWriter, r *http.Request) {
	tg := s.opts.Telegram
	if tg == nil {
		writeErr(w, http.StatusNotFound, "telegram_off")
		return
	}
	var body struct {
		InitData string `json:"initData"`
	}
	if !decode(w, r, &body) {
		return
	}
	if !s.tglogin.allow(s.clientIP(r)) {
		writeErr(w, http.StatusTooManyRequests, "rate_limited")
		return
	}
	uid, _, err := tg.VerifyInitData(body.InitData)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, "bad_init_data")
		return
	}
	p, err := s.store.PlayerByChat(r.Context(), uid)
	if errors.Is(err, store.ErrNotFound) {
		writeErr(w, http.StatusNotFound, "not_linked")
		return
	}
	if err != nil {
		s.internal(w, r, err)
		return
	}
	code := newCode()
	if err := s.store.AddToken(r.Context(), p.ID, hashCode(normalizeCode(code)), deviceLabel(r.UserAgent(), true)); err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"player": playerJSON{ID: p.ID, Nickname: p.Nickname, CreatedAt: p.CreatedAt.Unix(), Code: code},
	})
}

// telegramAppLink — Mini App'da ochiq profil shu Telegram foydalanuvchisiga bog'lanadi: keyin saytda va
// boshqa qurilmalarda Telegram orqali kiriladi.
func (s *Server) telegramAppLink(w http.ResponseWriter, r *http.Request) {
	tg := s.opts.Telegram
	if tg == nil {
		writeErr(w, http.StatusNotFound, "telegram_off")
		return
	}
	var body struct {
		InitData string `json:"initData"`
	}
	if !decode(w, r, &body) {
		return
	}
	uid, _, err := tg.VerifyInitData(body.InitData)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, "bad_init_data")
		return
	}
	if err := s.store.LinkChat(r.Context(), uid, playerFrom(r).ID); err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"linked": true})
}
