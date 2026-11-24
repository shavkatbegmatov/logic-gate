package store

import (
	"cmp"
	"context"
	"database/sql"
	"errors"
	"slices"
	"strings"
	"time"
)

// ErrContestActive — sinfda musobaqa davom etmoqda (bir vaqtda bittadan ortiq bo'lmaydi).
var ErrContestActive = errors.New("contest_active")

// Contest — sinf musobaqasi: darajalar ro'yxati va vaqti (StartsAt ≤ hozir < EndsAt — davom etmoqda).
type Contest struct {
	ID       int64
	ClassID  string
	Title    string
	Levels   []string
	StartsAt time.Time
	EndsAt   time.Time
}

// Active — musobaqa shu paytda davom etmoqdami.
func (c *Contest) Active(now time.Time) bool { return !now.Before(c.StartsAt) && now.Before(c.EndsAt) }

// Has — daraja musobaqadami.
func (c *Contest) Has(level string) bool { return slices.Contains(c.Levels, level) }

// ContestEntry — musobaqa reytingi qatori: darajalar bo'yicha yulduzlar (faqat musobaqa vaqtidagi yechimlar).
type ContestEntry struct {
	Rank     int
	PlayerID string
	Nickname string
	Stars    int
	Solved   int
	Levels   map[string]int // daraja → yulduzlar
	Last     time.Time      // eng yaxshi natijalarning oxirgisi (tenglikda avvalroq tugatgan yuqorida)
}

// CreateContest yangi musobaqani yozadi (davom etayotgani bo'lsa — ErrContestActive) va c.ID ni to'ldiradi.
// Sinfda eng ko'pi bilan keep ta musobaqa saqlanadi — eskilari (natijalari bilan) o'chadi.
func (s *Store) CreateContest(ctx context.Context, c *Contest, keep int) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var active int
	if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM class_contests WHERE class_id = ? AND starts_at <= ? AND ends_at > ?`,
		c.ClassID, c.StartsAt.Unix(), c.StartsAt.Unix()).Scan(&active); err != nil {
		return err
	}
	if active > 0 {
		return ErrContestActive
	}
	res, err := tx.ExecContext(ctx, `INSERT INTO class_contests (class_id, title, levels, starts_at, ends_at) VALUES (?, ?, ?, ?, ?)`,
		c.ClassID, c.Title, strings.Join(c.Levels, ","), c.StartsAt.Unix(), c.EndsAt.Unix())
	if err != nil {
		return err
	}
	if c.ID, err = res.LastInsertId(); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM class_contests WHERE class_id = ? AND id NOT IN (
		SELECT id FROM class_contests WHERE class_id = ? ORDER BY id DESC LIMIT ?)`, c.ClassID, c.ClassID, keep); err != nil {
		return err
	}
	return tx.Commit()
}

const contestColumns = `id, class_id, title, levels, starts_at, ends_at`

func scanContest(row interface{ Scan(...any) error }) (*Contest, error) {
	var c Contest
	var lv string
	var start, end int64
	err := row.Scan(&c.ID, &c.ClassID, &c.Title, &lv, &start, &end)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	c.Levels, c.StartsAt, c.EndsAt = strings.Split(lv, ","), time.Unix(start, 0), time.Unix(end, 0)
	return &c, nil
}

// LatestContest — sinfning oxirgi musobaqasi (davom etayotgan yoki tugagan); yo'q bo'lsa ErrNotFound.
func (s *Store) LatestContest(ctx context.Context, classID string) (*Contest, error) {
	return scanContest(s.db.QueryRowContext(ctx,
		`SELECT `+contestColumns+` FROM class_contests WHERE class_id = ? ORDER BY id DESC LIMIT 1`, classID))
}

// ContestByID — shu sinfdagi musobaqa; yo'q bo'lsa ErrNotFound.
func (s *Store) ContestByID(ctx context.Context, classID string, id int64) (*Contest, error) {
	return scanContest(s.db.QueryRowContext(ctx,
		`SELECT `+contestColumns+` FROM class_contests WHERE class_id = ? AND id = ?`, classID, id))
}

