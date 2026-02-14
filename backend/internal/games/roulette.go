package games

import (
	"fmt"
	"math"

	"github.com/MJE43/stake-pf-replay-go/internal/engine"
)

// RouletteGame implements European Roulette (0-36)
type RouletteGame struct{}

// Spec returns metadata about the Roulette game
func (g *RouletteGame) Spec() GameSpec {
	return GameSpec{
		ID:          "roulette",
		Name:        "Roulette",
		MetricLabel: "pocket",
	}
}

// FloatCount returns the number of floats required
func (g *RouletteGame) FloatCount(params map[string]any) int {
	return 1
}

// Evaluate determines which pocket the ball lands in (0-36)
func (g *RouletteGame) Evaluate(seeds Seeds, nonce uint64, params map[string]any) (GameResult, error) {
	// Generate the required float
	floats := engine.Floats(seeds.Server, seeds.Client, nonce, 0, 1)
	return g.EvaluateWithFloats(floats, params)
}

// EvaluateWithFloats determines which pocket the ball lands in using pre-computed floats
func (g *RouletteGame) EvaluateWithFloats(floats []float64, params map[string]any) (GameResult, error) {
	if len(floats) < 1 {
		return GameResult{}, fmt.Errorf("roulette requires at least 1 float, got %d", len(floats))
	}

	f := floats[0]

	// Use formula: floor(float * 37) for European roulette (0-36)
	pocket := math.Floor(f * 37)

	// Determine color and properties
	var color string
	var isEven bool
	var isLow bool // 1-18

	if pocket == 0 {
		color = "green"
		isEven = false
		isLow = false
	} else {
		// Red numbers: 1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36
		redNumbers := map[int]bool{
			1: true, 3: true, 5: true, 7: true, 9: true,
			12: true, 14: true, 16: true, 18: true, 19: true,
			21: true, 23: true, 25: true, 27: true, 30: true,
			32: true, 34: true, 36: true,
		}

		if redNumbers[int(pocket)] {
			color = "red"
		} else {
			color = "black"
		}

		isEven = int(pocket)%2 == 0
		isLow = pocket >= 1 && pocket <= 18
	}

	return GameResult{
		Metric:      pocket, // Keep as float64 for uniformity
		MetricLabel: "pocket",
		Details: map[string]any{
			"raw_float": f,
			"pocket":    int(pocket), // Integer in details
			"color":     color,
			"even":      isEven,
			"low":       isLow,
		},
	}, nil
}
