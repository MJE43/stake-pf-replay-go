package games

import "testing"

func TestBlackjackGame(t *testing.T) {
	game := &BlackjackGame{}

	spec := game.Spec()
	if spec.ID != "blackjack" {
		t.Errorf("expected ID 'blackjack', got '%s'", spec.ID)
	}

	if fc := game.FloatCount(nil); fc != 52 {
		t.Errorf("expected FloatCount 52, got %d", fc)
	}
}

func TestBlackjackEvaluation(t *testing.T) {
	game := &BlackjackGame{}
	seeds := Seeds{Server: "test_server", Client: "test_client"}

	result, err := game.Evaluate(seeds, 1, nil)
	if err != nil {
		t.Fatalf("Evaluation failed: %v", err)
	}

	details, ok := result.Details.(map[string]any)
	if !ok {
		t.Fatal("expected details map")
	}

	playerCards, ok := details["player_cards"].([]string)
	if !ok {
		t.Fatal("expected player_cards to be []string")
	}
	if len(playerCards) != 2 {
		t.Errorf("expected 2 initial player cards, got %d", len(playerCards))
	}

	dealerCards, ok := details["dealer_cards"].([]string)
	if !ok {
		t.Fatal("expected dealer_cards to be []string")
	}
	if len(dealerCards) != 2 {
		t.Errorf("expected 2 initial dealer cards, got %d", len(dealerCards))
	}

	playerValue, ok := details["player_value"].(int)
	if !ok {
		t.Fatal("expected player_value to be int")
	}
	if playerValue < 2 || playerValue > 21 {
		t.Errorf("player value should be 2-21, got %d", playerValue)
	}

	dealerValue, ok := details["dealer_value"].(int)
	if !ok {
		t.Fatal("expected dealer_value to be int")
	}
	if dealerValue < 2 || dealerValue > 21 {
		t.Errorf("dealer value should be 2-21, got %d", dealerValue)
	}

	if result.Metric < 0 || result.Metric > 51 {
		t.Errorf("metric (first card index) should be 0-51, got %f", result.Metric)
	}
}

func TestBlackjackHandValues(t *testing.T) {
	tests := []struct {
		name     string
		cards    []Card
		expected int
	}{
		{"pair of 10s", []Card{{Rank: "10"}, {Rank: "10"}}, 20},
		{"blackjack", []Card{{Rank: "A"}, {Rank: "K"}}, 21},
		{"soft 17", []Card{{Rank: "A"}, {Rank: "6"}}, 17},
		{"double ace", []Card{{Rank: "A"}, {Rank: "A"}}, 12},
		{"bust rescue", []Card{{Rank: "A"}, {Rank: "5"}, {Rank: "8"}}, 14},
		{"triple bust", []Card{{Rank: "10"}, {Rank: "5"}, {Rank: "8"}}, 23},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := blackjackHandValue(tt.cards)
			if got != tt.expected {
				t.Errorf("blackjackHandValue: expected %d, got %d", tt.expected, got)
			}
		})
	}
}

func TestBlackjackInsufficientFloats(t *testing.T) {
	game := &BlackjackGame{}
	_, err := game.EvaluateWithFloats([]float64{0.1, 0.2, 0.3}, nil)
	if err == nil {
		t.Error("expected error for insufficient floats")
	}
}

func TestBlackjackDeterminism(t *testing.T) {
	game := &BlackjackGame{}
	seeds := Seeds{Server: "abc123", Client: "def456"}

	r1, _ := game.Evaluate(seeds, 42, nil)
	r2, _ := game.Evaluate(seeds, 42, nil)

	if r1.Metric != r2.Metric {
		t.Errorf("determinism failed: %f != %f", r1.Metric, r2.Metric)
	}
}
