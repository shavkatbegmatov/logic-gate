package sim

import (
	"encoding/json"
	"fmt"
	"os"
	"slices"
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
	if len(pack.Levels) != 36 {
		t.Fatalf("36 ta daraja kutilgan, %d bor", len(pack.Levels))
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
