package games

import (
	"fmt"
	"math"

	"github.com/MJE43/stake-pf-replay-go/internal/engine"
)

// KenoGame implements the Keno game from Stake Originals
type KenoGame struct{}

// Spec returns metadata about the Keno game
func (g *KenoGame) Spec() GameSpec {
	return GameSpec{
		ID:          "keno",
		Name:        "Keno",
		MetricLabel: "multiplier",
	}
}

// FloatCount returns the number of floats required for Keno
// Keno uses 2 cursor increments (10 floats total) for Fisher-Yates selection of 10 draws
func (g *KenoGame) FloatCount(params map[string]any) int {
	return KenoDrawCount
}

// Evaluate calculates the Keno result for given seeds and nonce
func (g *KenoGame) Evaluate(seeds Seeds, nonce uint64, params map[string]any) (GameResult, error) {
	// Generate floats for the draw
	floats := engine.Floats(seeds.Server, seeds.Client, nonce, 0, KenoDrawCount)
	return g.EvaluateWithFloats(floats, params)
}

// EvaluateWithFloats calculates the Keno result using pre-computed floats
func (g *KenoGame) EvaluateWithFloats(floats []float64, params map[string]any) (GameResult, error) {
	if len(floats) < KenoDrawCount {
		return GameResult{}, fmt.Errorf("keno requires at least %d floats, got %d", KenoDrawCount, len(floats))
	}

	// Get risk level from params, default to "medium"
	risk := "medium"
	if r, ok := params["risk"].(string); ok {
		if IsValidKenoRisk(r) {
			risk = r
		}
	}

	// Get player's picks from params
	picks, err := extractPicks(params)
	if err != nil {
		return GameResult{}, err
	}

	if len(picks) < KenoMinPicks || len(picks) > KenoMaxPicks {
		return GameResult{}, fmt.Errorf("keno requires between %d and %d picks, got %d", KenoMinPicks, KenoMaxPicks, len(picks))
	}

	// Validate picks are in valid range
	for _, p := range picks {
		if p < 0 || p >= KenoSquares {
			return GameResult{}, fmt.Errorf("invalid pick %d: must be between 0 and %d", p, KenoSquares-1)
		}
	}

	// Generate the 10 drawn numbers using Fisher-Yates selection
	draws := generateKenoDraws(floats)

	// Count how many of the player's picks match the drawn numbers
	hits := countHits(picks, draws)

	// Look up multiplier from payout table
	multiplier := GetKenoMultiplier(risk, len(picks), hits)

	return GameResult{
		Metric:      multiplier,
		MetricLabel: "multiplier",
		Details: map[string]any{
			"risk":       risk,
			"picks":      picks,
			"picks_count": len(picks),
			"draws":      draws,
			"hits":       hits,
			"multiplier": multiplier,
		},
	}, nil
}

// generateKenoDraws uses Fisher-Yates selection to draw 10 unique numbers from 0-39
// This matches Stake's algorithm as documented
func generateKenoDraws(floats []float64) []int {
	// Create pool of numbers 0-39
	pool := make([]int, KenoSquares)
	for i := range pool {
		pool[i] = i
	}

	draws := make([]int, KenoDrawCount)

	// Fisher-Yates selection: each float picks from remaining pool
	for i := 0; i < KenoDrawCount; i++ {
		// Floor the float * pool size to get index
		idx := int(math.Floor(floats[i] * float64(len(pool))))
		if idx >= len(pool) {
			idx = len(pool) - 1
		}

		// Select this number
		draws[i] = pool[idx]

		// Remove from pool (stable removal to match Stake's verification output)
		// Stake's UI demonstrates ordered removal (equivalent to JS Array.splice).
		pool = append(pool[:idx], pool[idx+1:]...)
	}

	return draws
}

// countHits returns how many of the player's picks appear in the drawn numbers
func countHits(picks, draws []int) int {
	// Create a set of draws for O(1) lookup
	drawSet := make(map[int]bool, len(draws))
	for _, d := range draws {
		drawSet[d] = true
	}

	hits := 0
	for _, p := range picks {
		if drawSet[p] {
			hits++
		}
	}

	return hits
}

// extractPicks extracts the picks array from params
func extractPicks(params map[string]any) ([]int, error) {
	picksRaw, ok := params["picks"]
	if !ok {
		return nil, fmt.Errorf("keno requires 'picks' parameter")
	}

	// Handle different possible types from JSON/frontend
	switch v := picksRaw.(type) {
	case []int:
		return v, nil
	case []interface{}:
		picks := make([]int, len(v))
		for i, p := range v {
			switch pv := p.(type) {
			case float64:
				picks[i] = int(pv)
			case int:
				picks[i] = pv
			default:
				return nil, fmt.Errorf("invalid pick type at index %d: %T", i, p)
			}
		}
		return picks, nil
	case []float64:
		picks := make([]int, len(v))
		for i, p := range v {
			picks[i] = int(p)
		}
		return picks, nil
	default:
		return nil, fmt.Errorf("invalid picks type: %T", picksRaw)
	}
}

// EvaluateDrawOnly returns just the 10 drawn numbers for a given seed/nonce combo
// This is useful for B2B scanning where we need to generate player picks separately
func (g *KenoGame) EvaluateDrawOnly(seeds Seeds, nonce uint64) []int {
	floats := engine.Floats(seeds.Server, seeds.Client, nonce, 0, KenoDrawCount)
	return generateKenoDraws(floats)
}

// EvaluateDrawOnlyWithFloats returns just the 10 drawn numbers from pre-computed floats
func (g *KenoGame) EvaluateDrawOnlyWithFloats(floats []float64) []int {
	if len(floats) < KenoDrawCount {
		return nil
	}
	return generateKenoDraws(floats)
}

// CalculateMultiplier is a helper to compute multiplier given risk, picks, and draws
func CalculateKenoMultiplier(risk string, picks, draws []int) (float64, int) {
	hits := countHits(picks, draws)
	return GetKenoMultiplier(risk, len(picks), hits), hits
}

