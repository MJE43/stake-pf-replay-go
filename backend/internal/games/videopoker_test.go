package games

import "testing"

func TestVideoPokerGame(t *testing.T) {
	game := &VideoPokerGame{}

	spec := game.Spec()
	if spec.ID != "videopoker" {
		t.Errorf("expected ID 'videopoker', got '%s'", spec.ID)
	}

	if fc := game.FloatCount(nil); fc != 52 {
		t.Errorf("expected FloatCount 52, got %d", fc)
	}
}

func TestVideoPokerEvaluation(t *testing.T) {
	game := &VideoPokerGame{}
	seeds := Seeds{Server: "test_server", Client: "test_client"}

	result, err := game.Evaluate(seeds, 1, nil)
	if err != nil {
		t.Fatalf("Evaluation failed: %v", err)
	}

	details, ok := result.Details.(map[string]any)
	if !ok {
		t.Fatal("expected details map")
	}

	hand, ok := details["hand"].([]string)
	if !ok {
		t.Fatal("expected hand to be []string")
	}
	if len(hand) != 5 {
		t.Errorf("expected 5-card hand, got %d", len(hand))
	}

	replacements, ok := details["replacements"].([]string)
	if !ok {
		t.Fatal("expected replacements to be []string")
	}
	if len(replacements) != 5 {
		t.Errorf("expected 5 replacement cards, got %d", len(replacements))
	}

	handRank, ok := details["hand_rank"].(string)
	if !ok {
		t.Fatal("expected hand_rank to be string")
	}

	validRanks := map[string]bool{
		"royal_flush": true, "straight_flush": true, "four_of_a_kind": true,
		"full_house": true, "flush": true, "straight": true,
		"three_of_a_kind": true, "two_pair": true, "jacks_or_better": true,
		"pair": true, "high_card": true,
	}
	if !validRanks[handRank] {
		t.Errorf("invalid hand rank: %s", handRank)
	}

	if result.Metric < 0 || result.Metric > 51 {
		t.Errorf("metric (first card index) should be 0-51, got %f", result.Metric)
	}
}

func TestVideoPokerNoDuplicates(t *testing.T) {
	game := &VideoPokerGame{}
	seeds := Seeds{Server: "test_server", Client: "test_client"}

	// Run multiple nonces and check that the first 10 cards are always unique
	for nonce := uint64(0); nonce < 10; nonce++ {
		result, err := game.Evaluate(seeds, nonce, nil)
		if err != nil {
			t.Fatalf("nonce %d: evaluation failed: %v", nonce, err)
		}

		details := result.Details.(map[string]any)
		hand := details["hand"].([]string)
		replacements := details["replacements"].([]string)

		// First 10 cards (hand + replacements) should be unique
		seen := make(map[string]bool)
		allCards := append(hand, replacements...)
		for _, card := range allCards {
			if seen[card] {
				t.Errorf("nonce %d: duplicate card %s in first 10", nonce, card)
			}
			seen[card] = true
		}
	}
}

func TestVideoPokerInsufficientFloats(t *testing.T) {
	game := &VideoPokerGame{}
	_, err := game.EvaluateWithFloats(make([]float64, 10), nil)
	if err == nil {
		t.Error("expected error for insufficient floats")
	}
}

func TestVideoPokerDeterminism(t *testing.T) {
	game := &VideoPokerGame{}
	seeds := Seeds{Server: "abc123", Client: "def456"}

	r1, _ := game.Evaluate(seeds, 42, nil)
	r2, _ := game.Evaluate(seeds, 42, nil)

	if r1.Metric != r2.Metric {
		t.Errorf("determinism failed: %f != %f", r1.Metric, r2.Metric)
	}
}

func TestPokerHandEvaluation(t *testing.T) {
	tests := []struct {
		name     string
		cards    []Card
		expected string
	}{
		{
			"royal flush",
			[]Card{{Rank: "A", Suit: "♠"}, {Rank: "K", Suit: "♠"}, {Rank: "Q", Suit: "♠"}, {Rank: "J", Suit: "♠"}, {Rank: "10", Suit: "♠"}},
			"royal_flush",
		},
		{
			"straight flush",
			[]Card{{Rank: "9", Suit: "♥"}, {Rank: "8", Suit: "♥"}, {Rank: "7", Suit: "♥"}, {Rank: "6", Suit: "♥"}, {Rank: "5", Suit: "♥"}},
			"straight_flush",
		},
		{
			"four of a kind",
			[]Card{{Rank: "K", Suit: "♠"}, {Rank: "K", Suit: "♥"}, {Rank: "K", Suit: "♦"}, {Rank: "K", Suit: "♣"}, {Rank: "2", Suit: "♠"}},
			"four_of_a_kind",
		},
		{
			"full house",
			[]Card{{Rank: "Q", Suit: "♠"}, {Rank: "Q", Suit: "♥"}, {Rank: "Q", Suit: "♦"}, {Rank: "J", Suit: "♣"}, {Rank: "J", Suit: "♠"}},
			"full_house",
		},
		{
			"flush",
			[]Card{{Rank: "A", Suit: "♦"}, {Rank: "10", Suit: "♦"}, {Rank: "7", Suit: "♦"}, {Rank: "4", Suit: "♦"}, {Rank: "2", Suit: "♦"}},
			"flush",
		},
		{
			"straight",
			[]Card{{Rank: "10", Suit: "♠"}, {Rank: "9", Suit: "♥"}, {Rank: "8", Suit: "♦"}, {Rank: "7", Suit: "♣"}, {Rank: "6", Suit: "♠"}},
			"straight",
		},
		{
			"three of a kind",
			[]Card{{Rank: "7", Suit: "♠"}, {Rank: "7", Suit: "♥"}, {Rank: "7", Suit: "♦"}, {Rank: "3", Suit: "♣"}, {Rank: "2", Suit: "♠"}},
			"three_of_a_kind",
		},
		{
			"two pair",
			[]Card{{Rank: "9", Suit: "♠"}, {Rank: "9", Suit: "♥"}, {Rank: "5", Suit: "♦"}, {Rank: "5", Suit: "♣"}, {Rank: "2", Suit: "♠"}},
			"two_pair",
		},
		{
			"jacks or better",
			[]Card{{Rank: "J", Suit: "♠"}, {Rank: "J", Suit: "♥"}, {Rank: "5", Suit: "♦"}, {Rank: "3", Suit: "♣"}, {Rank: "2", Suit: "♠"}},
			"jacks_or_better",
		},
		{
			"low pair",
			[]Card{{Rank: "5", Suit: "♠"}, {Rank: "5", Suit: "♥"}, {Rank: "9", Suit: "♦"}, {Rank: "3", Suit: "♣"}, {Rank: "2", Suit: "♠"}},
			"pair",
		},
		{
			"high card",
			[]Card{{Rank: "A", Suit: "♠"}, {Rank: "10", Suit: "♥"}, {Rank: "7", Suit: "♦"}, {Rank: "4", Suit: "♣"}, {Rank: "2", Suit: "♣"}},
			"high_card",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := evaluatePokerHand(tt.cards)
			if got != tt.expected {
				t.Errorf("expected %s, got %s", tt.expected, got)
			}
		})
	}
}
