// Package sim — mantiqiy sxemani qat'iy tekshirish va hisoblash.
// Qoidalar web/src/sim/sim.ts bilan bir xil; birini o'zgartirsangiz, ikkinchisini ham yangilang.
package sim

import (
	"fmt"
	"math"
	"regexp"
	"slices"
	"strconv"
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
	"HA": 2, "FA": 3, "MUX": 3, "DEC": 2,
	"SPLIT": 4, "JOIN": 4, "NOT4": 4, "ADD4": 9, "MUX4": 9, "INC4": 4,
}

// Block — blok (mikrosxema): Fn kirish bitlaridan chiqish bitlarini beradi (birinchi kirish — qatorning eng
// katta biti); hisoblashda undan tuzilgan jadval (Table) ishlatiladi. web/src/sim/types.ts dagi BLOCKS va
// levels/blocks.mjs bilan bir xil bo'lishi shart — testlar levels.json dagi `blocks` jadvallari bilan solishtiradi.
type Block struct {
	Inputs  []string
	Outputs []string
	Fn      func(in []uint8) []uint8
	// Table[r] — r-qatordagi chiqishlar maskasi (k-bit — k-chiqish); init da Fn dan.
	Table []uint8
}

func pins4(name string) []string {
	return []string{name + "3", name + "2", name + "1", name + "0"}
}

func num(bits []uint8) int {
	v := 0
	for _, b := range bits {
		v = v<<1 | int(b)
	}
	return v
}

// withCarry — to'rt bit (eng kattasi birinchi) va beshinchi bit (ko'chirish) oxirida.
func withCarry(v int) []uint8 {
	return []uint8{uint8(v >> 3 & 1), uint8(v >> 2 & 1), uint8(v >> 1 & 1), uint8(v & 1), uint8(v >> 4 & 1)}
}

func ident(a []uint8) []uint8 { return append([]uint8(nil), a...) }

var Blocks = map[string]*Block{
	"HA":  {Inputs: []string{"A", "B"}, Outputs: []string{"S", "C"}, Fn: func(a []uint8) []uint8 { return []uint8{a[0] ^ a[1], a[0] & a[1]} }},
	"FA":  {Inputs: []string{"A", "B", "Ci"}, Outputs: []string{"S", "Co"}, Fn: func(a []uint8) []uint8 { s := a[0] + a[1] + a[2]; return []uint8{s & 1, s >> 1} }},
	"MUX": {Inputs: []string{"A", "B", "S"}, Outputs: []string{"Q"}, Fn: func(a []uint8) []uint8 { return []uint8{a[a[2]]} }},
	"DEC": {Inputs: []string{"A", "B"}, Outputs: []string{"Y0", "Y1", "Y2", "Y3"}, Fn: func(a []uint8) []uint8 {
		out := make([]uint8, 4)
		out[a[0]*2+a[1]] = 1
		return out
	}},
	// Shinalar (4 bit): bo'laklovchi va birlashtiruvchi — simlar, qolganlari har bit uchun.
	"SPLIT": {Inputs: pins4("A"), Outputs: pins4("A"), Fn: ident},
	"JOIN":  {Inputs: pins4("A"), Outputs: pins4("Q"), Fn: ident},
	"NOT4": {Inputs: pins4("A"), Outputs: pins4("Q"), Fn: func(a []uint8) []uint8 {
		out := ident(a)
		for i := range out {
			out[i] ^= 1
		}
		return out
	}},
	"ADD4": {Inputs: append(append(pins4("A"), pins4("B")...), "Ci"), Outputs: append(pins4("S"), "Co"), Fn: func(a []uint8) []uint8 {
		return withCarry(num(a[:4]) + num(a[4:8]) + int(a[8]))
	}},
	"MUX4": {Inputs: append(append(pins4("A"), pins4("B")...), "S"), Outputs: pins4("Q"), Fn: func(a []uint8) []uint8 {
		if a[8] == 1 {
			return ident(a[4:8])
		}
		return ident(a[:4])
	}},
	"INC4": {Inputs: pins4("A"), Outputs: append(pins4("Q"), "C"), Fn: func(a []uint8) []uint8 { return withCarry(num(a) + 1) }},
}

