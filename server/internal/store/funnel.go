package store

import (
	"context"
	"time"
)

// O'yinchilar voronkasi: qurilma har bosqichni bir marta xabar qiladi (bosqich belgisi qurilmaning o'zida
// saqlanadi), server esa kun bo'yicha faqat sonini oshiradi. Qurilma, o'yinchi yoki IP saqlanmaydi.
const (
	EvVisit  = "visit"  // o'yin shu qurilmada birinchi marta ochildi
	EvLevel1 = "level1" // birinchi daraja yechildi
	EvLevel3 = "level3" // uchta daraja yechildi
	EvDaily1 = "daily1" // birinchi kunlik masala yechildi
	EvReturn = "return" // boshqa kuni qaytib ochildi
)

// FunnelEvents — qabul qilinadigan bosqichlar (voronka tartibida).
var FunnelEvents = []string{EvVisit, EvLevel1, EvLevel3, EvDaily1, EvReturn}

// CountEvent — day kuni src manbasidan event bosqichi yana bir marta.
func (s *Store) CountEvent(ctx context.Context, day int, event, src string) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO stats_daily (day, event, src, count) VALUES (?, ?, ?, 1)
		ON CONFLICT (day, event, src) DO UPDATE SET count = count + 1`, day, event, src)
	return err
}

// Funnel — oraliqdagi bosqichlar soni: Events[bosqich] — jami, TG[bosqich] — shundan Telegram ichida;
// Profiles — shu vaqtda ochilgan profillar (serverdagi players jadvalidan).
type Funnel struct {
	Events   map[string]int
	TG       map[string]int
	Profiles int
}

// Funnel — fromDay dan keyingi (fromDay kiritilmaydi) toDay gacha bo'lgan kunlar; profillar — since dan beri.
func (s *Store) Funnel(ctx context.Context, fromDay, toDay int, since time.Time) (Funnel, error) {
	f := Funnel{Events: map[string]int{}, TG: map[string]int{}}
	rows, err := s.db.QueryContext(ctx, `SELECT event, src, SUM(count) FROM stats_daily
		WHERE day > ? AND day <= ? GROUP BY event, src`, fromDay, toDay)
	if err != nil {
		return f, err
	}
	defer rows.Close()
	for rows.Next() {
		var ev, src string
		var n int
		if err := rows.Scan(&ev, &src, &n); err != nil {
			return f, err
		}
		f.Events[ev] += n
		if src == "tg" {
			f.TG[ev] += n
		}
	}
	if err := rows.Err(); err != nil {
		return f, err
	}
	err = s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM players WHERE created_at >= ?`, since.Unix()).Scan(&f.Profiles)
	return f, err
}
