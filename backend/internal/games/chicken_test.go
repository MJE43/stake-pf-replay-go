package games

import "testing"

func TestChickenGame(t *testing.T) {
	game := &ChickenGame{}

	spec := game.Spec()
	if spec.ID != "chicken" {
		t.Errorf("expected ID 'chicken', got '%s'", spec.ID)
	}
	if spec.MetricLabel != "death_round" {
		t.Errorf("expected MetricLabel 'death_round', got '%s'", spec.MetricLabel)
	}

	if fc := game.FloatCount(nil); fc != 20 {
		t.Errorf("expected FloatCount 20, got %d", fc)
	}
}

func TestChickenEvaluation(t *testing.T) {
	game := &ChickenGame{}
	seeds := Seeds{Server: "test_server", Client: "test_client"}

	// Test with default bones (1)
	result, err := game.Evaluate(seeds, 1, nil)
	if err != nil {
		t.Fatalf("Evaluation failed: %v", err)
	}

	details, ok := result.Details.(map[string]any)
	if !ok {
		t.Fatal("expected details map")
	}

	deathRounds, ok := details["death_rounds"].([]int)
	if !ok {
		t.Fatal("expected death_rounds to be []int")
	}

	if len(deathRounds) != 1 {
		t.Errorf("expected 1 death round, got %d", len(deathRounds))
	}

	// Death round should be between 1 and 20
	for _, r := range deathRounds {
		if r < 1 || r > 20 {
			t.Errorf("death round %d out of range [1, 20]", r)
		}
	}

	// First death should match metric
	firstDeath, _ := details["first_death"].(int)
	if float64(firstDeath) != result.Metric {
		t.Errorf("metric mismatch: expected %d, got %f", firstDeath, result.Metric)
	}

	// Safe steps should be first_death - 1
	safeSteps, _ := details["safe_steps"].(int)
	if safeSteps != firstDeath-1 {
		t.Errorf("safe_steps should be %d, got %d", firstDeath-1, safeSteps)
	}
}

func TestChickenMultipleBones(t *testing.T) {
	game := &ChickenGame{}
	seeds := Seeds{Server: "test_server", Client: "test_client"}

	for _, boneCount := range []int{1, 5, 10, 19, 20} {
		params := map[string]any{"bones": float64(boneCount)}
		result, err := game.Evaluate(seeds, 1, params)
		if err != nil {
			t.Errorf("Evaluation failed for bones=%d: %v", boneCount, err)
			continue
		}

		details := result.Details.(map[string]any)
		deathRounds := details["death_rounds"].([]int)
		if len(deathRounds) != boneCount {
			t.Errorf("expected %d death rounds, got %d", boneCount, len(deathRounds))
		}

		// All death rounds should be unique
		seen := make(map[int]bool)
		for _, r := range deathRounds {
			if seen[r] {
				t.Errorf("duplicate death round: %d (bones=%d)", r, boneCount)
			}
			seen[r] = true
		}
	}
}

func TestChickenInvalidParams(t *testing.T) {
	game := &ChickenGame{}

	// Bones too low
	_, err := game.EvaluateWithFloats(make([]float64, 20), map[string]any{"bones": float64(0)})
	if err == nil {
		t.Error("expected error for bones=0")
	}

	// Bones too high
	_, err = game.EvaluateWithFloats(make([]float64, 20), map[string]any{"bones": float64(21)})
	if err == nil {
		t.Error("expected error for bones=21")
	}

	// Not enough floats
	_, err = game.EvaluateWithFloats(make([]float64, 10), nil)
	if err == nil {
		t.Error("expected error for insufficient floats")
	}
}

func TestChickenDeterminism(t *testing.T) {
	game := &ChickenGame{}
	seeds := Seeds{Server: "abc123", Client: "def456"}

	r1, _ := game.Evaluate(seeds, 42, map[string]any{"bones": float64(3)})
	r2, _ := game.Evaluate(seeds, 42, map[string]any{"bones": float64(3)})

	if r1.Metric != r2.Metric {
		t.Errorf("determinism failed: %f != %f", r1.Metric, r2.Metric)
	}
}
