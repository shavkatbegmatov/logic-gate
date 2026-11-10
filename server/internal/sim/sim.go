// Package sim — mantiqiy sxemani qat'iy tekshirish va hisoblash.
// Qoidalar web/src/sim/sim.ts bilan bir xil; birini o'zgartirsangiz, ikkinchisini ham yangilang.
package sim

import (
	"fmt"
	"math"
	"regexp"
	"slices"
	"strings"
)

const (
	MaxGates = 64
	MaxWires = 256
	// MaxFlipflops — D-triggerlar soni: ketma-ket tekshiruvda holatlar 2^n gacha o'sadi.
	MaxFlipflops = 8
	// Koordinatalar uchun chegara: saqlanadigan JSON hajmini cheklaydi.
	maxCoord = 100000
)

var gateIDRe = regexp.MustCompile(`^[a-z0-9_]{1,16}$`)

// DFF — D-trigger: kirish D, chiqish Q — saqlangan qiymat; har taktda Q := D.
var arity = map[string]int{
	"NOT": 1, "AND": 2, "OR": 2, "XOR": 2, "NAND": 2, "NOR": 2, "XNOR": 2, "DFF": 1,
}

type Gate struct {
	ID   string  `json:"id"`
	Type string  `json:"type"`
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
}

type Wire struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type Circuit struct {
	Gates []Gate `json:"gates"`
	Wires []Wire `json:"wires"`
}

type Spec struct {
	Inputs  []string
	Outputs []string
	Gates   []string
}

// Error kodlari mijozdagi ErrorCode bilan bir xil.
type Error struct {
	Code string `json:"error"`
	Ref  string `json:"ref,omitempty"`
}

func (e *Error) Error() string { return fmt.Sprintf("%s (%s)", e.Code, e.Ref) }

// lut — element haqiqat jadvali: (a<<1 | b)-bit — natija. NOT b ni e'tiborsiz qoldiradi.
var lut = map[string]uint8{
	"NOT": 0b0011, "AND": 0b1000, "OR": 0b1110, "XOR": 0b0110, "NAND": 0b0111, "NOR": 0b0001, "XNOR": 0b1001,
}

// op — bitta element: vals[dst] = lut ning (vals[a]<<1 | vals[b])-biti.
type op struct {
	lut       uint8
	a, b, dst int32
}

// compiled — tekshiruvdan o'tgan sxema: elementlar topologik tartibda, D-triggerlar boshida.
type compiled struct {
	spec    Spec
	order   []Gate
	drivers map[string]string
	// dffs — D-triggerlar tartibi: holat bitmaskasida i-bit.
	dffs []string

	// Hisoblash dasturi: qiymatlar slice'da (kirishlar, keyin order tartibidagi elementlar) — har taktda
	// xarita yaratilmaydi.
	nVals  int
	ops    []op    // D-triggerdan boshqa elementlar, topologik tartibda
	dffVal []int32 // i-trigger qiymati (Q) joyi
	dffSrc []int32 // i-trigger kirishi (D) manbasi
	outSrc []int32 // chiqishlar manbasi, spec.Outputs tartibida
}

func isSource(spec Spec, gates map[string]Gate, s string) bool {
	if name, ok := strings.CutPrefix(s, "in:"); ok {
		return slices.Contains(spec.Inputs, name)
	}
	_, ok := gates[s]
	return ok
}

func isSink(spec Spec, gates map[string]Gate, s string) bool {
	if name, ok := strings.CutPrefix(s, "out:"); ok {
		return slices.Contains(spec.Outputs, name)
	}
	i := strings.LastIndexByte(s, ':')
	if i < 0 {
		return false
	}
	g, ok := gates[s[:i]]
	idx := s[i+1:]
	return ok && (idx == "0" || (idx == "1" && arity[g.Type] == 2))
}

func validCoord(v float64) bool {
	return !math.IsNaN(v) && !math.IsInf(v, 0) && math.Abs(v) <= maxCoord
}

