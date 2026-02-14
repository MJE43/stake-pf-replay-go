package games

import (
	"fmt"
	"math"

	"github.com/MJE43/stake-pf-replay-go/internal/engine"
)

// MinesGame implements the Mines provably fair game.
// The game uses a 5x5 grid (25 tiles) with 1-24 mines placed via Fisher-Yates shuffle.
type MinesGame struct{}

const (
	minesTotalTiles   = 25
	minesFloatCount   = 24 // 24 floats for Fisher-Yates of 25 positions
	minesDefaultCount = 3  // default mine count
	minesMinCount     = 1
	minesMaxCount     = 24
)

// Spec returns metadata about the Mines game.
func (g *MinesGame) Spec() GameSpec {
	return GameSpec{
		ID:          "mines",
		Name:        "Mines",
		MetricLabel: "first_bomb",
	}
}

// FloatCount returns the number of floats required (always 24).
func (g *MinesGame) FloatCount(params map[string]any) int {
	return minesFloatCount
}

// Evaluate generates floats and calculates the mine layout.
func (g *MinesGame) Evaluate(seeds Seeds, nonce uint64, params map[string]any) (GameResult, error) {
	floats := engine.Floats(seeds.Server, seeds.Client, nonce, 0, minesFloatCount)
	return g.EvaluateWithFloats(floats, params)
}

// EvaluateWithFloats calculates the mine layout using pre-computed floats.
func (g *MinesGame) EvaluateWithFloats(floats []float64, params map[string]any) (GameResult, error) {
	if len(floats) < minesFloatCount {
		return GameResult{}, fmt.Errorf("mines requires at least %d floats, got %d", minesFloatCount, len(floats))
	}

	mineCount := minesDefaultCount
	if mc, ok := params["mineCount"].(float64); ok {
		mineCount = int(mc)
	} else if mc, ok := params["mineCount"].(int); ok {
		mineCount = mc
	} else if mc, ok := params["mines"].(float64); ok {
		mineCount = int(mc)
	} else if mc, ok := params["mines"].(int); ok {
		mineCount = mc
	}

	if mineCount < minesMinCount || mineCount > minesMaxCount {
		return GameResult{}, fmt.Errorf("mines count must be between %d and %d, got %d", minesMinCount, minesMaxCount, mineCount)
	}

	// Fisher-Yates shuffle: create pool of tile positions 0-24
	pool := make([]int, minesTotalTiles)
	for i := range pool {
		pool[i] = i
	}

	// Generate full permutation using Fisher-Yates selection
	permutation := make([]int, 0, minesFloatCount)
	for i := 0; i < minesFloatCount; i++ {
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

	// First mineCount positions in the permutation are mine locations
	mines := make([]int, mineCount)
	copy(mines, permutation[:mineCount])

	// Create a set of mine positions for quick lookup
	mineSet := make(map[int]bool, mineCount)
	for _, pos := range mines {
		mineSet[pos] = true
	}

	// Find the first bomb index (1-indexed position in left-to-right, top-to-bottom order)
	// This represents the earliest tile that contains a mine
	firstBomb := minesTotalTiles + 1
	for _, pos := range mines {
		if pos < firstBomb {
			firstBomb = pos
		}
	}
	// Convert to 1-indexed
	firstBombIndex := firstBomb + 1

	// Build the 5x5 grid for details
	grid := make([][]string, 5)
	for r := 0; r < 5; r++ {
		grid[r] = make([]string, 5)
		for c := 0; c < 5; c++ {
			pos := r*5 + c
			if mineSet[pos] {
				grid[r][c] = "mine"
			} else {
				grid[r][c] = "gem"
			}
		}
	}

	return GameResult{
		Metric:      float64(firstBombIndex),
		MetricLabel: "first_bomb",
		Details: map[string]any{
			"mine_count":       mineCount,
			"mine_positions":   mines,
			"first_bomb_index": firstBombIndex,
			"grid":             grid,
			"permutation":      permutation,
		},
	}, nil
}
