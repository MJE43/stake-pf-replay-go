package games

import (
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/MJE43/stake-pf-replay-go/internal/engine"
)

const (
	plinkoMinRows     = 8
	plinkoMaxRows     = 16
	plinkoDefaultRows = 16
)

var plinkoDefaultRisk = "medium"

// PlinkoGame implements the Plinko provably fair game using Stake's payout tables.
type PlinkoGame struct{}

// Spec returns metadata about the Plinko game.
func (g *PlinkoGame) Spec() GameSpec {
	return GameSpec{
		ID:          "plinko",
		Name:        "Plinko",
		MetricLabel: "multiplier",
	}
}

// FloatCount returns how many floats are required for the given parameters.
func (g *PlinkoGame) FloatCount(params map[string]any) int {
	rows, err := plinkoRowsFromParams(params)
	if err != nil {
		return plinkoDefaultRows
	}
	return rows
}

// Evaluate generates floats on demand and delegates to EvaluateWithFloats.
func (g *PlinkoGame) Evaluate(seeds Seeds, nonce uint64, params map[string]any) (GameResult, error) {
	rows, risk, err := plinkoParams(params)
	if err != nil {
		return GameResult{}, err
	}

	floats := engine.Floats(seeds.Server, seeds.Client, nonce, 0, rows)
	return g.evaluateFromFloats(floats, rows, risk)
}

// EvaluateWithFloats uses pre-computed floats (e.g. during scanning).
func (g *PlinkoGame) EvaluateWithFloats(floats []float64, params map[string]any) (GameResult, error) {
	rows, risk, err := plinkoParams(params)
	if err != nil {
		return GameResult{}, err
	}

	if len(floats) < rows {
		return GameResult{}, fmt.Errorf("plinko requires %d floats, got %d", rows, len(floats))
	}

	return g.evaluateFromFloats(floats[:rows], rows, risk)
}

func (g *PlinkoGame) evaluateFromFloats(floats []float64, rows int, risk string) (GameResult, error) {
	table, err := plinkoTable(risk, rows)
	if err != nil {
		return GameResult{}, err
	}

	directions := make([]string, rows)
	prizeIndex := 0

	for i, f := range floats {
		if f < 0 || f >= 1 {
			return GameResult{}, fmt.Errorf("plinko float at index %d out of range [0,1): %f", i, f)
		}

		decision := 0
		direction := "left"
		if f >= 0.5 {
			decision = 1
			direction = "right"
		}

		prizeIndex += decision
		directions[i] = direction
	}

	if prizeIndex < 0 || prizeIndex >= len(table) {
		return GameResult{}, fmt.Errorf("plinko prize index %d out of bounds for rows %d", prizeIndex, rows)
	}

	multiplier := table[prizeIndex]

	return GameResult{
		Metric:      multiplier,
		MetricLabel: "multiplier",
		Details: map[string]any{
			"rows":        rows,
			"risk":        risk,
			"directions":  directions,
			"prize_index": prizeIndex,
			"multiplier":  multiplier,
			"floats":      floats,
		},
	}, nil
}

func plinkoParams(params map[string]any) (int, string, error) {
	rows, err := plinkoRowsFromParams(params)
	if err != nil {
		return 0, "", err
	}

	risk, err := plinkoRiskFromParams(params)
	if err != nil {
		return 0, "", err
	}

	return rows, risk, nil
}

func plinkoRowsFromParams(params map[string]any) (int, error) {
	if params == nil {
		return plinkoDefaultRows, nil
	}

	raw, ok := params["rows"]
	if !ok {
		return plinkoDefaultRows, nil
	}

	switch v := raw.(type) {
	case int:
		return validatePlinkoRows(v)
	case int64:
		return validatePlinkoRows(int(v))
	case float64:
		if math.Mod(v, 1) != 0 {
			return 0, fmt.Errorf("plinko rows must be an integer, got %f", v)
		}
		return validatePlinkoRows(int(v))
	case string:
		parsed, err := strconv.Atoi(v)
		if err != nil {
			return 0, fmt.Errorf("invalid plinko rows value %q", v)
		}
		return validatePlinkoRows(parsed)
	default:
		return 0, fmt.Errorf("unsupported type for plinko rows: %T", raw)
	}
}

func validatePlinkoRows(rows int) (int, error) {
	if rows < plinkoMinRows || rows > plinkoMaxRows {
		return 0, fmt.Errorf("plinko rows must be between %d and %d, got %d", plinkoMinRows, plinkoMaxRows, rows)
	}
	return rows, nil
}

func plinkoRiskFromParams(params map[string]any) (string, error) {
	if params == nil {
		return plinkoDefaultRisk, nil
	}

	raw, ok := params["risk"]
	if !ok {
		return plinkoDefaultRisk, nil
	}

	var risk string
	switch v := raw.(type) {
	case string:
		risk = v
	default:
		return "", fmt.Errorf("unsupported type for plinko risk: %T", raw)
	}

	risk = strings.ToLower(strings.TrimSpace(risk))
	switch risk {
	case "low", "medium", "high":
		return risk, nil
	default:
		return "", fmt.Errorf("invalid plinko risk: %s", risk)
	}
}
