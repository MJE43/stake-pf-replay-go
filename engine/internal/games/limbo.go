package games

import "math"

// LimboGame implements the Limbo crash game
type LimboGame struct{}

// Name returns the game identifier
func (g *LimboGame) Name() string {
	return "limbo"
}

// MetricName returns the name of the metric
func (g *LimboGame) MetricName() string {
	return "multiplier"
}

// FloatsNeeded returns the number of floats required
func (g *LimboGame) FloatsNeeded() int {
	return 1
}

// Evaluate calculates the crash multiplier for Limbo
func (g *LimboGame) Evaluate(floats []float64) (float64, interface{}) {
	if len(floats) < 1 {
		return 1.0, nil
	}
	
	float := floats[0]
	houseEdge := 0.99 // 1% house edge
	
	// Calculate crash point using Limbo's formula
	floatPoint := 1e8 / (float * 1e8) * houseEdge
	
	// Round down to 2 decimal places
	crashPoint := math.Floor(floatPoint*100) / 100
	
	// Ensure minimum multiplier of 1.00
	result := math.Max(crashPoint, 1.0)
	
	return result, map[string]interface{}{
		"crash_point": result,
		"house_edge":  houseEdge,
	}
}