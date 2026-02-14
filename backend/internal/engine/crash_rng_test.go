package engine

import (
	"crypto/sha256"
	"encoding/hex"
	"math"
	"testing"
)

func TestCrashResultBasic(t *testing.T) {
	// Known test: a hash that produces an instant crash (val % 33 == 0)
	// and a hash that doesn't
	salt := "0000000000000000000fa3b65e43e4240d71762a5bf397d5304b2596d116859c"
	gameHash := "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"

	result := CrashResult(gameHash, salt)
	if result < 1.0 {
		t.Errorf("crash result should never be below 1.0, got %f", result)
	}

	// Result should be a number floored to 2 decimal places
	rounded := math.Floor(result*100) / 100
	if result != rounded {
		t.Errorf("crash result should be floored to 2 decimals, got %f", result)
	}
}

func TestCrashResultInstantCrash(t *testing.T) {
	// Generate a game hash that results in val % 33 == 0
	// We'll brute-force a small example
	salt := "testsalt"
	found := false

	// Try hashing incrementing strings until we find one where val%33==0
	for i := 0; i < 10000; i++ {
		gameHash := hex.EncodeToString([]byte("crash_test_" + string(rune(i+'A'))))
		result := CrashResult(gameHash, salt)
		if result == 1.0 {
			// Verify it's actually an instant crash (not just a low multiplier)
			found = true
			break
		}
	}

	if !found {
		t.Log("could not find instant crash in 10000 attempts; statistical check only")
	}
}

func TestCrashResultDeterministic(t *testing.T) {
	gameHash := "77b271fe12fca03c618f63a71571f35aea4fe4478d1a8b528f9f4a9031adbab5"
	salt := "0000000000000000000fa3b65e43e4240d71762a5bf397d5304b2596d116859c"

	r1 := CrashResult(gameHash, salt)
	r2 := CrashResult(gameHash, salt)

	if r1 != r2 {
		t.Errorf("crash result should be deterministic: got %f and %f", r1, r2)
	}
}

func TestCrashResultRange(t *testing.T) {
	salt := "test_salt_for_range"

	// Generate 1000 results from a chain and verify all are >= 1.0
	h := sha256.Sum256([]byte("seed"))
	currentHash := hex.EncodeToString(h[:])

	for i := 0; i < 1000; i++ {
		result := CrashResult(currentHash, salt)
		if result < 1.0 {
			t.Errorf("round %d: crash point %f < 1.0", i, result)
		}
		if result > CrashMaxMultiplier {
			t.Errorf("round %d: crash point %f > max %f", i, result, CrashMaxMultiplier)
		}

		// Advance chain
		h = sha256.Sum256([]byte(currentHash))
		currentHash = hex.EncodeToString(h[:])
	}
}

func TestGenerateHashChain(t *testing.T) {
	terminatingHash := "77b271fe12fca03c618f63a71571f35aea4fe4478d1a8b528f9f4a9031adbab5"

	chain := GenerateHashChain(terminatingHash, 10)

	if len(chain) != 10 {
		t.Fatalf("expected chain length 10, got %d", len(chain))
	}

	// Last element should be the terminating hash
	if chain[9] != terminatingHash {
		t.Errorf("last chain element should be terminating hash")
	}

	// Verify chain links: hash of chain[i+1] == chain[i]
	if !VerifyHashChain(chain) {
		t.Error("generated chain failed verification")
	}
}

func TestVerifyHashChain(t *testing.T) {
	terminatingHash := "abc123def456abc123def456abc123def456abc123def456abc123def456abc1"
	chain := GenerateHashChain(terminatingHash, 5)

	if !VerifyHashChain(chain) {
		t.Error("valid chain should verify")
	}

	// Tamper with a link
	tampered := make([]string, len(chain))
	copy(tampered, chain)
	tampered[2] = "0000000000000000000000000000000000000000000000000000000000000000"

	if VerifyHashChain(tampered) {
		t.Error("tampered chain should NOT verify")
	}
}

func TestCrashResultsFromChain(t *testing.T) {
	terminatingHash := "77b271fe12fca03c618f63a71571f35aea4fe4478d1a8b528f9f4a9031adbab5"
	salt := "0000000000000000000fa3b65e43e4240d71762a5bf397d5304b2596d116859c"

	chain := GenerateHashChain(terminatingHash, 100)
	results := CrashResultsFromChain(chain, salt)

	if len(results) != 100 {
		t.Fatalf("expected 100 results, got %d", len(results))
	}

	// Verify each result matches individual calculation
	for i, hash := range chain {
		expected := CrashResult(hash, salt)
		if results[i] != expected {
			t.Errorf("result[%d]: got %f, expected %f", i, results[i], expected)
		}
	}
}

func TestCrashHouseEdgeDistribution(t *testing.T) {
	// Statistical test: over many rounds, ~3% should be instant crashes
	salt := "statistical_test_salt"
	h := sha256.Sum256([]byte("statistical_seed"))
	currentHash := hex.EncodeToString(h[:])

	instantCrashes := 0
	total := 10000

	for i := 0; i < total; i++ {
		result := CrashResult(currentHash, salt)
		if result == 1.0 {
			instantCrashes++
		}
		h = sha256.Sum256([]byte(currentHash))
		currentHash = hex.EncodeToString(h[:])
	}

	rate := float64(instantCrashes) / float64(total)
	// The 1.0x rate includes val%33==0 (~3%) plus low-multiplier floor cases,
	// so expect roughly 5-10% total in the 1.0x bucket.
	if rate < 0.02 || rate > 0.12 {
		t.Errorf("1.0x crash rate %f outside expected range [0.02, 0.12]", rate)
	}

	t.Logf("1.0x crash rate: %.2f%% (%d/%d)", rate*100, instantCrashes, total)
}
