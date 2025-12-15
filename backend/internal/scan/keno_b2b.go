package scan

import (
	"context"
	"sort"
	"sync"

	"github.com/MJE43/stake-pf-replay-go/internal/engine"
	"github.com/MJE43/stake-pf-replay-go/internal/games"
)

// KenoB2BRequest represents a Keno B2B scan request
type KenoB2BRequest struct {
	Seeds        games.Seeds `json:"seeds"`
	NonceStart   uint64      `json:"nonce_start"`
	NonceEnd     uint64      `json:"nonce_end"`
	Risk         string      `json:"risk"`         // "classic", "low", "medium", "high"
	PickCount    int         `json:"pick_count"`   // 1-10
	PickerMode   PickerMode  `json:"picker_mode"`  // "reproducible" or "entropy"
	B2BThreshold float64     `json:"b2b_threshold"` // Minimum cumulative multiplier to record
	TopN         int         `json:"top_n"`        // 0 = find all, >0 = limit to top N
}

// KenoBet represents a single Keno bet in a B2B sequence
type KenoBet struct {
	Nonce      uint64  `json:"nonce"`
	Picks      []int   `json:"picks"`
	Draws      []int   `json:"draws"`
	Hits       int     `json:"hits"`
	Multiplier float64 `json:"multiplier"`
}

// B2BSequence represents a streak of consecutive wins
type B2BSequence struct {
	StartNonce           uint64    `json:"start_nonce"`
	EndNonce             uint64    `json:"end_nonce"`
	CumulativeMultiplier float64   `json:"cumulative_multiplier"`
	StreakLength         int       `json:"streak_length"`
	Bets                 []KenoBet `json:"bets"`
}

// KenoB2BResult contains the results of a Keno B2B scan
type KenoB2BResult struct {
	Sequences      []B2BSequence `json:"sequences"`
	TotalFound     int           `json:"total_found"`
	HighestMulti   float64       `json:"highest_multi"`
	TotalEvaluated uint64        `json:"total_evaluated"`
	AntebotScript  string        `json:"antebot_script,omitempty"`
}

// KenoB2BScanner performs B2B scanning for Keno
type KenoB2BScanner struct {
	picker *NumberPicker
}

// NewKenoB2BScanner creates a new Keno B2B scanner
func NewKenoB2BScanner(mode PickerMode) *KenoB2BScanner {
	return &KenoB2BScanner{
		picker: NewNumberPicker(mode),
	}
}

