package stake

import (
	"crypto/rand"
	"math/big"
)

// Stake uses a specific 64-character charset for random string generation.
// Note: '_' and '-' appear at both index 0,1 and 62,63 (per the original JS source).
const charset = "_-0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-"

// RandomString generates a cryptographically random string of the given length
// using the Stake-compatible charset. Uses crypto/rand for security.
func RandomString(length int) string {
	b := make([]byte, length)
	max := big.NewInt(int64(len(charset)))
	for i := range b {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			// Fallback should never happen with crypto/rand
			b[i] = charset[0]
			continue
		}
		b[i] = charset[n.Int64()]
	}
	return string(b)
}

// BetIdentifier generates a 21-character random identifier for bet requests.
// Every bet MUST have a unique identifier to prevent replay attacks.
func BetIdentifier() string {
	return RandomString(21)
}

// DefaultClientSeed generates a 10-character random string suitable
// as a default client seed for seed rotation.
func DefaultClientSeed() string {
	return RandomString(10)
}
