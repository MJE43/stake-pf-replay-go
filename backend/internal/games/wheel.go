package games

import (
	"fmt"
	"math"
	"strings"

	"github.com/MJE43/stake-pf-replay-go/internal/engine"
)

// WheelGame implements the Wheel provably fair game.
type WheelGame struct{}

const wheelDefaultSegments = 10

var wheelDefaultRisk = "low"

// Wheel payout tables from Stake documentation.
// Keys: segments (10, 20, 30, 40, 50) → risk (low, medium, high) → []multiplier
var wheelPayouts = map[int]map[string][]float64{
	10: {
		"low":    {1.5, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.2, 0},
		"medium": {0, 1.9, 0, 1.5, 0, 2, 0, 1.5, 0, 3},
		"high":   {0, 0, 0, 0, 0, 0, 0, 0, 0, 9.9},
	},
	20: {
		"low": {
			1.5, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.2, 0,
			1.5, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.2, 0,
		},
		"medium": {
			1.5, 0, 2, 0, 2, 0, 2, 0, 1.5, 0,
			3, 0, 1.8, 0, 2, 0, 2, 0, 2, 0,
		},
		"high": {
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 19.8,
		},
	},
	30: {
		"low": {
			1.5, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.2, 0,
			1.5, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.2, 0,
			1.5, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.2, 0,
		},
		"medium": {
			1.5, 0, 1.5, 0, 2, 0, 1.5, 0, 2, 0,
			2, 0, 1.5, 0, 3, 0, 1.5, 0, 2, 0,
			2, 0, 1.7, 0, 4, 0, 1.5, 0, 2, 0,
		},
		"high": {
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 29.7,
		},
	},
	40: {
		"low": {
			1.5, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.2, 0,
			1.5, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.2, 0,
			1.5, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.2, 0,
			1.5, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.2, 0,
		},
		"medium": {
			2, 0, 3, 0, 2, 0, 1.5, 0, 3, 0,
			1.5, 0, 1.5, 0, 2, 0, 1.5, 0, 3, 0,
			1.5, 0, 2, 0, 2, 0, 1.6, 0, 2, 0,
			1.5, 0, 3, 0, 1.5, 0, 2, 0, 1.5, 0,
		},
		"high": {
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 39.6,
		},
	},
	50: {
		"low": {
			1.5, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.2, 0,
			1.5, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.2, 0,
			1.5, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.2, 0,
			1.5, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.2, 0,
			1.5, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.2, 0,
		},
		"medium": {
			2, 0, 1.5, 0, 2, 0, 1.5, 0, 3, 0,
			1.5, 0, 1.5, 0, 2, 0, 1.5, 0, 3, 0,
			1.5, 0, 2, 0, 1.5, 0, 2, 0, 2, 0,
			1.5, 0, 3, 0, 1.5, 0, 2, 0, 1.5, 0,
			1.5, 0, 5, 0, 1.5, 0, 2, 0, 1.5, 0,
		},
		"high": {
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 49.5,
		},
	},
}

var wheelValidSegments = map[int]bool{10: true, 20: true, 30: true, 40: true, 50: true}

// Spec returns metadata about the Wheel game.
func (g *WheelGame) Spec() GameSpec {
	return GameSpec{
		ID:          "wheel",
		Name:        "Wheel",
		MetricLabel: "multiplier",
	}
}

// FloatCount returns the number of floats required (always 1).
func (g *WheelGame) FloatCount(params map[string]any) int {
	return 1
}

// Evaluate generates floats and calculates the wheel result.
func (g *WheelGame) Evaluate(seeds Seeds, nonce uint64, params map[string]any) (GameResult, error) {
	floats := engine.Floats(seeds.Server, seeds.Client, nonce, 0, 1)
	return g.EvaluateWithFloats(floats, params)
}

// EvaluateWithFloats calculates the wheel result using pre-computed floats.
func (g *WheelGame) EvaluateWithFloats(floats []float64, params map[string]any) (GameResult, error) {
	if len(floats) < 1 {
		return GameResult{}, fmt.Errorf("wheel requires at least 1 float, got %d", len(floats))
	}

	segments, risk, err := wheelParams(params)
	if err != nil {
		return GameResult{}, err
	}

	riskTable, ok := wheelPayouts[segments]
	if !ok {
		return GameResult{}, fmt.Errorf("no payout table for %d segments", segments)
	}

	table, ok := riskTable[risk]
	if !ok {
		return GameResult{}, fmt.Errorf("no payout table for risk %q with %d segments", risk, segments)
	}

	f := floats[0]

	// Game event translation: index = floor(float * segments)
	index := int(math.Floor(f * float64(segments)))
	if index >= segments {
		index = segments - 1
	}

	multiplier := table[index]

	return GameResult{
		Metric:      multiplier,
		MetricLabel: "multiplier",
		Details: map[string]any{
			"segments":   segments,
			"risk":       risk,
			"index":      index,
			"multiplier": multiplier,
			"raw_float":  f,
		},
	}, nil
}

func wheelParams(params map[string]any) (int, string, error) {
	segments, err := wheelSegmentsFromParams(params)
	if err != nil {
		return 0, "", err
	}

	risk, err := wheelRiskFromParams(params)
	if err != nil {
		return 0, "", err
	}

	return segments, risk, nil
}

func wheelSegmentsFromParams(params map[string]any) (int, error) {
	if params == nil {
		return wheelDefaultSegments, nil
	}

	raw, ok := params["segments"]
	if !ok {
		return wheelDefaultSegments, nil
	}

	var seg int
	switch v := raw.(type) {
	case int:
		seg = v
	case int64:
		seg = int(v)
	case float64:
		seg = int(v)
	case string:
		_, err := fmt.Sscanf(v, "%d", &seg)
		if err != nil {
			return 0, fmt.Errorf("invalid wheel segments value %q", v)
		}
	default:
		return 0, fmt.Errorf("unsupported type for wheel segments: %T", raw)
	}

	if !wheelValidSegments[seg] {
		return 0, fmt.Errorf("wheel segments must be one of 10, 20, 30, 40, 50; got %d", seg)
	}

	return seg, nil
}

func wheelRiskFromParams(params map[string]any) (string, error) {
	if params == nil {
		return wheelDefaultRisk, nil
	}

	raw, ok := params["risk"]
	if !ok {
		return wheelDefaultRisk, nil
	}

	risk, ok := raw.(string)
	if !ok {
		return "", fmt.Errorf("unsupported type for wheel risk: %T", raw)
	}

	risk = strings.ToLower(strings.TrimSpace(risk))
	switch risk {
	case "low", "medium", "high":
		return risk, nil
	default:
		return "", fmt.Errorf("invalid wheel risk: %s", risk)
	}
}
