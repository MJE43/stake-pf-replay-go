package games

import "testing"

func TestMinesGame(t *testing.T) {
	game := &MinesGame{}

	spec := game.Spec()
	if spec.ID != "mines" {
		t.Errorf("expected ID 'mines', got '%s'", spec.ID)
	}
	if spec.MetricLabel != "first_bomb" {
		t.Errorf("expected MetricLabel 'first_bomb', got '%s'", spec.MetricLabel)
	}

	if fc := game.FloatCount(nil); fc != 24 {
		t.Errorf("expected FloatCount 24, got %d", fc)
	}
}

func TestMinesEvaluation(t *testing.T) {
	game := &MinesGame{}
	seeds := Seeds{Server: "test_server", Client: "test_client"}

	// Test with default mine count
	result, err := game.Evaluate(seeds, 1, nil)
	if err != nil {
		t.Fatalf("Evaluation failed: %v", err)
	}

	details, ok := result.Details.(map[string]any)
	if !ok {
		t.Fatal("expected details map")
	}

	mines, ok := details["mine_positions"].([]int)
	if !ok {
		t.Fatal("expected mine_positions to be []int")
	}

	// Default is 3 mines
	if len(mines) != 3 {
		t.Errorf("expected 3 mines, got %d", len(mines))
	}

	// All mine positions should be unique and in range [0, 24]
	seen := make(map[int]bool)
	for _, pos := range mines {
		if pos < 0 || pos > 24 {
			t.Errorf("mine position %d out of range [0, 24]", pos)
		}
		if seen[pos] {
			t.Errorf("duplicate mine position: %d", pos)
		}
		seen[pos] = true
	}

	// Test various mine counts
	for _, mineCount := range []int{1, 5, 10, 24} {
		params := map[string]any{"mineCount": float64(mineCount)}
		result, err := game.Evaluate(seeds, 1, params)
		if err != nil {
			t.Errorf("Evaluation failed for mineCount=%d: %v", mineCount, err)
			continue
		}

		details := result.Details.(map[string]any)
		mines := details["mine_positions"].([]int)
		if len(mines) != mineCount {
			t.Errorf("expected %d mines, got %d", mineCount, len(mines))
		}
	}
}

func TestMinesGridLayout(t *testing.T) {
	game := &MinesGame{}
	seeds := Seeds{Server: "test_server", Client: "test_client"}

	result, err := game.Evaluate(seeds, 1, map[string]any{"mineCount": float64(5)})
	if err != nil {
		t.Fatalf("Evaluation failed: %v", err)
	}

	details := result.Details.(map[string]any)
	grid, ok := details["grid"].([][]string)
	if !ok {
		t.Fatal("expected grid to be [][]string")
	}

	// 5x5 grid
	if len(grid) != 5 {
		t.Errorf("expected 5 rows, got %d", len(grid))
	}
	for i, row := range grid {
		if len(row) != 5 {
			t.Errorf("row %d: expected 5 columns, got %d", i, len(row))
		}
	}

	// Count mines in grid
	mineCount := 0
	for _, row := range grid {
		for _, cell := range row {
			if cell == "mine" {
				mineCount++
			} else if cell != "gem" {
				t.Errorf("unexpected cell value: %s", cell)
			}
		}
	}
	if mineCount != 5 {
		t.Errorf("expected 5 mines in grid, got %d", mineCount)
	}
}

func TestMinesInvalidParams(t *testing.T) {
	game := &MinesGame{}

	// Mine count too low
	_, err := game.EvaluateWithFloats(make([]float64, 24), map[string]any{"mineCount": float64(0)})
	if err == nil {
		t.Error("expected error for mineCount=0")
	}

	// Mine count too high
	_, err = game.EvaluateWithFloats(make([]float64, 24), map[string]any{"mineCount": float64(25)})
	if err == nil {
		t.Error("expected error for mineCount=25")
	}

	// Not enough floats
	_, err = game.EvaluateWithFloats(make([]float64, 10), nil)
	if err == nil {
		t.Error("expected error for insufficient floats")
	}
}

func TestMinesDeterminism(t *testing.T) {
	game := &MinesGame{}
	seeds := Seeds{Server: "abc123", Client: "def456"}

	r1, _ := game.Evaluate(seeds, 42, map[string]any{"mineCount": float64(5)})
	r2, _ := game.Evaluate(seeds, 42, map[string]any{"mineCount": float64(5)})

	d1 := r1.Details.(map[string]any)
	d2 := r2.Details.(map[string]any)

	m1 := d1["mine_positions"].([]int)
	m2 := d2["mine_positions"].([]int)

	for i := range m1 {
		if m1[i] != m2[i] {
			t.Errorf("determinism failed at index %d: %d != %d", i, m1[i], m2[i])
		}
	}
}
