// Package api — o'yin serverining HTTP API si.
package api

import (
	"bytes"
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"

	"logicgate/levels"
	"logicgate/server/internal/nickname"
	"logicgate/server/internal/sim"
	"logicgate/server/internal/store"
	"logicgate/server/internal/tglogin"
)

const (
	maxBody         = 64 << 10
	leaderboardSize = 50
	// Reyting ko'pi bilan shuncha vaqtda bir marta qayta hisoblanadi (taxallus va yechimlar uni majburlay
	// olmaydi); oraliqda avvalgi holat beriladi.
	leaderboardCache = 15 * time.Second
	// Bundan eski holat berilmaydi — yangisi kutiladi (uzoq tanaffusdan keyingi birinchi so'rov).
	leaderboardMaxStale = 4 * leaderboardCache
	// Bitta qayta hisoblash uchun muddat.
	leaderboardBuildTimeout = time.Minute
)

type Server struct {
	store  *store.Store
	pack   *levels.Pack
	daily  *levels.Daily
	now    func() time.Time
	log    *slog.Logger
	opts   Options
	api    *limiter // umumiy so'rovlar
	signup *limiter // yangi o'yinchi yaratish
	// Kalitlar: tiklash kodi va o'qituvchi kaliti bo'yicha noto'g'ri urinishlar.
	auth *limiter
	// Sinf yaratish.
	classes *limiter
	// Brauzer xatolari haqida xabarlar va ularning takrorlari.
	reports *limiter
	// Telegram orqali kirish so'rovlari.
	tglogin *limiter
	cerr    clientErrors

	// Umumiy reyting keshi (cachedLeaderboard): oxirgi holat, qayta hisoblash boshlangan payt va davom
	// etayotgan hisoblash (nil — yo'q; tugaganda yopiladi).
	lbMu      sync.Mutex
	lb        *lbSnapshot
	lbStarted time.Time
	lbWait    chan struct{}
	lbErr     error
	lbRenamed map[string]string // hisoblash paytida almashgan taxalluslar
	lbBuilds  int               // nechta hisoblash boshlangan (testlar uchun)

	// Kunlik arxivning umumiy qismi (o'yinchi natijalarisiz): archDay kuni uchun, archiveCacheTTL davomida.
	archMu   sync.Mutex
	archDay  int
	archAt   time.Time
	archData []archiveDayJSON
}

// Options — muhitga bog'liq sozlamalar.
type Options struct {
	// Docker'da Traefik xususiy tarmoq manzilidan keladi; uning X-Real-IP sarlavhasiga ishonish.
	TrustPrivateProxies bool
	// Version /api/version da qaytariladi: CI deploy'dan keyin yangi versiya ishga tushganini tekshiradi.
	Version string
	// Now — joriy vaqt (testlarda kunni almashtirish uchun); nil bo'lsa time.Now.
	Now func() time.Time
	// Telegram — bot o'rnatilgan bo'lsa (o'yin ichidan kunlik eslatma); nil — o'chirilgan.
	Telegram Telegram
	// Logins — saytga Telegram orqali kirish so'rovlari (bot ular bilan ishlaydi); nil — o'chirilgan.
	Logins *tglogin.Hub
}

