package games

import (
	"math"

	"github.com/MJE43/stake-pf-replay-go/internal/engine"
)

// DiceGame implements the Dice roll game
type DiceGame struct{}

// Spec returns metadata about the Dice game
func (g *DiceGame) Spec() GameSpec {
	return GameSpec{
		ID:          "dice",
		Name:        "Dice",
		MetricLabel: "roll",
	}
}

// FloatCount returns the number of floats required
func (g *DiceGame) FloatCount(params map[string]any) int {
	return 1
}

// Evaluate calculates the dice roll (0.00 to 100.00)
func (g *DiceGame) Evaluate(seeds Seeds, nonce uint64, params map[string]any) (GameResult, error) {
	// Generate the required float
	floats := engine.Floats(seeds.Server, seeds.Client, nonce, 0, 1)
	f := floats[0]
	
	// Use discrete formula: floor(float * 10001) / 100 for 0.00-100.00 range
	// This creates exactly 10,001 discrete outcomes (0.00, 0.01, 0.02, ..., 100.00)
	// matching Stake's implementation. For target matching, use tolerance=0 for exact matches.
	roll := math.Floor(f*10001) / 100
	
	return GameResult{
		Metric:      roll,
		MetricLabel: "roll",
		Details: map[string]any{
			"raw_float": f,
			"roll":      roll,
		},
	}, nil
}