package games

import (
	"fmt"

	"github.com/MJE43/stake-pf-replay-go/internal/engine"
)

// BlackjackGame implements the Blackjack provably fair game.
// Uses unlimited deck (each card drawn independently from 52 cards).
// Generates up to 52 cards to cover all possible hands in a game.
type BlackjackGame struct{}

const (
	blackjackDefaultCards = 52
)

// Spec returns metadata about the Blackjack game.
func (g *BlackjackGame) Spec() GameSpec {
	return GameSpec{
		ID:          "blackjack",
		Name:        "Blackjack",
		MetricLabel: "first_card",
	}
}

// FloatCount returns the number of floats required.
// Blackjack uses up to 52 floats (cursor of 13) to cover all possible cards.
func (g *BlackjackGame) FloatCount(params map[string]any) int {
	return blackjackDefaultCards
}

// Evaluate generates floats and calculates the card deal.
func (g *BlackjackGame) Evaluate(seeds Seeds, nonce uint64, params map[string]any) (GameResult, error) {
	floats := engine.Floats(seeds.Server, seeds.Client, nonce, 0, blackjackDefaultCards)
	return g.EvaluateWithFloats(floats, params)
}

// EvaluateWithFloats calculates the blackjack deal using pre-computed floats.
func (g *BlackjackGame) EvaluateWithFloats(floats []float64, params map[string]any) (GameResult, error) {
	if len(floats) < 4 {
		return GameResult{}, fmt.Errorf("blackjack requires at least 4 floats, got %d", len(floats))
	}

	// Deal cards from floats (unlimited deck)
	allCards := make([]Card, len(floats))
	for i, f := range floats {
		allCards[i] = cardFromFloat(f)
	}

	// Standard deal order: player1, dealer1, player2, dealer2
	playerCards := []Card{allCards[0], allCards[2]}
	dealerCards := []Card{allCards[1], allCards[3]}

	playerValue := blackjackHandValue(playerCards)
	dealerValue := blackjackHandValue(dealerCards)

	// Build card string lists for details
	playerStrs := make([]string, len(playerCards))
	for i, c := range playerCards {
		playerStrs[i] = c.String()
	}
	dealerStrs := make([]string, len(dealerCards))
	for i, c := range dealerCards {
		dealerStrs[i] = c.String()
	}

	// Build full deck list
	allCardStrs := make([]string, len(allCards))
	for i, c := range allCards {
		allCardStrs[i] = c.String()
	}

	// First card index (0-51) as metric (for scanning)
	firstCardIndex := cardIndexFromFloat(floats[0])

	return GameResult{
		Metric:      float64(firstCardIndex),
		MetricLabel: "first_card",
		Details: map[string]any{
			"player_cards":     playerStrs,
			"dealer_cards":     dealerStrs,
			"player_value":     playerValue,
			"dealer_value":     dealerValue,
			"player_blackjack": playerValue == 21,
			"dealer_blackjack": dealerValue == 21,
			"all_cards":        allCardStrs,
		},
	}, nil
}
