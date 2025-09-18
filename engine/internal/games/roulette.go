package games

import "math"

// RouletteGame implements European Roulette (0-36)
type RouletteGame struct{}

// Name returns the game identifier
func (g *RouletteGame) Name() string {
	return "roulette"
}

// MetricName returns the name of the metric
func (g *RouletteGame) MetricName() string {
	return "pocket"
}

// FloatsNeeded returns the number of floats required
func (g *RouletteGame) FloatsNeeded() int {
	return 1
}

// Evaluate determines which pocket the ball lands in (0-36)
func (g *RouletteGame) Evaluate(floats []float64) (float64, interface{}) {
	if len(floats) < 1 {
		return 0.0, nil
	}
	
	float := floats[0]
	
	// European roulette has 37 pockets (0-36)
	pocket := math.Floor(float * 37)
	
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
	
	return pocket, map[string]interface{}{
		"pocket": int(pocket),
		"color":  color,
		"even":   isEven,
		"low":    isLow,
	}
}