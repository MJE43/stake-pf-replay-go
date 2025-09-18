package engine

import (
	"crypto/hmac"
	"crypto/sha256"
	"fmt"
)

// ByteGenerator generates cryptographically secure bytes using HMAC-SHA256

// NewByteGenerator creates a new byte generator with the given parameters
func NewByteGenerator(serverSeed, clientSeed string, nonce uint64, cursor int) *ByteGenerator {
	return &ByteGenerator{
		serverSeed:         serverSeed,
		clientSeed:         clientSeed,
		nonce:             nonce,
		cursor:            cursor,
		currentRound:      cursor / 32,
		currentRoundCursor: cursor % 32,
	}
}

// Next returns the next byte from the generator
func (bg *ByteGenerator) Next() byte {
	if bg.currentRoundCursor >= 32 {
		bg.currentRound++
		bg.currentRoundCursor = 0
	}

	if bg.currentRoundCursor == 0 {
		bg.generateRound()
	}

	b := bg.buffer[bg.currentRoundCursor]
	bg.currentRoundCursor++
	return b
}

type ByteGenerator struct {
	serverSeed         string
	clientSeed         string
	nonce             uint64
	cursor            int
	currentRound      int
	currentRoundCursor int
	buffer            [32]byte
}

func (bg *ByteGenerator) generateRound() {
	h := hmac.New(sha256.New, []byte(bg.serverSeed))
	message := fmt.Sprintf("%s:%d:%d", bg.clientSeed, bg.nonce, bg.currentRound)
	h.Write([]byte(message))
	copy(bg.buffer[:], h.Sum(nil))
}

// GenerateFloats generates the specified number of floats using 4 bytes each
func GenerateFloats(serverSeed, clientSeed string, nonce uint64, cursor int, count int) []float64 {
	bg := NewByteGenerator(serverSeed, clientSeed, nonce, cursor)
	floats := make([]float64, count)
	
	for i := 0; i < count; i++ {
		// Use 4 bytes per float for precision
		b0 := bg.Next()
		b1 := bg.Next()
		b2 := bg.Next()
		b3 := bg.Next()
		
		// Convert bytes to float in range [0, 1)
		floats[i] = float64(b0)/256.0 + 
					float64(b1)/(256.0*256.0) + 
					float64(b2)/(256.0*256.0*256.0) + 
					float64(b3)/(256.0*256.0*256.0*256.0)
	}
	
	return floats
}