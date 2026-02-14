package stake

import (
	"strings"
	"testing"
)

func TestRandomString(t *testing.T) {
	// Test length
	for _, length := range []int{1, 5, 10, 21, 50} {
		s := RandomString(length)
		if len(s) != length {
			t.Errorf("RandomString(%d): expected length %d, got %d", length, length, len(s))
		}
	}

	// Test charset compliance
	for i := 0; i < 100; i++ {
		s := RandomString(21)
		for _, c := range s {
			if !strings.ContainsRune(charset, c) {
				t.Errorf("RandomString produced invalid character: %c", c)
			}
		}
	}

	// Test uniqueness (probabilistic)
	seen := make(map[string]bool)
	for i := 0; i < 100; i++ {
		s := RandomString(21)
		if seen[s] {
			t.Errorf("RandomString produced duplicate in 100 attempts: %s", s)
		}
		seen[s] = true
	}
}

func TestBetIdentifier(t *testing.T) {
	id := BetIdentifier()
	if len(id) != 21 {
		t.Errorf("BetIdentifier: expected length 21, got %d", len(id))
	}
}

func TestDefaultClientSeed(t *testing.T) {
	seed := DefaultClientSeed()
	if len(seed) != 10 {
		t.Errorf("DefaultClientSeed: expected length 10, got %d", len(seed))
	}
}
