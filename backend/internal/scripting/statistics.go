package scripting

import "math"

// Statistics tracks all session-level betting statistics.
// Mirrors the bot2love global statistics variables.
type Statistics struct {
	Bets     int     `json:"bets"`
	Wins     int     `json:"wins"`
	Losses   int     `json:"losses"`
	Wagered  float64 `json:"wagered"`
	Profit   float64 `json:"profit"`
	Balance  float64 `json:"balance"`
	StartBal float64 `json:"startBal"`

	WinStreak  int `json:"winStreak"`
	LoseStreak int `json:"loseStreak"`
	// Positive = win streak, negative = lose streak.
	CurrentStreak int `json:"currentStreak"`

	HighestStreak int     `json:"highestStreak"`
	LowestStreak  int     `json:"lowestStreak"`
	HighestBet    float64 `json:"highestBet"`
	HighestProfit float64 `json:"highestProfit"`
	LowestProfit  float64 `json:"lowestProfit"`

	CurrentProfit float64 `json:"currentProfit"`
	PreviousBet   float64 `json:"previousBet"`
}

// ChartPoint is a single data point for the profit chart.
type ChartPoint struct {
	BetNumber int     `json:"x"`
	Profit    float64 `json:"y"`
	Win       bool    `json:"win"`
}

// ChartBuffer holds a rolling window of chart data points.
type ChartBuffer struct {
	Points []ChartPoint `json:"points"`
	Max    int          `json:"-"`
}

// NewChartBuffer creates a chart buffer with the given max capacity.
func NewChartBuffer(max int) *ChartBuffer {
	if max <= 0 {
		max = 50
	}
	return &ChartBuffer{
		Points: make([]ChartPoint, 0, max),
		Max:    max,
	}
}

// Push adds a data point. When the buffer exceeds Max, it decimates by
// keeping every other point (preserving first and last) to maintain a
// reasonable chart size during long sessions.
func (cb *ChartBuffer) Push(p ChartPoint) {
	cb.Points = append(cb.Points, p)

	// When we hit double the max, decimate to half
	if len(cb.Points) >= cb.Max*2 {
		decimated := make([]ChartPoint, 0, cb.Max)
		decimated = append(decimated, cb.Points[0]) // keep first
		for i := 2; i < len(cb.Points)-1; i += 2 {
			decimated = append(decimated, cb.Points[i])
		}
		decimated = append(decimated, cb.Points[len(cb.Points)-1]) // keep last
		cb.Points = decimated
	}
}

// Reset clears all chart data.
func (cb *ChartBuffer) Reset() {
	cb.Points = cb.Points[:0]
}

// NewStatistics creates a Statistics with starting balance.
func NewStatistics(startBalance float64) *Statistics {
	return &Statistics{
		Balance:  startBalance,
		StartBal: startBalance,
	}
}

// Reset clears all stats and sets the starting balance to current.
func (s *Statistics) Reset() {
	bal := s.Balance
	*s = Statistics{
		Balance:  bal,
		StartBal: bal,
	}
}

// BetResult holds the outcome of a single bet for statistics tracking.
type BetResult struct {
	Amount          float64 `json:"amount"`
	Payout          float64 `json:"payout"`
	PayoutMulti     float64 `json:"payoutMultiplier"`
	Win             bool    `json:"win"`
	Roll            float64 `json:"roll"`
	Chance          float64 `json:"chance"`
	Target          float64 `json:"target"`
	TargetNumber    float64 `json:"targetNumber"`
	GameSpecificStr string  `json:"gameSpecific,omitempty"`
}

// RecordBet processes a completed bet and updates all statistics.
func (s *Statistics) RecordBet(result BetResult) {
	s.Bets++

	profit := result.Payout - result.Amount
	s.CurrentProfit = profit
	s.Profit += profit
	s.Wagered += result.Amount
	s.PreviousBet = result.Amount
	s.Balance += profit

	if result.Win {
		s.Wins++
		s.WinStreak++
		s.LoseStreak = 0
		s.CurrentStreak = s.WinStreak
	} else {
		s.Losses++
		s.LoseStreak++
		s.WinStreak = 0
		s.CurrentStreak = -s.LoseStreak
	}

	// Update peaks
	if result.Amount > s.HighestBet {
		s.HighestBet = result.Amount
	}
	if s.Profit > s.HighestProfit {
		s.HighestProfit = s.Profit
	}
	if s.Profit < s.LowestProfit {
		s.LowestProfit = s.Profit
	}
	if s.CurrentStreak > s.HighestStreak {
		s.HighestStreak = s.CurrentStreak
	}
	if s.CurrentStreak < s.LowestStreak {
		s.LowestStreak = s.CurrentStreak
	}
}

// ProfitPercent returns profit as a percentage of starting balance.
func (s *Statistics) ProfitPercent() float64 {
	if s.StartBal == 0 {
		return 0
	}
	return (s.Profit / math.Abs(s.StartBal)) * 100
}