func compile(spec Spec, c Circuit) (*compiled, *Error) {
	if len(c.Gates) > MaxGates {
		return nil, &Error{Code: "too_many_gates"}
	}
	if len(c.Wires) > MaxWires {
		return nil, &Error{Code: "too_many_wires"}
	}
	gates := make(map[string]Gate, len(c.Gates))
	for _, g := range c.Gates {
		if _, ok := arity[g.Type]; !ok || !gateIDRe.MatchString(g.ID) || !validCoord(g.X) || !validCoord(g.Y) {
			return nil, &Error{Code: "bad_gate", Ref: g.ID}
		}
		if _, dup := gates[g.ID]; dup {
			return nil, &Error{Code: "dup_gate", Ref: g.ID}
		}
		if !slices.Contains(spec.Gates, g.Type) {
			return nil, &Error{Code: "gate_not_allowed", Ref: g.ID}
		}
		gates[g.ID] = g
	}
	drivers := make(map[string]string, len(c.Wires))
	for _, w := range c.Wires {
		if !isSource(spec, gates, w.From) || !isSink(spec, gates, w.To) {
			return nil, &Error{Code: "bad_wire"}
		}
		if _, taken := drivers[w.To]; taken {
			return nil, &Error{Code: "sink_taken", Ref: w.To}
		}
		drivers[w.To] = w.From
	}

	// Kahn algoritmi; elementlar kiritilgan tartibda ko'rib chiqiladi (mijoz bilan bir xil).
	indeg := make(map[string]int, len(gates))
	users := make(map[string][]string, len(gates))
	for _, g := range c.Gates {
		// D-trigger kirishi chiqishiga shu taktda ta'sir qilmaydi — u orqali o'tgan aylana sikl emas.
		if g.Type == "DFF" {
			continue
		}
		for i := range arity[g.Type] {
			if src, ok := drivers[fmt.Sprintf("%s:%d", g.ID, i)]; ok {
				if _, isGate := gates[src]; isGate {
					indeg[g.ID]++
					users[src] = append(users[src], g.ID)
				}
			}
		}
	}
	var queue []string
	for _, g := range c.Gates {
		if indeg[g.ID] == 0 {
			queue = append(queue, g.ID)
		}
	}
	order := make([]Gate, 0, len(gates))
	for len(queue) > 0 {
		id := queue[0]
		queue = queue[1:]
		order = append(order, gates[id])
		for _, u := range users[id] {
			indeg[u]--
			if indeg[u] == 0 {
				queue = append(queue, u)
			}
		}
	}
	if len(order) < len(gates) {
		for _, g := range c.Gates {
			if indeg[g.ID] > 0 {
				return nil, &Error{Code: "cycle", Ref: g.ID}
			}
		}
	}
	var dffs []string
	for _, g := range order {
		if g.Type == "DFF" {
			dffs = append(dffs, g.ID)
		}
	}
	if len(dffs) > MaxFlipflops {
		return nil, &Error{Code: "too_many_flipflops"}
	}

	for _, g := range c.Gates {
		for i := range arity[g.Type] {
			if _, ok := drivers[fmt.Sprintf("%s:%d", g.ID, i)]; !ok {
				return nil, &Error{Code: "unconnected_input", Ref: g.ID}
			}
		}
	}
	for _, o := range spec.Outputs {
		if _, ok := drivers["out:"+o]; !ok {
			return nil, &Error{Code: "unconnected_output", Ref: o}
		}
	}
	cc := &compiled{spec: spec, order: order, drivers: drivers, dffs: dffs}
	cc.program()
	return cc, nil
}

// program qiymatlar joyini belgilaydi va elementlarni slice indekslari bilan dasturga aylantiradi.
func (c *compiled) program() {
	n := len(c.spec.Inputs)
	slot := make(map[string]int32, n+len(c.order))
	for k, name := range c.spec.Inputs {
		slot["in:"+name] = int32(k)
	}
	for i, g := range c.order {
		slot[g.ID] = int32(n + i)
	}
	src := func(sink string) int32 { return slot[c.drivers[sink]] }
	c.nVals = n + len(c.order)
	for i, g := range c.order {
		if g.Type == "DFF" {
			c.dffVal = append(c.dffVal, int32(n+i))
			c.dffSrc = append(c.dffSrc, src(g.ID+":0"))
			continue
		}
		a := src(g.ID + ":0")
		b := a // bir kirishli element (NOT) b ni ishlatmaydi
		if arity[g.Type] == 2 {
			b = src(g.ID + ":1")
		}
		c.ops = append(c.ops, op{lut: lut[g.Type], a: a, b: b, dst: int32(n + i)})
	}
	for _, o := range c.spec.Outputs {
		c.outSrc = append(c.outSrc, src("out:"+o))
	}
}

// Validate sxemani qat'iy tekshiradi; xato bo'lmasa nil qaytaradi.
func Validate(spec Spec, c Circuit) *Error {
	_, err := compile(spec, c)
	return err
}

// step — bitta takt: state holatida (i-bit — dffs[i]) r-qator uchun chiqishlar out ga yoziladi va keyingi
// holat qaytadi (birinchi kirish — eng katta bit). vals — c.nVals uzunlikdagi ish joyi: xotira ajratilmaydi.
func (c *compiled) step(r int, state uint64, vals, out []uint8) uint64 {
	n := len(c.spec.Inputs)
	for k := range n {
		vals[k] = uint8(r>>(n-1-k)) & 1
	}
	for i, at := range c.dffVal {
		vals[at] = uint8(state>>i) & 1
	}
	for _, o := range c.ops {
		vals[o.dst] = o.lut >> (vals[o.a]<<1 | vals[o.b]) & 1
	}
	for i, at := range c.outSrc {
		out[i] = vals[at]
	}
	var next uint64
	for i, at := range c.dffSrc {
		next |= uint64(vals[at]) << i
	}
	return next
}

