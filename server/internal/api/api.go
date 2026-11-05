// Package api — o'yin serverining HTTP API si.
package api

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"logicgate/levels"
	"logicgate/server/internal/sim"
	"logicgate/server/internal/store"
)

const (
	maxBody          = 64 << 10
	leaderboardSize  = 50
	leaderboardCache = 15 * time.Second
)

type Server struct {
	store  *store.Store
	pack   *levels.Pack
	log    *slog.Logger
	api    *limiter // umumiy so'rovlar
	signup *limiter // yangi o'yinchi yaratish
	// Kalitlar: tiklash kodi bo'yicha noto'g'ri urinishlar.
	auth *limiter

	lbMu   sync.Mutex
	lbAt   time.Time
	lbData []store.Entry
}

func New(st *store.Store, pack *levels.Pack, log *slog.Logger) *Server {
	return &Server{
		store:  st,
		pack:   pack,
		log:    log,
		api:    newLimiter(10, 40),
		signup: newLimiter(1.0/30, 5),
		auth:   newLimiter(0.2, 10),
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte("ok")) })
	mux.HandleFunc("POST /api/players", s.createPlayer)
	mux.HandleFunc("GET /api/me", s.authed(s.getMe))
	mux.HandleFunc("PATCH /api/me", s.authed(s.patchMe))
	mux.HandleFunc("GET /api/progress", s.authed(s.getProgress))
	mux.HandleFunc("POST /api/levels/{id}/solve", s.authed(s.solve))
	mux.HandleFunc("GET /api/levels/{id}/stats", s.levelStats)
	mux.HandleFunc("GET /api/leaderboard", s.leaderboard)
	mux.HandleFunc("/api/", func(w http.ResponseWriter, _ *http.Request) {
		writeErr(w, http.StatusNotFound, "not_found")
	})
	return s.limit(mux)
}

// clientIP: Nginx orqasida X-Real-IP ishlatiladi, lekin faqat so'rov lokal manzildan kelsa.
func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	if ip := net.ParseIP(host); ip != nil && ip.IsLoopback() {
		if real := strings.TrimSpace(r.Header.Get("X-Real-IP")); real != "" {
			return real
		}
	}
	return host
}

func (s *Server) limit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("X-Content-Type-Options", "nosniff")
			if !s.api.allow(clientIP(r)) {
				w.Header().Set("Retry-After", "5")
				writeErr(w, http.StatusTooManyRequests, "rate_limited")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

type ctxKey struct{}

func (s *Server) authed(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		code := normalizeCode(token)
		if !ok || code == "" {
			writeErr(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		p, err := s.store.PlayerByToken(r.Context(), hashCode(code))
		if errors.Is(err, store.ErrNotFound) {
			// Kodni terib topishga urinishlarni sekinlashtirish.
			if !s.auth.allow(clientIP(r)) {
				writeErr(w, http.StatusTooManyRequests, "rate_limited")
				return
			}
			writeErr(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		if err != nil {
			s.internal(w, err)
			return
		}
		if err := s.store.Touch(r.Context(), p); err != nil {
			s.log.Warn("touch", "err", err)
		}
		h(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, p)))
	}
}

func playerFrom(r *http.Request) *store.Player { return r.Context().Value(ctxKey{}).(*store.Player) }

func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxBody)
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		writeErr(w, http.StatusBadRequest, "bad_json")
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"error": code})
}

func (s *Server) internal(w http.ResponseWriter, err error) {
	s.log.Error("ichki xato", "err", err)
	writeErr(w, http.StatusInternalServerError, "internal")
}

type playerJSON struct {
	ID        string `json:"id"`
	Nickname  string `json:"nickname"`
	CreatedAt int64  `json:"createdAt"`
	Code      string `json:"code,omitempty"`
}