// StopContest davom etayotgan musobaqani hozir tugatadi (tugagan bo'lsa — o'zgarmaydi).
func (s *Store) StopContest(ctx context.Context, classID string, id int64, now time.Time) error {
	_, err := s.db.ExecContext(ctx, `UPDATE class_contests SET ends_at = ? WHERE class_id = ? AND id = ? AND ends_at > ?`,
		now.Unix(), classID, id, now.Unix())
	return err
}

// SaveContestSolve musobaqadagi yechimni yozadi, agar u o'yinchining shu darajadagi avvalgisidan yaxshiroq
// (kamroq element) bo'lsa. improved — yozildimi.
func (s *Store) SaveContestSolve(ctx context.Context, contestID int64, playerID, levelID string, gates, stars int, at time.Time) (bool, error) {
	res, err := s.db.ExecContext(ctx, `
		INSERT INTO contest_solves (contest_id, player_id, level_id, gates, stars, solved_at) VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT (contest_id, player_id, level_id) DO UPDATE SET
			gates = excluded.gates, stars = excluded.stars, solved_at = excluded.solved_at
		WHERE excluded.gates < contest_solves.gates`, contestID, playerID, levelID, gates, stars, at.Unix())
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	return n > 0, err
}

// ContestBoard — musobaqa reytingi: sinfning hamma a'zolari (hech narsa yechmaganlar oxirida). Tartib: ko'p
// yulduz, keyin ko'p daraja, keyin avvalroq erishgan; hamma ko'rsatkichi teng bo'lganlar bir o'rinda.
func (s *Store) ContestBoard(ctx context.Context, c *Contest) ([]ContestEntry, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT p.id, p.nickname FROM class_members m JOIN players p ON p.id = m.player_id
		WHERE m.class_id = ?`, c.ClassID)
	if err != nil {
		return nil, err
	}
	var out []ContestEntry
	index := map[string]int{}
	for rows.Next() {
		e := ContestEntry{Levels: map[string]int{}}
		if err := rows.Scan(&e.PlayerID, &e.Nickname); err != nil {
			rows.Close()
			return nil, err
		}
		index[e.PlayerID] = len(out)
		out = append(out, e)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	sols, err := s.db.QueryContext(ctx, `SELECT player_id, level_id, stars, solved_at FROM contest_solves WHERE contest_id = ?`, c.ID)
	if err != nil {
		return nil, err
	}
	defer sols.Close()
	for sols.Next() {
		var pid, level string
		var stars int
		var at int64
		if err := sols.Scan(&pid, &level, &stars, &at); err != nil {
			return nil, err
		}
		i, ok := index[pid]
		if !ok || !c.Has(level) {
			continue
		}
		e := &out[i]
		e.Levels[level] = stars
		e.Stars += stars
		e.Solved++
		if t := time.Unix(at, 0); t.After(e.Last) {
			e.Last = t
		}
	}
	if err := sols.Err(); err != nil {
		return nil, err
	}
	key := func(e ContestEntry) int64 {
		if e.Solved == 0 {
			return 1<<62 - 1
		}
		return e.Last.Unix()
	}
	slices.SortFunc(out, func(a, b ContestEntry) int {
		return cmp.Or(cmp.Compare(b.Stars, a.Stars), cmp.Compare(b.Solved, a.Solved), cmp.Compare(key(a), key(b)),
			strings.Compare(strings.ToLower(a.Nickname), strings.ToLower(b.Nickname)), strings.Compare(a.PlayerID, b.PlayerID))
	})
	for i := range out {
		out[i].Rank = i + 1
		if i > 0 && out[i].Stars == out[i-1].Stars && out[i].Solved == out[i-1].Solved && key(out[i]) == key(out[i-1]) {
			out[i].Rank = out[i-1].Rank
		}
	}
	return out, nil
}