// Check sxemani tekshiradi va target jadval bilan solishtiradi.
// Xato qatorlar bo'lsa, wrongRows to'ldiriladi (err nil bo'ladi).
func Check(spec Spec, target map[string]string, c Circuit) (gates int, wrongRows []int, err *Error) {
	cc, err := compile(spec, c)
	if err != nil {
		return 0, nil, err
	}
	vals, got := make([]uint8, cc.nVals), make([]uint8, len(spec.Outputs))
	for r := range 1 << len(spec.Inputs) {
		cc.step(r, 0, vals, got)
		for i, o := range spec.Outputs {
			if got[i] != target[o][r]-'0' {
				wrongRows = append(wrongRows, r)
				break
			}
		}
	}
	return len(c.Gates), wrongRows, nil
}

// Machine — ketma-ket masalaning kerakli xatti-harakati (eng kichik Mealy avtomati, boshlanishi 0):
// Out[holat][qator] — chiqishlar ("01…"), Next[holat][qator] — keyingi holat.
type Machine struct {
	Next [][]int
	Out  [][]string
}

// CheckSeq sxemani avtomat bilan solishtiradi: ikkalasi boshlang'ich holatdan birga, erishiladigan
// har bir juft holat bo'yicha kenglik bo'yicha yuradi. Farq bo'lsa, uni ko'rsatadigan eng qisqa
// kirishlar ketma-ketligi (qatorlar) qaytadi — oxirgi taktda chiqish noto'g'ri.
//
// Juft holat (sxema holati, avtomat holati) — zich jadvalda: holat*len(m.Next) + avtomat holati. Sxema
// holati MaxFlipflops bit bilan cheklangan, shuning uchun juftlar ko'pi bilan 2^8 × avtomat holatlari,
// ish esa juftlar × qatorlar — har taktda xotira ajratilmaydi.
func CheckSeq(spec Spec, m Machine, c Circuit) (gates int, trace []int, err *Error) {
	cc, err := compile(spec, c)
	if err != nil {
		return 0, nil, err
	}
	ms := len(m.Next)
	// prev[i] — i-juftga qaysi juftdan kelingani (-1 — hali ko'rilmagan, o'zi — boshlanish), row[i] — qator.
	prev := make([]int32, (1<<len(cc.dffSrc))*ms)
	row := make([]int32, len(prev))
	for i := range prev {
		prev[i] = -1
	}
	prev[0] = 0
	queue := make([]int32, 1, 64)
	vals, got := make([]uint8, cc.nVals), make([]uint8, len(spec.Outputs))
	rows := 1 << len(spec.Inputs)
	for qi := 0; qi < len(queue); qi++ {
		p := int(queue[qi])
		state, s := uint64(p/ms), p%ms
		for r := range rows {
			nextState := cc.step(r, state, vals, got)
			want := m.Out[s][r]
			for i := range got {
				if got[i] != want[i]-'0' {
					trace = []int{r}
					for e := p; int(prev[e]) != e; e = int(prev[e]) {
						trace = append([]int{int(row[e])}, trace...)
					}
					return len(c.Gates), trace, nil
				}
			}
			next := int(nextState)*ms + m.Next[s][r]
			if prev[next] < 0 {
				prev[next], row[next] = int32(p), int32(r)
				queue = append(queue, int32(next))
			}
		}
	}
	return len(c.Gates), nil, nil
}

// StoreCoord — saqlanadigan koordinata chegarasi: o'yin maydoni bundan ancha kichik.
const StoreCoord = 10000

// Canonical — tekshiruvdan o'tgan sxemaning saqlash uchun ixcham ko'rinishi: elementlar kiritilgan
// tartibda g1, g2, … deb qayta nomlanadi (simlar ham), koordinatalar butun songa yaxlitlanib
// ±StoreCoord ga cheklanadi, noma'lum maydonlar tushib qoladi. Mijoz yangi elementga mavjud gN larning
// eng kattasidan keyingi raqamni beradi (web/src/board/editor.ts, nextId) — to'qnashuv bo'lmaydi.
func Canonical(c Circuit) Circuit {
	ids := make(map[string]string, len(c.Gates))
	out := Circuit{Gates: make([]Gate, len(c.Gates)), Wires: make([]Wire, len(c.Wires))}
	for i, g := range c.Gates {
		id := fmt.Sprintf("g%d", i+1)
		ids[g.ID] = id
		out.Gates[i] = Gate{ID: id, Type: g.Type, X: storeCoord(g.X), Y: storeCoord(g.Y)}
	}
	port := func(p string) string {
		if strings.HasPrefix(p, "in:") || strings.HasPrefix(p, "out:") {
			return p
		}
		if i := strings.LastIndexByte(p, ':'); i >= 0 {
			return ids[p[:i]] + p[i:]
		}
		return ids[p]
	}
	for i, w := range c.Wires {
		out.Wires[i] = Wire{From: port(w.From), To: port(w.To)}
	}
	return out
}

func storeCoord(v float64) float64 {
	v = max(-StoreCoord, min(StoreCoord, math.Round(v)))
	if v == 0 {
		v = 0 // -0 emas: JSON da "-0" bo'lmasin
	}
	return v
}

// Stars: element soni ≤ maqsad → 3, ≤ maqsad+2 → 2, aks holda 1.
func Stars(goal, gates int) int {
	switch {
	case gates <= goal:
		return 3
	case gates <= goal+2:
		return 2
	default:
		return 1
	}
}
