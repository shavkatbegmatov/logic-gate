// Package tglogin — saytga Telegram orqali kirish so'rovlari (xotirada, bir martalik, qisqa muddatli).
//
// Brauzer so'rov ochadi (Start) va botga havola oladi: t.me/<bot>?start=auth_<id>. Foydalanuvchi botda
// so'rovni ochadi (Open — so'rov shu Telegram hisobiga biriktiriladi) va saytda ko'rinib turgan raqamni
// tugmalardan tanlaydi (Answer). To'g'ri raqam — tasdiq, noto'g'risi yoki «Bu men emas» — rad. Raqam
// boshqa birov yuborgan havola orqali begona brauzerni o'z profiliga kiritib yuborishdan saqlaydi: u
// raqam faqat so'rovni ochgan brauzerda ko'rinadi. Brauzer holatni so'rab turadi (Get) va natijani olgach
// so'rovni yopadi (Finish).
package tglogin

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"math/big"
	"sync"
	"time"
)

// Kind — so'rov turi.
type Kind uint8

const (
	// Login — brauzer Telegram hisobiga bog'langan profilga kiradi (bog'lanmagan bo'lsa — yangisini ochadi
	// yoki tiklash kodi bilan mavjudini bog'laydi).
	Login Kind = iota + 1
	// Link — brauzerda ochiq profil shu Telegram hisobiga bog'lanadi.
	Link
)

// State — so'rov holati.
type State uint8

const (
	Pending State = iota
	Approved
	Denied
)

const (
	// TTL — so'rov shuncha vaqt kutadi (botni ochib, raqamni tanlashga yetarli).
	TTL = 5 * time.Minute
	// maxPending — bir vaqtda kutayotgan so'rovlar chegarasi (xotira to'lib ketmasin).
	maxPending = 10000
)

var (
	ErrNotFound = errors.New("so'rov topilmadi yoki eskirgan")
	ErrTaken    = errors.New("so'rov boshqa Telegram hisobida ochilgan")
	ErrBusy     = errors.New("kutayotgan so'rovlar juda ko'p")
)

// Request — so'rovning nusxasi (Hub ichidagisi faqat qulf ostida o'zgaradi).
type Request struct {
	ID       string
	Kind     Kind
	Player   string // Link: bog'lanadigan profil
	Nickname string // Link: uning taxallusi (botda ko'rsatiladi)
	Number   int    // saytda ko'rinadigan raqam (10–99)
	Choices  [3]int // botdagi tugmalar; biri — Number
	Chat     int64  // so'rovni botda ochgan Telegram foydalanuvchisi (0 — hali ochilmagan)
	Name     string // uning Telegram'dagi ismi (yangi profil taxallusi uchun)
	State    State
	Expires  time.Time
}

type Hub struct {
	mu   sync.Mutex
	reqs map[string]*Request
	now  func() time.Time
}

func New(now func() time.Time) *Hub {
	if now == nil {
		now = time.Now
	}
	return &Hub{reqs: map[string]*Request{}, now: now}
}

// Start yangi so'rov ochadi.
func (h *Hub) Start(kind Kind, player, nickname string) (Request, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	now := h.now()
	if len(h.reqs) >= maxPending {
		h.gc(now)
		if len(h.reqs) >= maxPending {
			return Request{}, ErrBusy
		}
	}
	r := &Request{ID: newID(), Kind: kind, Player: player, Nickname: nickname, Expires: now.Add(TTL)}
	r.Choices = choices()
	r.Number = r.Choices[randInt(len(r.Choices))]
	h.reqs[r.ID] = r
	return *r, nil
}

// Get — so'rov holati (eskirgani o'chiriladi va topilmagan hisoblanadi).
func (h *Hub) Get(id string) (Request, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	r := h.live(id)
	if r == nil {
		return Request{}, false
	}
	return *r, true
}

// Open — so'rov botda ochildi. Birinchi ochgan Telegram hisobiga biriktiriladi: havola boshqa birovga
// o'tib qolsa, u so'rovni o'ziga ololmaydi. Javob berilgan so'rov qayta ochilmaydi.
func (h *Hub) Open(id string, chat int64, name string) (Request, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	r := h.live(id)
	if r == nil || r.State != Pending {
		return Request{}, ErrNotFound
	}
	if r.Chat != 0 && r.Chat != chat {
		return Request{}, ErrTaken
	}
	r.Chat, r.Name = chat, name
	return *r, nil
}

// Answer — botda tanlangan raqam (0 — «Bu men emas»). To'g'ri raqam — Approved, aks holda — Denied
// (noto'g'ri raqamdan keyin qayta tanlab bo'lmaydi: taxmin qilib topishning iloji yo'q).
func (h *Hub) Answer(id string, chat int64, number int) (Request, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	r := h.live(id)
	if r == nil || r.State != Pending {
		return Request{}, ErrNotFound
	}
	if r.Chat != chat {
		return Request{}, ErrTaken
	}
	if number != 0 && number == r.Number {
		r.State = Approved
	} else {
		r.State = Denied
	}
	return *r, nil
}

// Finish so'rovni yopadi (natija brauzerga berildi).
func (h *Hub) Finish(id string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.reqs, id)
}

func (h *Hub) live(id string) *Request {
	r := h.reqs[id]
	if r == nil {
		return nil
	}
	if !h.now().Before(r.Expires) {
		delete(h.reqs, id)
		return nil
	}
	return r
}

func (h *Hub) gc(now time.Time) {
	for id, r := range h.reqs {
		if !now.Before(r.Expires) {
			delete(h.reqs, id)
		}
	}
}

// newID — 128 bit tasodifiy, base64url (Telegram start parametri: A-Z, a-z, 0-9, _ va -).
func newID() string {
	var b [16]byte
	rand.Read(b[:])
	return base64.RawURLEncoding.EncodeToString(b[:])
}

// choices — 10–99 orasidan uchta har xil raqam.
func choices() [3]int {
	var c [3]int
	for i := 0; i < len(c); {
		n := 10 + randInt(90)
		if n == c[0] || n == c[1] {
			continue
		}
		c[i] = n
		i++
	}
	return c
}

func randInt(n int) int {
	v, err := rand.Int(rand.Reader, big.NewInt(int64(n)))
	if err != nil {
		panic(err)
	}
	return int(v.Int64())
}
