package levels

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"time"
)

// daily.json ni qo'lda tahrirlamang: u `node levels/daily.mjs` orqali yaratiladi.
//
//go:embed daily.json
var dailyRaw []byte

// Tashkent — kun chegarasi O'zbekiston vaqti bilan (UTC+5, yozgi vaqt yo'q).
// Konteynerda tzdata bo'lmasligi mumkin, shuning uchun o'zgarmas siljish ishlatiladi.
var Tashkent = time.FixedZone("UZT", 5*60*60)

type DailyHint struct {
	Gates map[string]int `json:"gates"`
	First []string       `json:"first"`
}

type Puzzle struct {
	Tier    int               `json:"tier"`
	Inputs  []string          `json:"inputs"`
	Outputs []string          `json:"outputs"`
	Gates   []string          `json:"gates"`
	Goal    int               `json:"goal"`
	Target  map[string]string `json:"target,omitempty"`
	// Seq — xotira kuni (yakshanba): jadval o'rniga kerakli avtomat (namunani o'yin o'zi quradi).
	Seq  *Seq      `json:"seq,omitempty"`
	Hint DailyHint `json:"hint"`
}

type Daily struct {
	Start    string   `json:"start"`
	Puzzles  []Puzzle `json:"puzzles"`
	startDay int
}

// LoadDaily joylangan daily.json ni o'qiydi va tekshiradi.
func LoadDaily() (*Daily, error) {
	var d Daily
	if err := json.Unmarshal(dailyRaw, &d); err != nil {
		return nil, fmt.Errorf("daily.json: %w", err)
	}
	start, err := time.ParseInLocation(time.DateOnly, d.Start, Tashkent)
	if err != nil {
		return nil, fmt.Errorf("daily.json start: %w", err)
	}
	if len(d.Puzzles) == 0 {
		return nil, fmt.Errorf("daily.json: masalalar yo'q")
	}
	d.startDay = DayOf(start)
	for i, p := range d.Puzzles {
		rows := 1 << len(p.Inputs)
		if p.Seq != nil {
			if err := p.Seq.check(rows, len(p.Outputs)); err != nil {
				return nil, fmt.Errorf("daily.json: %d-masala: %w", i+1, err)
			}
			continue
		}
		for _, o := range p.Outputs {
			if len(p.Target[o]) != rows {
				return nil, fmt.Errorf("daily.json: %d-masala %s jadvali %d emas", i+1, o, rows)
			}
		}
	}
	return &d, nil
}

// DayOf — Toshkent vaqti bo'yicha 1970-01-01 dan beri o'tgan kunlar soni.
func DayOf(t time.Time) int {
	_, off := t.In(Tashkent).Zone()
	return int((t.Unix() + int64(off)) / 86400)
}

// DayStart — kun boshlanishi (Toshkent yarim tuni).
func DayStart(day int) time.Time {
	return time.Unix(int64(day)*86400-5*60*60, 0).In(Tashkent)
}

// Number — masalaning tartib raqami (birinchi kun — 1); boshlanishdan oldingi kunlar uchun 0.
// Avval solishtiriladi: juda kichik kunda ayirish to'lib, musbat (kelajakdagi) raqam chiqmasin.
func (d *Daily) Number(day int) int {
	if day < d.startDay {
		return 0
	}
	return day - d.startDay + 1
}

// FirstDay — birinchi masala kuni.
func (d *Daily) FirstDay() int { return d.startDay }

// For kun uchun masalani qaytaradi. Ro'yxat tugagach, masalalar boshidan takrorlanadi.
func (d *Daily) For(day int) (*Puzzle, bool) {
	if day < d.startDay {
		return nil, false
	}
	return &d.Puzzles[(d.Number(day)-1)%len(d.Puzzles)], true
}