func New(st *store.Store, pack *levels.Pack, daily *levels.Daily, log *slog.Logger, opts Options) *Server {
	now := opts.Now
	if now == nil {
		now = time.Now
	}
	return &Server{
		store: st,
		pack:  pack,
		daily: daily,
		now:   now,
		log:   log,
		opts:  opts,
		// Sinf rejimi: 25–40 o'quvchi bitta maktab NAT manzilidan keladi. Bir qurilma ilovani ochib, profil
		// yaratib, sinfga qo'shilguncha ~10 ta so'rov yuboradi (progress, sinf, a'zolik, vazifalar, kunlik
		// masala...) — 40 qurilmaga 400 ta birdaniga; keyin o'yin davomida soniyasiga 20 ta (qurilmaga ~0.5).
		api: newLimiter(20, 400),
		// Bir IP dan: butun sinf (40 + zaxira) birdaniga, keyin 30 soniyada bitta — keyingi darsdagi sinfgacha
		// (~20 daqiqada) yana to'ladi.
		signup: newLimiter(1.0/30, 50),
		auth:   newLimiter(0.2, 10),
		// Bir IP dan: 5 tagacha birdaniga, keyin 2 daqiqada bitta sinf.
		classes: newLimiter(1.0/120, 5),
		// Bir IP dan: 5 tagacha birdaniga, keyin daqiqada bitta xato xabari.
		reports: newLimiter(1.0/60, 5),
		// Bir IP dan: butun sinf birdaniga, keyin 5 soniyada bitta so'rov (holatni so'rash — umumiy cheklov ostida).
		tglogin: newLimiter(1.0/5, 45),
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte("ok")) })
	mux.HandleFunc("GET /api/version", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"version": s.opts.Version})
	})
	mux.HandleFunc("POST /api/players", s.createPlayer)
	mux.HandleFunc("GET /api/me", s.authed(s.getMe))
	mux.HandleFunc("PATCH /api/me", s.authed(s.patchMe))
	mux.HandleFunc("GET /api/progress", s.authed(s.getProgress))
	mux.HandleFunc("POST /api/levels/{id}/solve", s.authed(s.solve))
	mux.HandleFunc("GET /api/levels/{id}/stats", s.levelStats)
	mux.HandleFunc("GET /api/leaderboard", s.leaderboard)
	mux.HandleFunc("GET /api/daily", s.getDaily)
	mux.HandleFunc("GET /api/daily/archive", s.dailyArchive)
	mux.HandleFunc("GET /api/daily/{day}", s.getDailyDay)
	mux.HandleFunc("POST /api/daily/{day}/solve", s.authed(s.solveDaily))
	mux.HandleFunc("GET /api/daily/{day}/leaderboard", s.dailyLeaderboard)
	mux.HandleFunc("POST /api/telegram/remind", s.telegramRemind)
	mux.HandleFunc("POST /api/auth/telegram", s.telegramLogin)
	mux.HandleFunc("POST /api/auth/telegram/app", s.telegramAppLogin)
	mux.HandleFunc("GET /api/auth/telegram/{id}", s.telegramLoginStatus)
	mux.HandleFunc("POST /api/auth/telegram/{id}/player", s.telegramLoginPlayer)
	mux.HandleFunc("POST /api/auth/telegram/{id}/attach", s.authed(s.telegramLoginAttach))
	mux.HandleFunc("POST /api/me/telegram", s.authed(s.telegramLink))
	mux.HandleFunc("POST /api/me/telegram/app", s.authed(s.telegramAppLink))
	mux.HandleFunc("POST /api/classes", s.createClass)
	mux.HandleFunc("GET /api/classes/{code}", s.getClass)
	mux.HandleFunc("DELETE /api/classes/{code}", s.deleteClass)
	mux.HandleFunc("POST /api/classes/{code}/join", s.authed(s.joinClass))
	mux.HandleFunc("DELETE /api/classes/{code}/join", s.authed(s.leaveClass))
	mux.HandleFunc("GET /api/classes/{code}/board", s.authed(s.classBoard))
	mux.HandleFunc("GET /api/classes/{code}/report", s.classReport)
	mux.HandleFunc("DELETE /api/classes/{code}/members/{id}", s.removeMember)
	mux.HandleFunc("POST /api/classes/{code}/tasks", s.createTask)
	mux.HandleFunc("DELETE /api/classes/{code}/tasks/{id}", s.deleteTask)
	mux.HandleFunc("GET /api/me/classes", s.authed(s.myClasses))
	mux.HandleFunc("POST /api/client-errors", s.clientError)
	mux.HandleFunc("/api/", func(w http.ResponseWriter, _ *http.Request) {
		writeErr(w, http.StatusNotFound, "not_found")
	})
	return s.limit(mux)
}

// clientIP — so'rovlar cheklovi kaliti (ipKey: IPv6 — /64 tarmoq). Proksi (Nginx yoki Traefik) qo'ygan
// X-Real-IP faqat ishonchli manzildan kelsa va haqiqatan IP bo'lsa olinadi — lokal manzil,
// TrustPrivateProxies yoqilgan bo'lsa esa xususiy tarmoq (Docker) manzillari ham.
func (s *Server) clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return host
	}
	if ip.IsLoopback() || (s.opts.TrustPrivateProxies && ip.IsPrivate()) {
		if real := net.ParseIP(strings.TrimSpace(r.Header.Get("X-Real-IP"))); real != nil {
			ip = real
		}
	}
	return ipKey(ip)
}

