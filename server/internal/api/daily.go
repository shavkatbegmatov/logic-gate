package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"logicgate/levels"
	"logicgate/server/internal/sim"
	"logicgate/server/internal/store"
)

const dailyBoardSize = 50

type dailyMeJSON struct {
	Rank  int `json:"rank"`
	Gates int `json:"gates"`
	Stars int `json:"stars"`
}

type dailyEntryJSON struct {
	Rank     int    `json:"rank"`
	Nickname string `json:"nickname"`
	Gates    int    `json:"gates"`
	Stars    int    `json:"stars"`
	Me       bool   `json:"me,omitempty"`
}

func (s *Server) today() int { return levels.DayOf(s.now()) }

// dayParam yo'ldagi {day} ni o'qiydi; masalasi bor kun bo'lmasa, 404 yozib false qaytaradi.
func (s *Server) dayParam(w http.ResponseWriter, r *http.Request) (int, *levels.Puzzle, bool) {
	day, err := strconv.Atoi(r.PathValue("day"))
	if r.PathValue("day") == "today" {
		day, err = s.today(), nil
	}
	if err == nil && day <= s.today() {
		if p, ok := s.daily.For(day); ok {
			return day, p, true
		}
	}
	writeErr(w, http.StatusNotFound, "no_daily")
	return 0, nil, false
}

// getDaily — bugungi masala, statistika va (token bo'lsa) o'yinchining natijasi hamda seriyasi.
func (s *Server) getDaily(w http.ResponseWriter, r *http.Request) {
	day := s.today()
	p, ok := s.daily.For(day)
	if !ok {
		writeErr(w, http.StatusNotFound, "no_daily")
		return
	}
	s.writeDaily(w, r, day, p)
}

// getDailyDay — arxivdagi (o'tgan) kun masalasi xuddi shu ko'rinishda. Kelajak kunlari 404 —
// masalani oldindan ko'rib bo'lmaydi.
func (s *Server) getDailyDay(w http.ResponseWriter, r *http.Request) {
	day, p, ok := s.dayParam(w, r)
	if !ok {
		return
	}
	s.writeDaily(w, r, day, p)
}

