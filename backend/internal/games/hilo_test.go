package games

import "testing"

func TestHiLoGame(t *testing.T) {
	game := &HiLoGame{}

	spec := game.Spec()
	if spec.ID != "hilo" {
		t.Errorf("expected ID 'hilo', got '%s'", spec.ID)
	}

	if fc := game.FloatCount(nil); fc != 52 {
		t.Errorf("expected FloatCount 52, got %d", fc)
	}
}

func TestHiLoEvaluation(t *testing.T) {
	game := &HiLoGame{}
	seeds := Seeds{Server: "test_server", Client: "test_client"}

	result, err := game.Evaluate(seeds, 1, nil)
	if err != nil {
		t.Fatalf("Evaluation failed: %v", err)
	}

	details, ok := result.Details.(map[string]any)
	if !ok {
		t.Fatal("expected details map")
	}

	cards, ok := details["cards"].([]string)
	if !ok {
		t.Fatal("expected cards to be []string")
	}

	if len(cards) != 52 {
		t.Errorf("expected 52 cards, got %d", len(cards))
	}

	// Each card should contain a suit symbol and a rank
	for _, card := range cards {
		if len(card) < 2 {
			t.Errorf("invalid card: %s", card)
		}
	}

	// Metric should be a valid first-card index (0-51)
	if result.Metric < 0 || result.Metric > 51 {
		t.Errorf("metric (first card index) should be 0-51, got %f", result.Metric)
	}
}

func TestHiLoCardMapping(t *testing.T) {
	game := &HiLoGame{}

	// Float of 0.0 should give first card (♦2)
	result, err := game.EvaluateWithFloats([]float64{0.0}, nil)
	if err != nil {
		t.Fatalf("Evaluation failed: %v", err)
	}
	details := result.Details.(map[string]any)
	firstCard := details["first_card"].(string)
	if firstCard != "♦2" {
		t.Errorf("float 0.0 should give ♦2, got %s", firstCard)
	}
	if result.Metric != 0 {
		t.Errorf("float 0.0 should give metric index 0, got %f", result.Metric)
	}

	// Float of 0.999 should give last card (♣A)
	result, err = game.EvaluateWithFloats([]float64{0.999}, nil)
	if err != nil {
		t.Fatalf("Evaluation failed: %v", err)
	}
	details = result.Details.(map[string]any)
	firstCard = details["first_card"].(string)
	if firstCard != "♣A" {
		t.Errorf("float 0.999 should give ♣A, got %s", firstCard)
	}
	if result.Metric != 51 {
		t.Errorf("float 0.999 should give metric index 51, got %f", result.Metric)
	}
}

func TestHiLoDeterminism(t *testing.T) {
	game := &HiLoGame{}
	seeds := Seeds{Server: "abc123", Client: "def456"}

	r1, _ := game.Evaluate(seeds, 42, nil)
	r2, _ := game.Evaluate(seeds, 42, nil)

	if r1.Metric != r2.Metric {
		t.Errorf("determinism failed: %f != %f", r1.Metric, r2.Metric)
	}
}
