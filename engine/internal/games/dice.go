package games

// DiceGame implements the Dice roll game
type DiceGame struct{}

// Name returns the game identifier
func (g *DiceGame) Name() string {
	return "dice"
}

// MetricName returns the name of the metric
func (g *DiceGame) MetricName() string {
	return "roll"
}

// FloatsNeeded returns the number of floats required
func (g *DiceGame) FloatsNeeded() int {
	return 1
}

// Evaluate calculates the dice roll (00.00 to 100.00)
func (g *DiceGame) Evaluate(floats []float64) (float64, interface{}) {
	if len(floats) < 1 {
		return 0.0, nil
	}
	
	float := floats[0]
	
	// Dice has 10,001 possible outcomes (00.00 to 100.00)
	roll := (float * 10001) / 100
	
	return roll, map[string]interface{}{
		"roll": roll,
	}
}