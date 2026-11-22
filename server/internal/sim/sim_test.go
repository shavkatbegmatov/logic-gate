package sim

import (
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"os"
	"slices"
	"strings"
	"testing"

	"logicgate/levels"
)

func specOf(l *levels.Level) Spec {
	return Spec{Inputs: l.Inputs, Outputs: l.Outputs, Gates: l.Gates}
}

// Mos yozuvdagi yechimlar Go simulyatorida ham to'g'ri chiqishi kerak (TS bilan o'zaro tekshiruv).
func TestReferenceSolutions(t *testing.T) {
	pack, err := levels.Load()
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile("../../../levels/solutions.json")
	if err != nil {
		t.Fatal(err)
	}
	var sols map[string]Circuit
	if err := json.Unmarshal(raw, &sols); err != nil {
		t.Fatal(err)
	}
	if len(pack.Levels) != 48 {
		t.Fatalf("48 ta daraja kutilgan, %d bor", len(pack.Levels))
	}
	for _, l := range pack.Levels {
		var (
			gates int
			wrong []int
			cerr  *Error
		)
		if l.Seq != nil {
			gates, wrong, cerr = CheckSeq(specOf(&l), Machine{Next: l.Seq.Next, Out: l.Seq.Out}, sols[l.ID])
		} else {
			gates, wrong, cerr = Check(specOf(&l), l.Target, sols[l.ID])
		}
		if cerr != nil || len(wrong) > 0 || gates != l.Goal {
			t.Errorf("%s: err=%v wrong=%v gates=%d goal=%d", l.ID, cerr, wrong, gates, l.Goal)
		}
	}
}

func TestErrors(t *testing.T) {
	spec := Spec{Inputs: []string{"A", "B"}, Outputs: []string{"Q"}, Gates: []string{"AND", "OR", "NOT"}}
	cases := []struct {
		name string
		c    Circuit
		code string
	}{
		{"ulanmagan chiqish", Circuit{}, "unconnected_output"},
		{"ulanmagan kirish", Circuit{
			Gates: []Gate{{ID: "g1", Type: "AND"}},
			Wires: []Wire{{"in:A", "g1:0"}, {"g1", "out:Q"}},
		}, "unconnected_input"},
		{"sikl", Circuit{
			Gates: []Gate{{ID: "g1", Type: "OR"}, {ID: "g2", Type: "NOT"}},
			Wires: []Wire{{"in:A", "g1:0"}, {"g2", "g1:1"}, {"g1", "g2:0"}, {"g1", "out:Q"}},
		}, "cycle"},
		{"band kirish", Circuit{Wires: []Wire{{"in:A", "out:Q"}, {"in:B", "out:Q"}}}, "sink_taken"},
		{"ruxsatsiz element", Circuit{Gates: []Gate{{ID: "x", Type: "XOR"}}}, "gate_not_allowed"},
		{"noma'lum kirish", Circuit{Wires: []Wire{{"in:Z", "out:Q"}}}, "bad_wire"},
		{"NOT ning 2-kirishi", Circuit{Gates: []Gate{{ID: "n", Type: "NOT"}}, Wires: []Wire{{"in:A", "n:1"}}}, "bad_wire"},
		{"yomon id", Circuit{Gates: []Gate{{ID: "Bad id", Type: "NOT"}}}, "bad_gate"},
		{"takroriy id", Circuit{Gates: []Gate{{ID: "n", Type: "NOT"}, {ID: "n", Type: "NOT"}}}, "dup_gate"},
		{"katta koordinata", Circuit{Gates: []Gate{{ID: "n", Type: "NOT", X: 1e9}}}, "bad_gate"},
	}
	for _, tc := range cases {
		if err := Validate(spec, tc.c); err == nil || err.Code != tc.code {
			t.Errorf("%s: %v, kutilgan %s", tc.name, err, tc.code)
		}
	}

	big := Circuit{}
	for range MaxGates + 1 {
		big.Gates = append(big.Gates, Gate{ID: "g", Type: "NOT"})
	}
	if err := Validate(spec, big); err == nil || err.Code != "too_many_gates" {
		t.Errorf("katta sxema: %v", err)
	}
}

