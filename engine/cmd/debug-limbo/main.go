package main

import (
	"fmt"
	"math"

	"github.com/MJE43/stake-pf-replay-go/internal/engine"
)

func main() {
	serverSeed := "e48cce04b6eb5ea077f2cb1f94add672d18bf2673a5fdacd17457463cd82e495"
	clientSeed := "56e27fed-ece3-4279-ab56-96f71fe9b2ee"
	nonce := uint64(15600)
	
	// Generate the raw float
	floats := engine.Floats(serverSeed, clientSeed, nonce, 0, 1)
	f := floats[0]
	
	fmt.Printf("Raw float: %.16f\n", f)
	
	// Expected result from Stake
	expected := 1.8168711752541955
	
	// Try different formulas
	fmt.Println("\nTrying different formulas:")
	
	// Current implementation
	houseEdge := 0.99
	floatPoint := (1e8 / (f * 1e8)) * houseEdge
	crashPoint := math.Floor(floatPoint*100.0) / 100.0
	result1 := math.Max(crashPoint, 1.0)
	fmt.Printf("Current formula: %.16f\n", result1)
	
	// Try without floor/ceiling operations
	result2 := (1.0 / f) * houseEdge
	fmt.Printf("Simple division: %.16f\n", result2)
	
	// Try with different precision
	result3 := math.Max((1.0/f)*houseEdge, 1.0)
	fmt.Printf("Max with 1.0: %.16f\n", result3)
	
	// Try Stake's actual formula (reverse engineered)
	// If expected = 1.8168711752541955 and f = raw_float
	// Then: expected = ? * f or expected = ? / f
	
	// Check if it's a simple division
	if f != 0 {
		possibleDivisor := 1.0 / expected
		fmt.Printf("If result = 1/f, then f should be: %.16f\n", possibleDivisor)
		fmt.Printf("Actual f: %.16f\n", f)
		fmt.Printf("Difference: %.16f\n", math.Abs(f-possibleDivisor))
	}
	
	// Try with house edge
	possibleWithHE := (1.0 / expected) / houseEdge
	fmt.Printf("If result = (1/f)*houseEdge, then f should be: %.16f\n", possibleWithHE)
	fmt.Printf("Difference: %.16f\n", math.Abs(f-possibleWithHE))
	
	// Try exact Stake formula based on their documentation
	// Limbo uses: Math.floor((99 / (result * 100)) * 100) / 100
	// Reverse: result = 99 / (Math.floor(value * 100) * 100 / 100)
	
	// Let's try the exact Stake formula
	stakeResult := 99.0 / (f * 100.0)
	fmt.Printf("Stake formula (99/(f*100)): %.16f\n", stakeResult)
	
	// Try with proper rounding
	stakeResult2 := math.Floor(stakeResult*100.0) / 100.0
	stakeResult2 = math.Max(stakeResult2, 1.0)
	fmt.Printf("Stake formula with floor: %.16f\n", stakeResult2)
}