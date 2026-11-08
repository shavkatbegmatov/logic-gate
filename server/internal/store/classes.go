package store

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

// ErrClassFull — sinfda o'rin qolmagan.
var ErrClassFull = errors.New("class_full")

// Class — o'qituvchi yaratgan sinf. ID — ochiq qo'shilish kodi.
type Class struct {
	ID        string
	Name      string
	KeyHash   []byte
	CreatedAt time.Time
	Members   int
}

// ClassEntry — sinf ichidagi reyting qatori (o'quvchilar ko'radi).
type ClassEntry struct {
	Rank     int
	PlayerID string
	Nickname string
	Stars    int
	Solved   int
}

// ClassMember — o'qituvchi hisobotidagi o'quvchi.
type ClassMember struct {
	PlayerID   string
	Nickname   string
	JoinedAt   time.Time
	LastSeen   time.Time
	Levels     map[string]int // daraja → yulduzlar
	DailyToday int            // bugungi kunlik masala yulduzlari (0 — yechilmagan)
	DailyWeek  int            // oxirgi 7 kunda yechilgan kunlik masalalar
}

func (s *Store) CreateClass(ctx context.Context, id, name string, keyHash []byte) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO classes (id, name, key_hash, created_at) VALUES (?, ?, ?, ?)`, id, name, keyHash, time.Now().Unix())
	return err
}

func (s *Store) ClassByID(ctx context.Context, id string) (*Class, error) {
	var c Class
	var created int64
	err := s.db.QueryRowContext(ctx, `SELECT c.id, c.name, c.key_hash, c.created_at,
		(SELECT COUNT(*) FROM class_members m WHERE m.class_id = c.id)
		FROM classes c WHERE c.id = ?`, id).Scan(&c.ID, &c.Name, &c.KeyHash, &created, &c.Members)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	c.CreatedAt = time.Unix(created, 0)
	return &c, nil
}

// JoinClass o'quvchini sinfga qo'shadi (allaqachon a'zo bo'lsa — hech narsa o'zgarmaydi).
func (s *Store) JoinClass(ctx context.Context, classID, playerID string, max int) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var member, count int
	if err := tx.QueryRowContext(ctx, `SELECT
		(SELECT COUNT(*) FROM class_members WHERE class_id = ? AND player_id = ?),
		(SELECT COUNT(*) FROM class_members WHERE class_id = ?)`, classID, playerID, classID).Scan(&member, &count); err != nil {
		return err
	}
	if member > 0 {
		return nil
	}
	if count >= max {
		return ErrClassFull
	}
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO class_members (class_id, player_id, joined_at) VALUES (?, ?, ?)`, classID, playerID, time.Now().Unix()); err != nil {
		return err
	}
	return tx.Commit()
}

// DeleteClass sinfni o'chiradi (a'zoliklar CASCADE bilan; o'quvchilarning natijalari qoladi).
func (s *Store) DeleteClass(ctx context.Context, classID string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM classes WHERE id = ?`, classID)
	return err
}

func (s *Store) LeaveClass(ctx context.Context, classID, playerID string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM class_members WHERE class_id = ? AND player_id = ?`, classID, playerID)
	return err
}

func (s *Store) IsClassMember(ctx context.Context, classID, playerID string) (bool, error) {
	var n int
	err := s.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM class_members WHERE class_id = ? AND player_id = ?`, classID, playerID).Scan(&n)
	return n > 0, err
}

// PlayerClasses — o'yinchi a'zo bo'lgan sinflar (qo'shilgan vaqti bo'yicha).
func (s *Store) PlayerClasses(ctx context.Context, playerID string) ([]Class, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT c.id, c.name, c.created_at,
		(SELECT COUNT(*) FROM class_members x WHERE x.class_id = c.id)
		FROM class_members m JOIN classes c ON c.id = m.class_id
		WHERE m.player_id = ? ORDER BY m.joined_at`, playerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Class
	for rows.Next() {
		var c Class
		var created int64
		if err := rows.Scan(&c.ID, &c.Name, &created, &c.Members); err != nil {
			return nil, err
		}
		c.CreatedAt = time.Unix(created, 0)
		out = append(out, c)
	}
	return out, rows.Err()
}

// ClassBoard — sinf a'zolari reytingi: hali hech narsa yechmaganlar ham (oxirida).
func (s *Store) ClassBoard(ctx context.Context, classID string) ([]ClassEntry, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT p.id, p.nickname, COALESCE(SUM(sol.stars), 0) AS stars, COUNT(sol.level_id) AS solved
		FROM class_members m
		JOIN players p ON p.id = m.player_id
		LEFT JOIN solutions sol ON sol.player_id = m.player_id
		WHERE m.class_id = ?
		GROUP BY p.id
		ORDER BY stars DESC, solved DESC, MIN(m.joined_at), p.id`, classID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ClassEntry
	for rows.Next() {
		var e ClassEntry
		if err := rows.Scan(&e.PlayerID, &e.Nickname, &e.Stars, &e.Solved); err != nil {
			return nil, err
		}
		e.Rank = len(out) + 1
		out = append(out, e)
	}
	return out, rows.Err()
}

// ClassReport — o'qituvchi uchun: har bir o'quvchining darajalari va kunlik masalalari
// (taxallus bo'yicha alifbo tartibida).
func (s *Store) ClassReport(ctx context.Context, classID string, today int) ([]ClassMember, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT p.id, p.nickname, m.joined_at, p.last_seen_at,
			COALESCE((SELECT stars FROM daily_solutions d WHERE d.player_id = p.id AND d.day = ?), 0),
			(SELECT COUNT(*) FROM daily_solutions d WHERE d.player_id = p.id AND d.day > ? AND d.day <= ?)
		FROM class_members m JOIN players p ON p.id = m.player_id
		WHERE m.class_id = ? ORDER BY p.nickname COLLATE NOCASE, p.id`, today, today-7, today, classID)
	if err != nil {
		return nil, err
	}
	var out []ClassMember
	index := map[string]int{}
	for rows.Next() {
		var c ClassMember
		var joined, seen int64
		if err := rows.Scan(&c.PlayerID, &c.Nickname, &joined, &seen, &c.DailyToday, &c.DailyWeek); err != nil {
			rows.Close()
			return nil, err
		}
		c.JoinedAt, c.LastSeen, c.Levels = time.Unix(joined, 0), time.Unix(seen, 0), map[string]int{}
		index[c.PlayerID] = len(out)
		out = append(out, c)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	sols, err := s.db.QueryContext(ctx, `
		SELECT sol.player_id, sol.level_id, sol.stars FROM solutions sol
		JOIN class_members m ON m.player_id = sol.player_id WHERE m.class_id = ?`, classID)
	if err != nil {
		return nil, err
	}
	defer sols.Close()
	for sols.Next() {
		var pid, level string
		var stars int
		if err := sols.Scan(&pid, &level, &stars); err != nil {
			return nil, err
		}
		if i, ok := index[pid]; ok {
			out[i].Levels[level] = stars
		}
	}
	return out, sols.Err()
}
