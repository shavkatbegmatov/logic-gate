package sim

import (
	"encoding/json"
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
	if len(pack.Levels) != 30 {
		t.Fatalf("30 ta daraja kutilgan, %d bor", len(pack.Levels))
	}
	for _, l := range pack.Levels {
		gates, wrong, cerr := Check(specOf(&l), l.Target, sols[l.ID])
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
