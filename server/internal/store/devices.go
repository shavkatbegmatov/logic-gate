package store

import (
	"context"
	"time"
)

// Device — o'yinchining qurilma kaliti (Telegram orqali kirgan brauzer yoki Mini App).
type Device struct {
	Hash      []byte
	Label     string
	CreatedAt time.Time
	UsedAt    time.Time
}

// Devices — o'yinchining qurilma kalitlari, yangisi birinchi. Asosiy tiklash kodi bu ro'yxatda yo'q.
func (s *Store) Devices(ctx context.Context, playerID string) ([]Device, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT token_hash, label, created_at, used_at FROM player_tokens WHERE player_id = ?
		 ORDER BY created_at DESC, token_hash`, playerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Device
	for rows.Next() {
		var d Device
		var created, used int64
		if err := rows.Scan(&d.Hash, &d.Label, &created, &used); err != nil {
			return nil, err
		}
		d.CreatedAt, d.UsedAt = time.Unix(created, 0), time.Unix(used, 0)
		out = append(out, d)
	}
	return out, rows.Err()
}

// DeleteDevice o'yinchining bitta qurilma kalitini o'chiradi: id — xeshning boshi (ochiq identifikator,
// kalitning o'zi emas). Topilmasa — ErrNotFound.
func (s *Store) DeleteDevice(ctx context.Context, playerID string, id []byte) error {
	res, err := s.db.ExecContext(ctx,
		`DELETE FROM player_tokens WHERE player_id = ? AND substr(token_hash, 1, ?) = ?`, playerID, len(id), id)
	if err != nil {
		return err
	}
	if n, err := res.RowsAffected(); err != nil {
		return err
	} else if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ResetTokens — «boshqa qurilmalardan chiqish»: asosiy tiklash kodi yangisiga almashadi, barcha qurilma
// kalitlari o'chiriladi. Shundan keyin profilga faqat yangi kod (yoki bog'langan Telegram) bilan kiriladi.
func (s *Store) ResetTokens(ctx context.Context, playerID string, newHash []byte) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	res, err := tx.ExecContext(ctx, `UPDATE players SET token_hash = ? WHERE id = ?`, newHash, playerID)
	if err != nil {
		return err
	}
	if n, err := res.RowsAffected(); err != nil {
		return err
	} else if n == 0 {
		return ErrNotFound
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM player_tokens WHERE player_id = ?`, playerID); err != nil {
		return err
	}
	return tx.Commit()
}
