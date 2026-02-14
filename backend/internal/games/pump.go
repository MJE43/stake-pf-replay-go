package games

import (
	"fmt"
	"math"

	"github.com/MJE43/stake-pf-replay-go/internal/engine"
)

// PumpGame implements the Pump game
type PumpGame struct{}

// Pump game constants
const (
	pumpPositions = 25 // K = 25 positions (always)
)

// Difficulty to M (number of POP tokens) mapping
var pumpMValues = map[string]int{
	"easy":   1,
	"medium": 3,
	"hard":   5,
	"expert": 10,
}

// Multiplier tables - lengths must equal (25 - M + 1)
var pumpMultiplierTables = map[string][]float64{
	"easy": {
		1.00, 1.02, 1.06, 1.11, 1.17, 1.23, 1.29, 1.36, 1.44, 1.53,
		1.62, 1.75, 1.88, 2.00, 2.23, 2.45, 2.72, 3.05, 3.50, 4.08,
		5.00, 6.25, 8.00, 12.25, 24.50,
	},
	"medium": {
		1.00, 1.11, 1.27, 1.46, 1.69, 1.98, 2.33, 2.76, 3.31, 4.03,
		4.95, 6.19, 7.87, 10.25, 13.66, 18.78, 26.83, 38.76, 64.40, 112.70,
		225.40, 563.50, 2254.00,
	},
	"hard": {
		1.00, 1.23, 1.55, 1.98, 2.56, 3.36, 4.48, 6.08, 8.41, 11.92,
		17.00, 26.01, 40.46, 65.74, 112.70, 206.62, 413.23, 929.77, 2479.40, 8677.90,
		52067.40,
	},
	"expert": {
		1.00, 1.63, 2.80, 4.95, 9.08, 17.34, 34.68, 73.21, 164.72,
		400.02, 1066.73, 3200.18, 11200.65, 48536.13, 291216.80, 3203384.80,
	},
}

// Spec returns metadata about the Pump game
func (g *PumpGame) Spec() GameSpec {
	return GameSpec{
		ID:          "pump",
		Name:        "Pump",
		MetricLabel: "multiplier",
	}
}

// FloatCount returns the number of floats required
// Pump uses 25 floats for Fisher-Yates shuffle of positions 1-25
func (g *PumpGame) FloatCount(params map[string]any) int {
	return 25
}

// Evaluate calculates the multiplier for Pump game
func (g *PumpGame) Evaluate(seeds Seeds, nonce uint64, params map[string]any) (GameResult, error) {
	// Generate 25 floats for the position shuffle
	floats := engine.Floats(seeds.Server, seeds.Client, nonce, 0, 25)
	return g.EvaluateWithFloats(floats, params)
}

// EvaluateWithFloats calculates the multiplier using pre-computed floats
func (g *PumpGame) EvaluateWithFloats(floats []float64, params map[string]any) (GameResult, error) {
	if len(floats) < 25 {
		return GameResult{}, fmt.Errorf("pump requires at least 25 floats, got %d", len(floats))
	}

	// Get difficulty from params, default to "expert"
	difficulty := "expert"
	if d, ok := params["difficulty"].(string); ok {
		if _, exists := pumpMValues[d]; exists {
			difficulty = d
		}
	}

	// Get M value and multiplier table for difficulty
	M, exists := pumpMValues[difficulty]
	if !exists {
		return GameResult{}, fmt.Errorf("invalid pump difficulty: %s", difficulty)
	}

	multiplierTable, exists := pumpMultiplierTables[difficulty]
	if !exists {
		return GameResult{}, fmt.Errorf("no multiplier table for difficulty: %s", difficulty)
	}

	// Create pool of positions 1-25
	pool := make([]int, pumpPositions)
	for i := 0; i < pumpPositions; i++ {
		pool[i] = i + 1
	}

	// Use selection shuffle to generate permutation
	permutation := make([]int, 0, pumpPositions)

	for _, f := range floats {
		if len(pool) == 0 {
			break
		}

		// CRITICAL: Floor operation for index selection
		index := int(math.Floor(f * float64(len(pool))))
		if index >= len(pool) {
			index = len(pool) - 1
		}

		// Add selected position to permutation
		permutation = append(permutation, pool[index])

		// Remove selected position from pool
		pool = append(pool[:index], pool[index+1:]...)
	}

	// Take first M positions as pops
	pops := permutation[:M]

	// Find minimum pop position (pop point)
	popPoint := pops[0]
	for _, pop := range pops[1:] {
		if pop < popPoint {
			popPoint = pop
		}
	}

	// Calculate safe pumps: min(pop_point - 1, 25 - M)
	safePumps := popPoint - 1
	maxSafePumps := 25 - M
	if safePumps > maxSafePumps {
		safePumps = maxSafePumps
	}
	if safePumps < 0 {
		safePumps = 0
	}

	// Get multiplier from table
	if safePumps >= len(multiplierTable) {
		return GameResult{}, fmt.Errorf("safe pumps %d exceeds table length %d for difficulty %s", safePumps, len(multiplierTable), difficulty)
	}

	multiplier := multiplierTable[safePumps]

	return GameResult{
		Metric:      multiplier,
		MetricLabel: "multiplier",
		Details: map[string]any{
			"difficulty":  difficulty,
			"positions":   pumpPositions,
			"M":           M,
			"pops":        pops,
			"pop_point":   popPoint,
			"safe_pumps":  safePumps,
			"max_safe":    maxSafePumps,
			"multiplier":  multiplier,
			"permutation": permutation,
		},
	}, nil
}
