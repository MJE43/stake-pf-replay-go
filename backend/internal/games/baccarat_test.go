package games

import "testing"

func TestBaccaratGame(t *testing.T) {
	game := &BaccaratGame{}

	spec := game.Spec()
	if spec.ID != "baccarat" {
		t.Errorf("expected ID 'baccarat', got '%s'", spec.ID)
	}

	if fc := game.FloatCount(nil); fc != 6 {
		t.Errorf("expected FloatCount 6, got %d", fc)
	}
}

func TestBaccaratEvaluation(t *testing.T) {
	game := &BaccaratGame{}
	seeds := Seeds{Server: "test_server", Client: "test_client"}

	result, err := game.Evaluate(seeds, 1, nil)
	if err != nil {
		t.Fatalf("Evaluation failed: %v", err)
	}

	details, ok := result.Details.(map[string]any)
	if !ok {
		t.Fatal("expected details map")
	}

	playerScore, ok := details["player_score"].(int)
	if !ok {
		t.Fatal("expected player_score to be int")
	}
	if playerScore < 0 || playerScore > 9 {
		t.Errorf("player score should be 0-9, got %d", playerScore)
	}

	bankerScore, ok := details["banker_score"].(int)
	if !ok {
		t.Fatal("expected banker_score to be int")
	}
	if bankerScore < 0 || bankerScore > 9 {
		t.Errorf("banker score should be 0-9, got %d", bankerScore)
	}

	winner, ok := details["winner"].(string)
	if !ok {
		t.Fatal("expected winner to be string")
	}
	switch winner {
	case "player", "banker", "tie":
		// valid
	default:
		t.Errorf("invalid winner: %s", winner)
	}

	// Verify winner matches scores
	switch {
	case playerScore > bankerScore && winner != "player":
		t.Errorf("player score %d > banker score %d but winner is %s", playerScore, bankerScore, winner)
	case bankerScore > playerScore && winner != "banker":
		t.Errorf("banker score %d > player score %d but winner is %s", bankerScore, playerScore, winner)
	case playerScore == bankerScore && winner != "tie":
		t.Errorf("scores equal (%d) but winner is %s", playerScore, winner)
	}

	if result.Metric < 0 || result.Metric > 51 {
		t.Errorf("metric (first card index) should be 0-51, got %f", result.Metric)
	}
}

func TestBaccaratCardValues(t *testing.T) {
	tests := []struct {
		rank     string
		expected int
	}{
		{"A", 1}, {"2", 2}, {"3", 3}, {"4", 4}, {"5", 5},
		{"6", 6}, {"7", 7}, {"8", 8}, {"9", 9},
		{"10", 0}, {"J", 0}, {"Q", 0}, {"K", 0},
	}

	for _, tt := range tests {
		got := baccaratCardValue(tt.rank)
		if got != tt.expected {
			t.Errorf("baccaratCardValue(%s): expected %d, got %d", tt.rank, tt.expected, got)
		}
	}
}

func TestBaccaratNatural(t *testing.T) {
	game := &BaccaratGame{}

	// Craft floats that produce a natural 9 for player:
	// We need: player gets 9 total, banker gets < 8
	// Card index 28 = ♦9 (rank 9), so float ≈ 28/52 = 0.538
	// Card index 0 = ♦2 (rank 2), so float ≈ 0.0
	// Deal order: player1, banker1, player2, banker2, player3, banker3
	// Player: ♦9 + ♦2 = 11 → baccarat score = 1 (not natural)
	// Let's try: player gets ♦4 (index 8, float=8/52≈0.154) + ♦5 (index 12, float=12/52≈0.231) = 9
	// banker gets ♦2 (index 0, float=0.0) + ♦3 (index 4, float=4/52≈0.077) = 5
	// With natural 9, no draws
	f4 := 8.5 / 52  // → floor(f*52)=8 → ♦4
	f2 := 0.5 / 52  // → floor(f*52)=0 → ♦2
	f5 := 12.5 / 52 // → floor(f*52)=12 → ♦5
	f3 := 4.5 / 52  // → floor(f*52)=4 → ♦3

	floats := []float64{f4, f2, f5, f3, 0.5, 0.5} // last 2 unused

	result, err := game.EvaluateWithFloats(floats, nil)
	if err != nil {
		t.Fatalf("Evaluation failed: %v", err)
	}

	details := result.Details.(map[string]any)
	playerScore := details["player_score"].(int)
	playerDraws := details["player_draws"].(bool)
	bankerDraws := details["banker_draws"].(bool)

	if playerScore != 9 {
		t.Errorf("expected player score 9, got %d", playerScore)
	}
	if playerDraws {
		t.Error("player should not draw on natural 9")
	}
	if bankerDraws {
		t.Error("banker should not draw when player has natural")
	}
}

func TestBaccaratThirdCardRules(t *testing.T) {
	// Test banker draw logic
	tests := []struct {
		bankerScore  int
		playerThird  int
		expectedDraw bool
	}{
		{0, 5, true}, // 0-2: always draw
		{1, 8, true},
		{2, 1, true},
		{3, 8, false}, // 3: draw unless player third is 8
		{3, 5, true},
		{4, 1, false}, // 4: draw on 2-7
		{4, 5, true},
		{5, 3, false}, // 5: draw on 4-7
		{5, 5, true},
		{6, 5, false}, // 6: draw on 6-7
		{6, 7, true},
		{7, 5, false}, // 7: never draw
	}

	for _, tt := range tests {
		got := bankerShouldDraw(tt.bankerScore, tt.playerThird)
		if got != tt.expectedDraw {
			t.Errorf("bankerShouldDraw(%d, %d): expected %v, got %v",
				tt.bankerScore, tt.playerThird, tt.expectedDraw, got)
		}
	}
}

func TestBaccaratInsufficientFloats(t *testing.T) {
	game := &BaccaratGame{}
	_, err := game.EvaluateWithFloats([]float64{0.1, 0.2}, nil)
	if err == nil {
		t.Error("expected error for insufficient floats")
	}
}

func TestBaccaratDeterminism(t *testing.T) {
	game := &BaccaratGame{}
	seeds := Seeds{Server: "abc123", Client: "def456"}

	r1, _ := game.Evaluate(seeds, 42, nil)
	r2, _ := game.Evaluate(seeds, 42, nil)

	if r1.Metric != r2.Metric {
		t.Errorf("determinism failed: %f != %f", r1.Metric, r2.Metric)
	}
}
