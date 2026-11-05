// Package store — SQLite ustidagi ma'lumotlar qatlami.
package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

var ErrNotFound = errors.New("topilmadi")

// migrations[i] bazani user_version=i dan i+1 ga o'tkazadi. Faqat oxiriga qo'shing.
var migrations = []string{
	`CREATE TABLE players (
		id           TEXT PRIMARY KEY,
		token_hash   BLOB NOT NULL UNIQUE,
		nickname     TEXT NOT NULL,
		created_at   INTEGER NOT NULL,
		last_seen_at INTEGER NOT NULL
	);
	CREATE TABLE solutions (
		player_id  TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
		level_id   TEXT NOT NULL,
		gate_count INTEGER NOT NULL,
		stars      INTEGER NOT NULL,
		circuit    TEXT NOT NULL,
		solved_at  INTEGER NOT NULL,
		PRIMARY KEY (player_id, level_id)
	) WITHOUT ROWID;
	CREATE INDEX solutions_level ON solutions(level_id, gate_count, solved_at);`,
}

type Store struct {
	db *sql.DB
}

type Player struct {
	ID        string
	Nickname  string
	CreatedAt time.Time
	LastSeen  time.Time
}

type Solution struct {
	LevelID  string
	Gates    int
	Stars    int
	Circuit  string // JSON
	SolvedAt time.Time
}

type Entry struct {
	Rank     int
	PlayerID string
	Nickname string
	Stars    int
	Solved   int
	Gates    int
}

type LevelStats struct {
	Solvers   int
	BestGates int // 0 — hali hech kim yechmagan
	BestBy    []string
}

func Open(path string) (*Store, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return nil, err
	}
	q := url.Values{}
	for _, p := range []string{
		"busy_timeout(5000)",
		"journal_mode(WAL)",
		"synchronous(NORMAL)",
		"foreign_keys(ON)",
		// Kesh hajmi ~2 MB: kichik VPS uchun yetarli.
		"cache_size(-2000)",
	} {
		q.Add("_pragma", p)
	}
	db, err := sql.Open("sqlite", "file:"+filepath.ToSlash(path)+"?"+q.Encode())
	if err != nil {
		return nil, err
	}
	// Bitta ulanish: yuk kichik, SQLITE_BUSY bo'lmaydi va xotira tejaladi.
	db.SetMaxOpenConns(1)
	s := &Store{db: db}
	if err := s.migrate(context.Background()); err != nil {
		db.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) migrate(ctx context.Context) error {
	var v int
	if err := s.db.QueryRowContext(ctx, `PRAGMA user_version`).Scan(&v); err != nil {
		return err
	}
	for i := v; i < len(migrations); i++ {
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, migrations[i]); err != nil {
			tx.Rollback()
			return fmt.Errorf("migratsiya %d: %w", i+1, err)
		}
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(`PRAGMA user_version = %d`, i+1)); err != nil {
			tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) CreatePlayer(ctx context.Context, id string, tokenHash []byte, nickname string) error {
	now := time.Now().Unix()
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO players (id, token_hash, nickname, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)`,
		id, tokenHash, nickname, now, now)
	return err
}

func (s *Store) PlayerByToken(ctx context.Context, tokenHash []byte) (*Player, error) {
	var p Player
	var created, seen int64
	err := s.db.QueryRowContext(ctx,
		`SELECT id, nickname, created_at, last_seen_at FROM players WHERE token_hash = ?`, tokenHash).
		Scan(&p.ID, &p.Nickname, &created, &seen)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	p.CreatedAt, p.LastSeen = time.Unix(created, 0), time.Unix(seen, 0)
	return &p, nil
}

// Touch last_seen_at ni yangilaydi, lekin soatiga ko'pi bilan bir marta (diskka kam yozish uchun).
func (s *Store) Touch(ctx context.Context, p *Player) error {
	if time.Since(p.LastSeen) < time.Hour {
		return nil
	}
	_, err := s.db.ExecContext(ctx, `UPDATE players SET last_seen_at = ? WHERE id = ?`, time.Now().Unix(), p.ID)
	return err
}

func (s *Store) SetNickname(ctx context.Context, id, nickname string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE players SET nickname = ? WHERE id = ?`, nickname, id)
	return err
}

