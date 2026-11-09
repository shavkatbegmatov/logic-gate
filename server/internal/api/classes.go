package api

import (
	"crypto/rand"
	"crypto/subtle"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"logicgate/levels"
	"logicgate/server/internal/nickname"
	"logicgate/server/internal/store"
)

// Sinf rejimi: o'qituvchi sinf yaratadi va ikki narsa oladi —
//   - qo'shilish kodi (6 belgi, ochiq): o'quvchilarga havola qilib beriladi;
//   - o'qituvchi kaliti (tiklash kodi kabi 16 belgi, maxfiy): hisobot va boshqaruv uchun,
//     X-Class-Key sarlavhasida yuboriladi; serverda faqat xeshi saqlanadi.
// O'quvchi o'z profili (taxallusi) bilan qo'shiladi; sinfdoshlar bir-birining taxallusi va
// yulduzlarini ko'radi, o'qituvchi esa har bir darajani va kunlik masalalarni.

const (
	classCodeLen  = 6
	maxMembers    = 200
	keyHeader     = "X-Class-Key"
	maxTasks      = 20  // sinfdagi vazifalar
	maxTaskLevels = 12  // bitta vazifadagi darajalar
	maxDueDays    = 366 // muddat bugundan ko'pi bilan shuncha kun keyin
)

func newClassCode() string {
	var b [classCodeLen]byte
	rand.Read(b[:])
	out := make([]byte, classCodeLen)
	for i, x := range b {
		out[i] = codeAlphabet[int(x)%len(codeAlphabet)]
	}
	return string(out)
}

// normalizeClassCode — kiritilgan kod (kichik harf, bo'shliq, O/I/L bilan) → kanonik; noto'g'ri bo'lsa "".
func normalizeClassCode(s string) string {
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
	if sb.Len() != classCodeLen {
		return ""
	}
	return sb.String()
}

var (
	errBadClassName = errors.New("bad_class_name")
	errBadTask      = errors.New("bad_task")
)

// cleanClassName: 2–50 belgi, harf, raqam va oddiy tinish belgilari; haqoratli so'zlarsiz.
func cleanClassName(s string) (string, error) { return cleanText(s, 2, 50, errBadClassName) }

// cleanText — bo'shliqlarni bittaga keltiradi va uzunlik, belgilar, haqoratli so'zlarni tekshiradi.
func cleanText(s string, min, max int, bad error) (string, error) {
	s = strings.Join(strings.Fields(s), " ")
	if n := utf8.RuneCountInString(s); n < min || n > max {
		return "", bad
	}
	for _, r := range s {
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) && !strings.ContainsRune(" _-.,:!?'ʻʼ`№#()/«»\"", r) {
			return "", bad
		}
	}
	if s != "" && nickname.Offensive(s) {
		return "", nickname.ErrNotAllowed
	}
	return s, nil
}

type classJSON struct {
	Code    string     `json:"code"`
	Name    string     `json:"name"`
	Members int        `json:"members"`
	Member  bool       `json:"member,omitempty"`
	Key     string     `json:"key,omitempty"`
	Tasks   []taskJSON `json:"tasks,omitempty"`
}

type taskJSON struct {
	ID        int64    `json:"id"`
	Title     string   `json:"title"`
	Levels    []string `json:"levels"`
	Due       int      `json:"due,omitempty"`
	CreatedAt int64    `json:"createdAt"`
}

func toTaskJSON(t store.ClassTask) taskJSON {
	return taskJSON{ID: t.ID, Title: t.Title, Levels: t.Levels, Due: t.Due, CreatedAt: t.CreatedAt.Unix()}
}

// classTasks — sinf vazifalari JSON ko'rinishida (bo'lmasa — bo'sh ro'yxat).
func (s *Server) classTasks(r *http.Request, classID string) ([]taskJSON, error) {
	list, err := s.store.ClassTasks(r.Context(), classID)
	out := make([]taskJSON, 0, len(list))
	for _, t := range list {
		out = append(out, toTaskJSON(t))
	}
	return out, err
}