func (s *Server) limit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("X-Content-Type-Options", "nosniff")
			if !s.api.allow(s.clientIP(r)) {
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
			if !s.auth.allow(s.clientIP(r)) {
				writeErr(w, http.StatusTooManyRequests, "rate_limited")
				return
			}
			writeErr(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		if err != nil {
			s.internal(w, r, err)
			return
		}
		if err := s.store.Touch(r.Context(), p); err != nil && r.Context().Err() == nil {
			s.log.Warn("touch", "err", err)
		}
		h(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, p)))
	}
}

func playerFrom(r *http.Request) *store.Player { return r.Context().Value(ctxKey{}).(*store.Player) }

// optionalPlayer — token ixtiyoriy bo'lgan so'rovlar uchun: noto'g'ri yoki yo'q bo'lsa nil.
// Javobdagi me/member maydonlari kod to'g'riligini bildirmasin: topilmagan kod auth cheklovini sarflaydi,
// u tugagan IP dan esa kod umuman tekshirilmaydi (nil).
func (s *Server) optionalPlayer(r *http.Request) *store.Player {
	token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if !ok {
		return nil
	}
	code := normalizeCode(token)
	if code == "" {
		return nil
	}
	ip := s.clientIP(r)
	if s.auth.blocked(ip) {
		return nil
	}
	p, err := s.store.PlayerByToken(r.Context(), hashCode(code))
	if errors.Is(err, store.ErrNotFound) {
		s.auth.allow(ip)
	}
	if err != nil {
		return nil
	}
	return p
}

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

// statusClientClosed — mijoz javobni kutmasdan uzildi (Nginx'dagi 499 kabi); javobni hech kim o'qimaydi.
const statusClientClosed = 499

// internal — kutilmagan xato: ERROR log (admin'ga Telegram ogohlantirishi ham) va 500. Mijoz uzilgani
// (so'rov konteksti bekor qilingan yoki muddati o'tgan) xato emas — bitta SQLite ulanishini kutib
// turgan so'rovlar odatiy hol, ular ogohlantirish bo'lib kelmasin. Serverning o'z muddati (masalan,
// reyting hisoblash) o'tgani esa xato bo'lib qoladi.
func (s *Server) internal(w http.ResponseWriter, r *http.Request, err error) {
	if r.Context().Err() != nil || errors.Is(err, context.Canceled) {
		s.log.Debug("so'rov uzildi", "path", r.URL.Path, "err", err)
		writeErr(w, statusClientClosed, "canceled")
		return
	}
	s.log.Error("ichki xato", "err", err)
	writeErr(w, http.StatusInternalServerError, "internal")
}

type playerJSON struct {
	ID        string `json:"id"`
	Nickname  string `json:"nickname"`
	CreatedAt int64  `json:"createdAt"`
	Code      string `json:"code,omitempty"`
	// Telegram — profil Telegram hisobiga bog'langanmi (faqat /api/me).
	Telegram *bool `json:"telegram,omitempty"`
}

func (s *Server) createPlayer(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Nickname string `json:"nickname"`
	}
	if !decode(w, r, &req) {
		return
	}
	nick, err := nickname.Clean(req.Nickname)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	// Cheklov faqat profil yaratiladigan so'rovdan olinadi: maktabda rad etilgan taxalluslar (bitta NAT
	// ortidagi butun sinf) qolgan o'quvchilarning ro'yxatdan o'tishini to'sib qo'ymasin. Rad etiladigan
	// so'rovlar bazaga tegmaydi va umumiy cheklov ostida.
	if !s.signup.allow(s.clientIP(r)) {
		writeErr(w, http.StatusTooManyRequests, "rate_limited")
		return
	}
	id, code := newID(), newCode()
	if err := s.store.CreatePlayer(r.Context(), id, hashCode(normalizeCode(code)), nick); err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, playerJSON{ID: id, Nickname: nick, CreatedAt: time.Now().Unix(), Code: code})
}

