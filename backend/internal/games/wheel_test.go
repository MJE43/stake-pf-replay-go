package games

import "testing"

func TestWheelGame(t *testing.T) {
	game := &WheelGame{}

	// Test spec
	spec := game.Spec()
	if spec.ID != "wheel" {
		t.Errorf("expected ID 'wheel', got '%s'", spec.ID)
	}
	if spec.MetricLabel != "multiplier" {
		t.Errorf("expected MetricLabel 'multiplier', got '%s'", spec.MetricLabel)
	}

	// Test float count
	if fc := game.FloatCount(nil); fc != 1 {
		t.Errorf("expected FloatCount 1, got %d", fc)
	}
}

func TestWheelEvaluation(t *testing.T) {
	game := &WheelGame{}
	seeds := Seeds{Server: "test_server", Client: "test_client"}

	// Test default params (10 segments, low risk)
	result, err := game.Evaluate(seeds, 1, nil)
	if err != nil {
		t.Fatalf("Evaluation failed: %v", err)
	}
	if result.Metric < 0 {
		t.Errorf("multiplier should be >= 0, got %f", result.Metric)
	}

	// Test all segment/risk combos produce valid results
	for _, seg := range []int{10, 20, 30, 40, 50} {
		for _, risk := range []string{"low", "medium", "high"} {
			params := map[string]any{"segments": float64(seg), "risk": risk}
			result, err := game.Evaluate(seeds, 1, params)
			if err != nil {
				t.Errorf("Evaluation failed for segments=%d risk=%s: %v", seg, risk, err)
				continue
			}

			details, ok := result.Details.(map[string]any)
			if !ok {
				t.Errorf("expected details map for segments=%d risk=%s", seg, risk)
				continue
			}

			gotSeg, _ := details["segments"].(int)
			gotRisk, _ := details["risk"].(string)
			if gotSeg != seg {
				t.Errorf("expected segments=%d, got %d", seg, gotSeg)
			}
			if gotRisk != risk {
				t.Errorf("expected risk=%s, got %s", risk, gotRisk)
			}
		}
	}

	// Test invalid segments
	_, err = game.EvaluateWithFloats([]float64{0.5}, map[string]any{"segments": float64(15)})
	if err == nil {
		t.Error("expected error for invalid segments, got nil")
	}

	// Test invalid risk
	_, err = game.EvaluateWithFloats([]float64{0.5}, map[string]any{"risk": "extreme"})
	if err == nil {
		t.Error("expected error for invalid risk, got nil")
	}

	// Test not enough floats
	_, err = game.EvaluateWithFloats([]float64{}, nil)
	if err == nil {
		t.Error("expected error for empty floats, got nil")
	}
}

func TestWheelPayoutTables(t *testing.T) {
	game := &WheelGame{}

	// Test that high risk with last segment yields max payout
	tests := []struct {
		segments int
		expected float64
	}{
		{10, 9.9},
		{20, 19.8},
		{30, 29.7},
		{40, 39.6},
		{50, 49.5},
	}

	for _, tt := range tests {
		// A float of 0.999... should map to the last segment
		f := 0.999
		params := map[string]any{"segments": float64(tt.segments), "risk": "high"}
		result, err := game.EvaluateWithFloats([]float64{f}, params)
		if err != nil {
			t.Errorf("Evaluation failed for %d segments: %v", tt.segments, err)
			continue
		}
		if result.Metric != tt.expected {
			t.Errorf("segments=%d high risk last slot: expected %f, got %f", tt.segments, tt.expected, result.Metric)
		}
	}
}

func TestWheelConsistency(t *testing.T) {
	game := &WheelGame{}
	seeds := Seeds{Server: "abc123", Client: "def456"}

	// Same inputs should produce same outputs
	r1, _ := game.Evaluate(seeds, 42, map[string]any{"segments": float64(20), "risk": "medium"})
	r2, _ := game.Evaluate(seeds, 42, map[string]any{"segments": float64(20), "risk": "medium"})

	if r1.Metric != r2.Metric {
		t.Errorf("determinism failed: %f != %f", r1.Metric, r2.Metric)
	}
}