// Scan performs the B2B scan across the nonce range
func (s *KenoB2BScanner) Scan(ctx context.Context, req KenoB2BRequest) (*KenoB2BResult, error) {
	// Validate request
	if !games.IsValidKenoRisk(req.Risk) {
		req.Risk = "medium"
	}
	if req.PickCount < games.KenoMinPicks || req.PickCount > games.KenoMaxPicks {
		req.PickCount = 9 // Default to 9 picks
	}
	if req.B2BThreshold <= 0 {
		req.B2BThreshold = 100 // Default threshold
	}

	// Create picker with the requested mode
	picker := NewNumberPicker(req.PickerMode)

	// Track sequences found
	var sequences []B2BSequence
	var seqMutex sync.Mutex

	// Current streak tracking
	var currentStreak []KenoBet
	var cumulativeMulti float64 = 1.0
	var streakStartNonce uint64

	var totalEvaluated uint64

	// Process nonces sequentially (required for B2B tracking)
	for nonce := req.NonceStart; nonce <= req.NonceEnd; nonce++ {
		select {
		case <-ctx.Done():
			// Check final streak before returning
			if len(currentStreak) > 0 && cumulativeMulti >= req.B2BThreshold {
				seq := B2BSequence{
					StartNonce:           streakStartNonce,
					EndNonce:             currentStreak[len(currentStreak)-1].Nonce,
					CumulativeMultiplier: cumulativeMulti,
					StreakLength:         len(currentStreak),
					Bets:                 currentStreak,
				}
				sequences = append(sequences, seq)
			}
			goto done
		default:
		}

		totalEvaluated++

		// Generate the Keno draw for this nonce
		floats := engine.Floats(req.Seeds.Server, req.Seeds.Client, nonce, 0, games.KenoDrawCount)
		draws := generateDraws(floats)

		// Generate player picks
		picks := picker.PickNumbers(nonce, req.PickCount)

		// Count hits and get multiplier
		hits := countKenoHits(picks, draws)
		multiplier := games.GetKenoMultiplier(req.Risk, req.PickCount, hits)

		bet := KenoBet{
			Nonce:      nonce,
			Picks:      picks,
			Draws:      draws,
			Hits:       hits,
			Multiplier: multiplier,
		}

		if multiplier > 0 {
			// Win - extend streak
			if len(currentStreak) == 0 {
				streakStartNonce = nonce
				cumulativeMulti = 1.0
			}
			cumulativeMulti *= multiplier
			currentStreak = append(currentStreak, bet)
		} else {
			// Loss - check if current streak meets threshold, then reset
			if len(currentStreak) > 0 && cumulativeMulti >= req.B2BThreshold {
				seq := B2BSequence{
					StartNonce:           streakStartNonce,
					EndNonce:             currentStreak[len(currentStreak)-1].Nonce,
					CumulativeMultiplier: cumulativeMulti,
					StreakLength:         len(currentStreak),
					Bets:                 make([]KenoBet, len(currentStreak)),
				}
				copy(seq.Bets, currentStreak)

				seqMutex.Lock()
				sequences = append(sequences, seq)
				seqMutex.Unlock()
			}
			// Reset streak
			currentStreak = currentStreak[:0]
			cumulativeMulti = 1.0
		}
	}

	// Check final streak at end of range
	if len(currentStreak) > 0 && cumulativeMulti >= req.B2BThreshold {
		seq := B2BSequence{
			StartNonce:           streakStartNonce,
			EndNonce:             currentStreak[len(currentStreak)-1].Nonce,
			CumulativeMultiplier: cumulativeMulti,
			StreakLength:         len(currentStreak),
			Bets:                 currentStreak,
		}
		sequences = append(sequences, seq)
	}

done:
	// Sort by cumulative multiplier descending
	sort.Slice(sequences, func(i, j int) bool {
		return sequences[i].CumulativeMultiplier > sequences[j].CumulativeMultiplier
	})

	// Apply TopN limit if specified
	totalFound := len(sequences)
	if req.TopN > 0 && len(sequences) > req.TopN {
		sequences = sequences[:req.TopN]
	}

	// Find highest multiplier
	var highestMulti float64
	if len(sequences) > 0 {
		highestMulti = sequences[0].CumulativeMultiplier
	}

	// Generate Antebot script for reproducible mode
	var antebotScript string
	if req.PickerMode == PickerModeReproducible {
		antebotScript = GenerateAntebotScript(req.PickCount, req.Risk)
	}

	return &KenoB2BResult{
		Sequences:      sequences,
		TotalFound:     totalFound,
		HighestMulti:   highestMulti,
		TotalEvaluated: totalEvaluated,
		AntebotScript:  antebotScript,
	}, nil
}

// generateDraws generates 10 Keno draws from floats using Fisher-Yates
func generateDraws(floats []float64) []int {
	pool := make([]int, games.KenoSquares)
	for i := range pool {
		pool[i] = i
	}

	draws := make([]int, games.KenoDrawCount)
	for i := 0; i < games.KenoDrawCount; i++ {
		idx := int(floats[i] * float64(len(pool)))
		if idx >= len(pool) {
			idx = len(pool) - 1
		}
		draws[i] = pool[idx]
		// Stable removal to match Stake verification (ordered pool shrink)
		pool = append(pool[:idx], pool[idx+1:]...)
	}

	return draws
}

// countKenoHits counts how many picks match draws
func countKenoHits(picks, draws []int) int {
	drawSet := make(map[int]bool, len(draws))
	for _, d := range draws {
		drawSet[d] = true
	}

	hits := 0
	for _, p := range picks {
		if drawSet[p] {
			hits++
		}
	}
	return hits
}

