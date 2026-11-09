package api

import (
	"net"
	"sync"
	"time"
)

// limiter — IP bo'yicha token bucket. Xotirada saqlanadi, eski yozuvlar vaqti-vaqti bilan tozalanadi.
type limiter struct {
	mu      sync.Mutex
	rate    float64 // sekundiga token
	burst   float64
	buckets map[string]*bucket
	lastGC  time.Time
}

type bucket struct {
	tokens float64
	last   time.Time
}

// Xotirani cheklash: shuncha IP dan oshsa, jadval tozalanadi.
const maxBuckets = 50000

func newLimiter(perSecond, burst float64) *limiter {
	return &limiter{rate: perSecond, burst: burst, buckets: make(map[string]*bucket), lastGC: time.Now()}
}

func (l *limiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	if now.Sub(l.lastGC) > time.Minute || len(l.buckets) > maxBuckets {
		l.gc(now)
	}
	b, ok := l.buckets[key]
	if !ok {
		b = &bucket{tokens: l.burst, last: now}
		l.buckets[key] = b
	}
	b.tokens = min(l.burst, b.tokens+now.Sub(b.last).Seconds()*l.rate)
	b.last = now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

// blocked — token sarflamasdan tekshiradi: shu kalit uchun hozir bitta ham token qolmaganmi.
func (l *limiter) blocked(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	b, ok := l.buckets[key]
	if !ok {
		return false
	}
	return min(l.burst, b.tokens+time.Since(b.last).Seconds()*l.rate) < 1
}

func (l *limiter) gc(now time.Time) {
	l.lastGC = now
	full := time.Duration(l.burst / l.rate * float64(time.Second))
	for k, b := range l.buckets {
		if now.Sub(b.last) > full {
			delete(l.buckets, k)
		}
	}
	if len(l.buckets) > maxBuckets {
		l.buckets = make(map[string]*bucket)
	}
}

// ipKey — cheklov kaliti: IPv4 o'zi, IPv6 esa /64 tarmog'i. Odatda bitta abonentga butun /64 beriladi —
// uning ichida manzilni almashtirib, har safar yangi (to'la) bucket olib bo'lmasin.
func ipKey(ip net.IP) string {
	if v4 := ip.To4(); v4 != nil {
		return v4.String()
	}
	return (&net.IPNet{IP: ip.Mask(net.CIDRMask(64, 128)), Mask: net.CIDRMask(64, 128)}).String()
}
