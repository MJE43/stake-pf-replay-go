package engine

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"testing"
)

func TestStakeKenoVerify(t *testing.T) {
	// Verified test case from Stake.com
	serverSeed := "fb30c5e2bbd8537b76c6df8e8e86533121cbeeae0bda9d306117147e656ad46e"
	clientSeed := "56e27fed-ece3-4279-ab56-96f71fe9b2ee"
	nonce := uint64(1)

	// Generate the HMAC for round 0 and round 1 (Keno needs 10 floats = 40 bytes)
	// Round 0: bytes 0-31
	h0 := hmac.New(sha256.New, []byte(serverSeed))
	h0.Write([]byte(fmt.Sprintf("%s:%d:%d", clientSeed, nonce, 0)))
	round0 := h0.Sum(nil)
	t.Logf("Round 0 hash (hex): %s", hex.EncodeToString(round0))
	t.Logf("Round 0 bytes: %v", round0)

	// Round 1: bytes 32-63
	h1 := hmac.New(sha256.New, []byte(serverSeed))
	h1.Write([]byte(fmt.Sprintf("%s:%d:%d", clientSeed, nonce, 1)))
	round1 := h1.Sum(nil)
	t.Logf("Round 1 hash (hex): %s", hex.EncodeToString(round1))
	t.Logf("Round 1 bytes: %v", round1)

	// Compute floats manually from bytes
	allBytes := append(round0, round1...)
	t.Logf("Combined bytes for 10 floats (40 bytes): %d bytes available", len(allBytes))

	floats := make([]float64, 10)
	for i := 0; i < 10; i++ {
		b := allBytes[i*4 : i*4+4]
		f := bytesToFloat([4]byte{b[0], b[1], b[2], b[3]})
		floats[i] = f
		t.Logf("Float[%d] from bytes %v = %.15f", i, b, f)
	}

	// Compare with our Floats function
	engineFloats := Floats(serverSeed, clientSeed, nonce, 0, 10)
	t.Logf("\nEngine floats: %v", engineFloats)

	for i := 0; i < 10; i++ {
		if floats[i] != engineFloats[i] {
			t.Errorf("Float %d mismatch: manual %.15f, engine %.15f", i, floats[i], engineFloats[i])
		}
	}

	// Now let's trace Fisher-Yates with these floats
	pool := make([]int, 40)
	for i := range pool {
		pool[i] = i + 1 // 1-40
	}

	t.Log("\nFisher-Yates trace:")
	draws := make([]int, 10)
	for i := 0; i < 10; i++ {
		idx := int(floats[i] * float64(len(pool)))
		if idx >= len(pool) {
			idx = len(pool) - 1
		}
		draws[i] = pool[idx]
		t.Logf("  Float[%d] = %.6f, pool size = %d, idx = %d, draw = %d",
			i, floats[i], len(pool), idx, draws[i])
		// Splice remove
		pool = append(pool[:idx], pool[idx+1:]...)
	}

	t.Logf("\nOur draws: %v", draws)
	t.Logf("Expected:  [3, 7, 8, 13, 17, 27, 32, 35, 37, 39]")
}