func (s *Server) writeDaily(w http.ResponseWriter, r *http.Request, day int, p *levels.Puzzle) {
	today := s.today()
	solvers, bestGates, err := s.store.DailyStats(r.Context(), day)
	if err != nil {
		s.internal(w, err)
		return
	}
	resp := map[string]any{
		"day":       day,
		"number":    s.daily.Number(day),
		"date":      levels.DayStart(day).Format(time.DateOnly),
		"nextAt":    levels.DayStart(day + 1).Unix(),
		"puzzle":    p,
		"solvers":   solvers,
		"bestGates": bestGates,
		"me":        nil,
		"streak":    0,
		// Natija hali qabul qilinadimi (bugun va kecha — seriya va reytingga); qolganlari — faqat mashq.
		"open": day >= today-1,
	}
	if me := s.optionalPlayer(r); me != nil {
		if e, err := s.store.DailyRank(r.Context(), day, me.ID); err == nil {
			resp["me"] = dailyMeJSON{Rank: e.Rank, Gates: e.Gates, Stars: e.Stars}
		} else if !errors.Is(err, store.ErrNotFound) {
			s.internal(w, err)
			return
		}
		if resp["streak"], err = s.store.DailyStreak(r.Context(), me.ID, today); err != nil {
			s.internal(w, err)
			return
		}
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) solveDaily(w http.ResponseWriter, r *http.Request) {
	day, p, ok := s.dayParam(w, r)
	if !ok {
		return
	}
	// Kechagi masala ham qabul qilinadi: yarim tundan oldin oflayn yechilgan natija keyin yetib kelishi mumkin.
	today := s.today()
	if day < today-1 {
		writeErr(w, http.StatusConflict, "daily_closed")
		return
	}
	var req struct {
		Circuit sim.Circuit `json:"circuit"`
	}
	if !decode(w, r, &req) {
		return
	}
	gates, simErr, wrong := checkPuzzle(p, req.Circuit)
	if simErr != nil {
		writeJSON(w, http.StatusUnprocessableEntity, simErr)
		return
	}
	if wrong != nil {
		writeJSON(w, http.StatusUnprocessableEntity, wrong)
		return
	}
	if req.Circuit.Gates == nil {
		req.Circuit.Gates = []sim.Gate{}
	}
	if req.Circuit.Wires == nil {
		req.Circuit.Wires = []sim.Wire{}
	}
	circuit, _ := json.Marshal(req.Circuit)
	player := playerFrom(r)
	best, improved, err := s.store.SaveDaily(r.Context(), player.ID, day, store.Solution{
		Gates: gates, Stars: sim.Stars(p.Goal, gates), Circuit: string(circuit),
	})
	if err != nil {
		s.internal(w, err)
		return
	}
	solvers, bestGates, err := s.store.DailyStats(r.Context(), day)
	if err != nil {
		s.internal(w, err)
		return
	}
	streak, err := s.store.DailyStreak(r.Context(), player.ID, today)
	if err != nil {
		s.internal(w, err)
		return
	}
	// Mijoz seriyaga bugungi lokal natijani qo'shish kerakmi, shundan biladi.
	todaySolved := day == today
	if !todaySolved {
		if _, err := s.store.DailyRank(r.Context(), today, player.ID); err == nil {
			todaySolved = true
		} else if !errors.Is(err, store.ErrNotFound) {
			s.internal(w, err)
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":          true,
		"day":         day,
		"gates":       gates,
		"stars":       sim.Stars(p.Goal, gates),
		"improved":    improved,
		"best":        dailyMeJSON{Rank: best.Rank, Gates: best.Gates, Stars: best.Stars},
		"solvers":     solvers,
		"bestGates":   bestGates,
		"streak":      streak,
		"todaySolved": todaySolved,
	})
}

// archiveDays — arxiv ro'yxatidagi eng ko'p kun.
const archiveDays = 366

type archiveResultJSON struct {
	Gates int `json:"gates"`
	Stars int `json:"stars"`
}

type archiveDayJSON struct {
	Day       int                `json:"day"`
	Number    int                `json:"number"`
	Date      string             `json:"date"`
	Tier      int                `json:"tier"`
	Seq       bool               `json:"seq,omitempty"`
	Goal      int                `json:"goal"`
	Solvers   int                `json:"solvers"`
	BestGates int                `json:"bestGates"`
	Me        *archiveResultJSON `json:"me"`
	Open      bool               `json:"open,omitempty"`
}

// dailyArchive — o'tgan kunlar ro'yxati (yangisi birinchi): masala turi, statistika va o'yinchi natijasi.
func (s *Server) dailyArchive(w http.ResponseWriter, r *http.Request) {
	today := s.today()
	from := max(s.daily.FirstDay(), today-archiveDays)
	to := today - 1
	days := []archiveDayJSON{}
	if from <= to {
		stats, err := s.store.DailyStatsRange(r.Context(), from, to)
		if err != nil {
			s.internal(w, err)
			return
		}
		mine := map[int]store.Solution{}
		if me := s.optionalPlayer(r); me != nil {
			if mine, err = s.store.PlayerDailies(r.Context(), me.ID, from, to); err != nil {
				s.internal(w, err)
				return
			}
		}
		for day := to; day >= from; day-- {
			p, ok := s.daily.For(day)
			if !ok {
				continue
			}
			d := archiveDayJSON{
				Day: day, Number: s.daily.Number(day), Date: levels.DayStart(day).Format(time.DateOnly),
				Tier: p.Tier, Seq: p.Seq != nil, Goal: p.Goal,
				Solvers: stats[day].Solvers, BestGates: stats[day].BestGates, Open: day >= today-1,
			}
			if m, ok := mine[day]; ok {
				d.Me = &archiveResultJSON{Gates: m.Gates, Stars: m.Stars}
			}
			days = append(days, d)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"today": today, "days": days})
}

func (s *Server) dailyLeaderboard(w http.ResponseWriter, r *http.Request) {
	day, _, ok := s.dayParam(w, r)
	if !ok {
		return
	}
	top, err := s.store.DailyLeaderboard(r.Context(), day, dailyBoardSize)
	if err != nil {
		s.internal(w, err)
		return
	}
	me := s.optionalPlayer(r)
	out := make([]dailyEntryJSON, 0, len(top))
	for _, e := range top {
		out = append(out, dailyEntryJSON{Rank: e.Rank, Nickname: e.Nickname, Gates: e.Gates, Stars: e.Stars,
			Me: me != nil && e.PlayerID == me.ID})
	}
	resp := map[string]any{"day": day, "number": s.daily.Number(day), "top": out, "me": nil}
	if me != nil {
		if e, err := s.store.DailyRank(r.Context(), day, me.ID); err == nil {
			resp["me"] = dailyEntryJSON{Rank: e.Rank, Nickname: e.Nickname, Gates: e.Gates, Stars: e.Stars, Me: true}
		} else if !errors.Is(err, store.ErrNotFound) {
			s.internal(w, err)
			return
		}
	}
	writeJSON(w, http.StatusOK, resp)
}

// checkPuzzle — kunlik masala yechimini tekshiradi: oddiy kunda jadval, xotira kunida avtomat bilan.
// wrong — noto'g'ri javob tavsifi (xato qatorlar yoki eng qisqa qarshi misol).
func checkPuzzle(p *levels.Puzzle, c sim.Circuit) (gates int, simErr *sim.Error, wrong map[string]any) {
	spec := sim.Spec{Inputs: p.Inputs, Outputs: p.Outputs, Gates: p.Gates}
	if p.Seq != nil {
		var trace []int
		gates, trace, simErr = sim.CheckSeq(spec, sim.Machine{Next: p.Seq.Next, Out: p.Seq.Out}, c)
		if trace != nil {
			wrong = map[string]any{"error": "wrong_answer", "trace": trace}
		}
		return gates, simErr, wrong
	}
	var rows []int
	gates, rows, simErr = sim.Check(spec, p.Target, c)
	if len(rows) > 0 {
		wrong = map[string]any{"error": "wrong_answer", "wrongRows": rows}
	}
	return gates, simErr, wrong
}
