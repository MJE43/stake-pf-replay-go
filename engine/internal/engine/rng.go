package engine

import (
	"crypto/hmac"
	"crypto/sha256"
	"fmt"
	"math"
)

// ByteGenerator generates cryptographically secure bytes using HMAC-SHA256
// for streaming approach to float generation
type ByteGenerator struct {
	serverSeed         string
	clientSeed         string
	nonce             uint64
	currentRound      uint64
	currentPos        int
	buffer            [32]byte
}

// NewByteGenerator creates a new byte generator with the given parameters
func NewByteGenerator(serverSeed, clientSeed string, nonce uint64, cursor uint64) *ByteGenerator {
	bg := &ByteGenerator{
		serverSeed:   serverSeed,
		clientSeed:   clientSeed,
		nonce:       nonce,
		currentRound: cursor / 32,
		currentPos:   int(cursor % 32),
	}
	
	// Always generate the initial round
	bg.generateRound()
	
	return bg
}

// Next returns the next byte from the generator
func (bg *ByteGenerator) Next() byte {
	// Check if we need to advance to the next round
	if bg.currentPos >= 32 {
		bg.currentRound++
		bg.currentPos = 0
		bg.generateRound()
	}

	b := bg.buffer[bg.currentPos]
	bg.currentPos++
	return b
}

// NextFloat generates the next float using exactly 4 bytes
func (bg *ByteGenerator) NextFloat() float64 {
	b0 := bg.Next()
	b1 := bg.Next()
	b2 := bg.Next()
	b3 := bg.Next()
	
	return bytesToFloat([4]byte{b0, b1, b2, b3})
}

func (bg *ByteGenerator) generateRound() {
	h := hmac.New(sha256.New, []byte(bg.serverSeed))
	message := fmt.Sprintf("%s:%d:%d", bg.clientSeed, bg.nonce, bg.currentRound)
	h.Write([]byte(message))
	copy(bg.buffer[:], h.Sum(nil))
}

// bytesToFloat converts exactly 4 bytes to float64 using the specified formula
func bytesToFloat(bytes [4]byte) float64 {
	result := 0.0
	for i, b := range bytes {
		divider := math.Pow(256, float64(i+1))
		result += float64(b) / divider
	}
	return result
}

// Floats generates the specified number of floats starting from the given cursor
func Floats(serverSeed, clientSeed string, nonce uint64, cursor uint64, count int) []float64 {
	bg := NewByteGenerator(serverSeed, clientSeed, nonce, cursor)
	floats := make([]float64, count)
	
	for i := 0; i < count; i++ {
		floats[i] = bg.NextFloat()
	}
	
	return floats
}

// FloatsInto fills the provided slice with floats, avoiding allocation
func FloatsInto(dst []float64, serverSeed, clientSeed string, nonce uint64, cursor uint64, count int) []float64 {
	if len(dst) < count {
		dst = make([]float64, count)
	}
	
	bg := NewByteGenerator(serverSeed, clientSeed, nonce, cursor)
	
	for i := 0; i < count; i++ {
		dst[i] = bg.NextFloat()
	}
	
	return dst[:count]
}