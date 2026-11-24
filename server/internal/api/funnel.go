package api

import (
	"net/http"
	"slices"

	"logicgate/levels"
	"logicgate/server/internal/store"
)

// funnelEvent — POST /api/events {event, src}: o'yinchilar voronkasi bosqichi (store.FunnelEvents). Qurilma
// har bosqichni bir marta yuboradi; server kun bo'yicha faqat sonini oshiradi — id, o'yinchi va IP
// saqlanmaydi (IP faqat xotiradagi so'rovlar cheklovida). Noma'lum bosqich — 400.
func (s *Server) funnelEvent(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Event string `json:"event"`
		Src   string `json:"src"`
	}
	if !decode(w, r, &req) {
		return
	}
	if !slices.Contains(store.FunnelEvents, req.Event) {
		writeErr(w, http.StatusBadRequest, "bad_event")
		return
	}
	if req.Src != "tg" {
		req.Src = "web"
	}
	if !s.events.allow(s.clientIP(r)) {
		writeErr(w, http.StatusTooManyRequests, "rate_limited")
		return
	}
	if err := s.store.CountEvent(r.Context(), levels.DayOf(s.now()), req.Event, req.Src); err != nil {
		s.internal(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
