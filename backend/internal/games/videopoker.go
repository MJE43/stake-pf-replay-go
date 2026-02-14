package games

import (
	"fmt"
	"math"
	"sort"

	"github.com/MJE43/stake-pf-replay-go/internal/engine"
)

// VideoPokerGame implements the Video Poker provably fair game.
// Uses Fisher-Yates shuffle to deal from a 52-card deck (no replacement).
type VideoPokerGame struct{}

const (
	videoPokerDeckSize   = 52
	videoPokerFloatCount = 52 // Full deck shuffle
)

// Spec returns metadata about the Video Poker game.
func (g *VideoPokerGame) Spec() GameSpec {
	return GameSpec{
		ID:          "videopoker",
		Name:        "Video Poker",
		MetricLabel: "first_card",
	}
}

// FloatCount returns the number of floats required (52 for full deck shuffle).
func (g *VideoPokerGame) FloatCount(params map[string]any) int {
	return videoPokerFloatCount
}

// Evaluate generates floats and calculates the card deal.
func (g *VideoPokerGame) Evaluate(seeds Seeds, nonce uint64, params map[string]any) (GameResult, error) {
	floats := engine.Floats(seeds.Server, seeds.Client, nonce, 0, videoPokerFloatCount)
	return g.EvaluateWithFloats(floats, params)
}

// EvaluateWithFloats calculates the shuffled deck using pre-computed floats.
func (g *VideoPokerGame) EvaluateWithFloats(floats []float64, params map[string]any) (GameResult, error) {
	if len(floats) < videoPokerFloatCount {
		return GameResult{}, fmt.Errorf("video poker requires at least %d floats, got %d", videoPokerFloatCount, len(floats))
	}

	// Fisher-Yates shuffle: create pool of card indices 0-51
	pool := make([]int, videoPokerDeckSize)
	for i := range pool {
		pool[i] = i
	}

	// Generate full deck order using Fisher-Yates selection
	shuffled := make([]int, 0, videoPokerDeckSize)
	for i := 0; i < videoPokerFloatCount; i++ {
		if len(pool) == 0 {
			break
		}

		index := int(math.Floor(floats[i] * float64(len(pool))))
		if index >= len(pool) {
			index = len(pool) - 1
		}

		shuffled = append(shuffled, pool[index])
		pool = append(pool[:index], pool[index+1:]...)
	}

	// Convert shuffled indices to cards
	cards := make([]Card, len(shuffled))
	for i, idx := range shuffled {
		cards[i] = cardDeck[idx]
	}

	// Initial hand is first 5 cards
	hand := cards[:5]
	// Replacement cards are next 5 (indices 5-9)
	replacements := cards[5:10]

	handStrs := make([]string, 5)
	for i, c := range hand {
		handStrs[i] = c.String()
	}

	replStrs := make([]string, 5)
	for i, c := range replacements {
		replStrs[i] = c.String()
	}

	// Evaluate the initial hand
	handRank := evaluatePokerHand(hand)

	// First card index (0-51) as metric
	firstCardIndex := shuffled[0]

	return GameResult{
		Metric:      float64(firstCardIndex),
		MetricLabel: "first_card",
		Details: map[string]any{
			"hand":         handStrs,
			"replacements": replStrs,
			"hand_rank":    handRank,
			"total_cards":  len(cards),
		},
	}, nil
}

// evaluatePokerHand returns a string describing the best poker hand.
func evaluatePokerHand(cards []Card) string {
	if len(cards) != 5 {
		return "invalid"
	}

	// Get rank values and sort them
	values := make([]int, 5)
	for i, c := range cards {
		values[i] = cardRankValue(c.Rank)
	}
	sort.Ints(values)

	// Check flush (all same suit)
	isFlush := true
	for i := 1; i < 5; i++ {
		if cards[i].Suit != cards[0].Suit {
			isFlush = false
			break
		}
	}

	// Check straight
	isStraight := false
	// Normal straight
	if values[4]-values[0] == 4 && allUnique(values) {
		isStraight = true
	}
	// Ace-high straight: A(1), 10, J, Q, K -> [1, 10, 11, 12, 13]
	if values[0] == 1 && values[1] == 10 && values[2] == 11 && values[3] == 12 && values[4] == 13 {
		isStraight = true
	}

	// Count rank frequencies
	freq := make(map[int]int)
	for _, v := range values {
		freq[v]++
	}

	// Collect frequency counts
	counts := make([]int, 0, len(freq))
	for _, c := range freq {
		counts = append(counts, c)
	}
	sort.Sort(sort.Reverse(sort.IntSlice(counts)))

	// Evaluate hand
	if isFlush && isStraight {
		// Royal flush check: A, 10, J, Q, K
		if values[0] == 1 && values[4] == 13 {
			return "royal_flush"
		}
		return "straight_flush"
	}
	if counts[0] == 4 {
		return "four_of_a_kind"
	}
	if counts[0] == 3 && counts[1] == 2 {
		return "full_house"
	}
	if isFlush {
		return "flush"
	}
	if isStraight {
		return "straight"
	}
	if counts[0] == 3 {
		return "three_of_a_kind"
	}
	if counts[0] == 2 && counts[1] == 2 {
		return "two_pair"
	}
	if counts[0] == 2 {
		// Jacks or better check
		for v, c := range freq {
			if c == 2 && (v >= 11 || v == 1) { // J, Q, K, or A
				return "jacks_or_better"
			}
		}
		return "pair"
	}
	return "high_card"
}

func allUnique(vals []int) bool {
	seen := make(map[int]bool, len(vals))
	for _, v := range vals {
		if seen[v] {
			return false
		}
		seen[v] = true
	}
	return true
}
