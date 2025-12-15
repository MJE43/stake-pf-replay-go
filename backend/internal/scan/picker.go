package scan

import (
	"crypto/rand"
	"fmt"
	"math/big"
)

// PickerMode defines how player numbers are generated
type PickerMode string

const (
	// PickerModeReproducible uses Mulberry32 PRNG seeded by nonce
	// This mode produces the same picks given the same nonce, matching the Antebot JS implementation
	PickerModeReproducible PickerMode = "reproducible"

	// PickerModeEntropy uses crypto/rand for true randomness
	// This mode simulates browser Math.random() behavior
	PickerModeEntropy PickerMode = "entropy"
)

// NumberPicker generates player number selections for Keno
type NumberPicker struct {
	mode PickerMode
}

// NewNumberPicker creates a picker with the specified mode
func NewNumberPicker(mode PickerMode) *NumberPicker {
	return &NumberPicker{mode: mode}
}

// PickNumbers generates `count` unique numbers from 0-39 for the given nonce
// In reproducible mode, the same nonce will always produce the same picks
// In entropy mode, picks are truly random (non-reproducible)
func (p *NumberPicker) PickNumbers(nonce uint64, count int) []int {
	if p.mode == PickerModeEntropy {
		return pickNumbersEntropy(count)
	}
	return pickNumbersReproducible(nonce, count)
}

// pickNumbersReproducible uses Mulberry32 PRNG seeded by nonce
// This algorithm can be implemented identically in JavaScript for Antebot
func pickNumbersReproducible(nonce uint64, count int) []int {
	// Initialize Mulberry32 with nonce as seed
	rng := newMulberry32(uint32(nonce))

	// Create pool of numbers 0-39
	pool := make([]int, 40)
	for i := range pool {
		pool[i] = i
	}

	picks := make([]int, count)

	// Fisher-Yates selection
	for i := 0; i < count; i++ {
		// Get random float [0, 1)
		f := rng.Float64()

		// Select index from remaining pool
		idx := int(f * float64(len(pool)))
		if idx >= len(pool) {
			idx = len(pool) - 1
		}

		// Record pick and remove from pool
		picks[i] = pool[idx]
		pool = append(pool[:idx], pool[idx+1:]...)
	}

	return picks
}

// pickNumbersEntropy uses crypto/rand for true randomness
func pickNumbersEntropy(count int) []int {
	pool := make([]int, 40)
	for i := range pool {
		pool[i] = i
	}

	picks := make([]int, count)

	for i := 0; i < count; i++ {
		// Get random index from remaining pool
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(pool))))
		idx := int(n.Int64())

		picks[i] = pool[idx]
		pool = append(pool[:idx], pool[idx+1:]...)
	}

	return picks
}

// mulberry32 is a simple, fast PRNG that can be implemented identically in Go and JavaScript
// Algorithm: https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
type mulberry32 struct {
	state uint32
}

// newMulberry32 creates a new Mulberry32 PRNG with the given seed
func newMulberry32(seed uint32) *mulberry32 {
	return &mulberry32{state: seed}
}

// Next returns the next random uint32
func (m *mulberry32) Next() uint32 {
	m.state += 0x6D2B79F5
	t := m.state
	t = (t ^ (t >> 15)) * (t | 1)
	t ^= t + (t^(t>>7))*(t|61)
	return t ^ (t >> 14)
}

// Float64 returns a random float64 in [0, 1)
func (m *mulberry32) Float64() float64 {
	return float64(m.Next()) / 4294967296.0
}

// GenerateAntebotScript returns JavaScript code that implements the same picker algorithm
// Users can copy this into their Antebot scripts for matching behavior
func GenerateAntebotScript(pickCount int, risk string) string {
	pickCountStr := fmt.Sprintf("%d", pickCount)
	return `// Mulberry32 PRNG - matches the Stake PF Replay Go picker
function mulberry32(seed) {
    return function() {
        seed = (seed + 0x6D2B79F5) >>> 0;
        let t = seed;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Pick numbers using Fisher-Yates selection
function pickNumbers(nonce, count) {
    const rng = mulberry32(nonce >>> 0);
    const pool = Array.from({length: 40}, (_, i) => i);
    const picks = [];
    for (let i = 0; i < count; i++) {
        const idx = Math.floor(rng() * pool.length);
        picks.push(pool.splice(idx, 1)[0]);
    }
    return picks;
}

// Configuration - matches your Stake PF Replay scan settings
const PICK_COUNT = ` + pickCountStr + `;
const RISK = '` + risk + `';

game = 'keno';
risk = RISK;
numbers = pickNumbers(0, PICK_COUNT);  // Initial picks for nonce 0

engine.onBetPlaced(async (lastBet) => {
    // Generate picks based on next nonce for reproducible results
    const nextNonce = lastBet.nonce + 1;
    numbers = pickNumbers(nextNonce, PICK_COUNT);
});
`
}