func (s *Server) createPlayer(w http.ResponseWriter, r *http.Request) {
	if !s.signup.allow(clientIP(r)) {
		writeErr(w, http.StatusTooManyRequests, "rate_limited")
		return
	}
	var req struct {
		Nickname string `json:"nickname"`
	}
	if !decode(w, r, &req) {
		return
	}
	nick, ok := cleanNickname(req.Nickname)
	if !ok {
		writeErr(w, http.StatusBadRequest, "bad_nickname")
		return
	}
	id, code := newID(), newCode()
	if err := s.store.CreatePlayer(r.Context(), id, hashCode(normalizeCode(code)), nick); err != nil {
		s.internal(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, playerJSON{ID: id, Nickname: nick, CreatedAt: time.Now().Unix(), Code: code})
}

func (s *Server) getMe(w http.ResponseWriter, r *http.Request) {
	p := playerFrom(r)
	writeJSON(w, http.StatusOK, playerJSON{ID: p.ID, Nickname: p.Nickname, CreatedAt: p.CreatedAt.Unix()})
}

func (s *Server) patchMe(w http.ResponseWriter, r *http.Request) {
	p := playerFrom(r)
	var req struct {
		Nickname string `json:"nickname"`
	}
	if !decode(w, r, &req) {
		return
	}
	nick, ok := cleanNickname(req.Nickname)
	if !ok {
		writeErr(w, http.StatusBadRequest, "bad_nickname")
		return
	}
	if err := s.store.SetNickname(r.Context(), p.ID, nick); err != nil {
		s.internal(w, err)
		return
	}
	s.dropLeaderboardCache()
	writeJSON(w, http.StatusOK, playerJSON{ID: p.ID, Nickname: nick, CreatedAt: p.CreatedAt.Unix()})
}

type solutionJSON struct {
	LevelID  string          `json:"levelId"`
	Gates    int             `json:"gates"`
	Stars    int             `json:"stars"`
	Circuit  json.RawMessage `json:"circuit,omitempty"`
	SolvedAt int64           `json:"solvedAt"`
}

func (s *Server) getProgress(w http.ResponseWriter, r *http.Request) {
	sols, err := s.store.Progress(r.Context(), playerFrom(r).ID)
	if err != nil {
		s.internal(w, err)
		return
	}
	out := make([]solutionJSON, 0, len(sols))
	for _, sol := range sols {
		out = append(out, solutionJSON{
			LevelID: sol.LevelID, Gates: sol.Gates, Stars: sol.Stars,
			Circuit: json.RawMessage(sol.Circuit), SolvedAt: sol.SolvedAt.Unix(),
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"levels": out})
}

func (s *Server) solve(w http.ResponseWriter, r *http.Request) {
	level, ok := s.pack.Level(r.PathValue("id"))
	if !ok {
		writeErr(w, http.StatusNotFound, "no_level")
		return
	}
	var req struct {
		Circuit sim.Circuit `json:"circuit"`
	}
	if !decode(w, r, &req) {
		return
	}
	spec := sim.Spec{Inputs: level.Inputs, Outputs: level.Outputs, Gates: level.Gates}
	gates, wrong, simErr := sim.Check(spec, level.Target, req.Circuit)
	if simErr != nil {
		writeJSON(w, http.StatusUnprocessableEntity, simErr)
		return
	}
	if len(wrong) > 0 {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]any{"error": "wrong_answer", "wrongRows": wrong})
		return
	}
	// Saqlashdan oldin qayta kodlash: faqat ma'lum maydonlar saqlanadi.
	if req.Circuit.Gates == nil {
		req.Circuit.Gates = []sim.Gate{}
	}
	if req.Circuit.Wires == nil {
		req.Circuit.Wires = []sim.Wire{}
	}
	circuit, _ := json.Marshal(req.Circuit)
	stars := sim.Stars(level.Goal, gates)
	best, improved, err := s.store.SaveSolution(r.Context(), playerFrom(r).ID, store.Solution{
		LevelID: level.ID, Gates: gates, Stars: stars, Circuit: string(circuit),
	})
	if err != nil {
		s.internal(w, err)
		return
	}
	if improved {
		s.dropLeaderboardCache()
	}
	st, err := s.store.LevelStats(r.Context(), level.ID)
	if err != nil {
		s.internal(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"gates":    gates,
		"stars":    stars,
		"improved": improved,
		"best":     solutionJSON{LevelID: best.LevelID, Gates: best.Gates, Stars: best.Stars, SolvedAt: best.SolvedAt.Unix()},
		"level":    statsJSON(st),
	})
}

func statsJSON(st *store.LevelStats) map[string]any {
	by := st.BestBy
	if by == nil {
		by = []string{}
	}
	return map[string]any{"solvers": st.Solvers, "bestGates": st.BestGates, "bestBy": by}
}

func (s *Server) levelStats(w http.ResponseWriter, r *http.Request) {
	level, ok := s.pack.Level(r.PathValue("id"))
	if !ok {
		writeErr(w, http.StatusNotFound, "no_level")
		return
	}
	st, err := s.store.LevelStats(r.Context(), level.ID)
	if err != nil {
		s.internal(w, err)
		return
	}
	writeJSON(w, http.StatusOK, statsJSON(st))
}

type entryJSON struct {
	Rank     int    `json:"rank"`
	Nickname string `json:"nickname"`
	Stars    int    `json:"stars"`
	Solved   int    `json:"solved"`
	Gates    int    `json:"gates"`
	Me       bool   `json:"me,omitempty"`
}

func (s *Server) dropLeaderboardCache() {
	s.lbMu.Lock()
	s.lbData = nil
	s.lbMu.Unlock()
}

func (s *Server) cachedLeaderboard(ctx context.Context) ([]store.Entry, error) {
	s.lbMu.Lock()
	defer s.lbMu.Unlock()
	if s.lbData != nil && time.Since(s.lbAt) < leaderboardCache {
		return s.lbData, nil
	}
	data, err := s.store.Leaderboard(ctx, leaderboardSize)
	if err != nil {
		return nil, err
	}
	if data == nil {
		data = []store.Entry{}
	}
	s.lbData, s.lbAt = data, time.Now()
	return data, nil
}

func (s *Server) leaderboard(w http.ResponseWriter, r *http.Request) {
	top, err := s.cachedLeaderboard(r.Context())
	if err != nil {
		s.internal(w, err)
		return
	}
	// Token ixtiyoriy: bo'lsa, o'yinchining o'rni ham qaytariladi.
	var meID string
	if token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer "); ok {
		if code := normalizeCode(token); code != "" {
			if p, err := s.store.PlayerByToken(r.Context(), hashCode(code)); err == nil {
				meID = p.ID
			}
		}
	}
	out := make([]entryJSON, 0, len(top))
	for _, e := range top {
		out = append(out, entryJSON{Rank: e.Rank, Nickname: e.Nickname, Stars: e.Stars, Solved: e.Solved, Gates: e.Gates, Me: e.PlayerID == meID})
	}
	resp := map[string]any{"top": out, "me": nil}
	if meID != "" {
		if e, err := s.store.Rank(r.Context(), meID); err == nil {
			resp["me"] = entryJSON{Rank: e.Rank, Nickname: e.Nickname, Stars: e.Stars, Solved: e.Solved, Gates: e.Gates, Me: true}
		} else if !errors.Is(err, store.ErrNotFound) {
			s.internal(w, err)
			return
		}
	}
	writeJSON(w, http.StatusOK, resp)
}