func TestWrongRows(t *testing.T) {
	spec := Spec{Inputs: []string{"A", "B"}, Outputs: []string{"Q"}, Gates: []string{"AND"}}
	c := Circuit{
		Gates: []Gate{{ID: "o", Type: "AND"}},
		Wires: []Wire{{"in:A", "o:0"}, {"in:A", "o:1"}, {"o", "out:Q"}},
	}
	_, wrong, err := Check(spec, map[string]string{"Q": "0001"}, c)
	if err != nil || !slices.Equal(wrong, []int{2}) {
		t.Fatalf("wrong=%v err=%v", wrong, err)
	}
}

func TestStars(t *testing.T) {
	for _, tc := range [][3]int{{4, 3, 3}, {4, 4, 3}, {4, 6, 2}, {4, 7, 1}} {
		if got := Stars(tc[0], tc[1]); got != tc[2] {
			t.Errorf("Stars(%d,%d)=%d", tc[0], tc[1], got)
		}
	}
}

// D-trigger: u orqali aylana sikl emas; avtomat bilan solishtirish TS dagi bilan bir xil eng qisqa
// farqni topadi (web/src/sim/sim.test.ts dagi s3 testi).
func TestSequential(t *testing.T) {
	pack, err := levels.Load()
	if err != nil {
		t.Fatal(err)
	}
	s3, _ := pack.Level("s3")
	spec := specOf(s3)
	m := Machine{Next: s3.Seq.Next, Out: s3.Seq.Out}

	toggle := Circuit{
		Gates: []Gate{{ID: "x", Type: "XOR"}, {ID: "d", Type: "DFF"}},
		Wires: []Wire{{"in:T", "x:0"}, {"d", "x:1"}, {"x", "d:0"}, {"d", "out:Q"}},
	}
	if gates, trace, err := CheckSeq(spec, m, toggle); err != nil || trace != nil || gates != 2 {
		t.Fatalf("almashtirgich: gates=%d trace=%v err=%v", gates, trace, err)
	}

	delay := Circuit{
		Gates: []Gate{{ID: "d", Type: "DFF"}},
		Wires: []Wire{{"in:T", "d:0"}, {"d", "out:Q"}},
	}
	if _, trace, err := CheckSeq(spec, m, delay); err != nil || !slices.Equal(trace, []int{1, 0, 0}) {
		t.Fatalf("kechikish: trace=%v err=%v", trace, err)
	}

	// Triggersiz aylana — sikl.
	loop := Circuit{
		Gates: []Gate{{ID: "x", Type: "XOR"}},
		Wires: []Wire{{"in:T", "x:0"}, {"x", "x:1"}, {"x", "out:Q"}},
	}
	if err := Validate(spec, loop); err == nil || err.Code != "cycle" {
		t.Fatalf("sikl: %v", err)
	}

	many := Circuit{Wires: []Wire{{"in:T", "out:Q"}}}
	for i := range MaxFlipflops + 1 {
		id := fmt.Sprintf("d%d", i)
		many.Gates = append(many.Gates, Gate{ID: id, Type: "DFF"})
		many.Wires = append(many.Wires, Wire{"in:T", id + ":0"})
	}
	if err := Validate(spec, many); err == nil || err.Code != "too_many_flipflops" {
		t.Fatalf("ko'p trigger: %v", err)
	}

	// Kombinatsion darajada DFF ruxsat etilmaydi.
	b1, _ := pack.Level("b1")
	dff := Circuit{Gates: []Gate{{ID: "d", Type: "DFF"}}, Wires: []Wire{{"in:A", "d:0"}, {"d", "out:Q"}}}
	if err := Validate(specOf(b1), dff); err == nil || err.Code != "gate_not_allowed" {
		t.Fatalf("b1 da DFF: %v", err)
	}
}