func (s *Store) Progress(ctx context.Context, playerID string) ([]Solution, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT level_id, gate_count, stars, circuit, solved_at FROM solutions WHERE player_id = ?`, playerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Solution
	for rows.Next() {
		var sol Solution
		var at int64
		if err := rows.Scan(&sol.LevelID, &sol.Gates, &sol.Stars, &sol.Circuit, &at); err != nil {
			return nil, err
		}
		sol.SolvedAt = time.Unix(at, 0)
		out = append(out, sol)
	}
	return out, rows.Err()
}

// SaveSolution yechimni saqlaydi, agar u avvalgisidan yaxshiroq (kamroq element) bo'lsa.
// Saqlangandan keyingi eng yaxshi natijani va yaxshilanganmi ekanini qaytaradi.
func (s *Store) SaveSolution(ctx context.Context, playerID string, sol Solution) (best Solution, improved bool, err error) {
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO solutions (player_id, level_id, gate_count, stars, circuit, solved_at)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT (player_id, level_id) DO UPDATE SET
		   gate_count = excluded.gate_count, stars = excluded.stars,
		   circuit = excluded.circuit, solved_at = excluded.solved_at
		 WHERE excluded.gate_count < solutions.gate_count`,
		playerID, sol.LevelID, sol.Gates, sol.Stars, sol.Circuit, time.Now().Unix())
	if err != nil {
		return best, false, err
	}
	n, _ := res.RowsAffected()
	var at int64
	err = s.db.QueryRowContext(ctx,
		`SELECT level_id, gate_count, stars, solved_at FROM solutions WHERE player_id = ? AND level_id = ?`,
		playerID, sol.LevelID).Scan(&best.LevelID, &best.Gates, &best.Stars, &at)
	best.SolvedAt = time.Unix(at, 0)
	return best, n > 0, err
}

const rankedCTE = `WITH t AS (
	SELECT player_id, SUM(stars) AS stars, COUNT(*) AS solved, SUM(gate_count) AS gates, MAX(solved_at) AS last
	FROM solutions GROUP BY player_id
), r AS (
	SELECT player_id, stars, solved, gates,
	       ROW_NUMBER() OVER (ORDER BY stars DESC, solved DESC, gates ASC, last ASC) AS rank
	FROM t
)`

func (s *Store) Leaderboard(ctx context.Context, limit int) ([]Entry, error) {
	rows, err := s.db.QueryContext(ctx, rankedCTE+`
		SELECT r.rank, r.player_id, p.nickname, r.stars, r.solved, r.gates
		FROM r JOIN players p ON p.id = r.player_id
		ORDER BY r.rank LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Entry
	for rows.Next() {
		var e Entry
		if err := rows.Scan(&e.Rank, &e.PlayerID, &e.Nickname, &e.Stars, &e.Solved, &e.Gates); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (s *Store) Rank(ctx context.Context, playerID string) (*Entry, error) {
	var e Entry
	err := s.db.QueryRowContext(ctx, rankedCTE+`
		SELECT r.rank, r.player_id, p.nickname, r.stars, r.solved, r.gates
		FROM r JOIN players p ON p.id = r.player_id WHERE r.player_id = ?`, playerID).
		Scan(&e.Rank, &e.PlayerID, &e.Nickname, &e.Stars, &e.Solved, &e.Gates)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &e, err
}

func (s *Store) LevelStats(ctx context.Context, levelID string) (*LevelStats, error) {
	var st LevelStats
	var best sql.NullInt64
	err := s.db.QueryRowContext(ctx,
		`SELECT COUNT(*), MIN(gate_count) FROM solutions WHERE level_id = ?`, levelID).Scan(&st.Solvers, &best)
	if err != nil || !best.Valid {
		return &st, err
	}
	st.BestGates = int(best.Int64)
	rows, err := s.db.QueryContext(ctx,
		`SELECT p.nickname FROM solutions s JOIN players p ON p.id = s.player_id
		 WHERE s.level_id = ? AND s.gate_count = ? ORDER BY s.solved_at LIMIT 5`, levelID, st.BestGates)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			return nil, err
		}
		st.BestBy = append(st.BestBy, n)
	}
	return &st, rows.Err()
}

// Backup bazaning izchil nusxasini dest fayliga yozadi (VACUUM INTO).
func (s *Store) Backup(ctx context.Context, dest string) error {
	if _, err := os.Stat(dest); err == nil {
		return fmt.Errorf("%s allaqachon mavjud", dest)
	}
	_, err := s.db.ExecContext(ctx, `VACUUM INTO ?`, dest)
	return err
}
