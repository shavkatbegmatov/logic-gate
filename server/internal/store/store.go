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
	"strings"
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
	// Kunlik boshqotirma: day — Toshkent vaqti bo'yicha 1970-01-01 dan beri kunlar.
	`CREATE TABLE daily_solutions (
		day        INTEGER NOT NULL,
		player_id  TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
		gate_count INTEGER NOT NULL,
		stars      INTEGER NOT NULL,
		circuit    TEXT NOT NULL,
		solved_at  INTEGER NOT NULL,
		PRIMARY KEY (day, player_id)
	) WITHOUT ROWID;
	CREATE INDEX daily_rank ON daily_solutions(day, gate_count, solved_at);
	CREATE INDEX daily_player ON daily_solutions(player_id, day);`,
	// Telegram bot: shaxsiy chatlar (chat_id = foydalanuvchi id) va kalit-qiymat yozuvlari.
	`CREATE TABLE tg_chats (
		chat_id    INTEGER PRIMARY KEY,
		lang       TEXT NOT NULL DEFAULT 'uz',
		remind     INTEGER NOT NULL DEFAULT 0,
		player_id  TEXT REFERENCES players(id) ON DELETE SET NULL,
		blocked    INTEGER NOT NULL DEFAULT 0,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	);
	CREATE INDEX tg_chats_remind ON tg_chats(remind, blocked);
	CREATE TABLE meta (
		key   TEXT PRIMARY KEY,
		value TEXT NOT NULL
	) WITHOUT ROWID;`,
	// Sinflar: o'qituvchi sinf yaratadi (id — ochiq qo'shilish kodi, key_hash — o'qituvchi kalitining
	// xeshi), o'quvchilar o'z profili bilan qo'shiladi.
	`CREATE TABLE classes (
		id         TEXT PRIMARY KEY,
		name       TEXT NOT NULL,
		key_hash   BLOB NOT NULL,
		created_at INTEGER NOT NULL
	);
	CREATE TABLE class_members (
		class_id  TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
		player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
		joined_at INTEGER NOT NULL,
		PRIMARY KEY (class_id, player_id)
	) WITHOUT ROWID;
	CREATE INDEX class_members_player ON class_members(player_id);`,
	// Sinf vazifalari: o'qituvchi bir nechta darajani beradi; due — Toshkent kuni (0 — muddatsiz).
	`CREATE TABLE class_tasks (
		id         INTEGER PRIMARY KEY,
		class_id   TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
		title      TEXT NOT NULL,
		levels     TEXT NOT NULL,
		due        INTEGER NOT NULL DEFAULT 0,
		created_at INTEGER NOT NULL
	);
	CREATE INDEX class_tasks_class ON class_tasks(class_id);`,
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
	Spread    []GateCount
}

// GateCount — eng yaxshi yechimida Gates ta element ishlatgan o'yinchilar soni.
type GateCount struct {
	Gates int
	Count int
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

// Ranking — reytingdagi barcha o'yinchilar, o'rni bo'yicha (SQLite'da LIMIT -1 — cheklovsiz). API uni
// keshlaydi: bitta hisoblashdan ham yuqori qism, ham har bir o'yinchining o'rni olinadi.
func (s *Store) Ranking(ctx context.Context) ([]Entry, error) { return s.Leaderboard(ctx, -1) }

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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	st.Spread, err = s.spread(ctx,
		`SELECT gate_count, COUNT(*) FROM solutions WHERE level_id = ? GROUP BY gate_count ORDER BY gate_count`, levelID)
	if err != nil {
		return nil, err
	}
	return &st, nil
}

// DailySpread — kun masalasi yechimlarining element soni bo'yicha taqsimoti.
func (s *Store) DailySpread(ctx context.Context, day int) ([]GateCount, error) {
	return s.spread(ctx,
		`SELECT gate_count, COUNT(*) FROM daily_solutions WHERE day = ? GROUP BY gate_count ORDER BY gate_count`, day)
}

