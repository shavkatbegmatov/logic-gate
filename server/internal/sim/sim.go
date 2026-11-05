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
	// Koordinatalar uchun chegara: saqlanadigan JSON hajmini cheklaydi.
	maxCoord = 100000
)

var gateIDRe = regexp.MustCompile(`^[a-z0-9_]{1,16}$`)

var arity = map[string]int{
	"NOT": 1, "AND": 2, "OR": 2, "XOR": 2, "NAND": 2, "NOR": 2, "XNOR": 2,
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

func apply(t string, a, b uint8) uint8 {
	switch t {
	case "NOT":
		return a ^ 1
	case "AND":
		return a & b
	case "OR":
		return a | b
	case "XOR":
		return a ^ b
	case "NAND":
		return (a & b) ^ 1
	case "NOR":
		return (a | b) ^ 1
	case "XNOR":
		return (a ^ b) ^ 1
	}
	return 0
}

// compiled — tekshiruvdan o'tgan sxema: elementlar topologik tartibda.
type compiled struct {
	spec    Spec
	order   []Gate
	drivers map[string]string
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
	return &compiled{spec: spec, order: order, drivers: drivers}, nil
}

// Validate sxemani qat'iy tekshiradi; xato bo'lmasa nil qaytaradi.
func Validate(spec Spec, c Circuit) *Error {
	_, err := compile(spec, c)
	return err
}

// row r-qator uchun chiqishlarni hisoblaydi (birinchi kirish — eng katta bit).
func (c *compiled) row(r int) []uint8 {
	n := len(c.spec.Inputs)
	values := make(map[string]uint8, n+len(c.order))
	for k, name := range c.spec.Inputs {
		values["in:"+name] = uint8(r>>(n-1-k)) & 1
	}
	for _, g := range c.order {
		a := values[c.drivers[g.ID+":0"]]
		b := values[c.drivers[g.ID+":1"]]
		values[g.ID] = apply(g.Type, a, b)
	}
	out := make([]uint8, len(c.spec.Outputs))
	for i, o := range c.spec.Outputs {
		out[i] = values[c.drivers["out:"+o]]
	}
	return out
}

// Check sxemani tekshiradi va target jadval bilan solishtiradi.
// Xato qatorlar bo'lsa, wrongRows to'ldiriladi (err nil bo'ladi).
func Check(spec Spec, target map[string]string, c Circuit) (gates int, wrongRows []int, err *Error) {
	cc, err := compile(spec, c)
	if err != nil {
		return 0, nil, err
	}
	for r := range 1 << len(spec.Inputs) {
		got := cc.row(r)
		for i, o := range spec.Outputs {
			if got[i] != target[o][r]-'0' {
				wrongRows = append(wrongRows, r)
				break
			}
		}
	}
	return len(c.Gates), wrongRows, nil
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
