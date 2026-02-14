package games

import (
	"fmt"

	"github.com/MJE43/stake-pf-replay-go/internal/engine"
)

// BaccaratGame implements the Baccarat provably fair game.
// Uses unlimited deck (each card drawn independently from 52 cards).
// Maximum 6 cards needed per game (3 player + 3 banker).
type BaccaratGame struct{}

const (
	baccaratMaxCards = 6
)

// Spec returns metadata about the Baccarat game.
func (g *BaccaratGame) Spec() GameSpec {
	return GameSpec{
		ID:          "baccarat",
		Name:        "Baccarat",
		MetricLabel: "first_card",
	}
}

// FloatCount returns the number of floats required (6 max).
func (g *BaccaratGame) FloatCount(params map[string]any) int {
	return baccaratMaxCards
}

// Evaluate generates floats and calculates the baccarat deal.
func (g *BaccaratGame) Evaluate(seeds Seeds, nonce uint64, params map[string]any) (GameResult, error) {
	floats := engine.Floats(seeds.Server, seeds.Client, nonce, 0, baccaratMaxCards)
	return g.EvaluateWithFloats(floats, params)
}

// EvaluateWithFloats calculates the baccarat deal using pre-computed floats.
func (g *BaccaratGame) EvaluateWithFloats(floats []float64, params map[string]any) (GameResult, error) {
	if len(floats) < baccaratMaxCards {
		return GameResult{}, fmt.Errorf("baccarat requires at least %d floats, got %d", baccaratMaxCards, len(floats))
	}

	// Deal 6 cards from floats (unlimited deck)
	allCards := make([]Card, baccaratMaxCards)
	for i := 0; i < baccaratMaxCards; i++ {
		allCards[i] = cardFromFloat(floats[i])
	}

	// Standard deal order: player1, banker1, player2, banker2, player3, banker3
	playerCards := []Card{allCards[0], allCards[2]}
	bankerCards := []Card{allCards[1], allCards[3]}

	// Calculate initial hand values
	playerScore := baccaratHandScore(playerCards)
	bankerScore := baccaratHandScore(bankerCards)

	// Baccarat third-card rules
	playerDraws := false
	bankerDraws := false

	// Neither side draws if either has a natural (8 or 9)
	if playerScore < 8 && bankerScore < 8 {
		// Player draws on 0-5
		if playerScore <= 5 {
			playerDraws = true
			playerCards = append(playerCards, allCards[4])
			playerScore = baccaratHandScore(playerCards)
		}

		// Banker drawing rules depend on player's third card
		if playerDraws {
			playerThirdValue := baccaratCardValue(allCards[4].Rank)
			bankerDraws = bankerShouldDraw(bankerScore, playerThirdValue)
		} else {
			// Player stood: banker draws on 0-5
			bankerDraws = bankerScore <= 5
		}

		if bankerDraws {
			bankerCards = append(bankerCards, allCards[5])
			bankerScore = baccaratHandScore(bankerCards)
		}
	}

	// Determine winner
	var winner string
	switch {
	case playerScore > bankerScore:
		winner = "player"
	case bankerScore > playerScore:
		winner = "banker"
	default:
		winner = "tie"
	}

	// Build card string lists
	playerStrs := make([]string, len(playerCards))
	for i, c := range playerCards {
		playerStrs[i] = c.String()
	}
	bankerStrs := make([]string, len(bankerCards))
	for i, c := range bankerCards {
		bankerStrs[i] = c.String()
	}

	// First card index (0-51) as metric (for scanning)
	firstCardIndex := cardIndexFromFloat(floats[0])

	return GameResult{
		Metric:      float64(firstCardIndex),
		MetricLabel: "first_card",
		Details: map[string]any{
			"player_cards": playerStrs,
			"banker_cards": bankerStrs,
			"player_score": playerScore,
			"banker_score": bankerScore,
			"winner":       winner,
			"player_draws": playerDraws,
			"banker_draws": bankerDraws,
		},
	}, nil
}

// baccaratHandScore calculates the baccarat hand score (sum of card values mod 10).
func baccaratHandScore(cards []Card) int {
	total := 0
	for _, c := range cards {
		total += baccaratCardValue(c.Rank)
	}
	return total % 10
}

// bankerShouldDraw implements the standard baccarat banker third-card rule.
// bankerScore is the banker's current score (0-7), playerThirdCard is the
// point value of the player's third card.
func bankerShouldDraw(bankerScore int, playerThirdCard int) bool {
	switch bankerScore {
	case 0, 1, 2:
		return true
	case 3:
		return playerThirdCard != 8
	case 4:
		return playerThirdCard >= 2 && playerThirdCard <= 7
	case 5:
		return playerThirdCard >= 4 && playerThirdCard <= 7
	case 6:
		return playerThirdCard == 6 || playerThirdCard == 7
	default: // 7, 8, 9
		return false
	}
}
