package games

import (
	"math"
	
	"github.com/MJE43/stake-pf-replay-go/internal/engine"
)

// LimboGame implements the Limbo crash game
type LimboGame struct{}

// Spec returns metadata about the Limbo game
func (g *LimboGame) Spec() GameSpec {
	return GameSpec{
		ID:          "limbo",
		Name:        "Limbo",
		MetricLabel: "multiplier",
	}
}

// FloatCount returns the number of floats required
func (g *LimboGame) FloatCount(params map[string]any) int {
	return 1
}

// Evaluate calculates the crash multiplier for Limbo
func (g *LimboGame) Evaluate(seeds Seeds, nonce uint64, params map[string]any) (GameResult, error) {
	// Get house edge from params, default to 0.99 (1% house edge)
	houseEdge := 0.99
	if he, ok := params["houseEdge"].(float64); ok && he > 0 && he <= 1 {
		houseEdge = he
	}
	
	// Generate the required float
	floats := engine.Floats(seeds.Server, seeds.Client, nonce, 0, 1)
	f := floats[0]
	
	// Calculate crash point using exact Limbo formula from Stake documentation
	// const floatPoint = 1e8 / (float * 1e8) * houseEdge;
	// This simplifies to: (1 / float) * houseEdge
	floatPoint := (1.0 / f) * houseEdge
	
	// Crash point rounded down to required denominator
	// const crashPoint = Math.floor(floatPoint * 100) / 100;
	crashPoint := math.Floor(floatPoint*100.0) / 100.0
	
	// Consolidate all crash points below 1
	// const result = Math.max(crashPoint, 1);
	result := math.Max(crashPoint, 1.0)
	
	return GameResult{
		Metric:      result,
		MetricLabel: "multiplier",
		Details: map[string]any{
			"raw_float":   f,
			"house_edge":  houseEdge,
			"crash_point": result,
		},
	}, nil
}