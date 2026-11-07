package levels

import (
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
	for i, p := range d.Puzzles {
		if p.Tier < 1 || p.Tier > 5 || p.Goal < 3 || len(p.Hint.Gates) == 0 || len(p.Hint.First) < 2 {
			t.Errorf("%d-masala: %+v", i+1, p)
		}
	}
}