// spread — (element soni, o'yinchilar) juftliklari, element soni o'sib borishi tartibida.
func (s *Store) spread(ctx context.Context, query string, arg any) ([]GateCount, error) {
	rows, err := s.db.QueryContext(ctx, query, arg)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []GateCount
	for rows.Next() {
		var g GateCount
		if err := rows.Scan(&g.Gates, &g.Count); err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

type PlayerRow struct {
	ID       string
	Nickname string
	Stars    int
	Solved   int
	Created  time.Time
}

// ListPlayers taxallusida query bor o'yinchilarni (bo'sh bo'lsa — hammasini) yulduzlar bo'yicha qaytaradi.
func (s *Store) ListPlayers(ctx context.Context, query string, limit int) ([]PlayerRow, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT p.id, p.nickname, COALESCE(SUM(s.stars), 0), COUNT(s.level_id), p.created_at
		 FROM players p LEFT JOIN solutions s ON s.player_id = p.id
		 WHERE p.nickname LIKE '%' || ? || '%' ESCAPE '\'
		 GROUP BY p.id ORDER BY 3 DESC, p.created_at LIMIT ?`,
		strings.NewReplacer(`\`, `\\`, "%", `\%`, "_", `\_`).Replace(query), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []PlayerRow
	for rows.Next() {
		var r PlayerRow
		var created int64
		if err := rows.Scan(&r.ID, &r.Nickname, &r.Stars, &r.Solved, &created); err != nil {
			return nil, err
		}
		r.Created = time.Unix(created, 0)
		out = append(out, r)
	}
	return out, rows.Err()
}

// RenamePlayer id bo'yicha taxallusni o'zgartiradi; o'yinchi topilmasa ErrNotFound.
func (s *Store) RenamePlayer(ctx context.Context, id, nickname string) error {
	res, err := s.db.ExecContext(ctx, `UPDATE players SET nickname = ? WHERE id = ?`, nickname, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// Backup bazaning izchil nusxasini dest fayliga yozadi (VACUUM INTO).
func (s *Store) Backup(ctx context.Context, dest string) error {
	if _, err := os.Stat(dest); err == nil {
		return fmt.Errorf("%s allaqachon mavjud", dest)
	}
	_, err := s.db.ExecContext(ctx, `VACUUM INTO ?`, dest)
	return err
}

// ── Kunlik boshqotirma ─────────────────────────────────────────

type DailyEntry struct {
	Rank     int
	PlayerID string
	Nickname string
	Gates    int
	Stars    int
	SolvedAt time.Time
}

// SaveDaily kunlik yechimni saqlaydi, agar u avvalgisidan kamroq elementli bo'lsa.
// Teng natijalarda vaqt saqlanib qoladi: reytingda birinchi topgan yuqorida turadi.
func (s *Store) SaveDaily(ctx context.Context, playerID string, day int, sol Solution) (best DailyEntry, improved bool, err error) {
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO daily_solutions (day, player_id, gate_count, stars, circuit, solved_at)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT (day, player_id) DO UPDATE SET
		   gate_count = excluded.gate_count, stars = excluded.stars,
		   circuit = excluded.circuit, solved_at = excluded.solved_at
		 WHERE excluded.gate_count < daily_solutions.gate_count`,
		day, playerID, sol.Gates, sol.Stars, sol.Circuit, time.Now().Unix())
	if err != nil {
		return best, false, err
	}
	n, _ := res.RowsAffected()
	e, err := s.DailyRank(ctx, day, playerID)
	if err != nil {
		return best, false, err
	}
	return *e, n > 0, nil
}

// DailyStats — kun masalasini nechta o'yinchi yechgan va eng kam element soni (0 — hali hech kim).
func (s *Store) DailyStats(ctx context.Context, day int) (solvers, bestGates int, err error) {
	var best sql.NullInt64
	err = s.db.QueryRowContext(ctx,
		`SELECT COUNT(*), MIN(gate_count) FROM daily_solutions WHERE day = ?`, day).Scan(&solvers, &best)
	return solvers, int(best.Int64), err
}

// DayStats — bir kun masalasi bo'yicha: yechganlar soni va eng kam element.
type DayStats struct {
	Solvers   int
	BestGates int
}

// DailyStatsRange — [from, to] kunlar statistikasi; hech kim yechmagan kun ro'yxatda bo'lmaydi.
func (s *Store) DailyStatsRange(ctx context.Context, from, to int) (map[int]DayStats, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT day, COUNT(*), MIN(gate_count) FROM daily_solutions WHERE day BETWEEN ? AND ? GROUP BY day`, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int]DayStats{}
	for rows.Next() {
		var day int
		var st DayStats
		if err := rows.Scan(&day, &st.Solvers, &st.BestGates); err != nil {
			return nil, err
		}
		out[day] = st
	}
	return out, rows.Err()
}

// PlayerDailies — o'yinchining [from, to] kunlardagi natijalari (har kun uchun eng yaxshisi saqlanadi).
func (s *Store) PlayerDailies(ctx context.Context, playerID string, from, to int) (map[int]Solution, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT day, gate_count, stars FROM daily_solutions WHERE player_id = ? AND day BETWEEN ? AND ?`, playerID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int]Solution{}
	for rows.Next() {
		var day int
		var sol Solution
		if err := rows.Scan(&day, &sol.Gates, &sol.Stars); err != nil {
			return nil, err
		}
		out[day] = sol
	}
	return out, rows.Err()
}

