// Package levels darajalar ro'yxatini (levels.json) binar faylga joylaydi.
// levels.json ni qo'lda tahrirlamang: u source.mjs dan `node levels/build.mjs` orqali yaratiladi.
package levels

import (
	_ "embed"
	"encoding/json"
	"fmt"
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
	Target  map[string]string `json:"target"`
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
		for _, o := range l.Outputs {
			if len(l.Target[o]) != rows {
				return nil, fmt.Errorf("levels.json: %s/%s jadvali %d emas", l.ID, o, rows)
			}
		}
		p.byID[l.ID] = l
	}
	return &p, nil
}

func (p *Pack) Level(id string) (*Level, bool) {
	l, ok := p.byID[id]
	return l, ok
}
