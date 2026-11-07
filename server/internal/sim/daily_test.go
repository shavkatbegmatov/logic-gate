package sim

import (
	"encoding/json"
	"os"
	"testing"

	"logicgate/levels"
)

// Har bir kunlik masalaning mos yozuvdagi yechimi to'g'ri va aynan "maqsad" elementdan iborat.
func TestDailySolutions(t *testing.T) {
	d, err := levels.LoadDaily()
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile("../../../levels/daily-solutions.json")
	if err != nil {
		t.Fatal(err)
	}
	var sols []Circuit
	if err := json.Unmarshal(raw, &sols); err != nil {
		t.Fatal(err)
	}
	if len(sols) != len(d.Puzzles) {
		t.Fatalf("%d ta yechim, %d ta masala", len(sols), len(d.Puzzles))
	}
	for i, p := range d.Puzzles {
		spec := Spec{Inputs: p.Inputs, Outputs: p.Outputs, Gates: p.Gates}
		gates, wrong, cerr := Check(spec, p.Target, sols[i])
		if cerr != nil || len(wrong) > 0 || gates != p.Goal {
			t.Errorf("%d-masala: err=%v wrong=%v gates=%d goal=%d", i+1, cerr, wrong, gates, p.Goal)
		}
		hint := 0
		for _, n := range p.Hint.Gates {
			hint += n
		}
		if hint != p.Goal {
			t.Errorf("%d-masala: maslahatda %d element, maqsad %d", i+1, hint, p.Goal)
		}
	}
}
