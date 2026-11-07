package store

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

// Chat — botga yozgan yoki o'yin ichida eslatmani yoqqan Telegram foydalanuvchisi (shaxsiy chat).
type Chat struct {
	ChatID   int64
	Lang     string
	Remind   bool
	PlayerID string // bog'langan o'yinchi (o'yin ichidan yoqilganda); bo'sh bo'lishi mumkin
	Blocked  bool
}

// UpsertChat chatni yozadi (yangi bo'lsa — shu til bilan); bot qayta ishga tushirilgan bo'lsa, blokdan chiqaradi.
// Mavjud chatning tili o'zgarmaydi — u faqat foydalanuvchi tanlovi bilan (SetLang) almashadi.
func (s *Store) UpsertChat(ctx context.Context, chatID int64, lang string) error {
	now := time.Now().Unix()
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO tg_chats (chat_id, lang, created_at, updated_at) VALUES (?, ?, ?, ?)
		ON CONFLICT (chat_id) DO UPDATE SET blocked = 0, updated_at = excluded.updated_at`,
		chatID, lang, now, now)
	return err
}

// SetLang — bot xabarlari tili (uz/ru).
func (s *Store) SetLang(ctx context.Context, chatID int64, lang string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE tg_chats SET lang = ?, updated_at = ? WHERE chat_id = ?`,
		lang, time.Now().Unix(), chatID)
	return err
}

// SetRemind kunlik eslatmani yoqadi/o'chiradi (chat bo'lmasa, yaratiladi).
func (s *Store) SetRemind(ctx context.Context, chatID int64, lang string, on bool) error {
	now := time.Now().Unix()
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO tg_chats (chat_id, lang, remind, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
		ON CONFLICT (chat_id) DO UPDATE SET remind = excluded.remind, blocked = 0, updated_at = excluded.updated_at`,
		chatID, lang, on, now, now)
	return err
}

// LinkChat chatni o'yinchiga bog'laydi: eslatma bugungi masalani yechganlarga yuborilmaydi, seriya ko'rsatiladi.
func (s *Store) LinkChat(ctx context.Context, chatID int64, playerID string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE tg_chats SET player_id = ?, updated_at = ? WHERE chat_id = ?`,
		playerID, time.Now().Unix(), chatID)
	return err
}

// SetBlocked — foydalanuvchi botni bloklagan (yoki o'chirgan): unga boshqa xabar yuborilmaydi.
func (s *Store) SetBlocked(ctx context.Context, chatID int64) error {
	_, err := s.db.ExecContext(ctx, `UPDATE tg_chats SET blocked = 1, updated_at = ? WHERE chat_id = ?`,
		time.Now().Unix(), chatID)
	return err
}

func (s *Store) Chat(ctx context.Context, chatID int64) (*Chat, error) {
	var c Chat
	var player sql.NullString
	err := s.db.QueryRowContext(ctx,
		`SELECT chat_id, lang, remind, player_id, blocked FROM tg_chats WHERE chat_id = ?`, chatID).
		Scan(&c.ChatID, &c.Lang, &c.Remind, &player, &c.Blocked)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	c.PlayerID = player.String
	return &c, err
}

// ReminderTargets — kunlik eslatma oladiganlar: yoqgan, bloklamagan va bugungi masalani hali yechmagan.
func (s *Store) ReminderTargets(ctx context.Context, day int) ([]Chat, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT c.chat_id, c.lang, c.player_id FROM tg_chats c
		WHERE c.remind = 1 AND c.blocked = 0 AND NOT EXISTS (
			SELECT 1 FROM daily_solutions d WHERE d.day = ? AND d.player_id = c.player_id
		) ORDER BY c.chat_id`, day)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Chat
	for rows.Next() {
		c := Chat{Remind: true}
		var player sql.NullString
		if err := rows.Scan(&c.ChatID, &c.Lang, &player); err != nil {
			return nil, err
		}
		c.PlayerID = player.String
		out = append(out, c)
	}
	return out, rows.Err()
}

// Stats — admin uchun qisqa ko'rsatkichlar.
type Stats struct {
	Players     int // jami o'yinchilar
	ActiveWeek  int // oxirgi 7 kunda kirganlar
	DailyToday  int // bugungi masalani yechganlar
	Chats       int // botga yozganlar (bloklamaganlar)
	Subscribers int // kunlik eslatma yoqqanlar
}

func (s *Store) Stats(ctx context.Context, today int, now time.Time) (Stats, error) {
	var st Stats
	err := s.db.QueryRowContext(ctx, `SELECT
		(SELECT COUNT(*) FROM players),
		(SELECT COUNT(*) FROM players WHERE last_seen_at >= ?),
		(SELECT COUNT(*) FROM daily_solutions WHERE day = ?),
		(SELECT COUNT(*) FROM tg_chats WHERE blocked = 0),
		(SELECT COUNT(*) FROM tg_chats WHERE blocked = 0 AND remind = 1)`,
		now.Add(-7*24*time.Hour).Unix(), today).
		Scan(&st.Players, &st.ActiveWeek, &st.DailyToday, &st.Chats, &st.Subscribers)
	return st, err
}

// Meta — kichik kalit-qiymat yozuvlari (bot uchun: oxirgi update, eslatma yuborilgan kun).
func (s *Store) Meta(ctx context.Context, key string) (string, error) {
	var v string
	err := s.db.QueryRowContext(ctx, `SELECT value FROM meta WHERE key = ?`, key).Scan(&v)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return v, err
}

func (s *Store) SetMeta(ctx context.Context, key, value string) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value`, key, value)
	return err
}

// Weekly — haftalik hisobot uchun ko'rsatkichlar (oxirgi 7 kun, bugun bilan).
type Weekly struct {
	Players, NewPlayers, Active     int
	DailySolves, DailySolvers       int
	LevelSolves, Chats, Subscribers int
}

func (s *Store) Weekly(ctx context.Context, today int, now time.Time) (Weekly, error) {
	var w Weekly
	since := now.Add(-7 * 24 * time.Hour).Unix()
	err := s.db.QueryRowContext(ctx, `SELECT
		(SELECT COUNT(*) FROM players),
		(SELECT COUNT(*) FROM players WHERE created_at >= ?),
		(SELECT COUNT(*) FROM players WHERE last_seen_at >= ?),
		(SELECT COUNT(*) FROM daily_solutions WHERE day > ?),
		(SELECT COUNT(DISTINCT player_id) FROM daily_solutions WHERE day > ?),
		(SELECT COUNT(*) FROM solutions WHERE solved_at >= ?),
		(SELECT COUNT(*) FROM tg_chats WHERE blocked = 0),
		(SELECT COUNT(*) FROM tg_chats WHERE blocked = 0 AND remind = 1)`,
		since, since, today-7, today-7, since).
		Scan(&w.Players, &w.NewPlayers, &w.Active, &w.DailySolves, &w.DailySolvers, &w.LevelSolves, &w.Chats, &w.Subscribers)
	return w, err
}
