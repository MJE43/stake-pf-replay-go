package games

import "math"

// Card represents a playing card with rank and suit.
type Card struct {
	Rank string `json:"rank"`
	Suit string `json:"suit"`
}

// String returns a human-readable card representation like "♦2" or "♠A".
func (c Card) String() string {
	return c.Suit + c.Rank
}

// Suits in the order used by Stake: ♦, ♥, ♠, ♣
var cardSuits = []string{"♦", "♥", "♠", "♣"}

// Ranks in order: 2-10, J, Q, K, A
var cardRanks = []string{"2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"}

// SuitCodes maps suit symbols to single-character codes used by the Stake API.
var SuitCodes = map[string]string{
	"♦": "D", "♥": "H", "♠": "S", "♣": "C",
}

// The full 52-card deck in Stake's index order: ♦2, ♥2, ♠2, ♣2, ♦3, ...
var cardDeck [52]Card

func init() {
	i := 0
	for _, rank := range cardRanks {
		for _, suit := range cardSuits {
			cardDeck[i] = Card{Rank: rank, Suit: suit}
			i++
		}
	}
}

// cardFromFloat converts a float [0,1) to a card index and returns the card.
// Uses the formula: index = floor(float * 52), then looks up the card.
// This is for games with unlimited deck (Blackjack, HiLo, Baccarat).
func cardFromFloat(f float64) Card {
	return cardDeck[cardIndexFromFloat(f)]
}

// cardIndexFromFloat converts a float [0,1) to a card index in [0, 51].
func cardIndexFromFloat(f float64) int {
	index := int(math.Floor(f * 52))
	if index < 0 {
		return 0
	}
	if index >= 52 {
		return 51
	}
	return index
}

// cardRankValue returns the numeric value of a card rank for comparison.
// A=1, 2=2, ..., 10=10, J=11, Q=12, K=13
func cardRankValue(rank string) int {
	switch rank {
	case "A":
		return 1
	case "2":
		return 2
	case "3":
		return 3
	case "4":
		return 4
	case "5":
		return 5
	case "6":
		return 6
	case "7":
		return 7
	case "8":
		return 8
	case "9":
		return 9
	case "10":
		return 10
	case "J":
		return 11
	case "Q":
		return 12
	case "K":
		return 13
	default:
		return 0
	}
}

// baccaratCardValue returns the baccarat point value of a card.
// 2-9: face value, 10/J/Q/K: 0, A: 1
func baccaratCardValue(rank string) int {
	switch rank {
	case "A":
		return 1
	case "2":
		return 2
	case "3":
		return 3
	case "4":
		return 4
	case "5":
		return 5
	case "6":
		return 6
	case "7":
		return 7
	case "8":
		return 8
	case "9":
		return 9
	default: // 10, J, Q, K
		return 0
	}
}

// blackjackCardValue returns the blackjack point value of a card.
// 2-10: face value, J/Q/K: 10, A: 11 (soft)
func blackjackCardValue(rank string) int {
	switch rank {
	case "A":
		return 11
	case "J", "Q", "K":
		return 10
	case "2":
		return 2
	case "3":
		return 3
	case "4":
		return 4
	case "5":
		return 5
	case "6":
		return 6
	case "7":
		return 7
	case "8":
		return 8
	case "9":
		return 9
	case "10":
		return 10
	default:
		return 0
	}
}

// blackjackHandValue calculates the best blackjack hand value (accounting for soft aces).
func blackjackHandValue(cards []Card) int {
	total := 0
	aces := 0
	for _, c := range cards {
		val := blackjackCardValue(c.Rank)
		total += val
		if c.Rank == "A" {
			aces++
		}
	}
	// Reduce aces from 11 to 1 if over 21
	for total > 21 && aces > 0 {
		total -= 10
		aces--
	}
	return total
}