func init() {
	for _, b := range Blocks {
		n := len(b.Inputs)
		b.Table = make([]uint8, 1<<n)
		in := make([]uint8, n)
		for r := range b.Table {
			for k := range n {
				in[k] = uint8(r>>(n-1-k)) & 1
			}
			for k, v := range b.Fn(in) {
				b.Table[r] |= (v & 1) << k
			}
		}
	}
}

// outputs — element chiqishlari soni: blokda bir nechta, qolganlarida 1.
func outputs(t string) int {
	if b, ok := Blocks[t]; ok {
		return len(b.Outputs)
	}
	return 1
}

// sourcePort — k-chiqish manbasi: `gid` (k = 0) yoki `gid.k`.
func sourcePort(id string, k int) string {
	if k == 0 {
		return id
	}
	return id + "." + strconv.Itoa(k)
}

// parseSource — `gid` yoki `gid.k` dan element id si va chiqish raqami; noto'g'ri bo'lsa k = -1.
func parseSource(s string) (string, int) {
	i := strings.LastIndexByte(s, '.')
	if i < 0 {
		return s, 0
	}
	k, err := strconv.Atoi(s[i+1:])
	if err != nil || k <= 0 {
		return s, -1
	}
	return s[:i], k
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

// op — bitta element: vals[dst] = lut ning (vals[a]<<1 | vals[b])-biti. Blokda (ins != nil) esa
// r = kirishlar bitlari, dsts[k] = luts[k] ning r-biti.
type op struct {
	lut       uint8
	a, b, dst int32
	ins       []int32
	table     []uint8
	dsts      []int32
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
	id, k := parseSource(s)
	g, ok := gates[id]
	return ok && k >= 0 && k < outputs(g.Type) && sourcePort(id, k) == s
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
	k, err := strconv.Atoi(idx)
	return ok && err == nil && len(idx) == 1 && k >= 0 && k < arity[g.Type]
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
			if src, ok := drivers[fmt.Sprintf("%s:%d", g.ID, i)]; ok && !strings.HasPrefix(src, "in:") {
				if id, _ := parseSource(src); gates[id].Type != "" {
					indeg[g.ID]++
					users[id] = append(users[id], g.ID)
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
	next := int32(n)
	for _, g := range c.order {
		for k := range outputs(g.Type) {
			slot[sourcePort(g.ID, k)] = next
			next++
		}
	}
	src := func(sink string) int32 { return slot[c.drivers[sink]] }
	c.nVals = int(next)
	for _, g := range c.order {
		at := slot[g.ID]
		if g.Type == "DFF" {
			c.dffVal = append(c.dffVal, at)
			c.dffSrc = append(c.dffSrc, src(g.ID+":0"))
			continue
		}
		if b, ok := Blocks[g.Type]; ok {
			o := op{table: b.Table}
			for i := range b.Inputs {
				o.ins = append(o.ins, src(fmt.Sprintf("%s:%d", g.ID, i)))
			}
			for k := range b.Outputs {
				o.dsts = append(o.dsts, at+int32(k))
			}
			c.ops = append(c.ops, o)
			continue
		}
		a := src(g.ID + ":0")
		b := a // bir kirishli element (NOT) b ni ishlatmaydi
		if arity[g.Type] == 2 {
			b = src(g.ID + ":1")
		}
		c.ops = append(c.ops, op{lut: lut[g.Type], a: a, b: b, dst: at})
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
		if o.ins == nil {
			vals[o.dst] = o.lut >> (vals[o.a]<<1 | vals[o.b]) & 1
			continue
		}
		r := 0
		for _, at := range o.ins {
			r = r<<1 | int(vals[at])
		}
		m := o.table[r]
		for k, at := range o.dsts {
			vals[at] = m >> k & 1
		}
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
		id, k := parseSource(p)
		return sourcePort(ids[id], k)
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