func (s *Server) getMe(w http.ResponseWriter, r *http.Request) {
	p := playerFrom(r)
	linked, err := s.store.TelegramLinked(r.Context(), p.ID)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, playerJSON{ID: p.ID, Nickname: p.Nickname, CreatedAt: p.CreatedAt.Unix(), Telegram: &linked})
}

func (s *Server) patchMe(w http.ResponseWriter, r *http.Request) {
	p := playerFrom(r)
	var req struct {
		Nickname string `json:"nickname"`
	}
	if !decode(w, r, &req) {
		return
	}
	nick, err := nickname.Clean(req.Nickname)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	// Taxallus o'zgarmagan bo'lsa — yozish kerak emas. O'zgarsa, reyting qayta hisoblanmaydi: keshdagi
	// yozuvdagi taxallus almashtiriladi (aks holda nom almashtirib, reytingni to'xtovsiz qayta hisoblatish
	// mumkin edi).
	if nick != p.Nickname {
		if err := s.store.SetNickname(r.Context(), p.ID, nick); err != nil {
			s.internal(w, r, err)
			return
		}
		s.renameInLeaderboard(p.ID, nick)
	}
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
		s.internal(w, r, err)
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
	var (
		gates  int
		simErr *sim.Error
		wrong  map[string]any
	)
	if level.Seq != nil {
		// Ketma-ket masala: sxema kerakli avtomat bilan har qanday kirishlar ketma-ketligida mos kelishi kerak.
		var trace []int
		gates, trace, simErr = sim.CheckSeq(spec, sim.Machine{Next: level.Seq.Next, Out: level.Seq.Out}, req.Circuit)
		if trace != nil {
			wrong = map[string]any{"error": "wrong_answer", "trace": trace}
		}
	} else {
		var rows []int
		gates, rows, simErr = sim.Check(spec, level.Target, req.Circuit)
		if len(rows) > 0 {
			wrong = map[string]any{"error": "wrong_answer", "wrongRows": rows}
		}
	}
	if simErr != nil {
		writeJSON(w, http.StatusUnprocessableEntity, simErr)
		return
	}
	if wrong != nil {
		writeJSON(w, http.StatusUnprocessableEntity, wrong)
		return
	}
	circuit, ok := storedCircuit(req.Circuit)
	if !ok {
		writeErr(w, http.StatusBadRequest, "circuit_too_large")
		return
	}
	stars := sim.Stars(level.Goal, gates)
	// Reyting keshi tozalanmaydi: yangi natija ko'pi bilan leaderboardCache dan keyin ko'rinadi, o'yinchining
	// o'z o'rni esa har so'rovda hisoblanadi.
	best, improved, err := s.store.SaveSolution(r.Context(), playerFrom(r).ID, store.Solution{
		LevelID: level.ID, Gates: gates, Stars: stars, Circuit: circuit,
	})
	if err != nil {
		s.internal(w, r, err)
		return
	}
	st, err := s.store.LevelStats(r.Context(), level.ID)
	if err != nil {
		s.internal(w, r, err)
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
	return map[string]any{"solvers": st.Solvers, "bestGates": st.BestGates, "bestBy": by, "spread": spreadJSON(st.Spread)}
}

// spreadJSON — [[element soni, o'yinchilar], ...]; taxalluslarsiz, faqat sonlar.
func spreadJSON(sp []store.GateCount) [][2]int {
	out := make([][2]int, len(sp))
	for i, g := range sp {
		out[i] = [2]int{g.Gates, g.Count}
	}
	return out
}

func (s *Server) levelStats(w http.ResponseWriter, r *http.Request) {
	level, ok := s.pack.Level(r.PathValue("id"))
	if !ok {
		writeErr(w, http.StatusNotFound, "no_level")
		return
	}
	st, err := s.store.LevelStats(r.Context(), level.ID)
	if err != nil {
		s.internal(w, r, err)
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

// lbSnapshot — reytingning bir paytdagi holati. O'zgartirilmaydi: taxallus almashsa, nusxasi yasaladi.
type lbSnapshot struct {
	at     time.Time     // hisoblash boshlangan payt
	top    []store.Entry // yuqori qism (leaderboardSize), taxalluslar bilan
	scores []store.Score // hammaning ko'rsatkichi, yuqoridan pastga (16 baytdan; id va taxallussiz)
}

// rank — shunday ko'rsatkichli o'yinchining o'rni: undan yuqoridagilar soni + 1 (ko'rsatkichlari aynan
// teng o'yinchilar bir o'rinda). Ikkilik qidiruv: har bir o'yinchi uchun xarita saqlanmaydi.
func (sn *lbSnapshot) rank(sc store.Score) int {
	i, _ := slices.BinarySearchFunc(sn.scores, sc, store.Score.Compare)
	return i + 1
}

// cachedLeaderboard — umumiy reyting. Qayta hisoblash ko'pi bilan leaderboardCache da bir marta boshlanadi
// va bir vaqtda bittadan ortiq bo'lmaydi; u fonda ishlaydi, shu payt avvalgi holat beriladi (u juda eski
// bo'lsa yoki hali yo'q bo'lsa — yangisi kutiladi). Taxallus va yechimlar hisoblashni majburlay olmaydi.
func (s *Server) cachedLeaderboard(ctx context.Context) (*lbSnapshot, error) {
	s.lbMu.Lock()
	snap, wait, err := s.lb, s.lbWait, s.lbErr
	if wait == nil && time.Since(s.lbStarted) >= leaderboardCache {
		wait = make(chan struct{})
		s.lbWait, s.lbStarted = wait, time.Now()
		s.lbBuilds++
		hint := 0
		if snap != nil {
			hint = len(snap.scores) + len(snap.scores)/16 + 16
		}
		go s.rebuildLeaderboard(wait, hint)
	}
	s.lbMu.Unlock()
	if snap != nil && (wait == nil || time.Since(snap.at) < leaderboardMaxStale) {
		return snap, nil
	}
	if wait == nil {
		// Birinchi hisoblash muvaffaqiyatsiz, qayta urinish vaqti hali kelmagan.
		return nil, cmp.Or(err, errors.New("reyting hali tayyor emas"))
	}
	select {
	case <-wait:
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	s.lbMu.Lock()
	defer s.lbMu.Unlock()
	if s.lb == nil {
		return nil, s.lbErr
	}
	return s.lb, nil
}

// rebuildLeaderboard reytingni so'rovdan mustaqil kontekstda hisoblaydi (mijoz uzilsa ham to'xtamaydi)
// va natijani keshga yozadi; xato bo'lsa avvalgi holat qoladi.
func (s *Server) rebuildLeaderboard(done chan struct{}, sizeHint int) {
	ctx, cancel := context.WithTimeout(context.Background(), leaderboardBuildTimeout)
	defer cancel()
	snap, err := s.buildLeaderboard(ctx, sizeHint)
	s.lbMu.Lock()
	if err == nil {
		// Hisoblash paytida almashgan taxalluslar (bazadan eski nom o'qilgan bo'lishi mumkin).
		for i, e := range snap.top {
			if nick, ok := s.lbRenamed[e.PlayerID]; ok {
				snap.top[i].Nickname = nick
			}
		}
		s.lb = snap
	}
	s.lbErr, s.lbWait, s.lbRenamed = err, nil, nil
	s.lbMu.Unlock()
	close(done)
	if err != nil {
		s.log.Warn("reyting hisoblanmadi", "err", err)
	}
}

// buildLeaderboard reytingni bazadan bitta o'tishda yig'adi: hammaning ko'rsatkichi (saralanadi) va eng
// yuqori leaderboardSize ta o'yinchi — taxalluslar faqat ular uchun olinadi.
func (s *Server) buildLeaderboard(ctx context.Context, sizeHint int) (*lbSnapshot, error) {
	type ranked struct {
		id string
		sc store.Score
	}
	// Teng ko'rsatkichlilar id bo'yicha: ro'yxat tartibi barqaror bo'lsin.
	compare := func(sc store.Score, id []byte, r ranked) int {
		return cmp.Or(sc.Compare(r.sc), bytes.Compare(id, []byte(r.id)))
	}
	snap := &lbSnapshot{at: time.Now(), scores: make([]store.Score, 0, sizeHint)}
	best := make([]ranked, 0, leaderboardSize+1)
	err := s.store.Scores(ctx, func(id []byte, sc store.Score) {
		snap.scores = append(snap.scores, sc)
		if len(best) == leaderboardSize && compare(sc, id, best[len(best)-1]) >= 0 {
			return
		}
		i := sort.Search(len(best), func(k int) bool { return compare(sc, id, best[k]) < 0 })
		best = slices.Insert(best, i, ranked{string(id), sc})[:min(len(best)+1, leaderboardSize)]
	})
	if err != nil {
		return nil, err
	}
	slices.SortFunc(snap.scores, store.Score.Compare)
	ids := make([]string, len(best))
	for i, b := range best {
		ids[i] = b.id
	}
	names, err := s.store.Nicknames(ctx, ids)
	if err != nil {
		return nil, err
	}
	for _, b := range best {
		nick, ok := names[b.id]
		if !ok {
			continue // shu orada o'chirilgan
		}
		snap.top = append(snap.top, store.Entry{Rank: snap.rank(b.sc), PlayerID: b.id, Nickname: nick,
			Stars: int(b.sc.Stars), Solved: int(b.sc.Solved), Gates: int(b.sc.Gates)})
	}
	return snap, nil
}

// renameInLeaderboard — keshdagi yuqori qismdagi o'yinchining taxallusini almashtiradi (nusxada: avvalgi
// holatni o'qiyotgan so'rovlar o'zgarmaydi). Hisoblash davom etayotgan bo'lsa, yangi nom unga ham qo'llanadi.
func (s *Server) renameInLeaderboard(id, nick string) {
	s.lbMu.Lock()
	defer s.lbMu.Unlock()
	if s.lbWait != nil {
		if s.lbRenamed == nil {
			s.lbRenamed = map[string]string{}
		}
		s.lbRenamed[id] = nick
	}
	if s.lb == nil {
		return
	}
	i := slices.IndexFunc(s.lb.top, func(e store.Entry) bool { return e.PlayerID == id })
	if i < 0 {
		return
	}
	snap := *s.lb
	snap.top = slices.Clone(snap.top)
	snap.top[i].Nickname = nick
	s.lb = &snap
}

func (s *Server) leaderboard(w http.ResponseWriter, r *http.Request) {
	snap, err := s.cachedLeaderboard(r.Context())
	if err != nil {
		s.internal(w, r, err)
		return
	}
	// Token ixtiyoriy: bo'lsa, o'yinchining o'rni ham qaytariladi.
	p := s.optionalPlayer(r)
	var meID string
	if p != nil {
		meID = p.ID
	}
	out := make([]entryJSON, 0, len(snap.top))
	for _, e := range snap.top {
		out = append(out, entryJSON{Rank: e.Rank, Nickname: e.Nickname, Stars: e.Stars, Solved: e.Solved, Gates: e.Gates, Me: e.PlayerID == meID})
	}
	resp := map[string]any{"top": out, "me": nil}
	// O'yinchining o'zi: ko'rsatkichi bazadan (yechimlar kaliti bo'yicha, arzon) — doim yangi, o'rni esa
	// keshdagi reytingga nisbatan (boshqalarniki leaderboardCache gacha eskirgan bo'lishi mumkin). Hech
	// narsa yechmagan — me: null. Taxallus — o'yinchining hozirgisi.
	if p != nil {
		sc, ok, err := s.store.PlayerScore(r.Context(), p.ID)
		if err != nil {
			s.internal(w, r, err)
			return
		}
		if ok {
			resp["me"] = entryJSON{Rank: snap.rank(sc), Nickname: p.Nickname, Stars: int(sc.Stars),
				Solved: int(sc.Solved), Gates: int(sc.Gates), Me: true}
		}
	}
	writeJSON(w, http.StatusOK, resp)
}

// maxStoredCircuit — saqlanadigan sxema hajmi (ixcham ko'rinishda). Eng katta to'g'ri sxema (64 element,
// ~130 sim, chekka koordinatalar) ~7 KB bo'ladi: chegara faqat kutilmagan holatda ishlaydi.
const maxStoredCircuit = 8 << 10

// storedCircuit — tekshiruvdan o'tgan sxemaning saqlanadigan ixcham JSON ko'rinishi (sim.Canonical);
// ok=false — chegaradan katta.
func storedCircuit(c sim.Circuit) (string, bool) {
	b, err := json.Marshal(sim.Canonical(c))
	return string(b), err == nil && len(b) <= maxStoredCircuit
}