const dailyRanked = `WITH r AS (
	SELECT player_id, gate_count, stars, solved_at,
	       ROW_NUMBER() OVER (ORDER BY gate_count, solved_at, player_id) AS rank
	FROM daily_solutions WHERE day = ?
)`

func (s *Store) DailyLeaderboard(ctx context.Context, day, limit int) ([]DailyEntry, error) {
	rows, err := s.db.QueryContext(ctx, dailyRanked+`
		SELECT r.rank, r.player_id, p.nickname, r.gate_count, r.stars, r.solved_at
		FROM r JOIN players p ON p.id = r.player_id ORDER BY r.rank LIMIT ?`, day, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []DailyEntry
	for rows.Next() {
		var e DailyEntry
		var at int64
		if err := rows.Scan(&e.Rank, &e.PlayerID, &e.Nickname, &e.Gates, &e.Stars, &at); err != nil {
			return nil, err
		}
		e.SolvedAt = time.Unix(at, 0)
		out = append(out, e)
	}
	return out, rows.Err()
}

// DailyRank — o'yinchining shu kungi natijasi va o'rni; yechmagan bo'lsa ErrNotFound.
func (s *Store) DailyRank(ctx context.Context, day int, playerID string) (*DailyEntry, error) {
	var e DailyEntry
	var at int64
	err := s.db.QueryRowContext(ctx, dailyRanked+`
		SELECT r.rank, r.player_id, p.nickname, r.gate_count, r.stars, r.solved_at
		FROM r JOIN players p ON p.id = r.player_id WHERE r.player_id = ?`, day, playerID).
		Scan(&e.Rank, &e.PlayerID, &e.Nickname, &e.Gates, &e.Stars, &at)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	e.SolvedAt = time.Unix(at, 0)
	return &e, err
}

// DailyStreak — today yoki kechagi kundan orqaga uzluksiz yechilgan kunlar soni.
// Bugun hali yechilmagan bo'lsa ham kechagacha bo'lgan seriya saqlanadi.
func (s *Store) DailyStreak(ctx context.Context, playerID string, today int) (int, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT day FROM daily_solutions WHERE player_id = ? AND day <= ? ORDER BY day DESC LIMIT 1000`,
		playerID, today)
	if err != nil {
		return 0, err
	}
	defer rows.Close()
	streak, want := 0, today
	for rows.Next() {
		var day int
		if err := rows.Scan(&day); err != nil {
			return 0, err
		}
		if streak == 0 && day == today-1 {
			want = today - 1
		}
		if day != want {
			break
		}
		streak++
		want--
	}
	return streak, rows.Err()
}
