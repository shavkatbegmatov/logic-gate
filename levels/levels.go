// Package levels darajalar ro'yxatini (levels.json) binar faylga joylaydi.
// levels.json ni qo'lda tahrirlamang: u source.mjs dan `node levels/build.mjs` orqali yaratiladi.
package levels

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"
)

//go:embed levels.json
var raw []byte

type Chapter struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	UnlockStars int    `json:"unlockStars"`
}

type Level struct {
	ID      string            `json:"id"`
	Chapter string            `json:"chapter"`
	Title   string            `json:"title"`
	Inputs  []string          `json:"inputs"`
	Outputs []string          `json:"outputs"`
	Gates   []string          `json:"gates"`
	Goal    int               `json:"goal"`
	Target  map[string]string `json:"target,omitempty"`
	// Seq — ketma-ket masala (xotira bilan): Target o'rniga kerakli avtomat.
	Seq *Seq `json:"seq,omitempty"`
}

// Seq — eng kichik Mealy avtomati, boshlang'ich holat 0: Out[holat][qator] — chiqishlar ("01…"),
// Next[holat][qator] — keyingi holat. Example — vaqt diagrammasidagi namuna (faqat mijoz uchun).
type Seq struct {
	Next    [][]int    `json:"next"`
	Out     [][]string `json:"out"`
	Example []int      `json:"example"`
}

type Pack struct {
	Version  int       `json:"version"`
	Chapters []Chapter `json:"chapters"`
	Levels   []Level   `json:"levels"`
	byID     map[string]*Level
}

// Load joylangan levels.json ni o'qiydi va tuzilmasini tekshiradi.
func Load() (*Pack, error) {
	var p Pack
	if err := json.Unmarshal(raw, &p); err != nil {
		return nil, fmt.Errorf("levels.json: %w", err)
	}
	p.byID = make(map[string]*Level, len(p.Levels))
	for i := range p.Levels {
		l := &p.Levels[i]
		rows := 1 << len(l.Inputs)
		if l.Seq != nil {
			if err := l.Seq.check(rows, len(l.Outputs)); err != nil {
				return nil, fmt.Errorf("levels.json: %s: %w", l.ID, err)
			}
		} else {
			for _, o := range l.Outputs {
				if len(l.Target[o]) != rows {
					return nil, fmt.Errorf("levels.json: %s/%s jadvali %d emas", l.ID, o, rows)
				}
			}
		}
		p.byID[l.ID] = l
	}
	return &p, nil
}

func (s *Seq) check(rows, outputs int) error {
	if len(s.Next) == 0 || len(s.Next) != len(s.Out) {
		return fmt.Errorf("avtomat holatlari: next %d, out %d", len(s.Next), len(s.Out))
	}
	for st := range s.Next {
		if len(s.Next[st]) != rows || len(s.Out[st]) != rows {
			return fmt.Errorf("%d-holat: %d qator kerak", st, rows)
		}
		for r := range rows {
			if n := s.Next[st][r]; n < 0 || n >= len(s.Next) {
				return fmt.Errorf("%d-holat, %d-qator: noto'g'ri keyingi holat %d", st, r, n)
			}
			if o := s.Out[st][r]; len(o) != outputs || strings.Trim(o, "01") != "" {
				return fmt.Errorf("%d-holat, %d-qator: noto'g'ri chiqish %q", st, r, o)
			}
		}
	}
	return nil
}

func (p *Pack) Level(id string) (*Level, bool) {
	l, ok := p.byID[id]
	return l, ok
}
