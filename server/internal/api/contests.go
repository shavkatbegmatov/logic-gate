package api

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"logicgate/server/internal/sim"
	"logicgate/server/internal/store"
)

// Sinf musobaqasi: o'qituvchi darajalarni tanlab, vaqtli musobaqa boshlaydi (bir sinfda bir vaqtda bitta).
// O'quvchilar musobaqa ekranida darajalarni bo'sh maydondan yechadi — yechim alohida yuboriladi (oldin
// yechilgan darajaning saqlangan sxemasi hisobga o'tmaydi). Reyting: ko'p yulduz, ko'p daraja, avvalroq.
//
//	POST /api/classes/{code}/contests            — o'qituvchi: {title, levels, minutes} → boshlanadi
//	POST /api/classes/{code}/contests/{id}/stop  — o'qituvchi: muddatidan oldin tugatish
//	GET  /api/classes/{code}/contest/teacher     — o'qituvchi (proyektor): oxirgi musobaqa va reyting
//	GET  /api/classes/{code}/contest             — o'quvchi (a'zo): oxirgi musobaqa va reyting
//	POST /api/classes/{code}/contests/{id}/solve — o'quvchi: {level, circuit}

const (
	maxContestMinutes = 120
	minContestMinutes = 3
	keepContests      = 20 // sinfda saqlanadigan musobaqalar (natijalari bilan)
	// Musobaqa tugagach shuncha vaqt ichida kelgan yechim qabul qilinadi (oxirgi soniyalarda yuborilgani
	// tarmoqda kechiksa ham).
	contestGrace = 15 * time.Second
)

type contestJSON struct {
	ID       int64    `json:"id"`
	Title    string   `json:"title"`
	Levels   []string `json:"levels"`
	StartsAt int64    `json:"startsAt"`
	EndsAt   int64    `json:"endsAt"`
	// Remaining — tugashiga necha soniya qoldi (0 — tugagan): mijoz soati server soatidan farq qilsa ham
	// taymer to'g'ri bo'lsin.
	Remaining int `json:"remaining"`
}

func (s *Server) toContestJSON(c *store.Contest) contestJSON {
	left := max(0, int(c.EndsAt.Sub(s.now()).Seconds()))
	return contestJSON{ID: c.ID, Title: c.Title, Levels: c.Levels, StartsAt: c.StartsAt.Unix(), EndsAt: c.EndsAt.Unix(), Remaining: left}
}

type contestEntryJSON struct {
	Rank     int            `json:"rank"`
	Nickname string         `json:"nickname"`
	Stars    int            `json:"stars"`
	Solved   int            `json:"solved"`
	Levels   map[string]int `json:"levels"`
	Me       bool           `json:"me,omitempty"`
}

// activeContest — sinfda hozir davom etayotgan musobaqa (yo'q bo'lsa nil): sinflar ro'yxatida ko'rsatiladi.
func (s *Server) activeContest(r *http.Request, classID string) (*contestJSON, error) {
	c, err := s.store.LatestContest(r.Context(), classID)
	if errors.Is(err, store.ErrNotFound) {
		return nil, nil
	}
	if err != nil || !c.Active(s.now()) {
		return nil, err
	}
	j := s.toContestJSON(c)
	return &j, nil
}

func (s *Server) createContest(w http.ResponseWriter, r *http.Request) {
	c := s.teacherClass(w, r)
	if c == nil {
		return
	}
	var req struct {
		Title   string   `json:"title"`
		Levels  []string `json:"levels"`
		Minutes int      `json:"minutes"`
	}
	if !decode(w, r, &req) {
		return
	}
	title, err := cleanText(req.Title, 0, 60, errBadTask)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	ids, ok := s.levelList(req.Levels)
	if !ok || req.Minutes < minContestMinutes || req.Minutes > maxContestMinutes {
		writeErr(w, http.StatusBadRequest, "bad_contest")
		return
	}
	now := s.now()
	ct := store.Contest{ClassID: c.ID, Title: title, Levels: ids, StartsAt: now, EndsAt: now.Add(time.Duration(req.Minutes) * time.Minute)}
	switch err := s.store.CreateContest(r.Context(), &ct, keepContests); {
	case errors.Is(err, store.ErrContestActive):
		writeErr(w, http.StatusConflict, err.Error())
		return
	case err != nil:
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, s.toContestJSON(&ct))
}

// levelList — o'yindagi darajalar (o'yin tartibida, takrorsiz); bo'sh, noma'lum yoki maxTaskLevels dan
// ko'p bo'lsa ok=false.
func (s *Server) levelList(want []string) ([]string, bool) {
	set := map[string]bool{}
	for _, id := range want {
		if _, ok := s.pack.Level(id); !ok {
			return nil, false
		}
		set[id] = true
	}
	var ids []string
	for _, l := range s.pack.Levels {
		if set[l.ID] {
			ids = append(ids, l.ID)
		}
	}
	return ids, len(ids) > 0 && len(ids) <= maxTaskLevels
}