func (s *Server) createClass(w http.ResponseWriter, r *http.Request) {
	if !s.classes.allow(s.clientIP(r)) {
		writeErr(w, http.StatusTooManyRequests, "rate_limited")
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if !decode(w, r, &req) {
		return
	}
	name, err := cleanClassName(req.Name)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	key := newCode()
	// Kod to'qnashuvi juda kam (32⁶ ≈ 10⁹), lekin bo'lsa — yangisi.
	for range 5 {
		code := newClassCode()
		if err = s.store.CreateClass(r.Context(), code, name, hashCode(normalizeCode(key))); err == nil {
			writeJSON(w, http.StatusCreated, classJSON{Code: code, Name: name, Key: key})
			return
		}
	}
	s.internal(w, err)
}

// classFrom — {code} bo'yicha sinf; topilmasa javob yoziladi va nil qaytadi.
func (s *Server) classFrom(w http.ResponseWriter, r *http.Request) *store.Class {
	code := normalizeClassCode(r.PathValue("code"))
	if code == "" {
		writeErr(w, http.StatusNotFound, "no_class")
		return nil
	}
	c, err := s.store.ClassByID(r.Context(), code)
	if errors.Is(err, store.ErrNotFound) {
		// Sinf kodlarini terib topishga urinishlarni sekinlashtirish (to'g'ri kod cheklovni sarflamaydi).
		if !s.auth.allow(s.clientIP(r)) {
			writeErr(w, http.StatusTooManyRequests, "rate_limited")
			return nil
		}
		writeErr(w, http.StatusNotFound, "no_class")
		return nil
	}
	if err != nil {
		s.internal(w, err)
		return nil
	}
	return c
}

// teacherClass — sinf va o'qituvchi kaliti tekshiruvi.
func (s *Server) teacherClass(w http.ResponseWriter, r *http.Request) *store.Class {
	c := s.classFrom(w, r)
	if c == nil {
		return nil
	}
	key := normalizeCode(r.Header.Get(keyHeader))
	if key == "" || subtle.ConstantTimeCompare(hashCode(key), c.KeyHash) != 1 {
		if !s.auth.allow(s.clientIP(r)) {
			writeErr(w, http.StatusTooManyRequests, "rate_limited")
			return nil
		}
		writeErr(w, http.StatusForbidden, "bad_key")
		return nil
	}
	return c
}

func (s *Server) getClass(w http.ResponseWriter, r *http.Request) {
	c := s.classFrom(w, r)
	if c == nil {
		return
	}
	tasks, err := s.classTasks(r, c.ID)
	if err != nil {
		s.internal(w, err)
		return
	}
	out := classJSON{Code: c.ID, Name: c.Name, Members: c.Members, Tasks: tasks}
	if p := s.optionalPlayer(r); p != nil {
		member, err := s.store.IsClassMember(r.Context(), c.ID, p.ID)
		if err != nil {
			s.internal(w, err)
			return
		}
		out.Member = member
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) joinClass(w http.ResponseWriter, r *http.Request) {
	c := s.classFrom(w, r)
	if c == nil {
		return
	}
	p := playerFrom(r)
	switch err := s.store.JoinClass(r.Context(), c.ID, p.ID, maxMembers); {
	case errors.Is(err, store.ErrClassFull):
		writeErr(w, http.StatusConflict, "class_full")
		return
	case err != nil:
		s.internal(w, err)
		return
	}
	c, err := s.store.ClassByID(r.Context(), c.ID)
	if err != nil {
		s.internal(w, err)
		return
	}
	writeJSON(w, http.StatusOK, classJSON{Code: c.ID, Name: c.Name, Members: c.Members, Member: true})
}

func (s *Server) leaveClass(w http.ResponseWriter, r *http.Request) {
	c := s.classFrom(w, r)
	if c == nil {
		return
	}
	if err := s.store.LeaveClass(r.Context(), c.ID, playerFrom(r).ID); err != nil {
		s.internal(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) myClasses(w http.ResponseWriter, r *http.Request) {
	list, err := s.store.PlayerClasses(r.Context(), playerFrom(r).ID)
	if err != nil {
		s.internal(w, err)
		return
	}
	out := make([]classJSON, 0, len(list))
	for _, c := range list {
		tasks, err := s.classTasks(r, c.ID)
		if err != nil {
			s.internal(w, err)
			return
		}
		out = append(out, classJSON{Code: c.ID, Name: c.Name, Members: c.Members, Member: true, Tasks: tasks})
	}
	writeJSON(w, http.StatusOK, map[string]any{"classes": out})
}

type classEntryJSON struct {
	Rank     int    `json:"rank"`
	Nickname string `json:"nickname"`
	Stars    int    `json:"stars"`
	Solved   int    `json:"solved"`
	Me       bool   `json:"me,omitempty"`
}

// classBoard — sinf ichidagi reyting: faqat a'zolar ko'radi.
func (s *Server) classBoard(w http.ResponseWriter, r *http.Request) {
	c := s.classFrom(w, r)
	if c == nil {
		return
	}
	p := playerFrom(r)
	member, err := s.store.IsClassMember(r.Context(), c.ID, p.ID)
	if err != nil {
		s.internal(w, err)
		return
	}
	if !member {
		writeErr(w, http.StatusForbidden, "not_member")
		return
	}
	rows, err := s.store.ClassBoard(r.Context(), c.ID)
	if err != nil {
		s.internal(w, err)
		return
	}
	top := make([]classEntryJSON, 0, len(rows))
	for _, e := range rows {
		top = append(top, classEntryJSON{Rank: e.Rank, Nickname: e.Nickname, Stars: e.Stars, Solved: e.Solved, Me: e.PlayerID == p.ID})
	}
	writeJSON(w, http.StatusOK, map[string]any{"code": c.ID, "name": c.Name, "top": top})
}

type memberJSON struct {
	ID         string         `json:"id"`
	Nickname   string         `json:"nickname"`
	JoinedAt   int64          `json:"joinedAt"`
	LastSeen   int64          `json:"lastSeen"`
	Levels     map[string]int `json:"levels"`
	DailyToday int            `json:"dailyToday"`
	DailyWeek  int            `json:"dailyWeek"`
}

// classReport — o'qituvchi hisoboti: har bir o'quvchi bo'yicha darajalar va kunlik masalalar.
func (s *Server) classReport(w http.ResponseWriter, r *http.Request) {
	c := s.teacherClass(w, r)
	if c == nil {
		return
	}
	today := levels.DayOf(s.now())
	list, err := s.store.ClassReport(r.Context(), c.ID, today)
	if err != nil {
		s.internal(w, err)
		return
	}
	tasks, err := s.classTasks(r, c.ID)
	if err != nil {
		s.internal(w, err)
		return
	}
	members := make([]memberJSON, 0, len(list))
	for _, m := range list {
		members = append(members, memberJSON{
			ID: m.PlayerID, Nickname: m.Nickname, JoinedAt: m.JoinedAt.Unix(), LastSeen: m.LastSeen.Unix(),
			Levels: m.Levels, DailyToday: m.DailyToday, DailyWeek: m.DailyWeek,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"code": c.ID, "name": c.Name, "createdAt": c.CreatedAt.Unix(), "today": today,
		"now": s.now().Unix(), "members": members, "tasks": tasks,
	})
}

// removeMember — o'qituvchi o'quvchini sinfdan chiqaradi.
func (s *Server) removeMember(w http.ResponseWriter, r *http.Request) {
	c := s.teacherClass(w, r)
	if c == nil {
		return
	}
	if err := s.store.LeaveClass(r.Context(), c.ID, r.PathValue("id")); err != nil {
		s.internal(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// deleteClass — o'qituvchi sinfni o'chiradi (a'zoliklar ham, o'quvchilarning natijalari qoladi).
func (s *Server) deleteClass(w http.ResponseWriter, r *http.Request) {
	c := s.teacherClass(w, r)
	if c == nil {
		return
	}
	if err := s.store.DeleteClass(r.Context(), c.ID); err != nil {
		s.internal(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// createTask — o'qituvchi vazifa beradi: {title, levels, due}. Darajalar o'yindagi tartibda saqlanadi.
func (s *Server) createTask(w http.ResponseWriter, r *http.Request) {
	c := s.teacherClass(w, r)
	if c == nil {
		return
	}
	var req struct {
		Title  string   `json:"title"`
		Levels []string `json:"levels"`
		Due    int      `json:"due"`
	}
	if !decode(w, r, &req) {
		return
	}
	title, err := cleanText(req.Title, 0, 60, errBadTask)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	want := map[string]bool{}
	for _, id := range req.Levels {
		if _, ok := s.pack.Level(id); !ok {
			writeErr(w, http.StatusBadRequest, errBadTask.Error())
			return
		}
		want[id] = true
	}
	var ids []string
	for _, l := range s.pack.Levels {
		if want[l.ID] {
			ids = append(ids, l.ID)
		}
	}
	if len(ids) == 0 || len(ids) > maxTaskLevels {
		writeErr(w, http.StatusBadRequest, errBadTask.Error())
		return
	}
	today := levels.DayOf(s.now())
	if req.Due != 0 && (req.Due < today || req.Due > today+maxDueDays) {
		writeErr(w, http.StatusBadRequest, "bad_due")
		return
	}
	t := store.ClassTask{ClassID: c.ID, Title: title, Levels: ids, Due: req.Due}
	switch err := s.store.CreateTask(r.Context(), &t, maxTasks); {
	case errors.Is(err, store.ErrTooManyTasks):
		writeErr(w, http.StatusConflict, err.Error())
		return
	case err != nil:
		s.internal(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, toTaskJSON(t))
}

// deleteTask — o'qituvchi vazifani o'chiradi (o'quvchilarning yechimlari qoladi).
func (s *Server) deleteTask(w http.ResponseWriter, r *http.Request) {
	c := s.teacherClass(w, r)
	if c == nil {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err == nil {
		err = s.store.DeleteTask(r.Context(), c.ID, id)
	}
	if err != nil {
		if errors.Is(err, store.ErrNotFound) || errors.Is(err, strconv.ErrSyntax) || errors.Is(err, strconv.ErrRange) {
			writeErr(w, http.StatusNotFound, "no_task")
			return
		}
		s.internal(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
