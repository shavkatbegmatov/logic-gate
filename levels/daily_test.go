package levels

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"math"
	"slices"
	"strings"
	"testing"
	"time"
)

func TestDayBoundary(t *testing.T) {
	// Toshkentda yarim tun = 19:00 UTC: kun aynan shu paytda almashadi.
	before := time.Date(2026, 11, 7, 18, 59, 59, 0, time.UTC)
	after := before.Add(time.Second)
	if DayOf(after) != DayOf(before)+1 {
		t.Fatalf("kun 19:00 UTC da almashishi kerak: %d → %d", DayOf(before), DayOf(after))
	}
	if got := DayStart(DayOf(after)); !got.Equal(after) {
		t.Fatalf("DayStart = %v, kutilgan %v", got, after)
	}
	if s := DayStart(DayOf(after)).Format(time.DateOnly); s != "2026-11-08" {
		t.Fatalf("sana %s", s)
	}
}

func TestDailyCycle(t *testing.T) {
	d, err := LoadDaily()
	if err != nil {
		t.Fatal(err)
	}
	start, _ := time.ParseInLocation(time.DateOnly, d.Start, Tashkent)
	first := DayOf(start)
	if _, ok := d.For(first - 1); ok {
		t.Fatal("boshlanishdan oldin masala bo'lmasligi kerak")
	}
	p1, ok := d.For(first)
	if !ok || d.Number(first) != 1 {
		t.Fatal("birinchi kun masalasi yo'q")
	}
	// Ro'yxat tugagach boshidan takrorlanadi; uzunlik 7 ga karrali — hafta kunlari mos keladi.
	if len(d.Puzzles)%7 != 0 {
		t.Fatalf("masalalar soni 7 ga karrali emas: %d", len(d.Puzzles))
	}
	if again, _ := d.For(first + len(d.Puzzles)); again != p1 {
		t.Fatal("takrorlanish noto'g'ri")
	}
	// Juda kichik kunlar: ayirish to'lib, kelajakdagi masala chiqmasligi kerak.
	for x := range 2 * len(d.Puzzles) {
		day := math.MinInt + x
		if _, ok := d.For(day); ok || d.Number(day) != 0 {
			t.Fatalf("%d-kun: masala bor (raqam %d)", day, d.Number(day))
		}
	}
	if _, ok := d.For(first - 1); ok || d.Number(first-1) != 0 {
		t.Fatal("boshlanishdan bir kun oldin")
	}
	for i, p := range d.Puzzles {
		// Xotira kunida maslahat bo'sh D-triggerdan boshlanishi mumkin (hamma narsa u orqali aylanadi).
		firstOK := len(p.Hint.First) >= 2 || (p.Seq != nil && len(p.Hint.First) == 1 && p.Hint.First[0] == "DFF")
		if p.Tier < 1 || p.Tier > 5 || p.Goal < 3 || len(p.Hint.Gates) == 0 || !firstOK {
			t.Errorf("%d-masala: %+v", i+1, p)
		}
	}
}

// O'tgan kunlar masalalari o'zgarmasin: ularning natijalari bazada (daily.mjs generator qoidasi
// o'zgarsa ham). Xesh — dastlabki 5 kun (2026-11-07 … 11-11; daily.mjs dagi UNIQUE_FROM gacha).
func TestPastDailyFrozen(t *testing.T) {
	var f struct {
		Puzzles []json.RawMessage `json:"puzzles"`
	}
	if err := json.Unmarshal(dailyRaw, &f); err != nil {
		t.Fatal(err)
	}
	parts := make([][]byte, 5)
	for i := range parts {
		parts[i] = f.Puzzles[i]
	}
	sum := sha256.Sum256(bytes.Join(parts, []byte("\n")))
	if got := hex.EncodeToString(sum[:]); got != "ea6e5c95fce629aabcb3fe2eb4b1890418ceb18e59f69598e411e310c9f4f8dd" {
		t.Fatalf("o'tgan kunlar masalalari o'zgardi: %s", got)
	}
}

// Bir xil masala (elementlar va jadval) yaqin kunlarda takrorlanmasin: kichik pullarda takror muqarrar,
// lekin u kamida ~11 oy keyin.
func TestDailyNoCloseRepeats(t *testing.T) {
	d, err := LoadDaily()
	if err != nil {
		t.Fatal(err)
	}
	last := map[string]int{}
	for i, p := range d.Puzzles {
		if p.Seq != nil {
			continue
		}
		targets := make([]string, 0, len(p.Outputs))
		for _, o := range p.Outputs {
			targets = append(targets, p.Target[o])
		}
		slices.Sort(targets)
		key := strings.Join(p.Gates, ",") + "|" + strings.Join(targets, ",")
		if j, ok := last[key]; ok && i-j < 300 && j >= 5 {
			t.Errorf("%d- va %d-kun masalasi bir xil (%d kun oralig'i)", j+1, i+1, i-j)
		}
		last[key] = i
	}
}
