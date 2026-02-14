package games

import (
	"fmt"

	"github.com/MJE43/stake-pf-replay-go/internal/engine"
)

// HiLoGame implements the HiLo provably fair game.
// Uses unlimited deck (each card drawn independently from 52 cards).
// Metric is the first card index (0-51) for scanning purposes.
type HiLoGame struct{}

const (
	hiloDefaultCards = 52 // generate enough cards for a full game
)

// Spec returns metadata about the HiLo game.
func (g *HiLoGame) Spec() GameSpec {
	return GameSpec{
		ID:          "hilo",
		Name:        "HiLo",
		MetricLabel: "first_card",
	}
}

// FloatCount returns the number of floats required.
// HiLo uses up to 52 floats (cursor of 13) to cover all possible cards needed.
func (g *HiLoGame) FloatCount(params map[string]any) int {
	return hiloDefaultCards
}

// Evaluate generates floats and calculates the card sequence.
func (g *HiLoGame) Evaluate(seeds Seeds, nonce uint64, params map[string]any) (GameResult, error) {
	floats := engine.Floats(seeds.Server, seeds.Client, nonce, 0, hiloDefaultCards)
	return g.EvaluateWithFloats(floats, params)
}

// EvaluateWithFloats calculates the card sequence using pre-computed floats.
func (g *HiLoGame) EvaluateWithFloats(floats []float64, params map[string]any) (GameResult, error) {
	if len(floats) < 1 {
		return GameResult{}, fmt.Errorf("hilo requires at least 1 float, got %d", len(floats))
	}

	// Deal cards from floats (unlimited deck, each float maps to one of 52 cards)
	cards := make([]Card, len(floats))
	for i, f := range floats {
		cards[i] = cardFromFloat(f)
	}

	// The first card is the "start card"
	firstCard := cards[0]
	firstCardIndex := cardIndexFromFloat(floats[0])

	// Build card strings for details
	cardStrs := make([]string, len(cards))
	for i, c := range cards {
		cardStrs[i] = c.String()
	}

	return GameResult{
		Metric:      float64(firstCardIndex),
		MetricLabel: "first_card",
		Details: map[string]any{
			"cards":       cardStrs,
			"first_card":  firstCard.String(),
			"first_rank":  firstCard.Rank,
			"first_suit":  firstCard.Suit,
			"total_cards": len(cards),
		},
	}, nil
}
