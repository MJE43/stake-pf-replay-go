package games

import (
	"fmt"
	"math"

	"github.com/MJE43/stake-pf-replay-go/internal/engine"
)

// ChickenGame implements the Chicken provably fair game.
// The game determines death rounds using Fisher-Yates shuffle of rounds 1-20.
type ChickenGame struct{}

const (
	chickenMaxRounds    = 20
	chickenFloatCount   = 20 // 20 floats for Fisher-Yates of 20 rounds
	chickenDefaultBones = 1  // default number of bones (death tokens)
	chickenMinBones     = 1
	chickenMaxBones     = 20
)

// Spec returns metadata about the Chicken game.
func (g *ChickenGame) Spec() GameSpec {
	return GameSpec{
		ID:          "chicken",
		Name:        "Chicken",
		MetricLabel: "death_round",
	}
}

// FloatCount returns the number of floats required (always 20).
func (g *ChickenGame) FloatCount(params map[string]any) int {
	return chickenFloatCount
}

// Evaluate generates floats and calculates the death round layout.
func (g *ChickenGame) Evaluate(seeds Seeds, nonce uint64, params map[string]any) (GameResult, error) {
	floats := engine.Floats(seeds.Server, seeds.Client, nonce, 0, chickenFloatCount)
	return g.EvaluateWithFloats(floats, params)
}

// EvaluateWithFloats calculates the death round using pre-computed floats.
func (g *ChickenGame) EvaluateWithFloats(floats []float64, params map[string]any) (GameResult, error) {
	if len(floats) < chickenFloatCount {
		return GameResult{}, fmt.Errorf("chicken requires at least %d floats, got %d", chickenFloatCount, len(floats))
	}

	boneCount := chickenDefaultBones
	if bc, ok := params["bones"].(float64); ok {
		boneCount = int(bc)
	} else if bc, ok := params["bones"].(int); ok {
		boneCount = bc
	}

	if boneCount < chickenMinBones || boneCount > chickenMaxBones {
		return GameResult{}, fmt.Errorf("chicken bones must be between %d and %d, got %d", chickenMinBones, chickenMaxBones, boneCount)
	}

	// Fisher-Yates shuffle: create pool of rounds 1-20
	pool := make([]int, chickenMaxRounds)
	for i := range pool {
		pool[i] = i + 1 // rounds are 1-indexed
	}

	// Generate permutation using Fisher-Yates selection
	permutation := make([]int, 0, chickenMaxRounds)
	for i := 0; i < chickenFloatCount; i++ {
		if len(pool) == 0 {
			break
		}

		index := int(math.Floor(floats[i] * float64(len(pool))))
		if index >= len(pool) {
			index = len(pool) - 1
		}

		permutation = append(permutation, pool[index])
		pool = append(pool[:index], pool[index+1:]...)
	}

	// First boneCount positions in the permutation are death rounds
	deathRounds := make([]int, boneCount)
	copy(deathRounds, permutation[:boneCount])

	// Find the earliest death round
	firstDeath := deathRounds[0]
	for _, r := range deathRounds[1:] {
		if r < firstDeath {
			firstDeath = r
		}
	}

	// Calculate safe steps: how many rounds before hitting the first death
	safeSteps := firstDeath - 1

	return GameResult{
		Metric:      float64(firstDeath),
		MetricLabel: "death_round",
		Details: map[string]any{
			"bones":        boneCount,
			"death_rounds": deathRounds,
			"first_death":  firstDeath,
			"safe_steps":   safeSteps,
			"permutation":  permutation,
		},
	}, nil
}
