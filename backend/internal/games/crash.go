package games

import (
	"fmt"
	"math"

	"github.com/MJE43/stake-pf-replay-go/internal/engine"
)

// CrashGame implements the Crash (and Slide) game.
//
// Crash uses a salt-chain RNG rather than the standard HMAC-SHA256
// byte generator. Each round has a game hash, and the result is
// computed via HMAC_SHA256(game_hash, salt).
//
// When params include "game_hash" and "salt", the authentic
// salt-chain algorithm is used. Otherwise, the float-based
// evaluation falls back to a Limbo-like formula for scanner
// compatibility.
type CrashGame struct{}

func (g *CrashGame) Spec() GameSpec {
	return GameSpec{
		ID:          "crash",
		Name:        "Crash",
		MetricLabel: "crash_point",
	}
}

func (g *CrashGame) FloatCount(params map[string]any) int {
	// If using salt-chain mode, no floats are needed.
	// For scanner fallback, 1 float is used.
	return 1
}

// Evaluate computes the crash point.
//
// When params["game_hash"] and params["salt"] are present, the
// authentic salt-chain algorithm is used (ignoring seeds/nonce).
// Otherwise, falls back to float-based evaluation via the standard RNG.
func (g *CrashGame) Evaluate(seeds Seeds, nonce uint64, params map[string]any) (GameResult, error) {
	// Salt-chain mode: authentic Crash RNG
	if gameHash, ok := params["game_hash"].(string); ok {
		salt, _ := params["salt"].(string)
		if salt == "" {
			return GameResult{}, fmt.Errorf("crash salt-chain mode requires 'salt' parameter")
		}
		crashPoint := engine.CrashResult(gameHash, salt)
		return GameResult{
			Metric:      crashPoint,
			MetricLabel: "crash_point",
			Details: map[string]any{
				"game_hash":   gameHash,
				"salt":        salt,
				"crash_point": crashPoint,
				"mode":        "salt_chain",
			},
		}, nil
	}

	// Float-based fallback for scanner
	floats := engine.Floats(seeds.Server, seeds.Client, nonce, 0, 1)
	return g.EvaluateWithFloats(floats, params)
}

// EvaluateWithFloats uses the Limbo-like formula as a scanner fallback.
// This does NOT implement the authentic salt-chain Crash algorithm,
// but provides a reasonable approximation for float-based scanning.
func (g *CrashGame) EvaluateWithFloats(floats []float64, params map[string]any) (GameResult, error) {
	if len(floats) < 1 {
		return GameResult{}, fmt.Errorf("crash requires at least 1 float, got %d", len(floats))
	}

	houseEdge := 1.0 - engine.CrashHouseEdge // 0.97
	if he, ok := params["houseEdge"].(float64); ok && he > 0 && he <= 1 {
		houseEdge = he
	}

	f := floats[0]
	floatPoint := (1.0 / f) * houseEdge
	crashPoint := math.Floor(floatPoint*100.0) / 100.0
	result := math.Max(crashPoint, 1.0)

	return GameResult{
		Metric:      result,
		MetricLabel: "crash_point",
		Details: map[string]any{
			"raw_float":   f,
			"house_edge":  houseEdge,
			"crash_point": result,
			"mode":        "float_fallback",
		},
	}, nil
}

// SlideGame is identical to Crash but with different metadata.
// Slide uses the same salt-chain algorithm.
type SlideGame struct{}

func (g *SlideGame) Spec() GameSpec {
	return GameSpec{
		ID:          "slide",
		Name:        "Slide",
		MetricLabel: "slide_point",
	}
}

func (g *SlideGame) FloatCount(params map[string]any) int {
	return 1
}

func (g *SlideGame) Evaluate(seeds Seeds, nonce uint64, params map[string]any) (GameResult, error) {
	crash := &CrashGame{}
	result, err := crash.Evaluate(seeds, nonce, params)
	if err != nil {
		return result, err
	}
	result.MetricLabel = "slide_point"
	return result, nil
}

func (g *SlideGame) EvaluateWithFloats(floats []float64, params map[string]any) (GameResult, error) {
	crash := &CrashGame{}
	result, err := crash.EvaluateWithFloats(floats, params)
	if err != nil {
		return result, err
	}
	result.MetricLabel = "slide_point"
	return result, nil
}