// ── Eski (har taktda xarita yaratadigan) hisoblash: faqat yangisi bilan solishtirish uchun ──

func oldApply(t string, a, b uint8) uint8 {
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

func (c *compiled) oldStep(r int, state uint64) ([]uint8, uint64) {
	n := len(c.spec.Inputs)
	values := make(map[string]uint8, n+len(c.order))
	for k, name := range c.spec.Inputs {
		values["in:"+name] = uint8(r>>(n-1-k)) & 1
	}
	bit := make(map[string]int, len(c.dffs))
	for i, id := range c.dffs {
		bit[id] = i
		values[id] = uint8(state>>i) & 1
	}
	for _, g := range c.order {
		if g.Type == "DFF" {
			continue
		}
		a := values[c.drivers[g.ID+":0"]]
		b := values[c.drivers[g.ID+":1"]]
		values[g.ID] = oldApply(g.Type, a, b)
	}
	out := make([]uint8, len(c.spec.Outputs))
	for i, o := range c.spec.Outputs {
		out[i] = values[c.drivers["out:"+o]]
	}
	var next uint64
	for id, i := range bit {
		next |= uint64(values[c.drivers[id+":0"]]) << i
	}
	return out, next
}

func oldCheck(spec Spec, target map[string]string, c Circuit) (gates int, wrongRows []int, err *Error) {
	cc, err := compile(spec, c)
	if err != nil {
		return 0, nil, err
	}
	for r := range 1 << len(spec.Inputs) {
		got, _ := cc.oldStep(r, 0)
		for i, o := range spec.Outputs {
			if got[i] != target[o][r]-'0' {
				wrongRows = append(wrongRows, r)
				break
			}
		}
	}
	return len(c.Gates), wrongRows, nil
}

func oldCheckSeq(spec Spec, m Machine, c Circuit) (gates int, trace []int, err *Error) {
	cc, err := compile(spec, c)
	if err != nil {
		return 0, nil, err
	}
	type pair struct {
		state uint64
		s     int
	}
	type edge struct {
		prev pair
		row  int
		root bool
	}
	start := pair{0, 0}
	parent := map[pair]edge{start: {root: true}}
	queue := []pair{start}
	rows := 1 << len(spec.Inputs)
	for qi := 0; qi < len(queue); qi++ {
		p := queue[qi]
		for r := range rows {
			got, nextState := cc.oldStep(r, p.state)
			want := m.Out[p.s][r]
			for i := range got {
				if got[i] != want[i]-'0' {
					trace = []int{r}
					for e := parent[p]; !e.root; e = parent[e.prev] {
						trace = append([]int{e.row}, trace...)
					}
					return len(c.Gates), trace, nil
				}
			}
			next := pair{nextState, m.Next[p.s][r]}
			if _, seen := parent[next]; !seen {
				parent[next] = edge{prev: p, row: r}
				queue = append(queue, next)
			}
		}
	}
	return len(c.Gates), nil, nil
}

// randomCircuit — tasodifiy spec va sxema: ko'pincha to'g'ri (kombinatsion manba — oldingi element yoki
// istalgan trigger), ba'zan sikl, ulanmagan kirish yoki ko'p trigger bilan.
func randomCircuit(rng *rand.Rand) (Spec, Circuit) {
	spec := Spec{Gates: []string{"NOT", "AND", "OR", "XOR", "NAND", "NOR", "XNOR", "DFF"}}
	for i := range 1 + rng.IntN(4) {
		spec.Inputs = append(spec.Inputs, string(rune('A'+i)))
	}
	for i := range 1 + rng.IntN(3) {
		spec.Outputs = append(spec.Outputs, fmt.Sprintf("Q%d", i))
	}
	var c Circuit
	dffs := 0
	for i := range rng.IntN(16) {
		t := spec.Gates[rng.IntN(len(spec.Gates))]
		if t == "DFF" {
			if dffs++; dffs > MaxFlipflops && rng.IntN(4) > 0 {
				t = "NOT"
			}
		}
		c.Gates = append(c.Gates, Gate{ID: fmt.Sprintf("x%d", i), Type: t, X: rng.Float64() * 900, Y: -rng.Float64() * 900})
	}
	source := func(i int) string {
		for {
			k := rng.IntN(len(spec.Inputs) + len(c.Gates))
			if k < len(spec.Inputs) {
				return "in:" + spec.Inputs[k]
			}
			g := c.Gates[k-len(spec.Inputs)]
			if k-len(spec.Inputs) < i || g.Type == "DFF" || rng.IntN(25) == 0 {
				return g.ID
			}
		}
	}
	for i, g := range c.Gates {
		for k := range arity[g.Type] {
			if rng.IntN(40) > 0 {
				c.Wires = append(c.Wires, Wire{From: source(i), To: fmt.Sprintf("%s:%d", g.ID, k)})
			}
		}
	}
	for _, o := range spec.Outputs {
		if rng.IntN(40) > 0 {
			c.Wires = append(c.Wires, Wire{From: source(len(c.Gates)), To: "out:" + o})
		}
	}
	// Ro'yxat tartibi topologik bo'lishi shart emas.
	rng.Shuffle(len(c.Gates), func(i, j int) { c.Gates[i], c.Gates[j] = c.Gates[j], c.Gates[i] })
	rng.Shuffle(len(c.Wires), func(i, j int) { c.Wires[i], c.Wires[j] = c.Wires[j], c.Wires[i] })
	return spec, c
}

// machineOf — sxemaning o'zidan avtomat (holat — triggerlar bitmaskasi); flip > 0 bo'lsa, tasodifiy
// joylarda chiqish teskarisiga almashtiriladi.
func machineOf(rng *rand.Rand, spec Spec, c Circuit, flip int) Machine {
	cc, _ := compile(spec, c)
	states, rows := 1<<len(cc.dffs), 1<<len(spec.Inputs)
	m := Machine{Next: make([][]int, states), Out: make([][]string, states)}
	for s := range states {
		m.Next[s], m.Out[s] = make([]int, rows), make([]string, rows)
		for r := range rows {
			out, next := cc.oldStep(r, uint64(s))
			var b strings.Builder
			for _, v := range out {
				b.WriteByte('0' + v)
			}
			m.Next[s][r], m.Out[s][r] = int(next), b.String()
		}
	}
	for range flip {
		s, r, i := rng.IntN(states), rng.IntN(rows), rng.IntN(len(spec.Outputs))
		o := []byte(m.Out[s][r])
		o[i] ^= 1
		m.Out[s][r] = string(o)
	}
	return m
}

func randomMachine(rng *rand.Rand, spec Spec) Machine {
	states, rows := 1+rng.IntN(4), 1<<len(spec.Inputs)
	m := Machine{Next: make([][]int, states), Out: make([][]string, states)}
	for s := range states {
		m.Next[s], m.Out[s] = make([]int, rows), make([]string, rows)
		for r := range rows {
			o := make([]byte, len(spec.Outputs))
			for i := range o {
				o[i] = '0' + byte(rng.IntN(2))
			}
			m.Next[s][r], m.Out[s][r] = rng.IntN(states), string(o)
		}
	}
	return m
}

func sameResult(t *testing.T, what string, g1 int, r1 []int, e1 *Error, g2 int, r2 []int, e2 *Error) {
	t.Helper()
	if g1 != g2 || !slices.Equal(r1, r2) || (r1 == nil) != (r2 == nil) || (e1 == nil) != (e2 == nil) || (e1 != nil && *e1 != *e2) {
		t.Fatalf("%s: yangi %d %v %v, eski %d %v %v", what, g1, r1, e1, g2, r2, e2)
	}
}

// Yangi (slice'li) hisoblash eskisi bilan aynan bir xil natija beradi: tasodifiy sxemalar, avtomatlar
// va jadvallarda, mos yozuvdagi yechimlarda va ortiqcha trigger/elementlar bilan to'ldirilgan sxemalarda.
func TestStepMatchesOld(t *testing.T) {
	rng := rand.New(rand.NewPCG(1, 2))
	valid, traces := 0, 0
	for i := range 4000 {
		spec, c := randomCircuit(rng)
		target := map[string]string{}
		for _, o := range spec.Outputs {
			var b strings.Builder
			for range 1 << len(spec.Inputs) {
				b.WriteByte('0' + byte(rng.IntN(2)))
			}
			target[o] = b.String()
		}
		g1, r1, e1 := Check(spec, target, c)
		g2, r2, e2 := oldCheck(spec, target, c)
		sameResult(t, fmt.Sprintf("%d: Check", i), g1, r1, e1, g2, r2, e2)
		machines := []Machine{randomMachine(rng, spec)}
		if e1 == nil {
			valid++
			machines = append(machines, machineOf(rng, spec, c, 0), machineOf(rng, spec, c, 1+rng.IntN(3)))
		}
		for k, m := range machines {
			g1, r1, e1 := CheckSeq(spec, m, c)
			g2, r2, e2 := oldCheckSeq(spec, m, c)
			sameResult(t, fmt.Sprintf("%d/%d: CheckSeq", i, k), g1, r1, e1, g2, r2, e2)
			if k == 1 && (e1 != nil || r1 != nil) {
				t.Fatalf("%d: sxemaning o'z avtomati bilan farq: %v %v", i, r1, e1)
			}
			if len(r1) > 1 {
				traces++
			}
		}
	}
	// Tasodif haqiqatan ham turli holatlarni qamrab olsin.
	if valid < 1000 || traces < 100 {
		t.Fatalf("qamrov kam: to'g'ri sxemalar %d, uzun izlar %d", valid, traces)
	}

	pack, err := levels.Load()
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile("../../../levels/solutions.json")
	if err != nil {
		t.Fatal(err)
	}
	var sols map[string]Circuit
	json.Unmarshal(raw, &sols)
	for _, l := range pack.Levels {
		spec := specOf(&l)
		for _, c := range []Circuit{sols[l.ID], padSeq(sols[l.ID], spec)} {
			if l.Seq != nil {
				m := Machine{Next: l.Seq.Next, Out: l.Seq.Out}
				g1, r1, e1 := CheckSeq(spec, m, c)
				g2, r2, e2 := oldCheckSeq(spec, m, c)
				sameResult(t, l.ID, g1, r1, e1, g2, r2, e2)
				continue
			}
			g1, r1, e1 := Check(spec, l.Target, c)
			g2, r2, e2 := oldCheck(spec, l.Target, c)
			sameResult(t, l.ID, g1, r1, e1, g2, r2, e2)
		}
	}
}

// padSeq — yechimga MaxFlipflops gacha trigger (siljish registri) va MaxGates gacha keraksiz element
// qo'shadi: ketma-ket tekshiruvdagi eng og'ir holat (holatlar 2^8 marta ko'payadi).
func padSeq(base Circuit, spec Spec) Circuit {
	c := Circuit{Gates: slices.Clone(base.Gates), Wires: slices.Clone(base.Wires)}
	pad := "NOT"
	for _, t := range spec.Gates {
		if arity[t] == 2 {
			pad = t
		}
	}
	dffs := 0
	for _, g := range c.Gates {
		if g.Type == "DFF" {
			dffs++
		}
	}
	prev := "in:" + spec.Inputs[0]
	for i := 0; dffs < MaxFlipflops && slices.Contains(spec.Gates, "DFF"); i++ {
		id := fmt.Sprintf("sr%d", i)
		c.Gates = append(c.Gates, Gate{ID: id, Type: "DFF"})
		c.Wires = append(c.Wires, Wire{From: prev, To: id + ":0"})
		prev, dffs = id, dffs+1
	}
	for i := 0; len(c.Gates) < MaxGates; i++ {
		id := fmt.Sprintf("p%d", i)
		c.Gates = append(c.Gates, Gate{ID: id, Type: pad})
		c.Wires = append(c.Wires, Wire{From: prev, To: id + ":0"})
		if arity[pad] == 2 {
			c.Wires = append(c.Wires, Wire{From: "in:" + spec.Inputs[0], To: id + ":1"})
		}
		prev = id
	}
	return c
}

// BenchmarkCheckSeqPadded — eng og'ir ketma-ket tekshiruv (8 trigger, 64 element).
func BenchmarkCheckSeqPadded(b *testing.B) {
	pack, _ := levels.Load()
	raw, _ := os.ReadFile("../../../levels/solutions.json")
	var sols map[string]Circuit
	json.Unmarshal(raw, &sols)
	var l *levels.Level
	for i := range pack.Levels {
		if s := pack.Levels[i].Seq; s != nil && (l == nil || len(s.Next) > len(l.Seq.Next)) {
			l = &pack.Levels[i]
		}
	}
	spec, m := specOf(l), Machine{Next: l.Seq.Next, Out: l.Seq.Out}
	c := padSeq(sols[l.ID], spec)
	check := CheckSeq
	if strings.HasSuffix(b.Name(), "Old") {
		check = oldCheckSeq
	}
	for b.Loop() {
		if _, trace, err := check(spec, m, c); trace != nil || err != nil {
			b.Fatal(trace, err)
		}
	}
}

// BenchmarkCheckSeqPaddedOld — o'sha sxema eski (xaritali) hisoblash bilan, solishtirish uchun.
func BenchmarkCheckSeqPaddedOld(b *testing.B) { BenchmarkCheckSeqPadded(b) }

// Saqlash uchun ixcham ko'rinish: qisqa id lar (simlar ham), butun koordinatalar, natija o'zgarmaydi.
func TestCanonical(t *testing.T) {
	spec := Spec{Inputs: []string{"A", "B"}, Outputs: []string{"Q"}, Gates: []string{"AND", "NOT"}}
	c := Circuit{
		Gates: []Gate{
			{ID: "zzzzzzzzzzzzzzz1", Type: "NOT", X: -0.4, Y: 99999.99999999999},
			{ID: "a_very_long_id_2", Type: "AND", X: 12.5, Y: -33333.3333333},
		},
		Wires: []Wire{
			{"in:A", "zzzzzzzzzzzzzzz1:0"}, {"zzzzzzzzzzzzzzz1", "a_very_long_id_2:0"},
			{"in:B", "a_very_long_id_2:1"}, {"a_very_long_id_2", "out:Q"},
		},
	}
	got := Canonical(c)
	b, _ := json.Marshal(got)
	want := `{"gates":[{"id":"g1","type":"NOT","x":0,"y":10000},{"id":"g2","type":"AND","x":13,"y":-10000}],` +
		`"wires":[{"from":"in:A","to":"g1:0"},{"from":"g1","to":"g2:0"},{"from":"in:B","to":"g2:1"},{"from":"g2","to":"out:Q"}]}`
	if string(b) != want {
		t.Fatalf("Canonical:\n%s\nkutilgan:\n%s", b, want)
	}
	target := map[string]string{"Q": "0100"} // Q = ¬A ∧ B
	g1, r1, e1 := Check(spec, target, c)
	g2, r2, e2 := Check(spec, target, got)
	sameResult(t, "ixcham sxema", g1, r1, e1, g2, r2, e2)
	if e1 != nil || len(r1) != 0 {
		t.Fatalf("sxema: %v %v", r1, e1)
	}
	if b, _ := json.Marshal(Canonical(Circuit{})); string(b) != `{"gates":[],"wires":[]}` {
		t.Fatalf("bo'sh: %s", b)
	}
}