// contestOf — {id} bo'yicha shu sinfdagi musobaqa; topilmasa javob yozilgan va nil.
func (s *Server) contestOf(w http.ResponseWriter, r *http.Request, classID string) *store.Contest {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	var ct *store.Contest
	if err == nil {
		ct, err = s.store.ContestByID(r.Context(), classID, id)
	}
	if err != nil {
		if errors.Is(err, store.ErrNotFound) || errors.Is(err, strconv.ErrSyntax) || errors.Is(err, strconv.ErrRange) {
			writeErr(w, http.StatusNotFound, "no_contest")
		} else {
			s.internal(w, r, err)
		}
		return nil
	}
	return ct
}

func (s *Server) stopContest(w http.ResponseWriter, r *http.Request) {
	c := s.teacherClass(w, r)
	if c == nil {
		return
	}
	ct := s.contestOf(w, r, c.ID)
	if ct == nil {
		return
	}
	if err := s.store.StopContest(r.Context(), c.ID, ct.ID, s.now()); err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// writeContest — oxirgi musobaqa va reyting; me — o'quvchi o'zi (o'qituvchi uchun bo'sh).
func (s *Server) writeContest(w http.ResponseWriter, r *http.Request, c *store.Class, me string) {
	ct, err := s.store.LatestContest(r.Context(), c.ID)
	if errors.Is(err, store.ErrNotFound) {
		writeErr(w, http.StatusNotFound, "no_contest")
		return
	}
	if err != nil {
		s.internal(w, r, err)
		return
	}
	rows, err := s.store.ContestBoard(r.Context(), ct)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	board := make([]contestEntryJSON, 0, len(rows))
	for _, e := range rows {
		board = append(board, contestEntryJSON{Rank: e.Rank, Nickname: e.Nickname, Stars: e.Stars, Solved: e.Solved, Levels: e.Levels, Me: me != "" && e.PlayerID == me})
	}
	writeJSON(w, http.StatusOK, map[string]any{"code": c.ID, "name": c.Name, "contest": s.toContestJSON(ct), "board": board})
}

func (s *Server) teacherContest(w http.ResponseWriter, r *http.Request) {
	if c := s.teacherClass(w, r); c != nil {
		s.writeContest(w, r, c, "")
	}
}

// memberClass — sinf va o'yinchining a'zoligi; a'zo bo'lmasa javob yozilgan va nil.
func (s *Server) memberClass(w http.ResponseWriter, r *http.Request) *store.Class {
	c := s.classFrom(w, r)
	if c == nil {
		return nil
	}
	member, err := s.store.IsClassMember(r.Context(), c.ID, playerFrom(r).ID)
	if err != nil {
		s.internal(w, r, err)
		return nil
	}
	if !member {
		writeErr(w, http.StatusForbidden, "not_member")
		return nil
	}
	return c
}

func (s *Server) studentContest(w http.ResponseWriter, r *http.Request) {
	if c := s.memberClass(w, r); c != nil {
		s.writeContest(w, r, c, playerFrom(r).ID)
	}
}

// contestSolve — o'quvchining musobaqadagi yechimi: server qayta tekshiradi va eng yaxshisini saqlaydi.
func (s *Server) contestSolve(w http.ResponseWriter, r *http.Request) {
	c := s.memberClass(w, r)
	if c == nil {
		return
	}
	ct := s.contestOf(w, r, c.ID)
	if ct == nil {
		return
	}
	var req struct {
		Level   string      `json:"level"`
		Circuit sim.Circuit `json:"circuit"`
	}
	if !decode(w, r, &req) {
		return
	}
	now := s.now()
	if now.Before(ct.StartsAt) || !now.Before(ct.EndsAt.Add(contestGrace)) {
		writeErr(w, http.StatusConflict, "contest_over")
		return
	}
	level, ok := s.pack.Level(req.Level)
	if !ok || !ct.Has(level.ID) {
		writeErr(w, http.StatusNotFound, "no_level")
		return
	}
	gates, ok := checkCircuit(w, level, req.Circuit)
	if !ok {
		return
	}
	p := playerFrom(r)
	stars := sim.Stars(level.Goal, gates)
	improved, err := s.store.SaveContestSolve(r.Context(), ct.ID, p.ID, level.ID, gates, stars, now)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	rows, err := s.store.ContestBoard(r.Context(), ct)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	out := map[string]any{"gates": gates, "stars": stars, "improved": improved}
	for _, e := range rows {
		if e.PlayerID == p.ID {
			out["rank"], out["total"], out["solved"], out["best"] = e.Rank, e.Stars, e.Solved, e.Levels[level.ID]
		}
	}
	writeJSON(w, http.StatusOK, out)
}
